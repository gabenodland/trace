/**
 * Sync Service - Internal sync orchestrator
 *
 * Handles bidirectional synchronization between local SQLite and Supabase.
 * This is an INTERNAL module - use syncApi.ts for public functions.
 *
 * Sync Order (respects foreign key dependencies):
 * PUSH: Categories → Locations → Entries → Photos → Deletes
 * PULL: Categories → Locations → Entries → Photos
 */

import { localDB } from '../db/localDB';
import { supabase } from '@trace/core/src/shared/supabase';
import { Entry, LocationEntity } from '@trace/core';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type { QueryClient } from '@tanstack/react-query';
import { uploadPhotoToSupabase, downloadPhotosInBackground } from '../../modules/photos/mobilePhotoApi';
import { createScopedLogger } from '../utils/logger';

// Create scoped logger for sync operations with sync icon
const log = createScopedLogger('Sync', '🔄');

// ============================================================================
// TYPES
// ============================================================================

export interface SyncResult {
  success: boolean;
  pushed: {
    entries: number;
    categories: number;
    locations: number;
    photos: number;
  };
  pulled: {
    entries: number;
    categories: number;
    locations: number;
    photos: number;
  };
  errors: {
    entries: number;
    categories: number;
    locations: number;
    photos: number;
  };
  duration: number;
}

export interface SyncStatus {
  unsyncedCount: number;
  isSyncing: boolean;
  lastSyncTime: number | null;
}

type SyncTrigger = 'manual' | 'post-save' | 'realtime' | 'app-foreground' | 'initialization';

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
  private readonly SYNC_THROTTLE_MS = 30000; // 30 seconds

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

    log.info('Initializing sync service');

    // Clean up data from previous users
    await this.cleanupWrongUserData();

    // Set up realtime subscription for server changes
    await this.setupRealtimeSubscription();

    log.success('Sync service initialized');
  }

  /**
   * Clean up sync service
   */
  destroy(): void {
    if (this.realtimeDebounceTimer) {
      clearTimeout(this.realtimeDebounceTimer);
    }
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      log.debug('Realtime subscription removed');
    }
    this.isInitialized = false;
    log.info('Sync service destroyed');
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
          category_id: serverEntry.category_id,
          tags: serverEntry.tags || [],
          mentions: serverEntry.mentions || [],
          entry_date: serverEntry.entry_date,
          entry_latitude: serverEntry.entry_latitude,
          entry_longitude: serverEntry.entry_longitude,
          location_accuracy: serverEntry.location_accuracy,
          location_id: serverEntry.location_id,
          status: (serverEntry.status as Entry['status']) || 'none',
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
        log.info('Entry pulled from server', { entryId });
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
    log.info('Force pull requested');
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
    const result: SyncResult = {
      success: false,
      pushed: { entries: 0, categories: 0, locations: 0, photos: 0 },
      pulled: { entries: 0, categories: 0, locations: 0, photos: 0 },
      errors: { entries: 0, categories: 0, locations: 0, photos: 0 },
      duration: 0,
    };

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
    log.info(`SYNC STARTED (${trigger})`);

    try {
      // PUSH: Local → Server
      if (options.push) {
        // Step 1: Push categories (entries depend on them)
        const categoryResult = await this.pushCategories();
        result.pushed.categories = categoryResult.success;
        result.errors.categories = categoryResult.errors;

        // Step 2: Push locations (entries reference them)
        const locationResult = await this.pushLocations();
        result.pushed.locations = locationResult.success;
        result.errors.locations = locationResult.errors;

        // Step 3: Push entries (create/update)
        const entryResult = await this.pushEntries();
        result.pushed.entries = entryResult.success;
        result.errors.entries = entryResult.errors;

        // Step 4: Push photos
        const photoResult = await this.pushPhotos();
        result.pushed.photos = photoResult.success;
        result.errors.photos = photoResult.errors;

        // Step 5: Push entry deletes (after photos to avoid FK issues)
        const deleteResult = await this.pushEntryDeletes();
        result.pushed.entries += deleteResult.success;
        result.errors.entries += deleteResult.errors;

        // Log push summary
        const totalPushed = result.pushed.entries + result.pushed.categories + result.pushed.locations + result.pushed.photos;
        if (totalPushed > 0) {
          log.info(`PUSHED ${totalPushed} items`, result.pushed);
        }
      }

      // PULL: Server → Local
      if (options.pull) {
        const forceFullPull = options.forceFullPull || false;
        const pullStartTime = new Date();

        // Step 1: Pull categories
        const categoryResult = await this.pullCategories(forceFullPull);
        result.pulled.categories = categoryResult.new + categoryResult.updated;

        // Step 2: Pull locations
        const locationResult = await this.pullLocations(forceFullPull);
        result.pulled.locations = locationResult.new + locationResult.updated;

        // Step 3: Pull entries
        const entryResult = await this.pullEntries(forceFullPull, pullStartTime);
        result.pulled.entries = entryResult.new + entryResult.updated;

        // Step 4: Pull photos
        const photoResult = await this.pullPhotos(forceFullPull);
        result.pulled.photos = photoResult.new + photoResult.updated;

        // Save pull timestamp for incremental sync
        await this.saveLastPullTimestamp(pullStartTime);

        // Log pull summary
        const totalPulled = result.pulled.entries + result.pulled.categories + result.pulled.locations + result.pulled.photos;
        if (totalPulled > 0) {
          log.info(`PULLED ${totalPulled} items`, result.pulled);
        }
      }

      // Invalidate React Query cache
      this.invalidateQueryCache();

      // Start background photo download (non-blocking)
      this.startBackgroundPhotoDownload();

      result.success = true;
      result.duration = Date.now() - startTime;

      // Log to sync_logs table
      await this.logSyncResult(trigger, result);

      const totalPushed = result.pushed.entries + result.pushed.categories + result.pushed.locations + result.pushed.photos;
      const totalPulled = result.pulled.entries + result.pulled.categories + result.pulled.locations + result.pulled.photos;
      log.info(`SYNC COMPLETE in ${(result.duration / 1000).toFixed(1)}s | pushed: ${totalPushed} | pulled: ${totalPulled}`);

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

  private async pushCategories(): Promise<{ success: number; errors: number }> {
    const unsyncedCategories = await localDB.getUnsyncedCategories();
    if (unsyncedCategories.length === 0) {
      return { success: 0, errors: 0 };
    }

    // Sort by depth (parents before children)
    const sortedCategories = [...unsyncedCategories].sort((a, b) => a.depth - b.depth);

    let success = 0;
    let errors = 0;

    for (const category of sortedCategories) {
      try {
        await this.syncCategory(category);
        success++;
      } catch (error) {
        log.warn('Failed to push category', { categoryId: category.category_id, error });
        await localDB.recordCategorySyncError(category.category_id, error instanceof Error ? error.message : String(error));
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

  private async pushEntries(): Promise<{ success: number; errors: number }> {
    const unsyncedEntries = await localDB.getUnsyncedEntries();
    const entriesToPush = unsyncedEntries.filter(e => e.sync_action !== 'delete');

    if (entriesToPush.length === 0) {
      return { success: 0, errors: 0 };
    }

    let success = 0;
    let errors = 0;

    for (const entry of entriesToPush) {
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

  private async pushEntryDeletes(): Promise<{ success: number; errors: number }> {
    const unsyncedEntries = await localDB.getUnsyncedEntries();
    const entriesToDelete = unsyncedEntries.filter(e => e.sync_action === 'delete');

    if (entriesToDelete.length === 0) {
      return { success: 0, errors: 0 };
    }

    let success = 0;
    let errors = 0;

    for (const entry of entriesToDelete) {
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

  private async pushPhotos(): Promise<{ success: number; errors: number }> {
    let success = 0;
    let errors = 0;

    // Upload photo files
    const photosToUpload = await localDB.getPhotosNeedingUpload();
    if (photosToUpload.length > 0) {
      log.debug('Uploading photo files', { count: photosToUpload.length });

      for (const photo of photosToUpload) {
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
    const photosToCreateOrUpdate = photosNeedingSync.filter(p => p.sync_action !== 'delete');

    if (photosToCreateOrUpdate.length > 0) {
      log.debug('Syncing photo metadata', { count: photosToCreateOrUpdate.length });

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
    if (photosToDelete.length > 0) {
      log.debug('Deleting photos', { count: photosToDelete.length });

      for (const photo of photosToDelete) {
        try {
          await supabase.from('photos').delete().eq('photo_id', photo.photo_id);
          if (photo.file_path) {
            await supabase.storage.from('photos').remove([photo.file_path]);
          }
          await localDB.permanentlyDeletePhoto(photo.photo_id);
          success++;
        } catch (error) {
          log.warn('Failed to delete photo', { photoId: photo.photo_id, error });
          errors++;
        }
      }
    }

    return { success, errors };
  }

  // ==========================================================================
  // PULL OPERATIONS
  // ==========================================================================

  private async pullCategories(forceFullPull: boolean): Promise<{ new: number; updated: number }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { new: 0, updated: 0 };

    const { data: remoteCategories, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('full_path');

    if (error) {
      log.error('Failed to fetch categories', error);
      return { new: 0, updated: 0 };
    }

    if (!remoteCategories || remoteCategories.length === 0) {
      return { new: 0, updated: 0 };
    }

    let newCount = 0;
    let updatedCount = 0;

    for (const remoteCategory of remoteCategories) {
      try {
        const localCategory = await localDB.getCategory(remoteCategory.category_id);

        const category = {
          ...remoteCategory,
          synced: 1,
          sync_action: null,
        };

        if (!localCategory) {
          await localDB.saveCategory(category);
          await localDB.markCategorySynced(category.category_id);
          newCount++;
        } else if (localCategory.synced !== 0) {
          const hasChanged =
            localCategory.name !== category.name ||
            localCategory.full_path !== category.full_path ||
            localCategory.parent_category_id !== category.parent_category_id ||
            localCategory.color !== category.color ||
            localCategory.icon !== category.icon;

          if (hasChanged) {
            await localDB.updateCategory(category.category_id, category);
            await localDB.markCategorySynced(category.category_id);
            updatedCount++;
          }
        }
      } catch (error) {
        log.warn('Failed to process category', { categoryId: remoteCategory.category_id, error });
      }
    }

    return { new: newCount, updated: updatedCount };
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
          category_id: remoteEntry.category_id,
          entry_latitude: remoteEntry.entry_latitude || null,
          entry_longitude: remoteEntry.entry_longitude || null,
          location_accuracy: remoteEntry.location_accuracy || null,
          location_id: remoteEntry.location_id || null,
          status: (remoteEntry.status as Entry['status']) || 'none',
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

  private async pullPhotos(forceFullPull: boolean): Promise<{ new: number; updated: number }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { new: 0, updated: 0 };

    const { data: remotePhotos, error } = await supabase
      .from('photos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      log.error('Failed to fetch photos', error);
      return { new: 0, updated: 0 };
    }

    if (!remotePhotos || remotePhotos.length === 0) {
      return { new: 0, updated: 0 };
    }

    let newCount = 0;
    let updatedCount = 0;

    for (const remotePhoto of remotePhotos) {
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

    return { new: newCount, updated: updatedCount };
  }

  // ==========================================================================
  // SYNC INDIVIDUAL ITEMS
  // ==========================================================================

  private async syncEntry(entry: Entry): Promise<void> {
    const { sync_action } = entry;

    // Enforce completed_at constraint
    let completedAtValue: string | null = null;
    if (entry.status === 'complete') {
      if (entry.completed_at) {
        completedAtValue = typeof entry.completed_at === 'number'
          ? new Date(entry.completed_at).toISOString()
          : entry.completed_at;
      } else {
        completedAtValue = new Date().toISOString();
      }
    }

    const supabaseData = {
      entry_id: entry.entry_id,
      user_id: entry.user_id,
      title: entry.title,
      content: entry.content,
      tags: entry.tags,
      mentions: entry.mentions,
      category_id: entry.category_id,
      entry_latitude: entry.entry_latitude,
      entry_longitude: entry.entry_longitude,
      location_accuracy: entry.location_accuracy,
      location_id: entry.location_id,
      status: entry.status,
      due_date: entry.due_date && (typeof entry.due_date === 'number'
        ? new Date(entry.due_date).toISOString()
        : entry.due_date),
      completed_at: completedAtValue,
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
      // Conflict detection for updates
      if (sync_action === 'update') {
        const { data: serverEntry, error: fetchError } = await supabase
          .from('entries')
          .select('version, base_version, title, content, status, tags, mentions, last_edited_by, last_edited_device')
          .eq('entry_id', entry.entry_id)
          .single();

        if (!fetchError && serverEntry) {
          const serverVersion = (serverEntry as any).version || 1;
          const localBaseVersion = entry.base_version || 1;

          if (serverVersion > localBaseVersion) {
            log.warn('Conflict detected', {
              entryId: entry.entry_id,
              serverVersion,
              localBaseVersion,
            });

            // Save local changes as backup
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

            return;
          }
        }
      }

      const { data: upsertedEntry, error } = await supabase
        .from('entries')
        .upsert(supabaseData, { onConflict: 'entry_id' })
        .select('version')
        .single();

      if (error) {
        throw new Error(`Supabase upsert failed: ${error.message}`);
      }

      // Update local base_version to match server's new version (set by trigger)
      const serverVersion = upsertedEntry?.version || 1;
      await localDB.updateEntry(entry.entry_id, {
        version: serverVersion,
        base_version: serverVersion,
        synced: 1,
        sync_action: null,
      });

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
  }

  private async syncCategory(category: any): Promise<void> {
    const { sync_action } = category;

    const supabaseData = {
      category_id: category.category_id,
      user_id: category.user_id,
      name: category.name,
      full_path: category.full_path,
      parent_category_id: category.parent_category_id,
      depth: category.depth,
      entry_count: category.entry_count,
      color: category.color,
      icon: category.icon,
      created_at: typeof category.created_at === 'number'
        ? new Date(category.created_at).toISOString()
        : category.created_at,
      updated_at: typeof (category.updated_at || category.created_at) === 'number'
        ? new Date(category.updated_at || category.created_at).toISOString()
        : (category.updated_at || category.created_at),
    };

    if (sync_action === 'create' || sync_action === 'update') {
      const { error } = await supabase
        .from('categories')
        .upsert(supabaseData, { onConflict: 'category_id' });

      if (error) {
        throw new Error(`Supabase upsert failed: ${error.message}`);
      }
    } else if (sync_action === 'delete') {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('category_id', category.category_id);

      if (error) {
        throw new Error(`Supabase delete failed: ${error.message}`);
      }
    }

    await localDB.markCategorySynced(category.category_id);
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

      this.realtimeChannel = supabase
        .channel('db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'entries', filter: `user_id=eq.${user.id}` }, () => {
          this.handleRealtimeChange('entries');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${user.id}` }, () => {
          this.handleRealtimeChange('categories');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'photos', filter: `user_id=eq.${user.id}` }, () => {
          this.handleRealtimeChange('photos');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'locations', filter: `user_id=eq.${user.id}` }, () => {
          this.handleRealtimeChange('locations');
        })
        .subscribe();
    } catch (error) {
      log.error('Failed to set up realtime subscription', error);
    }
  }

  private handleRealtimeChange(table: string): void {
    if (this.realtimeDebounceTimer) {
      clearTimeout(this.realtimeDebounceTimer);
    }

    this.realtimeDebounceTimer = setTimeout(() => {
      if (this.isSyncing) {
        return;
      }
      log.info(`Server change detected (${table}), syncing...`);
      this.fullSync('realtime').catch(console.error);
    }, 2000);
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

  private async cleanupWrongUserData(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const wrongUserEntries = await localDB.runCustomQuery(
        'SELECT entry_id FROM entries WHERE user_id != ?',
        [user.id]
      );

      if (wrongUserEntries.length > 0) {
        log.info('Cleaning up entries from previous user', { count: wrongUserEntries.length });
        await localDB.runCustomQuery('DELETE FROM entries WHERE user_id != ?', [user.id]);
      }

      const wrongUserCategories = await localDB.runCustomQuery(
        'SELECT category_id FROM categories WHERE user_id != ?',
        [user.id]
      );

      if (wrongUserCategories.length > 0) {
        log.info('Cleaning up categories from previous user', { count: wrongUserCategories.length });
        await localDB.runCustomQuery('DELETE FROM categories WHERE user_id != ?', [user.id]);
      }

      const wrongUserPhotos = await localDB.runCustomQuery(
        'SELECT photo_id FROM photos WHERE user_id != ?',
        [user.id]
      );

      if (wrongUserPhotos.length > 0) {
        log.info('Cleaning up photos from previous user', { count: wrongUserPhotos.length });
        await localDB.runCustomQuery('DELETE FROM photos WHERE user_id != ?', [user.id]);
      }

      const wrongUserLocations = await localDB.runCustomQuery(
        'SELECT location_id FROM locations WHERE user_id != ?',
        [user.id]
      );

      if (wrongUserLocations.length > 0) {
        log.info('Cleaning up locations from previous user', { count: wrongUserLocations.length });
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

  private invalidateQueryCache(): void {
    if (this.queryClient) {
      log.debug('Invalidating React Query cache');
      this.queryClient.invalidateQueries({ queryKey: ['entries'] });
      this.queryClient.invalidateQueries({ queryKey: ['categories'] });
      this.queryClient.invalidateQueries({ queryKey: ['categoryTree'] });
      this.queryClient.invalidateQueries({ queryKey: ['locations'] });
      this.queryClient.invalidateQueries({ queryKey: ['unsyncedCount'] });
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
    const hasErrors = result.errors.entries > 0 || result.errors.categories > 0 ||
                      result.errors.locations > 0 || result.errors.photos > 0;
    const logLevel = hasErrors ? 'warning' : 'info';

    const totalPushed = result.pushed.entries + result.pushed.categories +
                        result.pushed.locations + result.pushed.photos;
    const totalPulled = result.pulled.entries + result.pulled.categories +
                        result.pulled.locations + result.pulled.photos;
    const totalErrors = result.errors.entries + result.errors.categories +
                        result.errors.locations + result.errors.photos;

    let message = `Sync (${trigger}) completed in ${(result.duration / 1000).toFixed(1)}s`;
    if (totalPushed > 0) message += ` - Pushed: ${totalPushed}`;
    if (totalPulled > 0) message += ` - Pulled: ${totalPulled}`;
    if (totalErrors > 0) message += ` - Errors: ${totalErrors}`;

    await localDB.addSyncLog(logLevel, 'sync', message, {
      entries_pushed: result.pushed.entries,
      entries_errors: result.errors.entries,
      categories_pushed: result.pushed.categories,
      categories_errors: result.errors.categories,
      photos_pushed: result.pushed.photos,
      photos_errors: result.errors.photos,
      entries_pulled: result.pulled.entries,
    });
  }
}

// Export singleton instance
export const syncService = new SyncService();
