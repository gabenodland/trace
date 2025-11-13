/**
 * Sync Queue Service
 * Handles bidirectional synchronization between local SQLite and Supabase
 */

import { localDB } from '../db/localDB';
import { supabase } from '@trace/core/src/shared/supabase';
import { Entry } from '@trace/core';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type { QueryClient } from '@tanstack/react-query';

class SyncQueue {
  private isSyncing = false;
  private isInitialized = false;
  private appStateSubscription: any = null;
  private realtimeChannel: any = null;
  private queryClient: QueryClient | null = null;
  private realtimeDebounceTimer: NodeJS.Timeout | null = null;

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

    // Listen to app state changes (foreground/background)
    // This is the PRIMARY sync trigger - sync when user opens app
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    // Set up Supabase Realtime subscriptions for instant updates
    // This provides real-time sync when changes occur on server
    await this.setupRealtimeSubscription();

    console.log('✅ Sync queue initialized (3 triggers: app foreground, realtime, manual)');
  }

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

      // Subscribe to changes on entries and categories tables for this user
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
        .subscribe();

      console.log('📡 Realtime subscription active (entries + categories)');
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
   * Handle app state changes
   */
  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
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

      // STEP 2: Push local entry changes to Supabase (AFTER categories are synced)
      const unsyncedEntries = await localDB.getUnsyncedEntries();

      if (unsyncedEntries.length > 0) {
        console.log(`📤 Pushing ${unsyncedEntries.length} entry changes...`);

        for (const entry of unsyncedEntries) {
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

        console.log(`📤 Entry push complete: ${pushSuccessCount} success, ${pushErrorCount} errors`);
      } else {
        console.log('✅ No entry changes to push');
      }

      // STEP 3: Pull remote changes from Supabase (incremental or full if empty)
      console.log('📥 Pulling remote changes...');
      await this.pullFromSupabase(); // Auto-detects empty DB and does full pull if needed

      console.log('✅ Bidirectional sync complete');

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
      const hasErrors = pushErrorCount > 0 || categoryPushErrorCount > 0;
      const logLevel = hasErrors ? 'warning' : 'info';

      const totalPushed = pushSuccessCount + categoryPushSuccessCount;
      const totalErrors = pushErrorCount + categoryPushErrorCount;

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
        entries_pulled: 0, // Pull stats not tracked yet
      });
    } catch (error) {
      console.error('❌ Sync queue error:', error);

      // Log sync error
      const errorMessage = error instanceof Error ? error.message : String(error);
      await localDB.addSyncLog('error', 'bidirectional_sync', `Sync failed: ${errorMessage}`);
    } finally {
      this.isSyncing = false;
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
        location_lat: entry.location_lat,
        location_lng: entry.location_lng,
        location_accuracy: entry.location_accuracy,
        location_name: entry.location_name,
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
        // Soft delete: Update deleted_at timestamp in Supabase
        // Note: We don't update updated_at - that should only change when content changes
        const { error } = await supabase
          .from('entries')
          .update({
            deleted_at: entry.deleted_at || new Date().toISOString(),
          })
          .eq('entry_id', entry.entry_id);

        if (error) {
          throw new Error(`Supabase delete failed: ${error.message} (code: ${error.code || 'unknown'})`);
        }

        // Mark as synced after deletion
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

      if (!remoteEntries || remoteEntries.length === 0) {
        console.log('No new entries to pull from Supabase');
        // Still update timestamp even if no changes
        await this.saveLastPullTimestamp(pullStartTime);
        return;
      }

      console.log(`📥 Found ${remoteEntries.length} entries to pull from Supabase...`);

      // Process each entry with last-write-wins resolution
      let savedCount = 0;
      let updatedCount = 0;
      let deletedCount = 0;
      let skippedCount = 0;

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
            location_lat: remoteEntry.location_lat,
            location_lng: remoteEntry.location_lng,
            location_accuracy: (remoteEntry as any).location_accuracy || null,
            location_name: remoteEntry.location_name,
            status: remoteEntry.status || 'none',
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

      console.log(`✅ Pull sync complete: ${savedCount} new, ${updatedCount} updated, ${deletedCount} deleted, ${skippedCount} skipped`);

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
            // Category exists - update it (categories don't have conflict resolution, server wins)
            await localDB.updateCategory(category.category_id, category);
            await localDB.markCategorySynced(category.category_id);
            updatedCount++;
            console.log(`  ↻ Updated category: ${category.name}`);
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
}

// Export singleton instance
export const syncQueue = new SyncQueue();
