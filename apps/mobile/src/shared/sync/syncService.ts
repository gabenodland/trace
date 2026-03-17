/**
 * Sync Service - Orchestrator
 *
 * Coordinates synchronization between local SQLite and Supabase.
 * Delegates to specialized modules for push/pull operations.
 *
 * Sync Order (respects foreign key dependencies):
 * PUSH: Streams → Locations → Entries → Attachments → Entry Versions → Deletes
 * PULL: Streams → Locations → Entries → Attachments → Entry Versions
 */

import { localDB } from '../db/localDB';
import { supabase, Entry } from '@trace/core';
import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import type { QueryClient } from '@tanstack/react-query';
import { getDeviceName } from '../utils/deviceUtils';
import { createScopedLogger } from '../utils/logger';
import { isNetworkError } from '../utils/networkUtils';
import { createSyncOverwriteIfNeeded } from '../../modules/versions/syncOverwriteHelper';
import { remoteToEntry } from './pullSyncOperations';

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

  // Status listeners — notified when isSyncing or lastSyncTime changes
  private statusListeners = new Set<(status: SyncStatus) => void>();

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

  // Debounce timer for realtime INSERT invalidations (batches rapid-fire events)
  private realtimeInsertDebounceTimer: NodeJS.Timeout | null = null;
  // Debounce timer for realtime stream invalidations
  private realtimeStreamDebounceTimer: NodeJS.Timeout | null = null;

  // Track entries currently being pushed - prevents race condition with realtime
  private currentlyPushingEntryIds: Set<string> = new Set();

  // Suppress realtime DELETE events during batch operations (tombstone push, purge)
  private suppressRealtimeDeletes: boolean = false;

  // App foreground sync state
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private lastForegroundSyncTime: number = 0;
  private readonly MIN_FOREGROUND_SYNC_INTERVAL_MS = 30000;

  // Post-sync enrichment state
  private isEnriching = false;

  // Cached device ID for realtime revocation checks
  private localDeviceId: string | null = null;
  private isSigningOut = false;

  // Device last_seen_at throttle
  private lastDeviceSeenUpdateTime: number = 0;
  private readonly DEVICE_SEEN_UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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

    // Cache device ID for revocation checks
    try {
      const { getDeviceId } = await import('../../config/appVersionService');
      this.localDeviceId = await getDeviceId();
    } catch (err) {
      log.error('Failed to cache device ID', err);
    }

    // Clean up data from previous users
    await this.cleanupWrongUserData();

    // Purge expired trash (entries deleted 30+ days ago)
    localDB.purgeExpiredTrash(30).catch(err => {
      log.warn('Failed to purge expired trash', err);
    });

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
      this.realtimeDebounceTimer = null;
    }
    if (this.realtimeInsertDebounceTimer) {
      clearTimeout(this.realtimeInsertDebounceTimer);
      this.realtimeInsertDebounceTimer = null;
    }
    if (this.realtimeStreamDebounceTimer) {
      clearTimeout(this.realtimeStreamDebounceTimer);
      this.realtimeStreamDebounceTimer = null;
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
    this.statusListeners.clear();
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

      const entry = remoteToEntry(serverEntry);

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

  /** Synchronous snapshot — unsyncedCount may be stale but isSyncing/lastSyncTime are always current */
  getStatusSync(): SyncStatus {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      unsyncedCount: 0, // Callers needing accurate count should use async getStatus()
    };
  }

  /** Subscribe to sync status changes. Returns unsubscribe function. */
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => { this.statusListeners.delete(listener); };
  }

  /** Notify all listeners of current status */
  private notifyStatusListeners(): void {
    const status = this.getStatusSync();
    for (const listener of this.statusListeners) {
      listener(status);
    }
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

    // Check if this device has been deactivated (only on foreground/reconnect, not post-save)
    if (trigger !== 'post-save' && !await this.checkDeviceActive()) {
      return result;
    }

    this.isSyncing = true;
    this.notifyStatusListeners();
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

        // Push entry versions (after entries + attachments are on server)
        const entryVersionResult = await pushOps.pushEntryVersions();
        result.pushed.entry_versions = entryVersionResult.success;
        result.errors.entry_versions = entryVersionResult.errors;

        // Push entry deletes
        const deleteResult = await pushOps.pushEntryDeletes(localOnlyStreamIds, markPushing, unmarkPushing);
        result.pushed.entries += deleteResult.success;
        result.errors.entries += deleteResult.errors;

        // Push tombstones (hard-deletes to server) — suppress realtime DELETE events
        this.suppressRealtimeDeletes = true;
        try {
          const tombstoneResult = await pushOps.pushTombstones();
          result.pushed.entries += tombstoneResult.success;
          result.errors.entries += tombstoneResult.errors;
        } finally {
          this.suppressRealtimeDeletes = false;
        }

        const totalPushed = result.pushed.entries + result.pushed.streams + result.pushed.locations + result.pushed.attachments + result.pushed.entry_versions;
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

        // Pull entry versions (after entries exist locally)
        const entryVersionResult = await pullOps.pullEntryVersions(forceFullPull);
        result.pulled.entry_versions = entryVersionResult.new + entryVersionResult.updated;

        // Pull tombstones (hard-deletes from other devices)
        const tombstoneResult = await pullOps.pullTombstones();
        result.pulled.entries += tombstoneResult.deleted;

        await pullOps.saveLastPullTimestamp(pullStartTime);

        const totalPulled = result.pulled.entries + result.pulled.streams + result.pulled.locations + result.pulled.attachments + result.pulled.entry_versions;
        if (totalPulled > 0) {
          log.debug(`PULLED ${totalPulled} items`, result.pulled);
        }
      }

      // Invalidate cache if we pulled new data
      const totalPulled = result.pulled.entries + result.pulled.streams + result.pulled.locations + result.pulled.attachments + result.pulled.entry_versions;
      if (totalPulled > 0) {
        this.invalidateQueryCache();
      }

      // Background attachment download
      this.startBackgroundAttachmentDownload();

      // Background enrichment — geocode entries + fill location hierarchy
      this.startBackgroundEnrichment();

      result.success = true;
      result.duration = Date.now() - startTime;

      // Update device last_seen_at after successful sync (R4: sync heartbeat)
      this.updateDeviceLastSeen().catch(err => {
        log.debug('Failed to update device last_seen_at', { error: err instanceof Error ? err.message : String(err) });
      });

      await this.logSyncResult(trigger, result);

      const totalPushed = result.pushed.entries + result.pushed.streams + result.pushed.locations + result.pushed.attachments;
      log.debug(`SYNC FINISHED in ${(result.duration / 1000).toFixed(1)}s | pushed: ${totalPushed} | pulled: ${totalPulled}`);

    } catch (error) {
      result.duration = Date.now() - startTime;
      if (isNetworkError(error)) {
        log.debug('Sync skipped (offline)');
      } else {
        log.error('SYNC FAILED', error);
        await localDB.addSyncLog('error', 'sync', `Sync failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      this.isSyncing = false;
      this.lastSyncTime = Date.now();
      this.notifyStatusListeners();
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
        if (isNetworkError(authError)) {
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
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'entry_versions' }, (payload) => {
          const entryId = (payload.new as any)?.entry_id;
          log.info('📡 Entry versions realtime event received', { eventType: payload.eventType, entryId });
          this.handleRealtimeChange('entry_versions', entryId);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'devices', filter: 'is_active=eq.false' }, (payload) => {
          this.handleDeviceDeactivation(payload).catch(err => {
            log.error('Failed to process device realtime event', err);
          });
        })
        .subscribe(async (status, err) => {
          if (status === 'SUBSCRIBED') {
            log.info('✅ Global realtime subscription ACTIVE for entries/streams/attachments/locations/entry_versions');
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
      if (isNetworkError(error)) {
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

      // Stop reconnecting if destroyed (e.g. user signed out)
      if (!this.isInitialized) {
        log.debug('Skipping realtime reconnect - sync service destroyed');
        return;
      }

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
      if (this.suppressRealtimeDeletes) {
        log.info('📡 SKIPPED DELETE - batch operation in progress', { entryId: entryId.substring(0, 8) });
        return;
      }
      log.info('📡 Entry DELETE event received - removing from local', { entryId });
      try {
        await localDB.deleteEntry(entryId);
      } catch (err) {
        log.warn('Failed to delete entry from LocalDB', { entryId, error: err });
      }
      this.removeEntryFromCache(entryId);
      return;
    }

    // Soft-delete via UPDATE: remote set deleted_at — mirror locally
    // Must check BEFORE version check — MCP deletes don't increment version
    const remoteDeletedAt = (payload.new as any)?.deleted_at;
    if (remoteDeletedAt != null) {
      log.info('📡 Entry soft-deleted remotely — mirroring delete locally', { entryId: entryId.substring(0, 8) });
      try {
        const localEntry = await localDB.getEntry(entryId);
        if (localEntry && !localEntry.deleted_at) {
          await localDB.updateEntry(entryId, {
            ...localEntry,
            deleted_at: remoteDeletedAt,
            location_id: null,
            synced: 1,
            sync_action: null,
          } as any);
        }
      } catch (err) {
        log.warn('Failed to mirror soft-delete from realtime', { entryId, error: err });
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
      // INSERT: Debounce invalidation to batch rapid-fire realtime events during sync
      log.info('📡 New entry from remote - scheduling debounced invalidation', { entryId: entryId.substring(0, 8) });
      this.debouncedInvalidateEntryQueries();
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

    const entry = remoteToEntry(payloadData);

    if (localEntry) {
      const created = await createSyncOverwriteIfNeeded({
        entryId,
        userId: entry.user_id,
        localEntry,
        remoteEntry: entry,
        localDeviceId: this.localDeviceId || null,
        triggeredByDevice: entry.last_edited_device || null,
      });

      if (created && this.queryClient) {
        this.queryClient.invalidateQueries({ queryKey: ['versions'] });
      }

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

  /**
   * Debounced version of invalidateEntryQueries for realtime INSERT events.
   * Batches rapid-fire events (e.g., 16 entries syncing) into a single invalidation.
   * Only affects INSERT path — DELETE uses removeEntryFromCache, UPDATE uses setEntryQueryData.
   */
  private debouncedInvalidateEntryQueries(): void {
    if (this.realtimeInsertDebounceTimer) {
      clearTimeout(this.realtimeInsertDebounceTimer);
    }
    this.realtimeInsertDebounceTimer = setTimeout(() => {
      this.realtimeInsertDebounceTimer = null;
      if (!this.isInitialized) return;
      log.info('📡 Executing batched entry query invalidation');
      this.invalidateEntryQueries();
    }, 500);
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

    // Soft-delete via UPDATE: remote set deleted_at — remove locally
    // Guard: only act when deleted_at transitions from null to non-null
    const oldDeletedAt = (payload.old as Record<string, unknown> | undefined)?.deleted_at;
    const newDeletedAt = (payload.new as Record<string, unknown> | undefined)?.deleted_at;
    if (oldDeletedAt == null && newDeletedAt != null) {
      log.info('📡 Stream soft-deleted remotely — removing locally', { streamId: streamId.substring(0, 8) });
      try {
        await localDB.removeStreamLocally(streamId);
      } catch (err) {
        log.warn('Failed to remove soft-deleted stream locally', { streamId, err });
      }
      if (this.queryClient) {
        this.queryClient.invalidateQueries({ queryKey: ['streams'] });
        this.queryClient.invalidateQueries({ queryKey: ['entries'] });
      }
      return;
    }

    // For INSERT/UPDATE, update from payload
    const payloadData = payload.new as any;
    if (payloadData) {
      await this.updateStreamFromPayload(streamId, payloadData);
    }

    // Debounce stream invalidation — each pushed entry triggers two stream events
    // (one from stream upsert, one from entry_count trigger)
    this.debouncedInvalidateStreamQueries();
  }

  private debouncedInvalidateStreamQueries(): void {
    if (this.realtimeStreamDebounceTimer) {
      clearTimeout(this.realtimeStreamDebounceTimer);
    }
    this.realtimeStreamDebounceTimer = setTimeout(() => {
      this.realtimeStreamDebounceTimer = null;
      if (!this.isInitialized || !this.queryClient) return;
      log.info('📡 Executing batched stream query invalidation');
      this.queryClient.invalidateQueries({ queryKey: ['streams'] });
    }, 500);
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
      if (isNetworkError(error)) {
        log.debug('Reconnect sync skipped (still offline)');
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error('Reconnect sync failed', { error: errorMessage });
      }
    }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private async canSync(): Promise<boolean> {
    // Use getSession (local cache) instead of getUser (network call)
    // to avoid a round-trip just to check if the user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

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
      this.queryClient.invalidateQueries({ queryKey: ['versions'] });

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

  /**
   * Handle realtime device UPDATE — check if this device was deactivated.
   * Only fires for is_active=false changes (filtered at subscription level).
   */
  private async handleDeviceDeactivation(payload: any): Promise<void> {
    const newRecord = payload.new;
    log.debug('Device deactivation event received', {
      eventDeviceId: newRecord?.device_id,
      localDeviceId: this.localDeviceId,
    });

    if (!newRecord || !this.localDeviceId) return;

    // Only care about our own device being deactivated
    if (newRecord.device_id !== this.localDeviceId) return;

    log.warn('🚨 Device deactivated remotely — signing out');
    await this.forceSignOut('This device has been signed out remotely.');
  }

  /**
   * Check if current device is still active.
   * Called on foreground/reconnect syncs (not post-save) as a fallback
   * for when realtime was disconnected during deactivation.
   */
  private async checkDeviceActive(): Promise<boolean> {
    if (!this.localDeviceId) return true;

    try {
      const { checkDeviceActive } = await import('../../modules/devices/deviceApi');
      const isActive = await checkDeviceActive(this.localDeviceId);

      log.debug('Device active check', { isActive });

      if (!isActive) {
        log.warn('🚨 Device is deactivated — signing out on sync check');
        await this.forceSignOut('This device has been signed out remotely.');
        return false;
      }
      return true;
    } catch (err) {
      // Fail open — don't sign out on network errors
      log.debug('Device active check failed', { error: err instanceof Error ? err.message : String(err) });
      return true;
    }
  }

  /**
   * Force sign-out with user-facing alert.
   * Guarded against double invocation from concurrent realtime + sync paths.
   */
  private async forceSignOut(message: string): Promise<void> {
    if (this.isSigningOut) return;
    this.isSigningOut = true;

    // Capture call stack for diagnostics — helps trace what triggered sign-out
    const stack = new Error('forceSignOut trace').stack;
    log.warn('🚨 forceSignOut called', { message, stack });

    const { Alert } = await import('react-native');
    const { signOut } = await import('@trace/core');

    Alert.alert('Signed Out', message);

    try {
      await signOut();
    } catch (err) {
      log.error('Force sign-out failed', err);
    } finally {
      this.isSigningOut = false;
    }
  }

  /**
   * Update device's last_seen_at timestamp after successful sync.
   * Throttled to avoid unnecessary writes on frequent syncs.
   */
  private async updateDeviceLastSeen(): Promise<void> {
    if (!this.localDeviceId) return;

    // Throttle — don't update more often than every 5 minutes
    const now = Date.now();
    if (now - this.lastDeviceSeenUpdateTime < this.DEVICE_SEEN_UPDATE_INTERVAL_MS) {
      return;
    }
    this.lastDeviceSeenUpdateTime = now;

    const { updateDeviceLastSeen } = await import('../../modules/devices/deviceApi');
    await updateDeviceLastSeen(this.localDeviceId);
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
