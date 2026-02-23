/**
 * Sync Service - Orchestrator
 *
 * Coordinates synchronization between local SQLite and Supabase.
 * Delegates to specialized modules for push/pull operations.
 *
 * Sync Order (respects foreign key dependencies):
 * PUSH: Streams → Locations → Entries → Attachments → Deletes
 * PULL: Streams → Locations → Entries → Attachments
 */

import { localDB } from '../db/localDB';
import { supabase, Entry } from '@trace/core';
import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import type { QueryClient } from '@tanstack/react-query';
import { getDeviceName } from '../utils/deviceUtils';
import { createScopedLogger } from '../utils/logger';

// Lazy imports to break circular dependencies
// mobileAttachmentApi imports syncApi, which imports this file
let _downloadAttachmentsInBackground: ((limit?: number) => Promise<void>) | null = null;
async function downloadAttachmentsInBackground(limit: number = 10): Promise<void> {
  if (!_downloadAttachmentsInBackground) {
    const module = await import('../../modules/attachments/mobileAttachmentApi');
    _downloadAttachmentsInBackground = module.downloadAttachmentsInBackground;
  }
  return _downloadAttachmentsInBackground(limit);
}

// Lazy import for location enrichment (geocode entries + fill location hierarchy)
let _geocodeEntries: (() => Promise<{ geocoded: number; noData: number; errors: number }>) | null = null;
let _enrichLocationHierarchy: (() => Promise<{ processed: number; errors: number }>) | null = null;
async function loadEnrichmentFunctions() {
  if (!_geocodeEntries || !_enrichLocationHierarchy) {
    const module = await import('../../modules/locations/mobileLocationApi');
    _geocodeEntries = module.geocodeEntries;
    _enrichLocationHierarchy = module.enrichLocationHierarchy;
  }
  return { geocodeEntries: _geocodeEntries!, enrichLocationHierarchy: _enrichLocationHierarchy! };
}
import {
  SyncResult,
  SyncStatus,
  SyncTrigger,
  createEmptySyncResult,
} from './syncTypes';

// Import extracted operations
import * as pushOps from './pushSyncOperations';
import * as pullOps from './pullSyncOperations';

// Re-export types for external consumers
export type { SyncResult, SyncStatus, SyncTrigger };

// Create scoped logger
const deviceName = getDeviceName();
const log = createScopedLogger(`Sync:${deviceName}`, '🔄');

// ============================================================================
// SYNC SERVICE CLASS
// ============================================================================

class SyncService {
  // Sync state
  private isSyncing = false;
  private isInitialized = false;
  private lastSyncTime: number | null = null;

  // React Query client for cache invalidation
  private queryClient: QueryClient | null = null;

  // Network state
  private networkUnsubscribe: (() => void) | null = null;
  private wasOffline = false;

  // Realtime subscription state
  private realtimeChannel: any = null;
  private realtimeDebounceTimer: NodeJS.Timeout | null = null;
  private realtimeReconnectTimer: NodeJS.Timeout | null = null;
  private realtimeReconnectAttempts = 0;
  private readonly REALTIME_MAX_BACKOFF_MS = 30000;

  // Track entries currently being pushed - prevents race condition with realtime
  private currentlyPushingEntryIds: Set<string> = new Set();

  // App foreground sync state
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private lastForegroundSyncTime: number = 0;
  private readonly MIN_FOREGROUND_SYNC_INTERVAL_MS = 30000;

  // Post-sync enrichment state
  private isEnriching = false;

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  async initialize(queryClient?: QueryClient): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;
    if (queryClient) {
      this.queryClient = queryClient;
    }

    log.debug('Initializing sync service');

    // Clean up data from previous users
    await this.cleanupWrongUserData();

    // Set up realtime subscription for server changes
    await this.setupRealtimeSubscription();

    // Set up network reconnect listener
    this.setupNetworkListener();

    // Set up app state listener for foreground sync
    this.setupAppStateListener();

    log.debug('Sync service initialized');

    // Trigger initial sync on app start (non-blocking)
    this.lastForegroundSyncTime = Date.now();
    this.fullSync('app-foreground').catch(err => {
      log.error('Initial sync failed', err);
    });
  }

  destroy(): void {
    if (this.realtimeDebounceTimer) {
      clearTimeout(this.realtimeDebounceTimer);
    }
    if (this.realtimeReconnectTimer) {
      clearTimeout(this.realtimeReconnectTimer);
      this.realtimeReconnectTimer = null;
    }
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      log.debug('Realtime subscription removed');
    }
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
      log.debug('Network listener removed');
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
      log.debug('AppState listener removed');
    }
    this.realtimeReconnectAttempts = 0;
    this.isInitialized = false;
    log.debug('Sync service destroyed');
  }

  // ==========================================================================
  // PUBLIC SYNC METHODS
  // ==========================================================================

  async fullSync(trigger: SyncTrigger = 'manual'): Promise<SyncResult> {
    return this.executeSync(trigger, { push: true, pull: true });
  }

  async pushChanges(trigger: SyncTrigger = 'post-save'): Promise<SyncResult> {
    return this.executeSync(trigger, { push: true, pull: false });
  }

  async pullChanges(trigger: SyncTrigger = 'app-foreground'): Promise<SyncResult> {
    return this.executeSync(trigger, { push: false, pull: true });
  }

  async pullEntry(entryId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data: serverEntry, error } = await supabase
        .from('entries')
        .select('*')
        .eq('entry_id', entryId)
        .eq('user_id', user.id)
        .single();

      if (error || !serverEntry) {
        log.warn('Failed to pull entry from server', { entryId, error });
        return false;
      }

      const entry: Entry = {
        entry_id: serverEntry.entry_id,
        user_id: serverEntry.user_id,
        title: serverEntry.title,
        content: serverEntry.content,
        tags: serverEntry.tags || [],
        mentions: serverEntry.mentions || [],
        stream_id: serverEntry.stream_id,
        entry_latitude: serverEntry.entry_latitude || null,
        entry_longitude: serverEntry.entry_longitude || null,
        location_id: serverEntry.location_id || null,
        // Location hierarchy (owned by entry)
        place_name: serverEntry.place_name || null,
        address: serverEntry.address || null,
        neighborhood: serverEntry.neighborhood || null,
        postal_code: serverEntry.postal_code || null,
        city: serverEntry.city || null,
        subdivision: serverEntry.subdivision || null,
        region: serverEntry.region || null,
        country: serverEntry.country || null,
        geocode_status: (serverEntry as any).geocode_status || null,
        status: (serverEntry.status as Entry['status']) || 'none',
        type: serverEntry.type || null,
        due_date: serverEntry.due_date,
        completed_at: serverEntry.completed_at,
        entry_date: serverEntry.entry_date || serverEntry.created_at,
        created_at: serverEntry.created_at,
        updated_at: serverEntry.updated_at,
        deleted_at: serverEntry.deleted_at,
        attachments: serverEntry.attachments,
        priority: serverEntry.priority || 0,
        rating: serverEntry.rating || 0.00,
        is_pinned: serverEntry.is_pinned || false,
        is_archived: (serverEntry as any).is_archived || false,
        local_only: 0,
        synced: 1,
        sync_action: null,
        version: serverEntry.version || 1,
        base_version: serverEntry.version || 1,
        conflict_status: (serverEntry.conflict_status as Entry['conflict_status']) || null,
        conflict_backup: typeof serverEntry.conflict_backup === 'string' ? serverEntry.conflict_backup : null,
        last_edited_by: serverEntry.last_edited_by || null,
        last_edited_device: serverEntry.last_edited_device || null,
      };

      await localDB.updateEntry(entryId, entry);
      await localDB.markSynced(entryId);

      if (this.queryClient) {
        this.queryClient.setQueryData(['entry', entryId], entry);
      }

      log.debug('Entry pulled from server', { entryId, version: entry.version });
      return true;
    } catch (error) {
      log.error('Error pulling entry', { entryId, error });
      return false;
    }
  }

  async forcePull(): Promise<SyncResult> {
    return this.executeSync('manual', { push: false, pull: true, forceFullPull: true });
  }

  async getStatus(): Promise<SyncStatus> {
    const unsyncedCount = await localDB.getUnsyncedCount();
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      unsyncedCount,
    };
  }

  // ==========================================================================
  // CORE SYNC EXECUTION
  // ==========================================================================

  private async executeSync(
    trigger: SyncTrigger,
    options: { push?: boolean; pull?: boolean; forceFullPull?: boolean }
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result = createEmptySyncResult();

    if (this.isSyncing) {
      log.debug('Sync already in progress, skipping');
      return result;
    }

    if (!await this.canSync()) {
      log.debug('Cannot sync (offline or not authenticated)');
      return result;
    }

    this.isSyncing = true;
    log.debug(`SYNC STARTED (${trigger})`);

    try {
      const forceFullPull = options.forceFullPull || false;
      const pullStartTime = new Date();

      // PULL FIRST: Server → Local (for streams/locations that entries depend on)
      if (options.pull) {
        const streamResult = await pullOps.pullStreams(forceFullPull);
        result.pulled.streams = streamResult.new + streamResult.updated;

        const locationResult = await pullOps.pullLocations(forceFullPull);
        result.pulled.locations = locationResult.new + locationResult.updated;
      }

      // PUSH: Local → Server
      if (options.push) {
        const localOnlyStreamIds = await this.getLocalOnlyStreamIds();

        // Push streams
        const streamResult = await pushOps.pushStreams();
        result.pushed.streams = streamResult.success;
        result.errors.streams = streamResult.errors;

        // Push locations
        const locationResult = await pushOps.pushLocations();
        result.pushed.locations = locationResult.success;
        result.errors.locations = locationResult.errors;

        // Push entries with tracking callbacks
        const markPushing = (id: string) => this.currentlyPushingEntryIds.add(id);
        const unmarkPushing = (id: string) => this.currentlyPushingEntryIds.delete(id);

        const entryResult = await pushOps.pushEntries(localOnlyStreamIds, markPushing, unmarkPushing);
        result.pushed.entries = entryResult.success;
        result.errors.entries = entryResult.errors;

        // Push attachments
        const attachmentResult = await pushOps.pushAttachments(localOnlyStreamIds);
        result.pushed.attachments = attachmentResult.success;
        result.errors.attachments = attachmentResult.errors;

        // Push entry deletes
        const deleteResult = await pushOps.pushEntryDeletes(localOnlyStreamIds, markPushing, unmarkPushing);
        result.pushed.entries += deleteResult.success;
        result.errors.entries += deleteResult.errors;

        const totalPushed = result.pushed.entries + result.pushed.streams + result.pushed.locations + result.pushed.attachments;
        if (totalPushed > 0) {
          log.debug(`PUSHED ${totalPushed} items`, result.pushed);
        }
      }

      // PULL REMAINING: entries and attachments
      if (options.pull) {
        const entryResult = await pullOps.pullEntries(
          forceFullPull,
          pullStartTime,
          pullOps.getLastPullTimestamp
        );
        result.pulled.entries = entryResult.new + entryResult.updated;

        const attachmentResult = await pullOps.pullAttachments(forceFullPull);
        result.pulled.attachments = attachmentResult.new + attachmentResult.updated + attachmentResult.deleted;

        await pullOps.saveLastPullTimestamp(pullStartTime);

        const totalPulled = result.pulled.entries + result.pulled.streams + result.pulled.locations + result.pulled.attachments;
        if (totalPulled > 0) {
          log.debug(`PULLED ${totalPulled} items`, result.pulled);
        }
      }

      // Invalidate cache if we pulled new data
      const totalPulled = result.pulled.entries + result.pulled.streams + result.pulled.locations + result.pulled.attachments;
      if (totalPulled > 0) {
        this.invalidateQueryCache();
      }

      // Background attachment download
      this.startBackgroundAttachmentDownload();

      // Background enrichment — geocode entries + fill location hierarchy
      this.startBackgroundEnrichment();

      result.success = true;
      result.duration = Date.now() - startTime;

      await this.logSyncResult(trigger, result);

      const totalPushed = result.pushed.entries + result.pushed.streams + result.pushed.locations + result.pushed.attachments;
      log.debug(`SYNC FINISHED in ${(result.duration / 1000).toFixed(1)}s | pushed: ${totalPushed} | pulled: ${totalPulled}`);

    } catch (error) {
      result.duration = Date.now() - startTime;
      log.error('SYNC FAILED', error);
      await localDB.addSyncLog('error', 'sync', `Sync failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isSyncing = false;
      this.lastSyncTime = Date.now();
    }

    return result;
  }

  // ==========================================================================
  // REALTIME SUBSCRIPTION
  // ==========================================================================

  private async setupRealtimeSubscription(): Promise<void> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        const errorMessage = authError.message || String(authError);
        // Network errors during auth are expected when reconnecting
        if (errorMessage.includes('Network request failed') || errorMessage.includes('fetch')) {
          log.debug('Auth check failed due to network (will retry)', { error: errorMessage });
        } else {
          log.warn('Auth check failed during realtime setup', { error: errorMessage });
        }
        throw authError;
      }
      if (!user) {
        log.debug('Not authenticated, skipping realtime setup');
        return;
      }

      log.info('📡 Setting up global realtime subscription for all tables...', { userId: user.id });

      this.realtimeChannel = supabase
        .channel('db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, (payload) => {
          this.processEntryRealtimeEvent(payload).catch(err => {
            log.error('Failed to process entry realtime event', err);
          });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'streams' }, (payload) => {
          this.processStreamRealtimeEvent(payload).catch(err => {
            log.error('Failed to process stream realtime event', err);
          });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments' }, (payload) => {
          const entryId = (payload.new as any)?.entry_id || (payload.old as any)?.entry_id;
          log.info('📡 Attachments realtime event received', { eventType: payload.eventType, entryId });
          this.handleRealtimeChange('attachments', entryId);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, (payload) => {
          log.info('📡 Locations realtime event received', { eventType: payload.eventType });
          this.handleRealtimeChange('locations');
        })
        .subscribe(async (status, err) => {
          if (status === 'SUBSCRIBED') {
            log.info('✅ Global realtime subscription ACTIVE for entries/streams/attachments/locations');
            this.realtimeReconnectAttempts = 0;
            if (this.realtimeReconnectTimer) {
              clearTimeout(this.realtimeReconnectTimer);
              this.realtimeReconnectTimer = null;
            }
          } else if (status === 'CHANNEL_ERROR') {
            const netState = await NetInfo.fetch().catch(() => ({ isConnected: false, isInternetReachable: false }));
            if (!netState.isConnected || !netState.isInternetReachable) {
              log.debug('Realtime subscription failed (expected - device is offline)');
            } else {
              log.warn('Realtime subscription failed, will reconnect', { error: err });
              this.scheduleRealtimeReconnect();
            }
          } else if (status === 'TIMED_OUT') {
            const netState = await NetInfo.fetch().catch(() => ({ isConnected: false, isInternetReachable: false }));
            if (!netState.isConnected || !netState.isInternetReachable) {
              log.debug('Realtime subscription timed out (expected - device is offline)');
            } else {
              log.warn('Realtime subscription timed out, will reconnect');
              this.scheduleRealtimeReconnect();
            }
          } else if (status === 'CLOSED') {
            log.info('🔒 Global realtime subscription CLOSED');
            if (this.isInitialized) {
              this.scheduleRealtimeReconnect();
            }
          } else {
            log.debug('Global realtime status', { status });
          }
        });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Distinguish between network errors (expected during reconnection) and other errors
      if (errorMessage.includes('Network request failed') || errorMessage.includes('fetch')) {
        log.debug('Realtime setup failed due to network (will retry)', { error: errorMessage });
      } else {
        log.error('Failed to set up realtime subscription', { error: errorMessage });
      }
      this.scheduleRealtimeReconnect();
    }
  }

  private scheduleRealtimeReconnect(): void {
    if (!this.isInitialized || this.realtimeReconnectTimer) {
      return;
    }

    const backoffMs = Math.min(
      1000 * Math.pow(2, this.realtimeReconnectAttempts),
      this.REALTIME_MAX_BACKOFF_MS
    );

    log.info(`🔄 Scheduling realtime reconnect in ${backoffMs / 1000}s (attempt ${this.realtimeReconnectAttempts + 1})`);

    this.realtimeReconnectTimer = setTimeout(async () => {
      this.realtimeReconnectTimer = null;
      this.realtimeReconnectAttempts++;

      const netState = await NetInfo.fetch();
      if (!netState.isConnected || !netState.isInternetReachable) {
        log.debug('Skipping realtime reconnect - device is offline');
        return;
      }

      log.info('🔄 Attempting realtime reconnect...');

      if (this.realtimeChannel) {
        try {
          await supabase.removeChannel(this.realtimeChannel);
        } catch (e) {
          // Ignore cleanup errors
        }
        this.realtimeChannel = null;
      }

      await this.setupRealtimeSubscription();
    }, backoffMs);
  }

  // ==========================================================================
  // REALTIME EVENT PROCESSING
  // ==========================================================================

  private async processEntryRealtimeEvent(payload: any): Promise<void> {
    const entryId = (payload.new as any)?.entry_id || (payload.old as any)?.entry_id;
    const eventType = payload.eventType;

    if (!entryId) {
      log.debug('📡 Ignoring realtime event - no entry ID');
      return;
    }

    log.info('📡 REALTIME EVENT RECEIVED', {
      entryId: entryId.substring(0, 8),
      eventType,
      remoteVersion: (payload.new as any)?.version,
      isPushing: this.currentlyPushingEntryIds.has(entryId),
    });

    // Skip if we're currently pushing this entry
    if (this.currentlyPushingEntryIds.has(entryId)) {
      log.info('📡 SKIPPED - currently pushing', { entryId: entryId.substring(0, 8) });
      return;
    }

    // For DELETE events, remove directly from LocalDB and cache
    if (eventType === 'DELETE') {
      log.info('📡 Entry DELETE event received - removing from local', { entryId });
      try {
        await localDB.deleteEntry(entryId);
      } catch (err) {
        log.warn('Failed to delete entry from LocalDB', { entryId, error: err });
      }
      this.removeEntryFromCache(entryId);
      return;
    }

    // For INSERT/UPDATE, check version against LocalDB
    const remoteVersion = (payload.new as any)?.version || 1;
    const localEntry = await localDB.getEntry(entryId);

    if (localEntry) {
      const localVersion = localEntry.base_version || 1;

      log.info('📡 VERSION CHECK', {
        entryId: entryId.substring(0, 8),
        remoteVersion,
        localBaseVersion: localVersion,
        localVersion: localEntry.version,
        localSynced: localEntry.synced,
        willSkip: remoteVersion <= localVersion,
      });

      if (remoteVersion <= localVersion) {
        log.info('📡 SKIPPED - version up to date', { entryId: entryId.substring(0, 8) });
        return;
      }

      if (localEntry.synced === 0) {
        log.info('📡 SKIPPED - local changes pending', { entryId: entryId.substring(0, 8) });
        return;
      }
    }

    // New entry or newer version - update LocalDB directly from payload
    const isNewEntry = !localEntry;
    log.info('📡 APPLYING REALTIME UPDATE', {
      entryId: entryId.substring(0, 8),
      eventType,
      remoteVersion,
      isNewEntry,
    });

    const updatedEntry = await this.updateEntryFromPayload(entryId, payload.new);

    if (isNewEntry) {
      // INSERT: Invalidate queries to trigger refetch
      log.info('📡 New entry from remote - invalidating entry queries', { entryId: entryId.substring(0, 8) });
      this.invalidateEntryQueries();
    } else {
      // UPDATE: Patch the cache directly
      this.setEntryQueryData(entryId, updatedEntry);
    }
  }

  private async updateEntryFromPayload(entryId: string, payloadData: any): Promise<Entry | null> {
    if (!payloadData) {
      log.warn('No payload data to update entry', { entryId });
      return null;
    }

    // Re-check version to prevent race conditions
    const localEntry = await localDB.getEntry(entryId);
    const remoteVersion = payloadData.version || 1;

    if (localEntry) {
      const localBaseVersion = localEntry.base_version || 1;
      if (remoteVersion <= localBaseVersion) {
        log.debug('Version check failed on write (race condition prevented)', { entryId, remoteVersion, localBaseVersion });
        return localEntry;
      }
    }

    const entry: Entry = {
      entry_id: payloadData.entry_id,
      user_id: payloadData.user_id,
      title: payloadData.title,
      content: payloadData.content,
      tags: payloadData.tags || [],
      mentions: payloadData.mentions || [],
      stream_id: payloadData.stream_id,
      entry_latitude: payloadData.entry_latitude || null,
      entry_longitude: payloadData.entry_longitude || null,
      location_id: payloadData.location_id || null,
      // Location hierarchy (owned by entry)
      place_name: payloadData.place_name || null,
      address: payloadData.address || null,
      neighborhood: payloadData.neighborhood || null,
      postal_code: payloadData.postal_code || null,
      city: payloadData.city || null,
      subdivision: payloadData.subdivision || null,
      region: payloadData.region || null,
      country: payloadData.country || null,
      geocode_status: payloadData.geocode_status || null,
      status: (payloadData.status as Entry['status']) || 'none',
      type: payloadData.type || null,
      due_date: payloadData.due_date,
      completed_at: payloadData.completed_at,
      entry_date: payloadData.entry_date || payloadData.created_at,
      created_at: payloadData.created_at,
      updated_at: payloadData.updated_at,
      deleted_at: payloadData.deleted_at,
      attachments: payloadData.attachments,
      priority: payloadData.priority || 0,
      rating: payloadData.rating || 0.00,
      is_pinned: payloadData.is_pinned || false,
      is_archived: payloadData.is_archived || false,
      local_only: 0,
      synced: 1,
      sync_action: null,
      version: remoteVersion,
      base_version: remoteVersion,
      conflict_status: (payloadData.conflict_status as Entry['conflict_status']) || null,
      conflict_backup: typeof payloadData.conflict_backup === 'string' ? payloadData.conflict_backup : null,
      last_edited_by: payloadData.last_edited_by || null,
      last_edited_device: payloadData.last_edited_device || null,
    };

    if (localEntry) {
      await localDB.updateEntry(entryId, entry);
    } else {
      await localDB.saveEntry(entry);
    }
    await localDB.markSynced(entryId);

    log.debug('Entry updated from realtime payload', { entryId, version: remoteVersion });
    return entry;
  }

  private invalidateEntryQueries(): void {
    if (!this.queryClient) return;
    this.queryClient.invalidateQueries({ queryKey: ['entries'] });
    this.queryClient.invalidateQueries({ queryKey: ['entryCounts'] });
    this.queryClient.invalidateQueries({ queryKey: ['streams'] });
    this.queryClient.invalidateQueries({ queryKey: ['locations'] });
  }

  private setEntryQueryData(entryId: string, entry: Entry | null): void {
    if (!this.queryClient || !entry) return;

    this.queryClient.setQueryData(['entry', entryId], entry);

    this.queryClient.setQueriesData(
      { queryKey: ['entries'] },
      (oldData: Entry[] | undefined) => {
        if (!oldData) return oldData;
        const index = oldData.findIndex(e => e.entry_id === entryId);
        if (index === -1) return oldData;
        const newData = [...oldData];
        newData[index] = entry;
        return newData;
      }
    );

    log.debug('Patched React Query cache for entry', { entryId, version: entry.version });
  }

  private removeEntryFromCache(entryId: string): void {
    if (!this.queryClient) return;

    this.queryClient.removeQueries({ queryKey: ['entry', entryId] });

    this.queryClient.setQueriesData(
      { queryKey: ['entries'] },
      (oldData: Entry[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.filter(e => e.entry_id !== entryId);
      }
    );

    this.queryClient.invalidateQueries({ queryKey: ['entryCounts'] });
    this.queryClient.invalidateQueries({ queryKey: ['streams'] });

    log.debug('Removed entry from React Query cache', { entryId });
  }

  private async processStreamRealtimeEvent(payload: any): Promise<void> {
    const streamId = (payload.new as any)?.stream_id || (payload.old as any)?.stream_id;
    const eventType = payload.eventType;

    if (!streamId) {
      log.debug('📡 Ignoring stream realtime event - no stream ID');
      return;
    }

    log.info('📡 Stream realtime event', { streamId, eventType });

    if (eventType === 'DELETE') {
      await localDB.runCustomQuery('DELETE FROM streams WHERE stream_id = ?', [streamId]);
      if (this.queryClient) {
        this.queryClient.invalidateQueries({ queryKey: ['streams'] });
      }
      return;
    }

    // For INSERT/UPDATE, update from payload
    const payloadData = payload.new as any;
    if (payloadData) {
      await this.updateStreamFromPayload(streamId, payloadData);
    }

    if (this.queryClient) {
      this.queryClient.invalidateQueries({ queryKey: ['streams'] });
    }
  }

  private async updateStreamFromPayload(streamId: string, payloadData: any): Promise<void> {
    const localStream = await localDB.getStream(streamId);

    // Skip if local has unsynced changes
    if (localStream && localStream.synced === 0) {
      log.debug('Skipping stream update - local changes pending', { streamId });
      return;
    }

    const stream = {
      stream_id: payloadData.stream_id,
      user_id: payloadData.user_id,
      name: payloadData.name,
      entry_count: payloadData.entry_count || 0,
      color: payloadData.color,
      icon: payloadData.icon,
      created_at: payloadData.created_at,
      updated_at: payloadData.updated_at,
      entry_title_template: payloadData.entry_title_template,
      entry_content_template: payloadData.entry_content_template,
      entry_use_rating: payloadData.entry_use_rating,
      entry_rating_type: payloadData.entry_rating_type,
      entry_use_priority: payloadData.entry_use_priority,
      entry_use_status: payloadData.entry_use_status,
      entry_use_duedates: payloadData.entry_use_duedates,
      entry_use_location: payloadData.entry_use_location,
      entry_use_photos: payloadData.entry_use_photos,
      entry_content_type: payloadData.entry_content_type,
      entry_statuses: payloadData.entry_statuses,
      entry_default_status: payloadData.entry_default_status,
      entry_use_type: payloadData.entry_use_type,
      entry_types: payloadData.entry_types,
      is_private: payloadData.is_private,
      synced: 1,
      sync_action: null,
    };

    if (localStream) {
      await localDB.updateStream(streamId, stream);
    } else {
      await localDB.saveStream(stream);
    }
    await localDB.markStreamSynced(streamId);

    log.debug('Stream updated from realtime payload', { streamId });
  }

  private handleRealtimeChange(table: string, entryId?: string): void {
    // Debounce realtime changes to batch multiple events
    if (this.realtimeDebounceTimer) {
      clearTimeout(this.realtimeDebounceTimer);
    }

    this.realtimeDebounceTimer = setTimeout(async () => {
      this.realtimeDebounceTimer = null;

      log.debug('Processing debounced realtime change', { table, entryId });

      try {
        await this.pullChanges('realtime');
      } catch (error) {
        log.error('Failed to process realtime change', { table, error });
      }
    }, 2000);
  }

  // ==========================================================================
  // APP STATE & NETWORK LISTENERS
  // ==========================================================================

  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        const now = Date.now();
        const timeSinceLastSync = now - this.lastForegroundSyncTime;

        if (timeSinceLastSync > this.MIN_FOREGROUND_SYNC_INTERVAL_MS) {
          this.lastForegroundSyncTime = now;
          log.info('App came to foreground, triggering sync');
          this.fullSync('app-foreground').catch(err => {
            log.error('Foreground sync failed', err);
          });
        } else {
          log.debug('App came to foreground, skipping sync (too soon)', {
            timeSinceLastSync,
            minInterval: this.MIN_FOREGROUND_SYNC_INTERVAL_MS,
          });
        }
      }
    });
    log.debug('AppState listener set up');
  }

  private setupNetworkListener(): void {
    NetInfo.fetch().then(state => {
      this.wasOffline = !state.isConnected || !state.isInternetReachable;
      log.debug('Initial network state', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        wasOffline: this.wasOffline
      });
    });

    this.networkUnsubscribe = NetInfo.addEventListener(state => {
      const isOnline = state.isConnected && state.isInternetReachable;

      log.debug('Network state changed', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        wasOffline: this.wasOffline,
        isOnline,
      });

      if (this.wasOffline && isOnline) {
        log.info('Network reconnected, syncing queued changes...');
        this.handleReconnect();
      }

      this.wasOffline = !isOnline;
    });

    log.debug('Network listener set up');
  }

  private async handleReconnect(): Promise<void> {
    this.realtimeReconnectAttempts = 0;

    if (this.realtimeReconnectTimer) {
      clearTimeout(this.realtimeReconnectTimer);
      this.realtimeReconnectTimer = null;
    }

    // Small delay to let network stabilize after reconnection
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Re-check network state after delay (connection may have dropped again)
    const netState = await NetInfo.fetch().catch(() => ({ isConnected: false, isInternetReachable: false }));
    if (!netState.isConnected || !netState.isInternetReachable) {
      log.debug('Network not stable after reconnect delay, skipping');
      return;
    }

    if (!this.realtimeChannel) {
      log.info('Reconnecting realtime subscription...');
      try {
        await this.setupRealtimeSubscription();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.warn('Failed to reconnect realtime subscription', { error: errorMessage });
        // Schedule retry via normal reconnect flow
        this.scheduleRealtimeReconnect();
      }
    }

    if (this.isSyncing) {
      log.debug('Sync already in progress, skipping reconnect sync');
      return;
    }

    try {
      await this.fullSync('app-foreground');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Reconnect sync failed', { error: errorMessage });
    }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private async canSync(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const netState = await NetInfo.fetch();
    return !!(netState.isConnected && netState.isInternetReachable);
  }

  private async getLocalOnlyStreamIds(): Promise<Set<string>> {
    const localOnlyStreams = await localDB.runCustomQuery(
      'SELECT stream_id FROM streams WHERE is_localonly = 1',
      []
    );
    return new Set<string>(localOnlyStreams.map((s: any) => s.stream_id));
  }

  private async cleanupWrongUserData(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const entriesFromOtherUsers = await localDB.runCustomQuery(
        'SELECT entry_id FROM entries WHERE user_id != ? LIMIT 1',
        [user.id]
      );

      if (entriesFromOtherUsers.length > 0) {
        log.warn('Found entries from other users, clearing all local data');
        await localDB.clearAllData();
      }
    } catch (error) {
      log.error('Failed to cleanup wrong user data', error);
    }
  }

  private invalidateQueryCache(entryIds?: string[]): void {
    if (this.queryClient) {
      log.info('🔄 [Sync] Invalidating React Query cache', { entryIds: entryIds?.length || 0 });

      this.queryClient.invalidateQueries({ queryKey: ['entries'] });
      this.queryClient.invalidateQueries({ queryKey: ['streams'] });
      this.queryClient.invalidateQueries({ queryKey: ['locations'] });
      this.queryClient.invalidateQueries({ queryKey: ['unsyncedCount'] });
      this.queryClient.invalidateQueries({ queryKey: ['entryCounts'] });
      this.queryClient.invalidateQueries({ queryKey: ['tags'] });
      this.queryClient.invalidateQueries({ queryKey: ['mentions'] });

      if (entryIds && entryIds.length > 0) {
        for (const entryId of entryIds) {
          this.queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
        }
      }
    }
  }

  private startBackgroundAttachmentDownload(): void {
    setTimeout(() => {
      downloadAttachmentsInBackground(10).catch((error: unknown) => {
        log.warn('Background attachment download error', { error });
      });
    }, 1000);
  }

  /**
   * Run geocoding for entries and hierarchy enrichment for saved locations.
   * Fire-and-forget after sync — fills in missing address/city/region data.
   * Items with no geocode data (e.g. middle of ocean) get marked 'no_data' and won't retry.
   */
  private startBackgroundEnrichment(): void {
    if (this.isEnriching) return;
    this.isEnriching = true;

    loadEnrichmentFunctions()
      .then(async ({ geocodeEntries, enrichLocationHierarchy }) => {
        const entryResult = await geocodeEntries();
        const locationResult = await enrichLocationHierarchy();

        const total = entryResult.geocoded + locationResult.processed;
        if (total > 0) {
          log.info(`Enrichment: ${entryResult.geocoded} entries geocoded, ${locationResult.processed} locations enriched`);
          this.invalidateQueryCache();
        }
      })
      .catch((error: unknown) => {
        log.warn('Background enrichment error', { error });
      })
      .finally(() => {
        this.isEnriching = false;
      });
  }

  private async logSyncResult(trigger: SyncTrigger, result: SyncResult): Promise<void> {
    const hasErrors = result.errors.entries > 0 || result.errors.streams > 0 ||
                      result.errors.locations > 0 || result.errors.attachments > 0;
    const logLevel = hasErrors ? 'warning' : 'info';

    const totalPushed = result.pushed.entries + result.pushed.streams +
                        result.pushed.locations + result.pushed.attachments;
    const totalPulled = result.pulled.entries + result.pulled.streams +
                        result.pulled.locations + result.pulled.attachments;
    const totalErrors = result.errors.entries + result.errors.streams +
                        result.errors.locations + result.errors.attachments;

    let message = `Sync (${trigger}) completed in ${(result.duration / 1000).toFixed(1)}s`;
    if (totalPushed > 0) message += ` - Pushed: ${totalPushed}`;
    if (totalPulled > 0) message += ` - Pulled: ${totalPulled}`;
    if (totalErrors > 0) message += ` - Errors: ${totalErrors}`;

    await localDB.addSyncLog(logLevel, 'sync', message, {
      entries_pushed: result.pushed.entries,
      entries_errors: result.errors.entries,
      streams_pushed: result.pushed.streams,
      streams_errors: result.errors.streams,
      attachments_pushed: result.pushed.attachments,
      attachments_errors: result.errors.attachments,
      entries_pulled: result.pulled.entries,
    });
  }
}

// Export singleton instance
export const syncService = new SyncService();
