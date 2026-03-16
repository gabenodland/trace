/**
 * Mobile Data Management Hooks
 *
 * Composes local (SQLite) queries to provide complete
 * data management state for the UI.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DeviceStorageUsage } from '@trace/core';
import * as api from './mobileDataManagementApi';
import type { DataSummary, EntryListItem } from './mobileDataManagementApi';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const dataManagementKeys = {
  all: ['dataManagement'] as const,
  deviceStorage: () => [...dataManagementKeys.all, 'deviceStorage'] as const,
  topLevelCounts: () => [...dataManagementKeys.all, 'topLevelCounts'] as const,
  entrySummary: () => [...dataManagementKeys.all, 'entrySummary'] as const,
  deletedSummary: () => [...dataManagementKeys.all, 'deletedSummary'] as const,
  entryList: () => [...dataManagementKeys.all, 'entryList'] as const,
  deletedEntries: () => [...dataManagementKeys.all, 'deletedEntries'] as const,
  deletedEntryCount: () => [...dataManagementKeys.all, 'deletedEntryCount'] as const,
  privateStreams: () => [...dataManagementKeys.all, 'privateStreams'] as const,
};

// ============================================================================
// DEVICE STORAGE
// ============================================================================

export function useDeviceStorageUsage() {
  const query = useQuery<DeviceStorageUsage>({
    queryKey: dataManagementKeys.deviceStorage(),
    queryFn: api.getDeviceStorageUsage,
    staleTime: 5 * 60 * 1000,
  });

  return {
    deviceStorage: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

// ============================================================================
// TOP-LEVEL COUNTS (streams, places)
// ============================================================================

export function useTopLevelCounts() {
  const query = useQuery({
    queryKey: dataManagementKeys.topLevelCounts(),
    queryFn: api.getTopLevelCounts,
    staleTime: 5 * 60 * 1000,
  });

  return {
    counts: query.data ?? { streams: 0, places: 0 },
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

// ============================================================================
// ENTRY SUMMARY (live entries card)
// ============================================================================

export function useEntrySummary() {
  const query = useQuery<DataSummary>({
    queryKey: dataManagementKeys.entrySummary(),
    queryFn: api.getEntrySummary,
    staleTime: 5 * 60 * 1000,
  });

  return {
    summary: query.data ?? { entryCount: 0, attachmentCount: 0, attachmentBytes: 0, versionCount: 0 },
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

// ============================================================================
// DELETED ENTRY SUMMARY (trash card)
// ============================================================================

export function useDeletedEntrySummary() {
  const query = useQuery<DataSummary>({
    queryKey: dataManagementKeys.deletedSummary(),
    queryFn: api.getDeletedEntrySummary,
    staleTime: 5 * 60 * 1000,
  });

  return {
    summary: query.data ?? { entryCount: 0, attachmentCount: 0, attachmentBytes: 0, versionCount: 0 },
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

// ============================================================================
// ENTRY LIST (entries screen)
// ============================================================================

export function useEntryList() {
  const query = useQuery<EntryListItem[]>({
    queryKey: dataManagementKeys.entryList(),
    queryFn: api.getEntryListItems,
    staleTime: 5 * 60 * 1000,
  });

  return {
    entries: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

// ============================================================================
// LOCAL TRASH
// ============================================================================

export function useLocalTrash() {
  const queryClient = useQueryClient();

  const deletedEntriesQuery = useQuery({
    queryKey: dataManagementKeys.deletedEntries(),
    queryFn: api.getLocalDeletedEntries,
    refetchOnMount: 'always' as const,
  });

  const restoreMutation = useMutation({
    mutationFn: api.restoreEntryLocally,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dataManagementKeys.deletedEntries() });
      queryClient.invalidateQueries({ queryKey: dataManagementKeys.deletedSummary() });
      queryClient.invalidateQueries({ queryKey: dataManagementKeys.entrySummary() });
      queryClient.invalidateQueries({ queryKey: dataManagementKeys.entryList() });
      queryClient.invalidateQueries({ queryKey: dataManagementKeys.topLevelCounts() });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: api.hardDeleteEntryLocally,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dataManagementKeys.deletedEntries() });
      queryClient.invalidateQueries({ queryKey: dataManagementKeys.deletedSummary() });
    },
  });

  const emptyTrashMutation = useMutation({
    mutationFn: api.emptyTrash,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dataManagementKeys.deletedEntries() });
      queryClient.invalidateQueries({ queryKey: dataManagementKeys.deletedSummary() });
      queryClient.invalidateQueries({ queryKey: dataManagementKeys.entrySummary() });
      queryClient.invalidateQueries({ queryKey: dataManagementKeys.entryList() });
      queryClient.invalidateQueries({ queryKey: dataManagementKeys.topLevelCounts() });
    },
  });

  return {
    deletedEntries: deletedEntriesQuery.data ?? [],
    deletedEntryCount: (deletedEntriesQuery.data ?? []).length,
    isLoading: deletedEntriesQuery.isLoading,

    restoreEntry: restoreMutation.mutateAsync,
    isRestoring: restoreMutation.isPending,

    hardDeleteEntry: hardDeleteMutation.mutateAsync,
    isDeletingEntry: hardDeleteMutation.isPending,

    emptyTrash: emptyTrashMutation.mutateAsync,
    isEmptyingTrash: emptyTrashMutation.isPending,

    refetch: deletedEntriesQuery.refetch,
  };
}

// ============================================================================
// PRIVACY SUMMARY
// ============================================================================

export function usePrivacySummary() {
  const query = useQuery({
    queryKey: dataManagementKeys.privateStreams(),
    queryFn: api.getPrivateStreams,
    staleTime: 5 * 60 * 1000,
  });

  return {
    privateStreams: query.data ?? [],
    hasPrivateStreams: (query.data?.length ?? 0) > 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
