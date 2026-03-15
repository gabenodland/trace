// React Query hooks for data management operations

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCloudStorageUsage,
  getDeletedEntries,
  getDeletedStreams,
  getDeletedLocations,
  getDeletedEntryDetail,
  restoreEntry,
  hardDeleteEntry,
  hardDeleteStream,
  hardDeleteLocation,
} from "./dataManagementApi";

// ============================================================================
// QUERY KEYS
// ============================================================================

const QUERY_KEYS = {
  cloudStorage: ["dataManagement", "cloudStorage"] as const,
  deletedEntries: ["dataManagement", "deletedEntries"] as const,
  deletedStreams: ["dataManagement", "deletedStreams"] as const,
  deletedLocations: ["dataManagement", "deletedLocations"] as const,
} as const;

// ============================================================================
// STORAGE QUERY
// ============================================================================

/**
 * Internal: Query hook for cloud storage usage
 */
function useCloudStorageQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.cloudStorage,
    queryFn: getCloudStorageUsage,
    staleTime: 5 * 60 * 1000, // 5 min — storage doesn't change rapidly
  });
}

// ============================================================================
// TRASH QUERIES
// ============================================================================

/**
 * Internal: Query hook for deleted entries
 */
function useDeletedEntriesQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.deletedEntries,
    queryFn: getDeletedEntries,
    refetchOnMount: "always",
  });
}

/**
 * Internal: Query hook for deleted streams
 */
function useDeletedStreamsQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.deletedStreams,
    queryFn: getDeletedStreams,
  });
}

/**
 * Internal: Query hook for deleted locations
 */
function useDeletedLocationsQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.deletedLocations,
    queryFn: getDeletedLocations,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Internal: Mutation hook for restoring an entry
 */
function useRestoreEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.deletedEntries });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cloudStorage });
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["streams"] });
    },
    onError: (error, entryId) => {
      console.error("[DataManagement] restoreEntry mutation failed:", error, { entryId });
    },
  });
}

/**
 * Internal: Mutation hook for hard-deleting an entry
 */
function useHardDeleteEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: hardDeleteEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.deletedEntries });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cloudStorage });
    },
    onError: (error, entryId) => {
      console.error("[DataManagement] hardDeleteEntry mutation failed:", error, { entryId });
    },
  });
}

/**
 * Internal: Mutation hook for hard-deleting a stream
 */
function useHardDeleteStreamMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: hardDeleteStream,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.deletedStreams });
      queryClient.invalidateQueries({ queryKey: ["entries"] }); // entries may have moved to Inbox
    },
    onError: (error, streamId) => {
      console.error("[DataManagement] hardDeleteStream mutation failed:", error, { streamId });
    },
  });
}

/**
 * Internal: Mutation hook for hard-deleting a location
 */
function useHardDeleteLocationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: hardDeleteLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.deletedLocations });
    },
    onError: (error, locationId) => {
      console.error("[DataManagement] hardDeleteLocation mutation failed:", error, { locationId });
    },
  });
}

// ============================================================================
// UNIFIED HOOKS (exported)
// ============================================================================

/**
 * Cloud storage usage — total bytes, breakdown by data vs attachments.
 */
export function useCloudStorageUsage() {
  const query = useCloudStorageQuery();

  return {
    storageUsage: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Full detail of a single deleted entry — content, metadata, attachments.
 */
export function useDeletedEntryDetail(entryId: string | null) {
  const query = useQuery({
    queryKey: ["dataManagement", "deletedEntryDetail", entryId] as const,
    queryFn: () => getDeletedEntryDetail(entryId!),
    enabled: !!entryId,
  });

  return {
    entry: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}

/**
 * Trash management — query deleted items and perform restore/delete actions.
 */
export function useTrash() {
  const entriesQuery = useDeletedEntriesQuery();
  const streamsQuery = useDeletedStreamsQuery();
  const locationsQuery = useDeletedLocationsQuery();

  const restoreMutation = useRestoreEntryMutation();
  const deleteEntryMutation = useHardDeleteEntryMutation();
  const deleteStreamMutation = useHardDeleteStreamMutation();
  const deleteLocationMutation = useHardDeleteLocationMutation();

  return {
    // Data
    deletedEntries: entriesQuery.data ?? [],
    deletedStreams: streamsQuery.data ?? [],
    deletedLocations: locationsQuery.data ?? [],

    // Loading states
    isLoading:
      entriesQuery.isLoading ||
      streamsQuery.isLoading ||
      locationsQuery.isLoading,

    // Counts (for tab badges)
    counts: {
      entries: entriesQuery.data?.length ?? 0,
      streams: streamsQuery.data?.length ?? 0,
      locations: locationsQuery.data?.length ?? 0,
    },

    // Actions
    restoreEntry: restoreMutation.mutateAsync,
    isRestoring: restoreMutation.isPending,

    hardDeleteEntry: deleteEntryMutation.mutateAsync,
    isDeletingEntry: deleteEntryMutation.isPending,

    hardDeleteStream: deleteStreamMutation.mutateAsync,
    isDeletingStream: deleteStreamMutation.isPending,

    hardDeleteLocation: deleteLocationMutation.mutateAsync,
    isDeletingLocation: deleteLocationMutation.isPending,

    // Refetch all
    refetchAll: () => {
      entriesQuery.refetch();
      streamsQuery.refetch();
      locationsQuery.refetch();
    },
  };
}
