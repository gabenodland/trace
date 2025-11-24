/**
 * Sync Queue Service
 * Handles bidirectional synchronization between local SQLite and Supabase
 */

import { localDB } from '../db/localDB';
import { supabase } from '@trace/core/src/shared/supabase';
import { Entry, LocationEntity } from '@trace/core';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type { QueryClient } from '@tanstack/react-query';
import { uploadPhotoToSupabase, downloadPhotosInBackground } from '../../modules/photos/mobilePhotoApi';

class SyncQueue {
  private isSyncing = false;
  private isInitialized = false;
  private appStateSubscription: any = null;
  private realtimeChannel: any = null;
  private queryClient: QueryClient | null = null;
  private realtimeDebounceTimer: NodeJS.Timeout | null = null;
  private lastSyncTime: number = 0;
  private readonly SYNC_THROTTLE_MS = 30000; // Don't sync more than once per 30 seconds

  /**
   * Initialize sync listeners
   */
  async initialize(queryClient?: QueryClient) {
    // Prevent double initialization
    if (this.isInitialized) {
      console.log('⚠️ Sync queue already initialized, skipping');
      return;
    }

    this.isInitialized = true;

    // Store queryClient for cache invalidation after sync
    if (queryClient) {
      this.queryClient = queryClient;
    }
    console.log('🔄 Initializing sync queue...');

    // Clean up entries that don't belong to current user (from previous logins)
    await this.cleanupWrongUserData();

    // DISABLED: App state change listener was causing excessive syncs
    // When opening camera and returning to app, it would trigger full sync
    // We rely on: (1) Realtime subscription for server changes, (2) Post-save sync
    // this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    // Set up Supabase Realtime subscriptions for instant updates
    // This provides real-time sync when changes occur on server
    await this.setupRealtimeSubscription();

    console.log('✅ Sync queue initialized (2 triggers: realtime, post-save)');
  } // Force Metro rebuild

  /**
   * Set up Supabase Realtime subscription for instant updates
   */
  private async setupRealtimeSubscription() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('🔒 Not authenticated, skipping Realtime setup');
        return;
      }

      // Subscribe to changes on entries, categories, and photos tables for this user
      this.realtimeChannel = supabase
        .channel('db-changes')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'entries',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('📡 Realtime entry update received:', payload.eventType);
            // Trigger a pull sync when changes are detected
            this.handleRealtimeChange(payload);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'categories',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('📡 Realtime category update received:', payload.eventType);
            // Trigger a pull sync when changes are detected
            this.handleRealtimeChange(payload);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'photos',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('📸 Realtime photo update received:', payload.eventType);
            // Trigger a pull sync when changes are detected
            this.handleRealtimeChange(payload);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'locations',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('📍 Realtime location update received:', payload.eventType);
            // Trigger a pull sync when changes are detected
            this.handleRealtimeChange(payload);
          }
        )
        .subscribe();

      console.log('📡 Realtime subscription active (entries + categories + photos + locations)');
    } catch (error) {
      console.error('❌ Failed to set up Realtime subscription:', error);
    }
  }

  /**
   * Handle Realtime change events
   */
  private handleRealtimeChange(payload: any) {
    // Clear any existing debounce timer
    if (this.realtimeDebounceTimer) {
      clearTimeout(this.realtimeDebounceTimer);
    }

    // Debounce: wait for burst of changes to finish before syncing
    this.realtimeDebounceTimer = setTimeout(() => {
      // Skip if already syncing to avoid concurrent syncs
      if (this.isSyncing) {
        console.log('⏭️ Realtime sync skipped (already syncing)');
        return;
      }

      console.log('🔄 Realtime triggered sync');
      this.processQueue();
    }, 2000); // 2 second delay to collect burst of changes
  }

  /**
   * Clean up listeners
   */
  destroy() {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    if (this.realtimeDebounceTimer) {
      clearTimeout(this.realtimeDebounceTimer);
    }
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      console.log('📡 Realtime subscription removed');
    }
    this.isInitialized = false;
  }

  /**
   * Clean up data that belongs to a different user
   * This happens when user logs out and logs in as a different user
   */
  private async cleanupWrongUserData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('🔒 Not authenticated, skipping cleanup');
        return;
      }

      // Find entries that don't belong to current user
      const wrongUserEntries = await localDB.runCustomQuery(
        'SELECT entry_id, user_id FROM entries WHERE user_id != ?',
        [user.id]
      );

      if (wrongUserEntries.length > 0) {
        console.log(`🧹 Cleaning up ${wrongUserEntries.length} entries from previous user`);

        // Delete entries that don't belong to current user
        await localDB.runCustomQuery('DELETE FROM entries WHERE user_id != ?', [user.id]);

        console.log(`✅ Cleaned up ${wrongUserEntries.length} wrong-user entries`);
      }

      // Find categories that don't belong to current user
      const wrongUserCategories = await localDB.runCustomQuery(
        'SELECT category_id, user_id FROM categories WHERE user_id != ?',
        [user.id]
      );

      if (wrongUserCategories.length > 0) {
        console.log(`🧹 Cleaning up ${wrongUserCategories.length} categories from previous user`);

        // Delete categories that don't belong to current user
        await localDB.runCustomQuery('DELETE FROM categories WHERE user_id != ?', [user.id]);

        console.log(`✅ Cleaned up ${wrongUserCategories.length} wrong-user categories`);
      }

      // Find photos that don't belong to current user
      const wrongUserPhotos = await localDB.runCustomQuery(
        'SELECT photo_id, user_id FROM photos WHERE user_id != ?',
        [user.id]
      );

      if (wrongUserPhotos.length > 0) {
        console.log(`🧹 Cleaning up ${wrongUserPhotos.length} photos from previous user`);

        // Delete photos that don't belong to current user
        await localDB.runCustomQuery('DELETE FROM photos WHERE user_id != ?', [user.id]);

        console.log(`✅ Cleaned up ${wrongUserPhotos.length} wrong-user photos`);
      }

    } catch (error) {
      console.error('❌ Failed to cleanup wrong-user data:', error);
      // Don't throw - initialization should continue even if cleanup fails
    }
  }

  /**
   * Handle app state changes (throttled to prevent excessive syncing)
   */
  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      const now = Date.now();
      const timeSinceLastSync = now - this.lastSyncTime;

      if (timeSinceLastSync < this.SYNC_THROTTLE_MS) {
        console.log(`⏸️ App became active, but synced ${Math.round(timeSinceLastSync / 1000)}s ago (throttled)`);
        return;
      }

      console.log('📱 App became active, triggering sync');
      this.processQueue();
    }
  };

  /**
   * Process the sync queue (bidirectional sync)
   * 1. Push local changes to Supabase
   * 2. Pull remote changes from Supabase
   */
  async processQueue(): Promise<void> {
    // Prevent concurrent syncs
    if (this.isSyncing) {
      console.log('⏳ Sync already in progress, skipping');
      return;
    }

    // Check network connectivity
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || !netInfo.isInternetReachable) {
      console.log('📡 No internet connection, skipping sync');
      return;
    }

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('🔒 Not authenticated, skipping sync');
      return;
    }

    this.isSyncing = true;

    try {
      console.log('🔄 Starting bidirectional sync...');

      // Track sync statistics for logging
      const syncStartTime = Date.now();
      let pushSuccessCount = 0;
      let pushErrorCount = 0;
      let categoryPushSuccessCount = 0;
      let categoryPushErrorCount = 0;
      let photoPushSuccessCount = 0;
      let photoPushErrorCount = 0;

      // STEP 1: Push unsynced categories to Supabase (MUST BE FIRST - entries depend on categories)
      const unsyncedCategories = await localDB.getUnsyncedCategories();

      if (unsyncedCategories.length > 0) {
        // CRITICAL: Sort categories by depth to ensure parents exist before children
        // depth 0 (root) -> depth 1 (children of root) -> depth 2 (grandchildren) etc.
        const sortedCategories = [...unsyncedCategories].sort((a, b) => a.depth - b.depth);

        console.log(`📤 Pushing ${sortedCategories.length} category changes (sorted by depth)...`);

        for (const category of sortedCategories) {
          try {
            await this.syncCategory(category);
            categoryPushSuccessCount++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Failed to push category ${category.category_id} (depth ${category.depth}):`, errorMessage);

            // Record the error in the database
            await localDB.recordCategorySyncError(category.category_id, errorMessage);
            categoryPushErrorCount++;
            // Will retry on next sync trigger
          }
        }

        console.log(`📤 Category push complete: ${categoryPushSuccessCount} success, ${categoryPushErrorCount} errors`);
      } else {
        console.log('✅ No category changes to push');
      }

      // STEP 1.5: Push unsynced locations to Supabase (BEFORE entries - entries reference locations)
      let locationPushSuccessCount = 0;
      let locationPushErrorCount = 0;
      const unsyncedLocations = await localDB.getUnsyncedLocations();

      if (unsyncedLocations.length > 0) {
        console.log(`📍 Pushing ${unsyncedLocations.length} location changes...`);

        for (const location of unsyncedLocations) {
          try {
            await this.syncLocation(location);
            locationPushSuccessCount++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Failed to push location ${location.location_id}:`, errorMessage);
            locationPushErrorCount++;
            // Will retry on next sync trigger
          }
        }

        console.log(`📍 Location push complete: ${locationPushSuccessCount} success, ${locationPushErrorCount} errors`);
      } else {
        console.log('✅ No location changes to push');
      }

      // STEP 2: Push local entry CREATE/UPDATE to Supabase (BEFORE photos)
      // Entries must exist before photos can reference them
      const unsyncedEntries = await localDB.getUnsyncedEntries();
      const entriesToCreateOrUpdate = unsyncedEntries.filter(e => e.sync_action !== 'delete');
      const entriesToDelete = unsyncedEntries.filter(e => e.sync_action === 'delete');

      if (entriesToCreateOrUpdate.length > 0) {
        console.log(`📤 Pushing ${entriesToCreateOrUpdate.length} entry create/update...`);

        for (const entry of entriesToCreateOrUpdate) {
          try {
            await this.syncEntry(entry);
            pushSuccessCount++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Failed to push entry ${entry.entry_id}:`, errorMessage);

            // Record the error in the database
            await localDB.recordSyncError(entry.entry_id, errorMessage);
            pushErrorCount++;
            // Will retry on next sync trigger
          }
        }

        console.log(`📤 Entry create/update complete: ${pushSuccessCount} success, ${pushErrorCount} errors`);
      } else {
        console.log('✅ No entry creates/updates to push');
      }

      // STEP 3: Upload photos to Supabase Storage (AFTER entries exist)
      // 3a. Upload photo files that need uploading
      const photosToUpload = await localDB.getPhotosNeedingUpload();

      if (photosToUpload.length > 0) {
        console.log(`📸 Uploading ${photosToUpload.length} photo files...`);

        for (const photo of photosToUpload) {
          try {
            if (photo.local_path) {
              // Upload photo file to Supabase Storage
              await uploadPhotoToSupabase(photo.local_path, photo.file_path);

              // Mark as uploaded in local DB
              await localDB.updatePhoto(photo.photo_id, {
                uploaded: true,
              });

              photoPushSuccessCount++;
              console.log(`✓ Uploaded photo ${photo.photo_id}`);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            // Handle missing local file gracefully (orphaned photo, not a real error)
            if (errorMessage.includes('Local file does not exist') || errorMessage.includes('File not found')) {
              console.log(`⚠️ Photo ${photo.photo_id} file missing locally (orphaned entry)`);
              // Mark as uploaded to prevent retrying (file is gone, nothing we can do)
              await localDB.updatePhoto(photo.photo_id, {
                uploaded: true,
              });
              photoPushErrorCount++;
            } else {
              // Real error - log and retry on next sync
              console.log(`❌ Failed to upload photo ${photo.photo_id}:`, errorMessage);
              photoPushErrorCount++;
            }
          }
        }

        console.log(`📸 Photo upload complete: ${photoPushSuccessCount} success, ${photoPushErrorCount} errors`);
      } else {
        console.log('✅ No photos to upload');
      }

      // 3b. Sync photo metadata CREATE/UPDATE to Supabase (AFTER entries exist)
      // Note: Orphan cleanup is now manual-only (Database Info screen) for performance
      // Running it every sync is O(n) where n = total photos, which can slow down sync significantly
      const photosNeedingSync = await localDB.getPhotosNeedingSync();
      const photosToCreateOrUpdate = photosNeedingSync.filter(p => p.sync_action !== 'delete');
      const photosToDelete = photosNeedingSync.filter(p => p.sync_action === 'delete');

      if (photosToCreateOrUpdate.length > 0) {
        console.log(`📸 Syncing ${photosToCreateOrUpdate.length} photo create/update...`);

        for (const photo of photosToCreateOrUpdate) {
          try {
            // Validate photo has required fields
            if (!photo.file_size || !photo.mime_type) {
              console.log(`ℹ️ Skipping incomplete photo ${photo.photo_id} (missing file_size or mime_type) - marking as synced to prevent retry`);
              // Mark as synced to prevent infinite retry
              await localDB.updatePhoto(photo.photo_id, {
                synced: 1,
                sync_action: null,
              });
              continue;
            }

            // Check if entry exists (don't sync orphaned photos)
            const entry = await localDB.getEntry(photo.entry_id);
            if (!entry || entry.deleted_at) {
              console.log(`ℹ️ Skipping orphaned photo ${photo.photo_id} (entry ${photo.entry_id} not found or deleted) - marking for deletion`);
              // Mark photo for deletion since its entry is gone
              await localDB.deletePhoto(photo.photo_id);
              continue;
            }

            // Create or update
            const { data, error } = await supabase
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

            // Mark as synced in local DB
            await localDB.updatePhoto(photo.photo_id, {
              synced: 1,
              sync_action: null,
            });

            console.log(`✓ Synced photo metadata ${photo.photo_id}`);
          } catch (error) {
            const errorMessage = error instanceof Error
              ? error.message
              : JSON.stringify(error, null, 2);
            console.error(`❌ Failed to sync photo metadata ${photo.photo_id}:`, errorMessage);
            console.error('Full error object:', error);
            photoPushErrorCount++;
            // Will retry on next sync
          }
        }

        console.log(`📸 Photo create/update complete`);
      } else {
        console.log('✅ No photo creates/updates to sync');
      }

      // 3d. Delete photos from Supabase (BEFORE deleting entries)
      if (photosToDelete.length > 0) {
        console.log(`📸 Deleting ${photosToDelete.length} photos...`);

        for (const photo of photosToDelete) {
          try {
            // Delete from Supabase (ignore if file doesn't exist)
            try {
              const { error: deleteError } = await supabase
                .from('photos')
                .delete()
                .eq('photo_id', photo.photo_id);

              if (deleteError) {
                console.log(`ℹ️ Photo delete from Supabase (ignoring error): ${photo.photo_id}`, deleteError.message);
              }
            } catch (deleteErr) {
              console.log(`ℹ️ Photo delete from Supabase failed (ignoring): ${photo.photo_id}`);
            }

            // Try to delete from storage (ignore if file doesn't exist)
            if (photo.file_path) {
              try {
                const { error: storageError } = await supabase.storage
                  .from('photos')
                  .remove([photo.file_path]);

                if (storageError) {
                  console.log(`ℹ️ Photo storage file delete (ignoring error): ${photo.file_path}`, storageError.message);
                }
              } catch (storageErr) {
                console.log(`ℹ️ Photo storage file delete failed (ignoring): ${photo.file_path}`);
              }
            }

            // Permanently delete from local DB
            await localDB.permanentlyDeletePhoto(photo.photo_id);
            console.log(`✓ Deleted photo ${photo.photo_id}`);
          } catch (error) {
            const errorMessage = error instanceof Error
              ? error.message
              : JSON.stringify(error, null, 2);
            console.error(`❌ Failed to delete photo ${photo.photo_id}:`, errorMessage);
            photoPushErrorCount++;
            // Will retry on next sync
          }
        }

        console.log(`📸 Photo delete complete`);
      } else {
        console.log('✅ No photo deletes to sync');
      }

      // STEP 4: Push entry DELETES to Supabase (AFTER photos are deleted)
      // Delete photos first to avoid foreign key constraint violations
      if (entriesToDelete.length > 0) {
        console.log(`📤 Pushing ${entriesToDelete.length} entry deletes...`);

        for (const entry of entriesToDelete) {
          try {
            await this.syncEntry(entry);
            pushSuccessCount++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Failed to push entry delete ${entry.entry_id}:`, errorMessage);

            // Record the error in the database
            await localDB.recordSyncError(entry.entry_id, errorMessage);
            pushErrorCount++;
            // Will retry on next sync trigger
          }
        }

        console.log(`📤 Entry delete complete: ${pushSuccessCount} success, ${pushErrorCount} errors`);
      } else {
        console.log('✅ No entry deletes to push');
      }

      // STEP 5: Pull remote changes from Supabase (incremental or full if empty)
      console.log('📥 Pulling remote changes...');
      await this.pullFromSupabase(); // Auto-detects empty DB and does full pull if needed

      console.log('✅ Bidirectional sync complete');

      // STEP 5: Background photo download (non-blocking)
      // Download up to 10 photos in the background
      setTimeout(() => {
        downloadPhotosInBackground(10).catch(error => {
          console.error('Background photo download error:', error);
        });
      }, 1000); // Delay 1 second to not block sync completion

      // STEP 4: Invalidate React Query cache to trigger UI refresh
      if (this.queryClient) {
        console.log('🔄 Invalidating React Query cache...');
        this.queryClient.invalidateQueries({ queryKey: ['entries'] });
        this.queryClient.invalidateQueries({ queryKey: ['categories'] });
        this.queryClient.invalidateQueries({ queryKey: ['categoryTree'] });
        this.queryClient.invalidateQueries({ queryKey: ['unsyncedCount'] });
        console.log('✅ Cache invalidated, UI will refresh');
      }

      // STEP 5: Log sync summary
      const syncDuration = Date.now() - syncStartTime;
      const hasErrors = pushErrorCount > 0 || categoryPushErrorCount > 0 || photoPushErrorCount > 0;
      const logLevel = hasErrors ? 'warning' : 'info';

      const totalPushed = pushSuccessCount + categoryPushSuccessCount + photoPushSuccessCount;
      const totalErrors = pushErrorCount + categoryPushErrorCount + photoPushErrorCount;

      let message = `Sync completed in ${(syncDuration / 1000).toFixed(1)}s`;
      if (totalPushed > 0) {
        message += ` - Pushed: ${totalPushed}`;
      }
      if (totalErrors > 0) {
        message += ` - Errors: ${totalErrors}`;
      }

      await localDB.addSyncLog(logLevel, 'bidirectional_sync', message, {
        entries_pushed: pushSuccessCount,
        entries_errors: pushErrorCount,
        categories_pushed: categoryPushSuccessCount,
        categories_errors: categoryPushErrorCount,
        photos_pushed: photoPushSuccessCount,
        photos_errors: photoPushErrorCount,
        entries_pulled: 0, // Pull stats not tracked yet
      });
    } catch (error) {
      console.error('❌ Sync queue error:', error);

      // Log sync error
      const errorMessage = error instanceof Error ? error.message : String(error);
      await localDB.addSyncLog('error', 'bidirectional_sync', `Sync failed: ${errorMessage}`);
    } finally {
      this.isSyncing = false;
      this.lastSyncTime = Date.now(); // Update last sync time for throttling
    }
  }

  /**
   * Sync a single entry to Supabase
   */
  private async syncEntry(entry: Entry): Promise<void> {
    try {
      const { sync_action } = entry;

      // Prepare data for Supabase (exclude sync tracking fields)
      // Convert timestamps from Unix milliseconds to ISO strings
      const supabaseData = {
        entry_id: entry.entry_id,
        user_id: entry.user_id,
        title: entry.title,
        content: entry.content,
        tags: entry.tags,
        mentions: entry.mentions,
        category_id: entry.category_id,
        // GPS coordinates (where user was when creating entry)
        entry_latitude: entry.entry_latitude,
        entry_longitude: entry.entry_longitude,
        location_accuracy: entry.location_accuracy,
        // Location reference (points to locations table)
        location_id: entry.location_id,
        status: entry.status,
        due_date: entry.due_date && (typeof entry.due_date === 'number'
          ? new Date(entry.due_date).toISOString()
          : entry.due_date),
        completed_at: entry.completed_at && (typeof entry.completed_at === 'number'
          ? new Date(entry.completed_at).toISOString()
          : entry.completed_at),
        created_at: typeof entry.created_at === 'number'
          ? new Date(entry.created_at).toISOString()
          : entry.created_at,
        updated_at: typeof entry.updated_at === 'number'
          ? new Date(entry.updated_at).toISOString()
          : entry.updated_at,
        deleted_at: entry.deleted_at && (typeof entry.deleted_at === 'number'
          ? new Date(entry.deleted_at).toISOString()
          : entry.deleted_at), // Include deleted_at for soft deletes
        // Include conflict resolution fields
        version: entry.version || 1,
        base_version: entry.base_version || 1,
        conflict_status: entry.conflict_status || null,
        conflict_backup: entry.conflict_backup || null,
        last_edited_by: entry.last_edited_by || null,
        last_edited_device: entry.last_edited_device || null,
      };

      if (sync_action === 'create' || sync_action === 'update') {
        // CONFLICT DETECTION: Check if server has newer version
        if (sync_action === 'update') {
          const { data: serverEntry, error: fetchError } = await supabase
            .from('entries')
            .select('version, base_version, title, content, status, tags, mentions, last_edited_by, last_edited_device')
            .eq('entry_id', entry.entry_id)
            .single();

          if (!fetchError && serverEntry) {
            const serverVersion = (serverEntry as any).version || 1;
            const localBaseVersion = entry.base_version || 1;

            // CONFLICT DETECTED: Server has been updated since we last synced
            if (serverVersion > localBaseVersion) {
              console.warn(`⚠️ Conflict detected for entry ${entry.entry_id}: server v${serverVersion} > base v${localBaseVersion}`);

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

              // Keep server version, but mark as conflicted
              await localDB.updateEntry(entry.entry_id, {
                // Use server data
                title: serverData.title,
                content: serverData.content,
                status: serverData.status,
                tags: serverData.tags,
                mentions: serverData.mentions,
                // Update version tracking
                version: serverVersion,
                base_version: serverVersion,
                // Mark conflict
                conflict_status: 'conflicted',
                conflict_backup: JSON.stringify(localBackup),
                // Keep server attribution
                last_edited_by: serverData.last_edited_by,
                last_edited_device: serverData.last_edited_device,
                // Mark as synced (we've resolved by taking server version)
                synced: 1,
                sync_action: null,
              });

              console.log(`✓ Conflict resolved: kept server version, saved local changes as backup`);
              return; // Don't push to server, conflict handled
            }
          }
        }

        // No conflict OR create operation: Upsert to Supabase
        const { error } = await supabase
          .from('entries')
          .upsert(supabaseData, {
            onConflict: 'entry_id',
          });

        if (error) {
          // Provide detailed error message
          throw new Error(`Supabase upsert failed: ${error.message} (code: ${error.code || 'unknown'})`);
        }

        // Update base_version to match current version after successful sync
        await localDB.updateEntry(entry.entry_id, {
          base_version: entry.version || 1,
          synced: 1,
          sync_action: null,
        });

      } else if (sync_action === 'delete') {
        // Check if entry exists in Supabase first
        // Use maybeSingle() to avoid errors when row doesn't exist
        const { data: existingEntry, error: checkError } = await supabase
          .from('entries')
          .select('entry_id')
          .eq('entry_id', entry.entry_id)
          .maybeSingle();

        // If entry exists in Supabase, soft delete it
        if (existingEntry && !checkError) {
          const { error } = await supabase
            .from('entries')
            .update({
              deleted_at: entry.deleted_at || new Date().toISOString(),
              location_id: null, // Release the location when deleting
            })
            .eq('entry_id', entry.entry_id);

          if (error) {
            // Check if it's an RLS error (entry in weird state, can't be updated)
            if (error.code === '42501') {
              console.log(`ℹ️ Entry ${entry.entry_id} exists but RLS blocks update (orphaned/inconsistent state), marking as synced`);
            } else {
              throw new Error(`Supabase delete failed: ${error.message} (code: ${error.code || 'unknown'})`);
            }
          } else {
            console.log(`✓ Soft deleted entry ${entry.entry_id} in Supabase`);
          }
        } else {
          // Entry never existed in Supabase (local-only draft that was deleted)
          // This is expected for drafts that were never synced
          console.log(`ℹ️ Entry ${entry.entry_id} never synced to Supabase, skipping delete`);
        }

        // Mark as synced after deletion (whether it was in Supabase or not)
        await localDB.markSynced(entry.entry_id);
      }
    } catch (error) {
      // Enhance error message with context
      if (error instanceof Error) {
        throw new Error(`Entry sync failed (${entry.sync_action}): ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Sync a single category to Supabase
   */
  private async syncCategory(category: any): Promise<void> {
    try {
      const { sync_action } = category;

      // Prepare data for Supabase (exclude sync tracking fields)
      // Convert timestamps from Unix milliseconds to ISO strings
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
        // Upsert to Supabase
        const { error } = await supabase
          .from('categories')
          .upsert(supabaseData, {
            onConflict: 'category_id',
          });

        if (error) {
          throw new Error(`Supabase upsert failed: ${error.message} (code: ${error.code || 'unknown'})`);
        }

      } else if (sync_action === 'delete') {
        // Hard delete from Supabase
        const { error } = await supabase
          .from('categories')
          .delete()
          .eq('category_id', category.category_id);

        if (error) {
          throw new Error(`Supabase delete failed: ${error.message} (code: ${error.code || 'unknown'})`);
        }
      }

      // Mark as synced in local DB
      await localDB.markCategorySynced(category.category_id);
    } catch (error) {
      // Enhance error message with context
      if (error instanceof Error) {
        throw new Error(`Category sync failed (${category.sync_action}): ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Sync a single location to Supabase
   */
  private async syncLocation(location: LocationEntity): Promise<void> {
    try {
      const { sync_action } = location;

      // Prepare data for Supabase (exclude sync tracking fields)
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
        // Upsert to Supabase
        const { error } = await supabase
          .from('locations')
          .upsert(supabaseData, {
            onConflict: 'location_id',
          });

        if (error) {
          throw new Error(`Supabase upsert failed: ${error.message} (code: ${error.code || 'unknown'})`);
        }

      } else if (sync_action === 'delete') {
        // Soft delete from Supabase
        const { error } = await supabase
          .from('locations')
          .update({ deleted_at: location.deleted_at || new Date().toISOString() })
          .eq('location_id', location.location_id);

        if (error) {
          throw new Error(`Supabase delete failed: ${error.message} (code: ${error.code || 'unknown'})`);
        }
      }

      // Mark as synced in local DB
      await localDB.markLocationSynced(location.location_id);
    } catch (error) {
      // Enhance error message with context
      if (error instanceof Error) {
        throw new Error(`Location sync failed (${location.sync_action}): ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Manual sync trigger (for sync button)
   */
  async syncNow(): Promise<void> {
    console.log('🔄 Manual sync triggered');
    await this.processQueue();
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    unsyncedCount: number;
    isSyncing: boolean;
  }> {
    const unsyncedCount = await localDB.getUnsyncedCount();

    return {
      unsyncedCount,
      isSyncing: this.isSyncing,
    };
  }

  /**
   * Force pull from Supabase (full pull, ignores incremental sync)
   * Useful for debugging or re-syncing
   */
  async forcePull(): Promise<void> {
    console.log('🔄 Force pulling from Supabase (full pull)...');
    await this.pullFromSupabase(true); // Force full pull
  }

  /**
   * Get last pull timestamp from sync metadata
   */
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
      console.error('Error getting last pull timestamp:', error);
      return null;
    }
  }

  /**
   * Save last pull timestamp to sync metadata
   */
  private async saveLastPullTimestamp(timestamp: Date): Promise<void> {
    await localDB.runCustomQuery(
      'INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)',
      ['last_pull_timestamp', timestamp.getTime().toString(), Date.now()]
    );
  }

  /**
   * Mark initial pull as completed
   */
  private async markPullCompleted(): Promise<void> {
    await localDB.runCustomQuery(
      'INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)',
      ['initial_pull_completed', 'true', Date.now()]
    );
  }

  /**
   * Pull entries from Supabase (incremental or full)
   * Only fetches entries modified since last sync
   */
  private async pullFromSupabase(forceFullPull: boolean = false): Promise<void> {
    try {
      const pullStartTime = new Date();

      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('Not authenticated, skipping pull');
        return;
      }

      // Pull categories first (entries depend on them)
      await this.pullCategoriesFromSupabase(forceFullPull, pullStartTime);

      // Check if database is empty - if so, force full pull
      const entryCount = await localDB.getAllEntries();
      const databaseIsEmpty = entryCount.length === 0;

      if (databaseIsEmpty && !forceFullPull) {
        console.log('ℹ️ Database is empty, forcing full pull');
        forceFullPull = true;
      }

      // Get last pull timestamp for incremental sync
      const lastPullTimestamp = forceFullPull ? null : await this.getLastPullTimestamp();

      if (lastPullTimestamp) {
        console.log(`📥 Incremental pull: fetching entries modified since ${lastPullTimestamp.toISOString()}`);
      } else {
        console.log('📥 Full pull: fetching all entries from Supabase...');
      }

      // Fetch entries from Supabase (including deleted ones for proper sync)
      // Build query
      let query = supabase
        .from('entries')
        .select('*')
        .eq('user_id', user.id);

      // Apply incremental filter if we have a last pull timestamp
      if (lastPullTimestamp) {
        query = query.gt('updated_at', lastPullTimestamp.toISOString());
      }

      query = query.order('updated_at', { ascending: false });

      const { data: remoteEntries, error } = await query;

      if (error) {
        console.error('Failed to fetch from Supabase:', error);
        return;
      }

      // Process entries if they exist
      let savedCount = 0;
      let updatedCount = 0;
      let deletedCount = 0;
      let skippedCount = 0;

      if (remoteEntries && remoteEntries.length > 0) {
        console.log(`📥 Found ${remoteEntries.length} entries to pull from Supabase...`);

        for (const remoteEntry of remoteEntries) {
          try {
          // Check if entry already exists locally
          const localEntry = await localDB.getEntry(remoteEntry.entry_id);

          // Check if remote entry is deleted
          if (remoteEntry.deleted_at) {
            if (localEntry) {
              // Remote deleted - delete locally too
              await localDB.deleteEntry(remoteEntry.entry_id);
              deletedCount++;
              console.log(`  🗑️ Deleted: ${remoteEntry.title || '(no title)'}`);
            } else {
              // Already deleted locally, skip
              skippedCount++;
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
            // GPS coordinates (where user was when creating entry)
            entry_latitude: (remoteEntry as any).entry_latitude || null,
            entry_longitude: (remoteEntry as any).entry_longitude || null,
            location_accuracy: (remoteEntry as any).location_accuracy || null,
            // Location reference (points to locations table)
            location_id: (remoteEntry as any).location_id || null,
            status: (remoteEntry.status as "none" | "incomplete" | "in_progress" | "complete") || 'none',
            due_date: remoteEntry.due_date,
            completed_at: remoteEntry.completed_at,
            entry_date: (remoteEntry as any).entry_date || remoteEntry.created_at, // Fallback to created_at if entry_date not set
            created_at: remoteEntry.created_at,
            updated_at: remoteEntry.updated_at,
            deleted_at: remoteEntry.deleted_at,
            attachments: remoteEntry.attachments,
            local_only: 0, // From Supabase, so not local-only
            synced: 1, // Already in Supabase, so marked as synced
            sync_action: null,
            // Conflict resolution fields - when pulling from server, version = base_version (in sync)
            version: (remoteEntry as any).version || 1,
            base_version: (remoteEntry as any).version || 1, // Set base to current server version
            conflict_status: (remoteEntry as any).conflict_status || null,
            conflict_backup: (remoteEntry as any).conflict_backup || null,
            last_edited_by: (remoteEntry as any).last_edited_by || null,
            last_edited_device: (remoteEntry as any).last_edited_device || null,
          };

          if (!localEntry) {
            // New entry from remote - save it
            await localDB.saveEntry(entry);
            await localDB.markSynced(entry.entry_id);
            savedCount++;
            console.log(`  ✓ New: ${entry.title || '(no title)'}`);
          } else {
            // Pure last-write-wins: Compare timestamps, newer wins
            const remoteTime = new Date(remoteEntry.updated_at).getTime();
            const localTime = new Date(localEntry.updated_at).getTime();

            if (remoteTime > localTime) {
              // Remote is newer - accept remote changes
              await localDB.updateEntry(entry.entry_id, entry);
              await localDB.markSynced(entry.entry_id);
              updatedCount++;
              console.log(`  ↻ Updated: ${entry.title || '(no title)'}`);
            } else if (remoteTime < localTime) {
              // Local is newer - skip (will be pushed in next push sync)
              skippedCount++;
              console.log(`  ⊘ Skipped (local newer): ${entry.title || '(no title)'}`);
            } else {
              // Timestamps equal - already in sync
              skippedCount++;
            }
          }
        } catch (error) {
          console.error(`Failed to process entry ${remoteEntry.entry_id}:`, error);
        }
        }

        console.log(`✅ Entry pull sync complete: ${savedCount} new, ${updatedCount} updated, ${deletedCount} deleted, ${skippedCount} skipped`);
      } else {
        console.log('No new entries to pull from Supabase');
      }

      // Pull photo metadata from Supabase (files downloaded on-demand)
      console.log('🔍 DEBUG: About to call pullPhotosFromSupabase...');
      console.log('🔍 DEBUG: forceFullPull =', forceFullPull);
      console.log('🔍 DEBUG: pullStartTime =', pullStartTime);
      await this.pullPhotosFromSupabase(forceFullPull, pullStartTime);
      console.log('🔍 DEBUG: pullPhotosFromSupabase completed');

      // Save last pull timestamp for incremental sync
      await this.saveLastPullTimestamp(pullStartTime);
      console.log(`📅 Last pull timestamp saved: ${pullStartTime.toISOString()}`);

      // Log final count
      const totalEntries = await localDB.getAllEntries();
      console.log(`📊 Total entries in local database: ${totalEntries.length}`);

      // Mark pull as completed (for first-time pull check)
      await this.markPullCompleted();
    } catch (error) {
      console.error('Pull sync failed:', error);
    }
  }

  /**
   * Pull categories from Supabase
   */
  private async pullCategoriesFromSupabase(forceFullPull: boolean, pullStartTime: Date): Promise<void> {
    try {
      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('Not authenticated, skipping category pull');
        return;
      }

      // For categories, we always do a full pull since they're small and rarely change
      // We could implement incremental sync later if needed
      console.log('📥 Pulling categories from Supabase...');

      const { data: remoteCategories, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('full_path');

      if (error) {
        console.error('Failed to fetch categories from Supabase:', error);
        return;
      }

      if (!remoteCategories || remoteCategories.length === 0) {
        console.log('No categories to pull from Supabase');
        return;
      }

      console.log(`📥 Found ${remoteCategories.length} categories to pull from Supabase...`);

      // Process each category
      let savedCount = 0;
      let updatedCount = 0;

      for (const remoteCategory of remoteCategories) {
        try {
          // Check if category already exists locally
          const localCategory = await localDB.getCategory(remoteCategory.category_id);

          const category = {
            category_id: remoteCategory.category_id,
            user_id: remoteCategory.user_id,
            name: remoteCategory.name,
            full_path: remoteCategory.full_path,
            parent_category_id: remoteCategory.parent_category_id,
            depth: remoteCategory.depth,
            entry_count: remoteCategory.entry_count || 0,
            color: remoteCategory.color,
            icon: remoteCategory.icon,
            created_at: remoteCategory.created_at,
            updated_at: remoteCategory.updated_at || remoteCategory.created_at,
            synced: 1, // Already in Supabase, so marked as synced
            sync_action: null,
          };

          if (!localCategory) {
            // New category from remote - save it
            await localDB.saveCategory(category);
            await localDB.markCategorySynced(category.category_id);
            savedCount++;
            console.log(`  ✓ New category: ${category.name}`);
          } else {
            // Category exists - only update if actual content changed
            // Don't include updated_at in comparison (it changes on every server touch)
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
              console.log(`  ↻ Updated category: ${category.name}`);
            }
            // Silently skip if no content changes
          }
        } catch (error) {
          console.error(`Failed to process category ${remoteCategory.category_id}:`, error);
        }
      }

      console.log(`✅ Category pull complete: ${savedCount} new, ${updatedCount} updated`);
    } catch (error) {
      console.error('Category pull sync failed:', error);
    }
  }

  /**
   * Pull photo metadata from Supabase
   * Downloads metadata only - actual files are downloaded on-demand
   */
  private async pullPhotosFromSupabase(forceFullPull: boolean, pullStartTime: Date): Promise<void> {
    try {
      console.log('📸 ========================================');
      console.log('📸 STARTING PHOTO PULL SYNC');
      console.log('📸 ========================================');

      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ Not authenticated, skipping photo pull');
        return;
      }

      console.log(`📸 Authenticated user: ${user.id}`);
      console.log('📸 Fetching photos from Supabase...');

      // Fetch all photos for this user
      const { data: remotePhotos, error } = await supabase
        .from('photos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      console.log('📸 Supabase query response:', {
        success: !error,
        photoCount: remotePhotos?.length || 0,
        error: error?.message
      });

      if (error) {
        console.error('❌ Failed to fetch photos from Supabase:', error);
        console.error('   Error code:', error.code);
        console.error('   Error message:', error.message);
        console.error('   Error details:', JSON.stringify(error, null, 2));
        return;
      }

      if (!remotePhotos || remotePhotos.length === 0) {
        console.log('ℹ️ No photos to pull from Supabase (empty result)');
        return;
      }

      console.log(`📸 ✅ Found ${remotePhotos.length} photos to pull from Supabase!`);
      console.log('📸 Sample photo data:', JSON.stringify(remotePhotos[0], null, 2));

      // Process each photo
      let savedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      console.log(`📸 Processing ${remotePhotos.length} photos...`);

      for (const remotePhoto of remotePhotos) {
        try {
          console.log(`📸 [${savedCount + updatedCount + skippedCount + 1}/${remotePhotos.length}] Processing photo: ${remotePhoto.photo_id}`);

          // Check if photo already exists locally
          const localPhotos = await localDB.runCustomQuery(
            'SELECT * FROM photos WHERE photo_id = ?',
            [remotePhoto.photo_id]
          );
          const localPhoto = localPhotos.length > 0 ? localPhotos[0] : null;

          console.log(`   Local status: ${localPhoto ? 'EXISTS' : 'NEW'}`);
          if (localPhoto) {
            console.log(`   Local photo:`, {
              photo_id: localPhoto.photo_id,
              position: localPhoto.position,
              mime_type: localPhoto.mime_type,
              synced: localPhoto.synced
            });
          }

          // Type cast to include all photo fields (TypeScript types need regeneration)
          const remotePhotoWithFields = remotePhoto as any;

          const photo = {
            photo_id: remotePhotoWithFields.photo_id,
            entry_id: remotePhotoWithFields.entry_id,
            user_id: remotePhotoWithFields.user_id,
            file_path: remotePhotoWithFields.file_path,
            local_path: localPhoto?.local_path || null, // Keep existing local_path if it exists
            mime_type: remotePhotoWithFields.mime_type,
            file_size: remotePhotoWithFields.file_size || null, // Optional metadata
            width: remotePhotoWithFields.width || null,
            height: remotePhotoWithFields.height || null,
            position: remotePhotoWithFields.position,
            created_at: new Date(remotePhotoWithFields.created_at).getTime(),
            updated_at: new Date(remotePhotoWithFields.updated_at).getTime(),
            uploaded: true, // From Supabase, so it's uploaded
            synced: 1, // Already in Supabase, so marked as synced
            sync_action: null,
          };

          if (!localPhoto) {
            // New photo from remote - save metadata only
            console.log(`   📥 Creating NEW photo metadata for entry ${photo.entry_id}`);
            console.log(`   Photo data:`, {
              photo_id: photo.photo_id,
              entry_id: photo.entry_id,
              file_path: photo.file_path,
              file_size: photo.file_size,
              position: photo.position
            });
            await localDB.createPhoto(photo);
            savedCount++;
            console.log(`   ✅ Successfully created photo metadata: ${photo.photo_id}`);
          } else {
            // Photo exists - update metadata if changed
            const hasChanged =
              localPhoto.position !== photo.position ||
              localPhoto.mime_type !== photo.mime_type;

            if (hasChanged) {
              console.log(`   📝 Updating photo metadata (changed)`);
              await localDB.updatePhoto(photo.photo_id, photo);
              updatedCount++;
              console.log(`   ✅ Updated photo metadata: ${photo.photo_id}`);
            } else {
              console.log(`   ⏭️ Skipping (no changes)`);
              skippedCount++;
            }
          }
        } catch (error) {
          console.error(`❌ Failed to process photo ${remotePhoto.photo_id}:`, error);
          if (error instanceof Error) {
            console.error(`   Error details: ${error.message}`);
            console.error(`   Stack: ${error.stack}`);
          }
        }
      }

      console.log('📸 ========================================');
      console.log(`📸 PHOTO PULL SYNC COMPLETE`);
      console.log(`📸 ✅ New: ${savedCount}`);
      console.log(`📸 ↻ Updated: ${updatedCount}`);
      console.log(`📸 ⏭️ Skipped: ${skippedCount}`);
      console.log(`📸 Total processed: ${savedCount + updatedCount + skippedCount}/${remotePhotos.length}`);
      console.log('📸 ========================================');
    } catch (error) {
      console.error('📸 ========================================');
      console.error('❌ PHOTO METADATA PULL SYNC FAILED');
      console.error('📸 ========================================');
      console.error('Error:', error);
      if (error instanceof Error) {
        console.error(`Error message: ${error.message}`);
        console.error(`Error stack: ${error.stack}`);
      }
    }
  }
}

// Export singleton instance
export const syncQueue = new SyncQueue();
