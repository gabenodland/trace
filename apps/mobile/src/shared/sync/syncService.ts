/**
 * Sync Service - Internal sync orchestrator
 *
 * Handles bidirectional synchronization between local SQLite and Supabase.
 * This is an INTERNAL module - use syncApi.ts for public functions.
 *
 * Sync Order (respects foreign key dependencies):
 * PUSH: Streams → Locations → Entries → Photos → Deletes
 * PULL: Streams → Locations → Entries → Photos
 */

import { localDB } from '../db/localDB';
import { supabase } from '@trace/core/src/shared/supabase';
import { Entry, LocationEntity, isCompletedStatus, ALL_STATUSES, EntryStatus } from '@trace/core';
import NetInfo from '@react-native-community/netinfo';
import type { QueryClient } from '@tanstack/react-query';
import { uploadPhotoToSupabase, downloadPhotosInBackground, deletePhotoFromLocalStorage } from '../../modules/photos/mobilePhotoApi';
import { getDeviceName } from '../../modules/entries/mobileEntryApi';
import { createScopedLogger } from '../utils/logger';
import {
  SyncResult,
  SyncStatus,
  SyncTrigger,
  createEmptySyncResult,
} from './syncTypes';

// Re-export types for external consumers
export type { SyncResult, SyncStatus, SyncTrigger };

// Create scoped logger for sync operations with sync icon and device name
const deviceName = getDeviceName();
const log = createScopedLogger(`Sync:${deviceName}`, '🔄');

// ============================================================================
// SYNC SERVICE CLASS
// ============================================================================

class SyncService {
  private isSyncing = false;
  private isInitialized = false;
  private queryClient: QueryClient | null = null;
  private realtimeChannel: any = null;
  private realtimeDebounceTimer: NodeJS.Timeout | null = null;
  private lastSyncTime: number | null = null;
  private networkUnsubscribe: (() => void) | null = null;
  private wasOffline = false;

  // Track entries currently being pushed - prevents race condition with realtime
  // Entry is added before push, removed after LocalDB is updated with new version
  private currentlyPushingEntryIds: Set<string> = new Set();

  // Realtime reconnection state
  private realtimeReconnectTimer: NodeJS.Timeout | null = null;
  private realtimeReconnectAttempts = 0;
  private readonly REALTIME_MAX_BACKOFF_MS = 30000; // 30 seconds max

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initialize sync service
   */
  async initialize(queryClient?: QueryClient): Promise<void> {
    if (this.isInitialized) {
      log.debug('Already initialized, skipping');
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

    log.debug('Sync service initialized');
  }

  /**
   * Clean up sync service
   */
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
    this.realtimeReconnectAttempts = 0;
    this.isInitialized = false;
    log.debug('Sync service destroyed');
  }

  // ==========================================================================
  // PUBLIC SYNC METHODS
  // ==========================================================================

  /**
   * Full bidirectional sync
   * Push local changes, then pull remote changes
   */
  async fullSync(trigger: SyncTrigger = 'manual'): Promise<SyncResult> {
    return this.executeSync(trigger, { push: true, pull: true });
  }

  /**
   * Push local changes to server only
   */
  async pushChanges(trigger: SyncTrigger = 'post-save'): Promise<SyncResult> {
    return this.executeSync(trigger, { push: true, pull: false });
  }

  /**
   * Pull remote changes from server only
   */
  async pullChanges(trigger: SyncTrigger = 'app-foreground'): Promise<SyncResult> {
    return this.executeSync(trigger, { push: false, pull: true });
  }

  /**
   * Pull a single entry from server (for editing)
   * Returns true if entry was updated, false if no changes or offline
   */
  async pullEntry(entryId: string): Promise<boolean> {
    log.debug('Pulling single entry', { entryId });

    if (!await this.canSync()) {
      log.debug('Cannot sync, skipping entry pull');
      return false;
    }

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
        log.debug('Entry not found on server', { entryId });
        return false;
      }

      const localEntry = await localDB.getEntry(entryId);

      // Don't overwrite unsynced local changes
      if (localEntry && localEntry.synced === 0) {
        log.debug('Entry has unsynced local changes, skipping pull', { entryId });
        return false;
      }

      const serverTime = new Date(serverEntry.updated_at).getTime();
      const localTime = localEntry ? new Date(localEntry.updated_at).getTime() : 0;

      // Only update if server is newer
      if (serverTime > localTime) {
        await localDB.updateEntry(entryId, {
          title: serverEntry.title,
          content: serverEntry.content,
          stream_id: serverEntry.stream_id,
          tags: serverEntry.tags || [],
          mentions: serverEntry.mentions || [],
          entry_date: serverEntry.entry_date,
          entry_latitude: serverEntry.entry_latitude,
          entry_longitude: serverEntry.entry_longitude,
          location_accuracy: serverEntry.location_accuracy,
          location_id: serverEntry.location_id,
          status: (serverEntry.status as Entry['status']) || 'none',
          type: serverEntry.type || null,
          due_date: serverEntry.due_date,
          completed_at: serverEntry.completed_at,
          attachments: serverEntry.attachments,
          priority: serverEntry.priority || 0,
          rating: serverEntry.rating || 0,
          is_pinned: serverEntry.is_pinned || false,
          updated_at: serverEntry.updated_at,
          deleted_at: serverEntry.deleted_at,
          version: serverEntry.version || 1,
          synced: 1,
          sync_action: null,
          base_version: serverEntry.version || 1,
        });
        log.debug('Entry pulled from server', { entryId });
        return true;
      }

      return false;
    } catch (error) {
      log.error('Failed to pull entry', error, { entryId });
      return false;
    }
  }

  /**
   * Force full pull (ignores incremental timestamps)
   */
  async forcePull(): Promise<SyncResult> {
    log.debug('Force pull requested');
    return this.executeSync('manual', { push: false, pull: true, forceFullPull: true });
  }

  /**
   * Get current sync status
   */
  async getStatus(): Promise<SyncStatus> {
    const unsyncedCount = await localDB.getUnsyncedCount();
    return {
      unsyncedCount,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
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

    // Prevent concurrent syncs
    if (this.isSyncing) {
      log.debug('Sync already in progress, skipping');
      return result;
    }

    // Check if we can sync
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
      // This ensures we detect remotely-deleted streams BEFORE trying to push entries
      if (options.pull) {
        // Step 1: Pull streams (and clean up orphans)
        const streamResult = await this.pullStreams(forceFullPull);
        result.pulled.streams = streamResult.new + streamResult.updated;

        // Step 2: Pull locations
        const locationResult = await this.pullLocations(forceFullPull);
        result.pulled.locations = locationResult.new + locationResult.updated;
      }

      // PUSH: Local → Server
      if (options.push) {
        // Cache local-only stream IDs for this sync cycle (called 5x in push methods)
        const localOnlyStreamIds = await this.getLocalOnlyStreamIds();

        // Step 1: Push streams (entries depend on them)
        const streamResult = await this.pushStreams();
        result.pushed.streams = streamResult.success;
        result.errors.streams = streamResult.errors;

        // Step 2: Push locations (entries reference them)
        const locationResult = await this.pushLocations();
        result.pushed.locations = locationResult.success;
        result.errors.locations = locationResult.errors;

        // Step 3: Push entries (create/update)
        const entryResult = await this.pushEntries(localOnlyStreamIds);
        result.pushed.entries = entryResult.success;
        result.errors.entries = entryResult.errors;

        // Step 4: Push photos
        const photoResult = await this.pushPhotos(localOnlyStreamIds);
        result.pushed.photos = photoResult.success;
        result.errors.photos = photoResult.errors;

        // Step 5: Push entry deletes (after photos to avoid FK issues)
        const deleteResult = await this.pushEntryDeletes(localOnlyStreamIds);
        result.pushed.entries += deleteResult.success;
        result.errors.entries += deleteResult.errors;

        // Log push summary
        const totalPushed = result.pushed.entries + result.pushed.streams + result.pushed.locations + result.pushed.photos;
        if (totalPushed > 0) {
          log.debug(`PUSHED ${totalPushed} items`, result.pushed);
        }
      }

      // PULL REMAINING: Server → Local (entries and photos)
      if (options.pull) {
        // Step 3: Pull entries
        const entryResult = await this.pullEntries(forceFullPull, pullStartTime);
        result.pulled.entries = entryResult.new + entryResult.updated;

        // Step 4: Pull photos
        const photoResult = await this.pullPhotos(forceFullPull);
        result.pulled.photos = photoResult.new + photoResult.updated + photoResult.deleted;

        // Save pull timestamp for incremental sync
        await this.saveLastPullTimestamp(pullStartTime);

        // Log pull summary
        const totalPulled = result.pulled.entries + result.pulled.streams + result.pulled.locations + result.pulled.photos;
        if (totalPulled > 0) {
          log.debug(`PULLED ${totalPulled} items`, result.pulled);
        }
      }

      // Calculate totals
      const totalPushed = result.pushed.entries + result.pushed.streams + result.pushed.locations + result.pushed.photos;
      const totalPulled = result.pulled.entries + result.pulled.streams + result.pulled.locations + result.pulled.photos;

      // Only invalidate React Query cache if we pulled new data from server
      // (Push-only syncs don't need invalidation since mutations already did it)
      if (totalPulled > 0) {
        this.invalidateQueryCache();
      }

      // Start background photo download (non-blocking)
      this.startBackgroundPhotoDownload();

      result.success = true;
      result.duration = Date.now() - startTime;

      // Log to sync_logs table
      await this.logSyncResult(trigger, result);

      log.debug(`SYNC COMPLETE in ${(result.duration / 1000).toFixed(1)}s | pushed: ${totalPushed} | pulled: ${totalPulled}`);

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
  // PUSH OPERATIONS
  // ==========================================================================

  private async pushStreams(): Promise<{ success: number; errors: number }> {
    const unsyncedStreams = await localDB.getUnsyncedStreams();
    if (unsyncedStreams.length === 0) {
      return { success: 0, errors: 0 };
    }

    let success = 0;
    let errors = 0;

    for (const stream of unsyncedStreams) {
      // Skip local-only streams - mark as synced so they don't reappear in queue
      if (stream.is_localonly) {
        log.debug('Skipping local-only stream', { streamId: stream.stream_id, name: stream.name });
        await localDB.markStreamSynced(stream.stream_id);
        continue;
      }

      try {
        await this.syncStream(stream);
        success++;
      } catch (error) {
        log.warn('Failed to push stream', { streamId: stream.stream_id, error });
        await localDB.recordStreamSyncError(stream.stream_id, error instanceof Error ? error.message : String(error));
        errors++;
      }
    }

    return { success, errors };
  }

  private async pushLocations(): Promise<{ success: number; errors: number }> {
    const unsyncedLocations = await localDB.getUnsyncedLocations();
    if (unsyncedLocations.length === 0) {
      return { success: 0, errors: 0 };
    }

    let success = 0;
    let errors = 0;

    for (const location of unsyncedLocations) {
      try {
        await this.syncLocation(location);
        success++;
      } catch (error) {
        log.warn('Failed to push location', { locationId: location.location_id, error });
        errors++;
      }
    }

    return { success, errors };
  }

  private async pushEntries(localOnlyStreamIds: Set<string>): Promise<{ success: number; errors: number }> {
    const unsyncedEntries = await localDB.getUnsyncedEntries();
    const entriesToPush = unsyncedEntries.filter(e => e.sync_action !== 'delete');

    if (entriesToPush.length === 0) {
      return { success: 0, errors: 0 };
    }

    let success = 0;
    let errors = 0;

    for (const entry of entriesToPush) {
      // Skip entries from local-only streams - mark as synced so they don't reappear in queue
      if (entry.stream_id && localOnlyStreamIds.has(entry.stream_id)) {
        log.debug('Skipping local-only entry', { entryId: entry.entry_id, streamId: entry.stream_id });
        await localDB.markSynced(entry.entry_id);
        continue;
      }

      try {
        await this.syncEntry(entry);
        success++;
      } catch (error) {
        log.warn('Failed to push entry', { entryId: entry.entry_id, error });
        await localDB.recordSyncError(entry.entry_id, error instanceof Error ? error.message : String(error));
        errors++;
      }
    }

    return { success, errors };
  }

  private async pushEntryDeletes(localOnlyStreamIds: Set<string>): Promise<{ success: number; errors: number }> {
    const unsyncedEntries = await localDB.getUnsyncedEntries();
    const entriesToDelete = unsyncedEntries.filter(e => e.sync_action === 'delete');

    if (entriesToDelete.length === 0) {
      return { success: 0, errors: 0 };
    }

    let success = 0;
    let errors = 0;

    for (const entry of entriesToDelete) {
      // Skip deletes for entries from local-only streams - they were never synced
      if (entry.stream_id && localOnlyStreamIds.has(entry.stream_id)) {
        log.debug('Skipping local-only entry delete', { entryId: entry.entry_id, streamId: entry.stream_id });
        await localDB.markSynced(entry.entry_id);
        continue;
      }

      try {
        await this.syncEntry(entry);
        success++;
      } catch (error) {
        log.warn('Failed to push entry delete', { entryId: entry.entry_id, error });
        await localDB.recordSyncError(entry.entry_id, error instanceof Error ? error.message : String(error));
        errors++;
      }
    }

    return { success, errors };
  }

  private async pushPhotos(localOnlyStreamIds: Set<string>): Promise<{ success: number; errors: number }> {
    let success = 0;
    let errors = 0;

    // Upload photo files
    const photosToUpload = await localDB.getPhotosNeedingUpload();
    if (photosToUpload.length > 0) {
      log.debug('Uploading photo files', { count: photosToUpload.length });

      for (const photo of photosToUpload) {
        // Check if photo's entry belongs to local-only stream
        const entry = await localDB.getEntry(photo.entry_id);
        if (entry && entry.stream_id && localOnlyStreamIds.has(entry.stream_id)) {
          log.debug('Skipping local-only photo upload', { photoId: photo.photo_id, streamId: entry.stream_id });
          // Mark as uploaded so it doesn't keep trying
          await localDB.updatePhoto(photo.photo_id, { uploaded: true, synced: 1, sync_action: null });
          continue;
        }

        try {
          if (photo.local_path) {
            await uploadPhotoToSupabase(photo.local_path, photo.file_path);
            await localDB.updatePhoto(photo.photo_id, { uploaded: true });
            success++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('Local file does not exist') || errorMessage.includes('File not found')) {
            log.debug('Photo file missing locally (orphaned)', { photoId: photo.photo_id });
            await localDB.updatePhoto(photo.photo_id, { uploaded: true });
          } else {
            log.warn('Failed to upload photo', { photoId: photo.photo_id, error });
          }
          errors++;
        }
      }
    }

    // Sync photo metadata
    const photosNeedingSync = await localDB.getPhotosNeedingSync();
    log.info('Photos needing sync query result', {
      total: photosNeedingSync.length,
      photos: photosNeedingSync.map(p => ({
        id: p.photo_id,
        entryId: p.entry_id,
        synced: p.synced,
        sync_action: p.sync_action,
        file_size: p.file_size,
        mime_type: p.mime_type,
      }))
    });
    const photosToCreateOrUpdate = photosNeedingSync.filter(p => p.sync_action !== 'delete');

    if (photosToCreateOrUpdate.length > 0) {
      log.info('Syncing photo metadata', { count: photosToCreateOrUpdate.length });

      for (const photo of photosToCreateOrUpdate) {
        try {
          if (!photo.file_size || !photo.mime_type) {
            log.debug('Skipping incomplete photo', { photoId: photo.photo_id });
            await localDB.updatePhoto(photo.photo_id, { synced: 1, sync_action: null });
            continue;
          }

          const entry = await localDB.getEntry(photo.entry_id);
          if (!entry || entry.deleted_at) {
            log.debug('Skipping orphaned photo', { photoId: photo.photo_id });
            await localDB.deletePhoto(photo.photo_id);
            continue;
          }

          // Skip photos from local-only streams - mark as synced so they don't keep trying
          if (entry.stream_id && localOnlyStreamIds.has(entry.stream_id)) {
            log.debug('Skipping local-only photo metadata sync', { photoId: photo.photo_id, streamId: entry.stream_id });
            await localDB.updatePhoto(photo.photo_id, { synced: 1, sync_action: null });
            continue;
          }

          const { error } = await supabase
            .from('photos')
            .upsert({
              photo_id: photo.photo_id,
              entry_id: photo.entry_id,
              user_id: photo.user_id,
              file_path: photo.file_path,
              mime_type: photo.mime_type,
              file_size: photo.file_size,
              width: photo.width || null,
              height: photo.height || null,
              position: photo.position,
            });

          if (error) throw error;

          await localDB.updatePhoto(photo.photo_id, { synced: 1, sync_action: null });
          success++;
        } catch (error) {
          log.warn('Failed to sync photo metadata', { photoId: photo.photo_id, error });
          errors++;
        }
      }
    }

    // Delete photos
    const photosToDelete = photosNeedingSync.filter(p => p.sync_action === 'delete');
    log.info('📸 Photo delete sync check', {
      totalPhotosNeedingSync: photosNeedingSync.length,
      photosToDeleteCount: photosToDelete.length,
      photosToDelete: photosToDelete.map(p => ({ id: p.photo_id, entryId: p.entry_id })),
    });
    if (photosToDelete.length > 0) {
      log.info('📸 Deleting photos from server', { count: photosToDelete.length });

      for (const photo of photosToDelete) {
        try {
          log.info('📸 Deleting photo from Supabase', { photoId: photo.photo_id, filePath: photo.file_path });
          const { error: dbError } = await supabase.from('photos').delete().eq('photo_id', photo.photo_id);
          if (dbError) {
            log.error('📸 Failed to delete photo from DB', { photoId: photo.photo_id, error: dbError });
          }
          if (photo.file_path) {
            const { error: storageError } = await supabase.storage.from('photos').remove([photo.file_path]);
            if (storageError) {
              log.warn('📸 Failed to delete photo from storage', { photoId: photo.photo_id, error: storageError });
            }
          }
          await localDB.permanentlyDeletePhoto(photo.photo_id);
          log.info('📸 Photo deleted successfully', { photoId: photo.photo_id });
          success++;
        } catch (error) {
          log.error('📸 Failed to delete photo', { photoId: photo.photo_id, error });
          errors++;
        }
      }
    }

    return { success, errors };
  }

  // ==========================================================================
  // PULL OPERATIONS
  // ==========================================================================

  private async pullStreams(forceFullPull: boolean): Promise<{ new: number; updated: number; deleted: number }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { new: 0, updated: 0, deleted: 0 };

    const { data: remoteStreams, error } = await supabase
      .from('streams')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (error) {
      log.error('Failed to fetch streams', error);
      return { new: 0, updated: 0, deleted: 0 };
    }

    let newCount = 0;
    let updatedCount = 0;

    // Build set of server stream IDs for missing stream detection
    const serverStreamIds = new Set<string>(
      (remoteStreams || []).map(s => s.stream_id)
    );

    // Process streams from server
    for (const remoteStream of (remoteStreams || [])) {
      try {
        const localStream = await localDB.getStream(remoteStream.stream_id);

        const stream = {
          ...remoteStream,
          synced: 1,
          sync_action: null,
        };

        if (!localStream) {
          await localDB.saveStream(stream);
          await localDB.markStreamSynced(stream.stream_id);
          newCount++;
        } else if (localStream.synced !== 0) {
          const hasChanged =
            localStream.name !== stream.name ||
            localStream.color !== stream.color ||
            localStream.icon !== stream.icon;

          if (hasChanged) {
            await localDB.updateStream(stream.stream_id, stream);
            await localDB.markStreamSynced(stream.stream_id);
            updatedCount++;
          }
        }
      } catch (error) {
        log.warn('Failed to process stream', { streamId: remoteStream.stream_id, error });
      }
    }

    // Detect local streams that exist but are missing from server
    // These could be: (1) deleted on server, or (2) never successfully pushed
    // We mark them for re-push rather than deleting - let the push logic handle them
    try {
      const localStreams = await localDB.getAllStreams();
      let markedForPush = 0;

      for (const localStream of localStreams) {
        // Skip streams already pending sync
        if (localStream.synced === 0) {
          continue;
        }

        // If stream exists locally (marked synced) but not on server,
        // it was likely never pushed successfully - mark for re-push
        if (!serverStreamIds.has(localStream.stream_id)) {
          log.warn('Stream missing from server, marking for re-push', {
            streamId: localStream.stream_id,
            name: localStream.name,
          });

          // Mark for re-push with 'create' action
          await localDB.runCustomQuery(
            'UPDATE streams SET synced = 0, sync_action = \'create\' WHERE stream_id = ?',
            [localStream.stream_id]
          );

          markedForPush++;
        }
      }

      if (markedForPush > 0) {
        log.debug(`Marked ${markedForPush} missing streams for re-push`);
      }
    } catch (error) {
      log.warn('Failed to check for missing streams', { error });
    }

    return { new: newCount, updated: updatedCount, deleted: 0 };
  }

  private async pullLocations(forceFullPull: boolean): Promise<{ new: number; updated: number }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { new: 0, updated: 0 };

    const { data: remoteLocations, error } = await supabase
      .from('locations')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      log.error('Failed to fetch locations', error);
      return { new: 0, updated: 0 };
    }

    if (!remoteLocations || remoteLocations.length === 0) {
      return { new: 0, updated: 0 };
    }

    let newCount = 0;
    let updatedCount = 0;

    for (const remoteLocation of remoteLocations) {
      try {
        const localLocation = await localDB.getLocation(remoteLocation.location_id);

        const location: LocationEntity = {
          location_id: remoteLocation.location_id,
          user_id: remoteLocation.user_id,
          name: remoteLocation.name,
          latitude: remoteLocation.latitude,
          longitude: remoteLocation.longitude,
          source: remoteLocation.source,
          address: remoteLocation.address,
          neighborhood: remoteLocation.neighborhood,
          postal_code: remoteLocation.postal_code,
          city: remoteLocation.city,
          subdivision: remoteLocation.subdivision,
          region: remoteLocation.region,
          country: remoteLocation.country,
          mapbox_place_id: remoteLocation.mapbox_place_id,
          foursquare_fsq_id: remoteLocation.foursquare_fsq_id,
          created_at: remoteLocation.created_at || new Date().toISOString(),
          updated_at: remoteLocation.updated_at || new Date().toISOString(),
          deleted_at: remoteLocation.deleted_at,
          synced: 1,
          sync_action: null,
        };

        if (!localLocation) {
          await localDB.saveLocation(location);
          await localDB.markLocationSynced(location.location_id);
          newCount++;
        } else if (localLocation.synced !== 0) {
          const hasChanged =
            localLocation.name !== location.name ||
            localLocation.latitude !== location.latitude ||
            localLocation.longitude !== location.longitude ||
            localLocation.address !== location.address ||
            localLocation.city !== location.city;

          if (hasChanged) {
            await localDB.saveLocation(location);
            await localDB.markLocationSynced(location.location_id);
            updatedCount++;
          }
        }
      } catch (error) {
        log.warn('Failed to process location', { locationId: remoteLocation.location_id, error });
      }
    }

    return { new: newCount, updated: updatedCount };
  }

  private async pullEntries(forceFullPull: boolean, pullStartTime: Date): Promise<{ new: number; updated: number; deleted: number }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { new: 0, updated: 0, deleted: 0 };

    // Check if database is empty - force full pull
    const entryCount = await localDB.getAllEntries();
    if (entryCount.length === 0 && !forceFullPull) {
      forceFullPull = true;
    }

    const lastPullTimestamp = forceFullPull ? null : await this.getLastPullTimestamp();

    let query = supabase
      .from('entries')
      .select('*')
      .eq('user_id', user.id);

    if (lastPullTimestamp) {
      query = query.gt('updated_at', lastPullTimestamp.toISOString());
    }

    query = query.order('updated_at', { ascending: false });

    const { data: remoteEntries, error } = await query;

    if (error) {
      log.error('Failed to fetch entries', error);
      return { new: 0, updated: 0, deleted: 0 };
    }

    if (!remoteEntries || remoteEntries.length === 0) {
      return { new: 0, updated: 0, deleted: 0 };
    }

    let newCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    for (const remoteEntry of remoteEntries) {
      try {
        const localEntry = await localDB.getEntry(remoteEntry.entry_id);

        // Handle deleted entries
        if (remoteEntry.deleted_at) {
          if (localEntry) {
            await localDB.deleteEntry(remoteEntry.entry_id);
            deletedCount++;
          }
          continue;
        }

        const entry: Entry = {
          entry_id: remoteEntry.entry_id,
          user_id: remoteEntry.user_id,
          title: remoteEntry.title,
          content: remoteEntry.content,
          tags: remoteEntry.tags || [],
          mentions: remoteEntry.mentions || [],
          stream_id: remoteEntry.stream_id,
          entry_latitude: remoteEntry.entry_latitude || null,
          entry_longitude: remoteEntry.entry_longitude || null,
          location_accuracy: remoteEntry.location_accuracy || null,
          location_id: remoteEntry.location_id || null,
          status: (remoteEntry.status as Entry['status']) || 'none',
          type: remoteEntry.type || null,
          due_date: remoteEntry.due_date,
          completed_at: remoteEntry.completed_at,
          entry_date: remoteEntry.entry_date || remoteEntry.created_at,
          created_at: remoteEntry.created_at,
          updated_at: remoteEntry.updated_at,
          deleted_at: remoteEntry.deleted_at,
          attachments: remoteEntry.attachments,
          priority: remoteEntry.priority || 0,
          rating: remoteEntry.rating || 0.00,
          is_pinned: remoteEntry.is_pinned || false,
          local_only: 0,
          synced: 1,
          sync_action: null,
          version: remoteEntry.version || 1,
          base_version: remoteEntry.version || 1,
          conflict_status: (remoteEntry.conflict_status as Entry['conflict_status']) || null,
          conflict_backup: typeof remoteEntry.conflict_backup === 'string' ? remoteEntry.conflict_backup : null,
          last_edited_by: remoteEntry.last_edited_by || null,
          last_edited_device: remoteEntry.last_edited_device || null,
        };

        if (!localEntry) {
          await localDB.saveEntry(entry);
          await localDB.markSynced(entry.entry_id);
          newCount++;
        } else {
          // Skip if local has unsynced changes (don't overwrite pending edits)
          if (localEntry.synced === 0) {
            log.debug('Skipping entry with unsynced local changes', { entryId: entry.entry_id });
            continue;
          }

          // Use version comparison instead of timestamp to avoid false updates
          // when server auto-updates updated_at via trigger
          const remoteVersion = remoteEntry.version || 1;
          const localBaseVersion = localEntry.base_version || 1;

          if (remoteVersion > localBaseVersion) {
            await localDB.updateEntry(entry.entry_id, entry);
            await localDB.markSynced(entry.entry_id);
            updatedCount++;
            log.debug('Entry updated from server', {
              entryId: entry.entry_id,
              remoteVersion,
              localBaseVersion
            });
          }
        }
      } catch (error) {
        log.warn('Failed to process entry', { entryId: remoteEntry.entry_id, error });
      }
    }

    return { new: newCount, updated: updatedCount, deleted: deletedCount };
  }

  private async pullPhotos(forceFullPull: boolean): Promise<{ new: number; updated: number; deleted: number }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { new: 0, updated: 0, deleted: 0 };

    const { data: remotePhotos, error } = await supabase
      .from('photos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      log.error('Failed to fetch photos', error);
      return { new: 0, updated: 0, deleted: 0 };
    }

    let newCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    // Build set of remote photo IDs for deletion detection
    const remotePhotoIds = new Set<string>(
      (remotePhotos || []).map(p => p.photo_id)
    );

    for (const remotePhoto of (remotePhotos || [])) {
      try {
        const localPhotos = await localDB.runCustomQuery(
          'SELECT * FROM photos WHERE photo_id = ?',
          [remotePhoto.photo_id]
        );
        const localPhoto = localPhotos.length > 0 ? localPhotos[0] : null;

        const photo = {
          photo_id: remotePhoto.photo_id,
          entry_id: remotePhoto.entry_id,
          user_id: remotePhoto.user_id,
          file_path: remotePhoto.file_path,
          local_path: localPhoto?.local_path || undefined,
          mime_type: remotePhoto.mime_type,
          file_size: remotePhoto.file_size || undefined,
          width: remotePhoto.width || undefined,
          height: remotePhoto.height || undefined,
          position: remotePhoto.position,
          created_at: new Date(remotePhoto.created_at).getTime(),
          updated_at: new Date(remotePhoto.updated_at).getTime(),
          uploaded: true,
          synced: 1,
          sync_action: null,
        };

        if (!localPhoto) {
          await localDB.createPhoto(photo, true);
          newCount++;
        } else {
          const hasChanged =
            localPhoto.position !== photo.position ||
            localPhoto.mime_type !== photo.mime_type;

          if (hasChanged) {
            await localDB.updatePhoto(photo.photo_id, photo);
            updatedCount++;
          }
        }
      } catch (error) {
        log.warn('Failed to process photo', { photoId: remotePhoto.photo_id, error });
      }
    }

    // Detect and delete photos that exist locally but were deleted on server
    // Only delete photos that are synced (uploaded) - not local-only unsynced photos
    try {
      const localSyncedPhotos = await localDB.runCustomQuery(
        'SELECT photo_id, local_path FROM photos WHERE user_id = ? AND synced = 1 AND (sync_action IS NULL OR sync_action != ?)',
        [user.id, 'delete']
      );

      for (const localPhoto of localSyncedPhotos) {
        if (!remotePhotoIds.has(localPhoto.photo_id)) {
          log.info('Photo deleted on server, removing locally', { photoId: localPhoto.photo_id });
          // Delete local file if exists
          if (localPhoto.local_path) {
            try {
              await deletePhotoFromLocalStorage(localPhoto.local_path);
            } catch (err) {
              log.warn('Failed to delete local photo file', { path: localPhoto.local_path, error: err });
            }
          }
          // Permanently delete from local DB
          await localDB.permanentlyDeletePhoto(localPhoto.photo_id);
          deletedCount++;
        }
      }
    } catch (error) {
      log.warn('Failed to detect deleted photos', { error });
    }

    return { new: newCount, updated: updatedCount, deleted: deletedCount };
  }

  // ==========================================================================
  // SYNC INDIVIDUAL ITEMS
  // ==========================================================================

  private async syncEntry(entry: Entry): Promise<void> {
    const { sync_action } = entry;

    // Track this entry as currently pushing to prevent realtime race condition
    this.currentlyPushingEntryIds.add(entry.entry_id);

    try {
    // Validate and sanitize status - ensure it's a valid value for the database constraint
    const validStatuses = ALL_STATUSES.map(s => s.value);
    let sanitizedStatus: EntryStatus = entry.status;

    // Debug: Log the original status value
    log.info('syncEntry status check', {
      entryId: entry.entry_id,
      originalStatus: entry.status,
      statusType: typeof entry.status,
      isValid: validStatuses.includes(entry.status)
    });

    if (!validStatuses.includes(entry.status)) {
      // Map legacy status values to new ones
      if (entry.status === 'incomplete' as unknown as EntryStatus) {
        sanitizedStatus = 'todo';
        log.info('Mapped incomplete to todo', { entryId: entry.entry_id });
      } else if (entry.status === 'complete' as unknown as EntryStatus) {
        sanitizedStatus = 'done';
        log.info('Mapped complete to done', { entryId: entry.entry_id });
      } else {
        // Unknown status - default to 'none'
        log.warn('Invalid status, defaulting to none', { entryId: entry.entry_id, status: entry.status });
        sanitizedStatus = 'none';
      }
    }

    // Enforce completed_at constraint:
    // - If status is completed (done, closed, cancelled) → completed_at MUST be set
    // - If status is NOT completed → completed_at MUST be NULL
    let completedAtValue: string | null = null;
    if (isCompletedStatus(sanitizedStatus)) {
      // Completed status - ensure completed_at is set
      if (entry.completed_at) {
        completedAtValue = typeof entry.completed_at === 'number'
          ? new Date(entry.completed_at).toISOString()
          : entry.completed_at;
      } else {
        completedAtValue = new Date().toISOString();
      }
    }
    // else: Non-completed status - completedAtValue stays null (constraint requirement)

    const supabaseData = {
      entry_id: entry.entry_id,
      user_id: entry.user_id,
      title: entry.title,
      content: entry.content,
      tags: entry.tags,
      mentions: entry.mentions,
      stream_id: entry.stream_id,
      entry_date: entry.entry_date && (typeof entry.entry_date === 'number'
        ? new Date(entry.entry_date).toISOString()
        : entry.entry_date),
      entry_latitude: entry.entry_latitude,
      entry_longitude: entry.entry_longitude,
      location_accuracy: entry.location_accuracy,
      location_id: entry.location_id,
      status: sanitizedStatus,
      type: entry.type || null,
      due_date: entry.due_date && (typeof entry.due_date === 'number'
        ? new Date(entry.due_date).toISOString()
        : entry.due_date),
      completed_at: completedAtValue,
      priority: entry.priority ?? 0,
      rating: entry.rating ?? 0,
      is_pinned: entry.is_pinned ?? false,
      created_at: typeof entry.created_at === 'number'
        ? new Date(entry.created_at).toISOString()
        : entry.created_at,
      updated_at: typeof entry.updated_at === 'number'
        ? new Date(entry.updated_at).toISOString()
        : entry.updated_at,
      deleted_at: entry.deleted_at && (typeof entry.deleted_at === 'number'
        ? new Date(entry.deleted_at).toISOString()
        : entry.deleted_at),
      // Note: version is NOT sent - server trigger auto-increments it on content changes
      // base_version is used for conflict detection on the client side only
      conflict_status: entry.conflict_status || null,
      conflict_backup: entry.conflict_backup || null,
      last_edited_by: entry.last_edited_by || null,
      last_edited_device: entry.last_edited_device || null,
    };

    if (sync_action === 'create' || sync_action === 'update') {
      // Debug: Log exactly what we're sending
      log.info('Syncing entry', {
        entryId: entry.entry_id,
        sync_action,
        status: supabaseData.status,
        completed_at: supabaseData.completed_at,
        localVersion: entry.version,
        baseVersion: entry.base_version,
      });

      if (sync_action === 'create') {
        // For creates, use upsert - no version conflict possible for new entries
        const { data: upsertedEntry, error } = await supabase
          .from('entries')
          .upsert(supabaseData, { onConflict: 'entry_id' })
          .select('version')
          .single();

        if (error) {
          log.error('Create failed', {
            entryId: entry.entry_id,
            errorCode: error.code,
            errorMessage: error.message,
          });
          throw new Error(`Supabase create failed: ${error.message}`);
        }

        // Update local base_version to match server's new version
        const serverVersion = upsertedEntry?.version || 1;
        await localDB.updateEntry(entry.entry_id, {
          version: serverVersion,
          base_version: serverVersion,
          synced: 1,
          sync_action: null,
          sync_error: null,
        });
      } else {
        // For updates, use OPTIMISTIC LOCKING with conditional update
        // This prevents race condition where two devices update simultaneously
        const localBaseVersion = entry.base_version || 1;

        // Attempt conditional update: only succeeds if server version matches our base_version
        // The server trigger will auto-increment version on success
        const { data: updatedEntry, error: updateError } = await supabase
          .from('entries')
          .update(supabaseData)
          .eq('entry_id', entry.entry_id)
          .eq('version', localBaseVersion)  // OPTIMISTIC LOCK: only update if version unchanged
          .select('version, title, content, status, tags, mentions, last_edited_by, last_edited_device')
          .maybeSingle();  // Returns null if no rows matched (conflict)

        if (updateError) {
          log.error('Update failed', {
            entryId: entry.entry_id,
            errorCode: updateError.code,
            errorMessage: updateError.message,
          });
          throw new Error(`Supabase update failed: ${updateError.message}`);
        }

        if (!updatedEntry) {
          // OPTIMISTIC LOCK FAILED: Server version changed since we started editing
          // This means another device updated between our last sync and now
          log.warn('Optimistic lock failed - version mismatch (race condition caught!)', {
            entryId: entry.entry_id,
            localBaseVersion,
          });

          // Fetch the current server state to show user what changed
          const { data: serverEntry, error: fetchError } = await supabase
            .from('entries')
            .select('version, title, content, status, tags, mentions, last_edited_by, last_edited_device')
            .eq('entry_id', entry.entry_id)
            .single();

          if (fetchError || !serverEntry) {
            log.error('Failed to fetch server entry after conflict', { entryId: entry.entry_id });
            throw new Error('Conflict detected but failed to fetch server state');
          }

          const serverVersion = (serverEntry as any).version || 1;

          // Save local changes as backup for user to review
          const localBackup = {
            title: entry.title,
            content: entry.content,
            status: entry.status,
            tags: entry.tags,
            mentions: entry.mentions,
            edited_by: entry.last_edited_by,
            edited_device: entry.last_edited_device,
            version: entry.version,
          };

          const serverData = serverEntry as any;

          // Keep server version, mark as conflicted
          await localDB.updateEntry(entry.entry_id, {
            title: serverData.title,
            content: serverData.content,
            status: serverData.status,
            tags: serverData.tags,
            mentions: serverData.mentions,
            version: serverVersion,
            base_version: serverVersion,
            conflict_status: 'conflicted',
            conflict_backup: JSON.stringify(localBackup),
            last_edited_by: serverData.last_edited_by,
            last_edited_device: serverData.last_edited_device,
            synced: 1,
            sync_action: null,
          });

          // Update React Query cache so UI sees the conflict
          const conflictedEntry = await localDB.getEntry(entry.entry_id);
          if (conflictedEntry) {
            this.setEntryQueryData(entry.entry_id, conflictedEntry);
          }

          log.warn('Conflict saved - user will be prompted to resolve', {
            entryId: entry.entry_id,
            serverVersion,
            localBackupSaved: true,
          });

          return;
        }

        // Update succeeded - update local base_version to match server
        const serverVersion = updatedEntry.version || 1;
        await localDB.updateEntry(entry.entry_id, {
          version: serverVersion,
          base_version: serverVersion,
          synced: 1,
          sync_action: null,
          sync_error: null,
        });

        log.debug('Entry updated with optimistic lock', {
          entryId: entry.entry_id,
          newVersion: serverVersion,
        });
      }

    } else if (sync_action === 'delete') {
      const { data: existingEntry } = await supabase
        .from('entries')
        .select('entry_id')
        .eq('entry_id', entry.entry_id)
        .maybeSingle();

      if (existingEntry) {
        const { error } = await supabase
          .from('entries')
          .update({
            deleted_at: entry.deleted_at || new Date().toISOString(),
            location_id: null,
          })
          .eq('entry_id', entry.entry_id);

        if (error && error.code !== '42501') {
          throw new Error(`Supabase delete failed: ${error.message}`);
        }
      }

      await localDB.markSynced(entry.entry_id);
    }
    } finally {
      // Always remove from tracking set, even on error
      this.currentlyPushingEntryIds.delete(entry.entry_id);
    }
  }

  private async syncStream(stream: any): Promise<void> {
    const { sync_action } = stream;

    const supabaseData = {
      stream_id: stream.stream_id,
      user_id: stream.user_id,
      name: stream.name,
      entry_count: stream.entry_count || 0,
      color: stream.color,
      icon: stream.icon,
      created_at: typeof stream.created_at === 'number'
        ? new Date(stream.created_at).toISOString()
        : stream.created_at,
      updated_at: typeof (stream.updated_at || stream.created_at) === 'number'
        ? new Date(stream.updated_at || stream.created_at).toISOString()
        : (stream.updated_at || stream.created_at),
    };

    if (sync_action === 'create' || sync_action === 'update') {
      const { error } = await supabase
        .from('streams')
        .upsert(supabaseData, { onConflict: 'stream_id' });

      if (error) {
        throw new Error(`Supabase upsert failed: ${error.message}`);
      }
    } else if (sync_action === 'delete') {
      const { error } = await supabase
        .from('streams')
        .delete()
        .eq('stream_id', stream.stream_id);

      if (error) {
        throw new Error(`Supabase delete failed: ${error.message}`);
      }
    }

    await localDB.markStreamSynced(stream.stream_id);
  }

  private async syncLocation(location: LocationEntity): Promise<void> {
    const { sync_action } = location;

    const supabaseData = {
      location_id: location.location_id,
      user_id: location.user_id,
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      source: location.source,
      address: location.address,
      neighborhood: location.neighborhood,
      postal_code: location.postal_code,
      city: location.city,
      subdivision: location.subdivision,
      region: location.region,
      country: location.country,
      mapbox_place_id: location.mapbox_place_id,
      foursquare_fsq_id: location.foursquare_fsq_id,
      created_at: location.created_at,
      updated_at: location.updated_at,
      deleted_at: location.deleted_at,
    };

    if (sync_action === 'create' || sync_action === 'update') {
      const { error } = await supabase
        .from('locations')
        .upsert(supabaseData, { onConflict: 'location_id' });

      if (error) {
        throw new Error(`Supabase upsert failed: ${error.message}`);
      }
    } else if (sync_action === 'delete') {
      const { error } = await supabase
        .from('locations')
        .update({ deleted_at: location.deleted_at || new Date().toISOString() })
        .eq('location_id', location.location_id);

      if (error) {
        throw new Error(`Supabase delete failed: ${error.message}`);
      }
    }

    await localDB.markLocationSynced(location.location_id);
  }

  // ==========================================================================
  // REALTIME SUBSCRIPTION
  // ==========================================================================

  private async setupRealtimeSubscription(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        log.debug('Not authenticated, skipping realtime setup');
        return;
      }

      log.info('📡 Setting up global realtime subscription for all tables...', { userId: user.id });

      // Subscribe to all changes on tables - RLS will filter to user's data
      // Note: Filters like user_id=eq.X can have issues, so we rely on RLS instead
      this.realtimeChannel = supabase
        .channel('db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, (payload) => {
          // Process entry realtime event with version-based filtering
          this.processEntryRealtimeEvent(payload).catch(err => {
            log.error('Failed to process entry realtime event', err);
          });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'streams' }, (payload) => {
          // Process stream realtime event with meaningful-change detection
          this.processStreamRealtimeEvent(payload).catch(err => {
            log.error('Failed to process stream realtime event', err);
          });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, (payload) => {
          const entryId = (payload.new as any)?.entry_id || (payload.old as any)?.entry_id;
          log.info('📡 Photos realtime event received', { eventType: payload.eventType, entryId });
          this.handleRealtimeChange('photos', entryId);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, (payload) => {
          log.info('📡 Locations realtime event received', { eventType: payload.eventType });
          this.handleRealtimeChange('locations');
        })
        .subscribe(async (status, err) => {
          if (status === 'SUBSCRIBED') {
            log.info('✅ Global realtime subscription ACTIVE for entries/streams/photos/locations');
            // Reset reconnection state on successful connection
            this.realtimeReconnectAttempts = 0;
            if (this.realtimeReconnectTimer) {
              clearTimeout(this.realtimeReconnectTimer);
              this.realtimeReconnectTimer = null;
            }
          } else if (status === 'CHANNEL_ERROR') {
            // Suppress logging when offline - this is expected behavior
            const netState = await NetInfo.fetch();
            if (!netState.isConnected || !netState.isInternetReachable) {
              log.debug('Realtime subscription failed (expected - device is offline)');
            } else {
              // Use warn instead of error - reconnection is automatic, this is expected during app lifecycle
              log.warn('Realtime subscription failed, will reconnect', { error: err });
              this.scheduleRealtimeReconnect();
            }
          } else if (status === 'TIMED_OUT') {
            // Suppress logging when offline
            const netState = await NetInfo.fetch();
            if (!netState.isConnected || !netState.isInternetReachable) {
              log.debug('Realtime subscription timed out (expected - device is offline)');
            } else {
              // Use warn instead of error - reconnection is automatic
              log.warn('Realtime subscription timed out, will reconnect');
              this.scheduleRealtimeReconnect();
            }
          } else if (status === 'CLOSED') {
            log.info('🔒 Global realtime subscription CLOSED');
            // Reconnect if closed unexpectedly while initialized
            if (this.isInitialized) {
              this.scheduleRealtimeReconnect();
            }
          } else {
            log.debug('Global realtime status', { status });
          }
        });
    } catch (error) {
      log.error('Failed to set up realtime subscription', error);
      this.scheduleRealtimeReconnect();
    }
  }

  /**
   * Schedule a reconnection attempt for the realtime subscription
   * Uses exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
   */
  private scheduleRealtimeReconnect(): void {
    // Don't schedule if not initialized or already scheduled
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

      // Check if we're online before attempting reconnect
      const netState = await NetInfo.fetch();
      if (!netState.isConnected || !netState.isInternetReachable) {
        log.debug('Skipping realtime reconnect - device is offline');
        return;
      }

      log.info('🔄 Attempting realtime reconnect...');

      // Remove old channel if it exists
      if (this.realtimeChannel) {
        try {
          await supabase.removeChannel(this.realtimeChannel);
        } catch (e) {
          // Ignore errors during cleanup
        }
        this.realtimeChannel = null;
      }

      // Set up new subscription
      await this.setupRealtimeSubscription();
    }, backoffMs);
  }

  /**
   * Process entry realtime event with version-based filtering
   * Compares payload version against LocalDB to determine if update is needed
   */
  private async processEntryRealtimeEvent(payload: any): Promise<void> {
    const entryId = (payload.new as any)?.entry_id || (payload.old as any)?.entry_id;
    const eventType = payload.eventType;

    if (!entryId) {
      log.debug('📡 Ignoring realtime event - no entry ID');
      return;
    }

    // Debug: Log all realtime events for entries
    log.info('📡 REALTIME EVENT RECEIVED', {
      entryId: entryId.substring(0, 8),
      eventType,
      remoteVersion: (payload.new as any)?.version,
      remoteEditedBy: (payload.new as any)?.last_edited_by?.substring(0, 8),
      isPushing: this.currentlyPushingEntryIds.has(entryId),
    });

    // Skip if we're currently pushing this entry (race condition prevention)
    if (this.currentlyPushingEntryIds.has(entryId)) {
      log.info('📡 SKIPPED - currently pushing', { entryId: entryId.substring(0, 8) });
      return;
    }

    // For DELETE events, just trigger the normal flow
    if (eventType === 'DELETE') {
      log.info('📡 Entry DELETE event received', { entryId });
      this.handleRealtimeChange('entries', entryId);
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

      // Skip if we already have this version or newer
      if (remoteVersion <= localVersion) {
        log.info('📡 SKIPPED - version up to date', { entryId: entryId.substring(0, 8) });
        return;
      }

      // Skip if local has unsynced changes (don't overwrite pending edits)
      if (localEntry.synced === 0) {
        log.info('📡 SKIPPED - local changes pending', { entryId: entryId.substring(0, 8) });
        return;
      }
    }

    // New entry or newer version - update LocalDB directly from payload
    log.warn('📡 APPLYING REALTIME UPDATE!', {
      entryId: entryId.substring(0, 8),
      eventType,
      remoteVersion,
      isNewEntry: !localEntry
    });

    const updatedEntry = await this.updateEntryFromPayload(entryId, payload.new);
    // Update React Query cache directly instead of invalidating
    // This prevents double-render: one from invalidation, one from refetch
    this.setEntryQueryData(entryId, updatedEntry);
  }

  /**
   * Update LocalDB entry directly from realtime payload data
   * Avoids unnecessary network call since payload contains full row
   * Returns the entry object for cache updates
   *
   * CRITICAL: Re-checks version before writing to prevent race conditions
   * when multiple realtime events arrive simultaneously
   */
  private async updateEntryFromPayload(entryId: string, payloadData: any): Promise<Entry | null> {
    if (!payloadData) {
      log.warn('No payload data to update entry', { entryId });
      return null;
    }

    const payloadVersion = payloadData.version || 1;

    // Re-check version right before writing (prevents race condition)
    // This is needed because multiple realtime events can arrive simultaneously
    // and both might pass the initial version check before either writes
    const currentEntry = await localDB.getEntry(entryId);
    if (currentEntry) {
      const currentVersion = currentEntry.base_version || 1;

      // Skip if LocalDB already has this version or newer
      if (payloadVersion <= currentVersion) {
        log.debug('Skipping outdated realtime update (race condition prevented)', {
          entryId,
          payloadVersion,
          currentVersion
        });
        return currentEntry; // Return current entry, don't overwrite
      }

      // Skip if local has unsynced changes (double-check since event processing started)
      if (currentEntry.synced === 0) {
        log.debug('Skipping realtime update - local changes now pending', { entryId });
        return currentEntry;
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
      location_accuracy: payloadData.location_accuracy || null,
      location_id: payloadData.location_id || null,
      status: payloadData.status || 'none',
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
      local_only: 0,
      synced: 1,
      sync_action: null,
      version: payloadVersion,
      base_version: payloadVersion,
      conflict_status: payloadData.conflict_status || null,
      conflict_backup: typeof payloadData.conflict_backup === 'string' ? payloadData.conflict_backup : null,
      last_edited_by: payloadData.last_edited_by || null,
      last_edited_device: payloadData.last_edited_device || null,
    };

    if (currentEntry) {
      await localDB.updateEntry(entryId, entry);
      log.debug('Updated entry from realtime payload', { entryId, version: entry.version });
    } else {
      await localDB.saveEntry(entry as any);
      await localDB.markSynced(entryId);
      log.debug('Inserted new entry from realtime payload', { entryId, version: entry.version });
    }

    return entry;
  }

  /**
   * Update React Query cache directly for an entry
   * This avoids triggering a refetch which would cause isFetching=true and UI flash
   */
  private setEntryQueryData(entryId: string, entry: Entry | null): void {
    if (!this.queryClient || !entry) return;

    // Update the specific entry cache
    this.queryClient.setQueryData(['entry', entryId], entry);

    // Also invalidate the entries list so it refreshes in the background
    this.queryClient.invalidateQueries({ queryKey: ['entries'] });

    log.debug('Updated React Query cache for entry', { entryId, version: entry.version });
  }

  /**
   * Process stream realtime event with meaningful-change detection
   * Streams don't have versions, so we compare actual field values
   * Ignores entry_count changes (computed locally from entries)
   */
  private async processStreamRealtimeEvent(payload: any): Promise<void> {
    const streamId = (payload.new as any)?.stream_id || (payload.old as any)?.stream_id;
    const eventType = payload.eventType;

    if (!streamId) {
      log.debug('📡 Ignoring stream realtime event - no stream ID');
      return;
    }

    // For DELETE events, trigger the normal pull flow
    if (eventType === 'DELETE') {
      log.info('📡 Stream DELETE event received', { streamId });
      this.handleRealtimeChange('streams');
      return;
    }

    // For INSERT/UPDATE, compare meaningful fields with LocalDB
    const remoteStream = payload.new as any;
    const localStream = await localDB.getStream(streamId);

    if (!localStream) {
      // New stream from another device - process it
      log.info('📡 Stream INSERT event - new stream from remote', { streamId });
      this.handleRealtimeChange('streams');
      return;
    }

    // Skip if local has unsynced changes
    if (localStream.synced === 0) {
      log.debug('📡 Ignoring stream realtime event - local changes pending', { streamId });
      return;
    }

    // Compare MEANINGFUL fields only (ignore entry_count - it's computed)
    const hasMeaningfulChanges =
      localStream.name !== remoteStream.name ||
      localStream.color !== remoteStream.color ||
      localStream.icon !== remoteStream.icon ||
      localStream.is_private !== remoteStream.is_private;

    if (!hasMeaningfulChanges) {
      log.debug('📡 Ignoring stream realtime event - only entry_count changed', {
        streamId,
        localEntryCount: localStream.entry_count,
        remoteEntryCount: remoteStream.entry_count
      });
      return;
    }

    // Meaningful changes detected - update LocalDB directly from payload
    log.info('📡 Stream realtime event - meaningful changes detected', {
      streamId,
      changes: {
        name: localStream.name !== remoteStream.name,
        color: localStream.color !== remoteStream.color,
        icon: localStream.icon !== remoteStream.icon,
        is_private: localStream.is_private !== remoteStream.is_private
      }
    });

    await this.updateStreamFromPayload(streamId, remoteStream);
    this.invalidateQueryCache();
  }

  /**
   * Update LocalDB stream directly from realtime payload data
   */
  private async updateStreamFromPayload(streamId: string, payloadData: any): Promise<void> {
    if (!payloadData) {
      log.warn('No payload data to update stream', { streamId });
      return;
    }

    await localDB.updateStream(streamId, {
      name: payloadData.name,
      color: payloadData.color,
      icon: payloadData.icon,
      is_private: payloadData.is_private,
      entry_count: payloadData.entry_count,
      updated_at: payloadData.updated_at,
      synced: 1,
      sync_action: null,
    });

    log.debug('Updated stream from realtime payload', { streamId });
  }

  // Track entry IDs that have changed during debounce window
  private pendingEntryIds: Set<string> = new Set();

  private handleRealtimeChange(table: string, entryId?: string): void {
    log.info(`🔔 Realtime change detected on ${table} table`, entryId ? { entryId } : {});

    // Track entry IDs for cache invalidation
    if (entryId) {
      this.pendingEntryIds.add(entryId);
    }

    if (this.realtimeDebounceTimer) {
      log.debug('Clearing existing debounce timer, resetting...');
      clearTimeout(this.realtimeDebounceTimer);
    }

    log.debug('Starting 2s debounce timer for realtime pull...');
    this.realtimeDebounceTimer = setTimeout(async () => {
      log.debug('Debounce timer fired, checking if can sync...');

      // Capture and clear pending entry IDs
      const entryIdsToInvalidate = [...this.pendingEntryIds];
      this.pendingEntryIds.clear();

      if (this.isSyncing) {
        log.warn('⚠️ Sync in progress, SKIPPING realtime pull (may cause stale data!)');
        return;
      }

      // Realtime events come from ALL changes to the database, including our own pushes.
      // We only want to pull when ANOTHER device made changes.
      //
      // Strategy: Do a pull-only sync. If we have unsynced local changes, the pull
      // will skip those entries (synced=0 check in pullEntries). If the server has
      // newer data from another device, we'll get it.
      log.info(`🔄 Pulling remote changes for ${table}...`);
      try {
        const result = await this.pullChanges('realtime');
        const totalPulled = result.pulled.entries + result.pulled.streams + result.pulled.locations + result.pulled.photos;

        if (totalPulled > 0) {
          log.info(`✅ Pulled ${result.pulled.entries} entries, ${result.pulled.streams} streams from realtime`);
          // Invalidate specific entry queries for pulled entries
          this.invalidateQueryCache(entryIdsToInvalidate);
        } else {
          // No actual changes - don't invalidate cache unnecessarily
          // Version comparison in pullEntries already handles this correctly
          log.debug('No changes from server (version up-to-date), skipping cache invalidation');
        }
      } catch (error) {
        log.error('Failed to pull realtime changes', error);
      }
    }, 2000);
  }

  // ==========================================================================
  // NETWORK LISTENER
  // ==========================================================================

  /**
   * Set up network state listener for reconnect sync
   * When network reconnects after being offline:
   * 1. Pull missed changes from server
   * 2. Push queued local changes
   */
  private setupNetworkListener(): void {
    // Get initial network state
    NetInfo.fetch().then(state => {
      this.wasOffline = !state.isConnected || !state.isInternetReachable;
      log.debug('Initial network state', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        wasOffline: this.wasOffline
      });
    });

    // Subscribe to network changes
    this.networkUnsubscribe = NetInfo.addEventListener(state => {
      const isOnline = state.isConnected && state.isInternetReachable;

      log.debug('Network state changed', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        wasOffline: this.wasOffline,
        isOnline,
      });

      // Reconnect detected: was offline, now online
      if (this.wasOffline && isOnline) {
        log.info('Network reconnected, syncing queued changes...');
        this.handleReconnect();
      }

      // Update offline state
      this.wasOffline = !isOnline;
    });

    log.debug('Network listener set up');
  }

  /**
   * Handle network reconnect
   * Reconnect realtime subscription and sync data
   */
  private async handleReconnect(): Promise<void> {
    // Reset reconnection attempts since we're back online
    this.realtimeReconnectAttempts = 0;

    // Cancel any pending reconnect timer
    if (this.realtimeReconnectTimer) {
      clearTimeout(this.realtimeReconnectTimer);
      this.realtimeReconnectTimer = null;
    }

    // Reconnect realtime if not connected
    if (!this.realtimeChannel) {
      log.info('Reconnecting realtime subscription...');
      await this.setupRealtimeSubscription();
    }

    if (this.isSyncing) {
      log.debug('Sync already in progress, skipping reconnect sync');
      return;
    }

    try {
      // Full sync: pull then push
      // The executeSync already does pull-then-push in the correct order
      await this.fullSync('app-foreground');
      log.info('Reconnect sync completed');
    } catch (error) {
      log.error('Reconnect sync failed', error);
    }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private async canSync(): Promise<boolean> {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || !netInfo.isInternetReachable) {
      return false;
    }

    const { data: { user } } = await supabase.auth.getUser();
    return !!user;
  }

  /**
   * Get the set of stream IDs that are marked as local-only
   * Entries from these streams should never sync to the cloud
   */
  private async getLocalOnlyStreamIds(): Promise<Set<string>> {
    const streams = await localDB.getAllStreams();
    const localOnlyStreams = streams.filter(s => s.is_localonly);

    if (localOnlyStreams.length > 0) {
      log.debug('Local-only streams (will not sync):', {
        streams: localOnlyStreams.map(s => ({ id: s.stream_id, name: s.name })),
      });
    }

    return new Set(localOnlyStreams.map(s => s.stream_id));
  }

  private async cleanupWrongUserData(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const wrongUserEntries = await localDB.runCustomQuery(
        'SELECT entry_id FROM entries WHERE user_id != ?',
        [user.id]
      );

      if (wrongUserEntries.length > 0) {
        log.debug('Cleaning up entries from previous user', { count: wrongUserEntries.length });
        await localDB.runCustomQuery('DELETE FROM entries WHERE user_id != ?', [user.id]);
      }

      const wrongUserStreams = await localDB.runCustomQuery(
        'SELECT stream_id FROM streams WHERE user_id != ?',
        [user.id]
      );

      if (wrongUserStreams.length > 0) {
        log.debug('Cleaning up streams from previous user', { count: wrongUserStreams.length });
        await localDB.runCustomQuery('DELETE FROM streams WHERE user_id != ?', [user.id]);
      }

      const wrongUserPhotos = await localDB.runCustomQuery(
        'SELECT photo_id FROM photos WHERE user_id != ?',
        [user.id]
      );

      if (wrongUserPhotos.length > 0) {
        log.debug('Cleaning up photos from previous user', { count: wrongUserPhotos.length });
        await localDB.runCustomQuery('DELETE FROM photos WHERE user_id != ?', [user.id]);
      }

      const wrongUserLocations = await localDB.runCustomQuery(
        'SELECT location_id FROM locations WHERE user_id != ?',
        [user.id]
      );

      if (wrongUserLocations.length > 0) {
        log.debug('Cleaning up locations from previous user', { count: wrongUserLocations.length });
        await localDB.runCustomQuery('DELETE FROM locations WHERE user_id != ?', [user.id]);
      }
    } catch (error) {
      log.error('Failed to cleanup wrong user data', error);
    }
  }

  private async getLastPullTimestamp(): Promise<Date | null> {
    try {
      const result = await localDB.runCustomQuery(
        'SELECT value FROM sync_metadata WHERE key = ?',
        ['last_pull_timestamp']
      );
      if (result.length > 0 && result[0].value) {
        return new Date(parseInt(result[0].value));
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private async saveLastPullTimestamp(timestamp: Date): Promise<void> {
    await localDB.runCustomQuery(
      'INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)',
      ['last_pull_timestamp', timestamp.getTime().toString(), Date.now()]
    );
  }

  private invalidateQueryCache(entryIds?: string[]): void {
    if (this.queryClient) {
      log.info('🔄 [Sync] Invalidating React Query cache', { entryIds: entryIds?.length || 0 });

      // Always invalidate list queries
      this.queryClient.invalidateQueries({ queryKey: ['entries'] });
      this.queryClient.invalidateQueries({ queryKey: ['streams'] });
      this.queryClient.invalidateQueries({ queryKey: ['locations'] });
      this.queryClient.invalidateQueries({ queryKey: ['unsyncedCount'] });

      // Also invalidate specific entry and photo queries if IDs provided
      // This ensures CaptureForm updates when editing the same entry on another device
      // Note: Entry query keys are ['entry', id, 'local'] or ['entry', id, 'refresh']
      // Photo query keys are ['photos', 'entry', entryId]
      // so we use predicate matching to invalidate both variants
      if (entryIds && entryIds.length > 0) {
        for (const entryId of entryIds) {
          log.debug('🔄 [Sync] Invalidating individual entry and photo queries', { entryId });
          // Invalidate entry queries
          this.queryClient.invalidateQueries({
            predicate: (query) => {
              const key = query.queryKey;
              return Array.isArray(key) && key[0] === 'entry' && key[1] === entryId;
            }
          });
          // Invalidate photo queries for this entry: ['photos', 'entry', entryId]
          this.queryClient.invalidateQueries({
            queryKey: ['photos', 'entry', entryId]
          });
        }
      }
    }
  }

  private startBackgroundPhotoDownload(): void {
    setTimeout(() => {
      downloadPhotosInBackground(10).catch(error => {
        log.warn('Background photo download error', { error });
      });
    }, 1000);
  }

  private async logSyncResult(trigger: SyncTrigger, result: SyncResult): Promise<void> {
    const hasErrors = result.errors.entries > 0 || result.errors.streams > 0 ||
                      result.errors.locations > 0 || result.errors.photos > 0;
    const logLevel = hasErrors ? 'warning' : 'info';

    const totalPushed = result.pushed.entries + result.pushed.streams +
                        result.pushed.locations + result.pushed.photos;
    const totalPulled = result.pulled.entries + result.pulled.streams +
                        result.pulled.locations + result.pulled.photos;
    const totalErrors = result.errors.entries + result.errors.streams +
                        result.errors.locations + result.errors.photos;

    let message = `Sync (${trigger}) completed in ${(result.duration / 1000).toFixed(1)}s`;
    if (totalPushed > 0) message += ` - Pushed: ${totalPushed}`;
    if (totalPulled > 0) message += ` - Pulled: ${totalPulled}`;
    if (totalErrors > 0) message += ` - Errors: ${totalErrors}`;

    await localDB.addSyncLog(logLevel, 'sync', message, {
      entries_pushed: result.pushed.entries,
      entries_errors: result.errors.entries,
      streams_pushed: result.pushed.streams,
      streams_errors: result.errors.streams,
      photos_pushed: result.pushed.photos,
      photos_errors: result.errors.photos,
      entries_pulled: result.pulled.entries,
    });
  }
}

// Export singleton instance
export const syncService = new SyncService();
