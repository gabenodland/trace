/**
 * Realtime Service - Per-entry subscriptions for live updates
 *
 * This service manages Supabase realtime subscriptions for entries that are
 * currently being edited. When another device updates an entry, this service:
 * 1. Updates LocalDB with the new data
 * 2. Invalidates React Query cache
 * 3. Shows a toast notification
 *
 * Usage:
 * - Subscribe when user opens entry editor
 * - Unsubscribe when user closes entry editor
 */

import { supabase } from '@trace/core/src/shared/supabase';
import { localDB } from '../db/localDB';
import { Entry, isCompletedStatus } from '@trace/core';
import type { QueryClient } from '@tanstack/react-query';
import { createScopedLogger } from '../utils/logger';

const log = createScopedLogger('Realtime', '📡');

// ============================================================================
// TYPES
// ============================================================================

export interface RealtimeSubscription {
  entryId: string;
  channel: any;
  unsubscribe: () => void;
}

export type OnExternalChangeCallback = (entry: Entry) => void;

// ============================================================================
// REALTIME SERVICE CLASS
// ============================================================================

class RealtimeService {
  private subscriptions: Map<string, RealtimeSubscription> = new Map();
  private queryClient: QueryClient | null = null;
  private onExternalChangeCallback: OnExternalChangeCallback | null = null;

  /**
   * Set the React Query client for cache invalidation
   */
  setQueryClient(queryClient: QueryClient): void {
    this.queryClient = queryClient;
  }

  /**
   * Set callback to be called when an external change is detected
   * This is typically used to show a toast notification
   */
  setOnExternalChangeCallback(callback: OnExternalChangeCallback | null): void {
    this.onExternalChangeCallback = callback;
  }

  /**
   * Subscribe to realtime updates for a specific entry
   * Call this when user opens entry editor
   */
  async subscribeToEntry(entryId: string): Promise<void> {
    // Don't subscribe if already subscribed
    if (this.subscriptions.has(entryId)) {
      log.debug('Already subscribed to entry', { entryId });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        log.debug('Not authenticated, skipping realtime subscription');
        return;
      }

      const channelName = `entry-${entryId}`;

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'entries',
            filter: `entry_id=eq.${entryId}`,
          },
          (payload) => {
            this.handleEntryUpdate(entryId, payload.new as any, user.id);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'entries',
            filter: `entry_id=eq.${entryId}`,
          },
          () => {
            this.handleEntryDelete(entryId);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            log.info('Subscribed to entry realtime', { entryId });
          } else if (status === 'CHANNEL_ERROR') {
            log.error('Failed to subscribe to entry', { entryId, status });
          }
        });

      const subscription: RealtimeSubscription = {
        entryId,
        channel,
        unsubscribe: () => {
          supabase.removeChannel(channel);
        },
      };

      this.subscriptions.set(entryId, subscription);
      log.debug('Created realtime subscription', { entryId });

    } catch (error) {
      log.error('Failed to create realtime subscription', error, { entryId });
    }
  }

  /**
   * Unsubscribe from realtime updates for a specific entry
   * Call this when user closes entry editor
   */
  unsubscribeFromEntry(entryId: string): void {
    const subscription = this.subscriptions.get(entryId);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(entryId);
      log.info('Unsubscribed from entry realtime', { entryId });
    }
  }

  /**
   * Unsubscribe from all entry subscriptions
   * Call this on logout or app cleanup
   */
  unsubscribeAll(): void {
    for (const [entryId, subscription] of this.subscriptions) {
      subscription.unsubscribe();
      log.debug('Unsubscribed from entry', { entryId });
    }
    this.subscriptions.clear();
    log.info('Unsubscribed from all entries');
  }

  /**
   * Check if currently subscribed to an entry
   */
  isSubscribed(entryId: string): boolean {
    return this.subscriptions.has(entryId);
  }

  /**
   * Get count of active subscriptions (for debugging)
   */
  getActiveSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  // ==========================================================================
  // PRIVATE HANDLERS
  // ==========================================================================

  /**
   * Handle entry update from another device
   */
  private async handleEntryUpdate(
    entryId: string,
    serverData: any,
    currentUserId: string
  ): Promise<void> {
    try {
      // Only process updates from the same user (RLS should handle this, but double-check)
      if (serverData.user_id !== currentUserId) {
        log.debug('Ignoring update for different user', { entryId });
        return;
      }

      // Get local entry to check if this is an external change
      const localEntry = await localDB.getEntry(entryId);
      if (!localEntry) {
        log.debug('Local entry not found, skipping update', { entryId });
        return;
      }

      // Check if local entry has unsynced changes
      // If so, we should NOT overwrite them - let the sync conflict resolution handle it
      if (localEntry.synced === 0) {
        log.debug('Local entry has unsynced changes, skipping realtime update', { entryId });
        return;
      }

      // Compare versions to determine if this is actually a newer version
      const serverVersion = serverData.version || 1;
      const localVersion = localEntry.version || 1;

      if (serverVersion <= localVersion) {
        log.debug('Server version not newer, skipping update', {
          entryId,
          serverVersion,
          localVersion,
        });
        return;
      }

      // This is an external update from another device - update LocalDB
      log.info('External update detected', {
        entryId,
        serverVersion,
        localVersion,
        editedBy: serverData.last_edited_device,
      });

      // Build updated entry object
      const updatedEntry: Partial<Entry> = {
        title: serverData.title,
        content: serverData.content,
        tags: serverData.tags || [],
        mentions: serverData.mentions || [],
        stream_id: serverData.stream_id,
        entry_date: serverData.entry_date,
        entry_latitude: serverData.entry_latitude,
        entry_longitude: serverData.entry_longitude,
        location_accuracy: serverData.location_accuracy,
        location_id: serverData.location_id,
        status: serverData.status || 'none',
        type: serverData.type || null,
        due_date: serverData.due_date,
        completed_at: serverData.completed_at,
        priority: serverData.priority || 0,
        rating: serverData.rating || 0,
        is_pinned: serverData.is_pinned || false,
        updated_at: serverData.updated_at,
        deleted_at: serverData.deleted_at,
        version: serverVersion,
        base_version: serverVersion,
        last_edited_by: serverData.last_edited_by,
        last_edited_device: serverData.last_edited_device,
        // Mark as synced since this came from server
        synced: 1,
        sync_action: null,
      };

      // Update LocalDB
      await localDB.updateEntry(entryId, updatedEntry);

      // Invalidate React Query cache
      if (this.queryClient) {
        this.queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
        this.queryClient.invalidateQueries({ queryKey: ['entries'] });
      }

      // Call callback to notify UI (show toast)
      if (this.onExternalChangeCallback) {
        const fullEntry = await localDB.getEntry(entryId);
        if (fullEntry) {
          this.onExternalChangeCallback(fullEntry);
        }
      }

    } catch (error) {
      log.error('Failed to handle entry update', error, { entryId });
    }
  }

  /**
   * Handle entry deletion from another device
   */
  private async handleEntryDelete(entryId: string): Promise<void> {
    try {
      log.info('External delete detected', { entryId });

      // Soft delete in LocalDB (mark as deleted)
      await localDB.updateEntry(entryId, {
        deleted_at: new Date().toISOString(),
        synced: 1,
        sync_action: null,
      });

      // Invalidate React Query cache
      if (this.queryClient) {
        this.queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
        this.queryClient.invalidateQueries({ queryKey: ['entries'] });
      }

      // Unsubscribe from this entry since it's deleted
      this.unsubscribeFromEntry(entryId);

    } catch (error) {
      log.error('Failed to handle entry delete', error, { entryId });
    }
  }
}

// Export singleton instance
export const realtimeService = new RealtimeService();
