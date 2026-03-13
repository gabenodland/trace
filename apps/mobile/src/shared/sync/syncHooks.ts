/**
 * Sync Hooks - React hooks for sync operations
 *
 * This is the PRIMARY interface for components to interact with sync.
 * Components should NEVER import syncService or syncApi directly.
 *
 * Architecture:
 * Components → Hooks (this file) → API → syncService (internal)
 *
 * Status updates are EVENT-DRIVEN via syncService.subscribe() —
 * no polling. Listeners fire immediately when sync starts/stops.
 */

import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fullSync,
  forcePull,
  getSyncStatusSync,
  subscribeSyncStatus,
  SyncResult,
  SyncStatus,
} from './syncApi';

// ============================================================================
// MAIN SYNC HOOK
// ============================================================================

/**
 * Hook for sync operations - THE SINGLE SOURCE OF TRUTH for sync
 *
 * @example
 * function ProfileScreen() {
 *   const { isSyncing, sync, forcePull } = useSync();
 *
 *   return (
 *     <View>
 *       <Button onPress={sync} disabled={isSyncing}>
 *         {isSyncing ? 'Syncing...' : 'Sync Now'}
 *       </Button>
 *     </View>
 *   );
 * }
 */
export function useSync() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>(getSyncStatusSync);

  useEffect(() => {
    // Get fresh status on mount
    setStatus(getSyncStatusSync());
    return subscribeSyncStatus(setStatus);
  }, []);

  // Mutation for full sync
  const syncMutation = useMutation<SyncResult>({
    mutationFn: fullSync,
    onSuccess: () => {
      // Invalidate data queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
  });

  // Mutation for force pull
  const forcePullMutation = useMutation<SyncResult>({
    mutationFn: forcePull,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
  });

  const syncAction = useCallback(() => syncMutation.mutateAsync(), [syncMutation.mutateAsync]);
  const forcePullAction = useCallback(() => forcePullMutation.mutateAsync(), [forcePullMutation.mutateAsync]);

  return {
    // Status data (event-driven, no polling)
    isSyncing: status.isSyncing || syncMutation.isPending || forcePullMutation.isPending,
    lastSyncTime: status.lastSyncTime,

    // Actions
    sync: syncAction,
    forcePull: forcePullAction,

    // Mutation states (for detailed UI feedback)
    syncState: {
      isPending: syncMutation.isPending,
      isSuccess: syncMutation.isSuccess,
      isError: syncMutation.isError,
      error: syncMutation.error,
      data: syncMutation.data,
    },
    forcePullState: {
      isPending: forcePullMutation.isPending,
      isSuccess: forcePullMutation.isSuccess,
      isError: forcePullMutation.isError,
      error: forcePullMutation.error,
      data: forcePullMutation.data,
    },
  };
}

// ============================================================================
// SYNC STATUS HOOK (lightweight alternative)
// ============================================================================

/**
 * Lightweight hook for just displaying sync status (e.g., TopBar indicator)
 * Event-driven — re-renders only when sync starts/stops, not on a timer.
 *
 * @example
 * function TopBar() {
 *   const { isSyncing } = useSyncStatus();
 *   return isSyncing && <SyncBadge />;
 * }
 */
export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatusSync);

  useEffect(() => {
    setStatus(getSyncStatusSync());
    return subscribeSyncStatus(setStatus);
  }, []);

  return {
    isSyncing: status.isSyncing,
    lastSyncTime: status.lastSyncTime,
  };
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export type { SyncResult, SyncStatus } from './syncApi';
