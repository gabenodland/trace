/**
 * Sync Hooks - React hooks for sync operations
 *
 * This is the PRIMARY interface for components to interact with sync.
 * Components should NEVER import syncService or syncApi directly.
 *
 * Architecture:
 * Components → Hooks (this file) → API → syncService (internal)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fullSync,
  forcePull,
  getSyncStatus,
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
 *   const { unsyncedCount, isSyncing, sync, forcePull } = useSync();
 *
 *   return (
 *     <View>
 *       <Text>Unsynced: {unsyncedCount}</Text>
 *       <Button onPress={sync} disabled={isSyncing}>
 *         {isSyncing ? 'Syncing...' : 'Sync Now'}
 *       </Button>
 *     </View>
 *   );
 * }
 */
export function useSync() {
  const queryClient = useQueryClient();

  // Query for sync status (polls every 5 seconds)
  const statusQuery = useQuery<SyncStatus>({
    queryKey: ['syncStatus'],
    queryFn: getSyncStatus,
    refetchInterval: 5000, // Poll every 5 seconds
    staleTime: 2000, // Consider data fresh for 2 seconds
  });

  // Mutation for full sync
  const syncMutation = useMutation<SyncResult>({
    mutationFn: fullSync,
    onSuccess: () => {
      // Refetch sync status after sync completes
      queryClient.invalidateQueries({ queryKey: ['syncStatus'] });
      // Invalidate data queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['categoryTree'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
  });

  // Mutation for force pull
  const forcePullMutation = useMutation<SyncResult>({
    mutationFn: forcePull,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syncStatus'] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['categoryTree'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
  });

  return {
    // Status data
    unsyncedCount: statusQuery.data?.unsyncedCount ?? 0,
    isSyncing: statusQuery.data?.isSyncing ?? syncMutation.isPending ?? forcePullMutation.isPending,
    lastSyncTime: statusQuery.data?.lastSyncTime ?? null,
    isLoading: statusQuery.isLoading,
    error: statusQuery.error,

    // Actions
    sync: syncMutation.mutateAsync,
    forcePull: forcePullMutation.mutateAsync,
    refetchStatus: statusQuery.refetch,

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
 * Lightweight hook for just displaying sync status
 * Use this when you only need to show unsynced count (e.g., in nav bar)
 *
 * @example
 * function NavBar() {
 *   const { unsyncedCount } = useSyncStatus();
 *   return unsyncedCount > 0 && <Badge>{unsyncedCount}</Badge>;
 * }
 */
export function useSyncStatus() {
  const statusQuery = useQuery<SyncStatus>({
    queryKey: ['syncStatus'],
    queryFn: getSyncStatus,
    refetchInterval: 5000,
    staleTime: 2000,
  });

  return {
    unsyncedCount: statusQuery.data?.unsyncedCount ?? 0,
    isSyncing: statusQuery.data?.isSyncing ?? false,
    lastSyncTime: statusQuery.data?.lastSyncTime ?? null,
    isLoading: statusQuery.isLoading,
  };
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export type { SyncResult, SyncStatus } from './syncApi';
