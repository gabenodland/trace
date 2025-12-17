/**
 * Mobile-specific entry hooks
 * Uses SQLite local database instead of direct Supabase calls
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createEntry,
  getEntries,
  getEntry,
  updateEntry,
  deleteEntry,
  copyEntry,
  getUnsyncedCount,
  getEntryCounts,
  getTags,
  getMentions,
  MobileEntryFilter,
  CopiedEntryData,
} from './mobileEntryApi';
import { CreateEntryInput, Entry } from '@trace/core';
import * as entryHelpers from '@trace/core/src/modules/entries/entryHelpers';

// Re-export types for consumers
export type { MobileEntryFilter, CopiedEntryData } from './mobileEntryApi';

/**
 * Internal: Query hook for fetching entries from local SQLite
 */
function useEntriesQuery(filter?: MobileEntryFilter) {
  return useQuery({
    queryKey: ['entries', filter],
    queryFn: () => getEntries(filter),
    // Override global staleTime to ensure list always shows fresh data
    staleTime: 0,
  });
}

/**
 * Internal: Query hook for fetching a single entry
 */
function useEntryQuery(id: string | null) {
  return useQuery({
    queryKey: ['entry', id],
    queryFn: () => (id ? getEntry(id) : Promise.resolve(null)),
    enabled: !!id,
    // Override global staleTime to ensure entry always shows fresh data
    staleTime: 0,
  });
}

/**
 * Internal: Mutation hook for creating an entry (offline-first)
 */
function useCreateEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEntry,
    onSuccess: () => {
      // Invalidate queries to trigger refresh
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['entryCounts'] });
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      queryClient.invalidateQueries({ queryKey: ['unsyncedCount'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['mentions'] });
    },
  });
}

/**
 * Internal: Mutation hook for updating an entry
 */
function useUpdateEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Entry> }) =>
      updateEntry(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['entryCounts'] });
      queryClient.invalidateQueries({ queryKey: ['entry', data.entry_id] });
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      queryClient.invalidateQueries({ queryKey: ['unsyncedCount'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['mentions'] });
    },
  });
}

/**
 * Internal: Mutation hook for deleting an entry
 */
function useDeleteEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['entryCounts'] });
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      queryClient.invalidateQueries({ queryKey: ['unsyncedCount'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['mentions'] });
    },
  });
}

/**
 * Internal: Mutation hook for copying an entry
 * Note: copyEntry no longer saves to DB - it returns in-memory data for CaptureForm
 * No query invalidation needed since nothing is persisted yet
 */
function useCopyEntryMutation() {
  return useMutation({
    mutationFn: ({ id, gpsCoords }: { id: string; gpsCoords?: { latitude: number; longitude: number; accuracy?: number } }) =>
      copyEntry(id, gpsCoords),
    // No onSuccess - entry is not saved to DB yet, so no queries to invalidate
    // The actual save happens in CaptureForm when user clicks save
  });
}

/**
 * SINGLE SOURCE OF TRUTH: Main hook for entry operations (mobile version)
 * Uses local SQLite database for offline-first functionality
 *
 * Privacy filtering is automatically applied:
 * - When no stream_id filter is specified (viewing "All Entries"), private streams are excluded
 * - When viewing a specific stream directly, all entries from that stream are shown (even if private)
 * - This ensures EntryListScreen, MapScreen, CalendarScreen all get correct filtering automatically
 */
export function useEntries(filter?: MobileEntryFilter) {
  // Auto-apply private stream filtering for "All Entries" view
  // Only when stream_id is undefined (showing all entries)
  // When stream_id is explicitly set (including null for unassigned), don't filter
  const effectiveFilter: MobileEntryFilter | undefined = filter?.stream_id === undefined
    ? { ...filter, excludePrivateStreams: filter?.excludePrivateStreams ?? true }
    : filter;

  const entriesQuery = useEntriesQuery(effectiveFilter);
  const createMutation = useCreateEntryMutation();
  const updateMutation = useUpdateEntryMutation();
  const deleteMutation = useDeleteEntryMutation();
  const copyMutation = useCopyEntryMutation();

  return {
    // Data
    entries: entriesQuery.data || [],
    isLoading: entriesQuery.isLoading,
    error: entriesQuery.error,

    // Mutations (offline-capable)
    entryMutations: {
      createEntry: async (data: CreateEntryInput) => {
        return createMutation.mutateAsync(data);
      },

      updateEntry: async (id: string, data: Partial<Entry>) => {
        return updateMutation.mutateAsync({ id, data });
      },

      deleteEntry: async (id: string) => {
        return deleteMutation.mutateAsync(id);
      },

      copyEntry: async (id: string, gpsCoords?: { latitude: number; longitude: number; accuracy?: number }): Promise<CopiedEntryData> => {
        return copyMutation.mutateAsync({ id, gpsCoords });
      },
    },

    // Helpers (pure functions)
    entryHelpers,
  };
}

/**
 * Hook for fetching a single entry by ID
 */
export function useEntry(id: string | null) {
  const entryQuery = useEntryQuery(id);
  const updateMutation = useUpdateEntryMutation();
  const deleteMutation = useDeleteEntryMutation();

  return {
    // Data
    entry: entryQuery.data || null,
    isLoading: entryQuery.isLoading,
    error: entryQuery.error,

    // Mutations
    entryMutations: {
      updateEntry: async (data: Partial<Entry>) => {
        if (!id) throw new Error('No entry ID provided');
        return updateMutation.mutateAsync({ id, data });
      },

      deleteEntry: async () => {
        if (!id) throw new Error('No entry ID provided');
        return deleteMutation.mutateAsync(id);
      },
    },

    // Helpers (pure functions)
    entryHelpers,
  };
}

/**
 * Hook for sync status
 */
export function useSyncStatus() {
  return useQuery({
    queryKey: ['unsyncedCount'],
    queryFn: getUnsyncedCount,
    refetchInterval: 5000, // Check every 5 seconds
  });
}

/**
 * Internal: Query hook for fetching tags
 */
function useTagsQuery() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: getTags,
  });
}

/**
 * Internal: Query hook for fetching mentions
 */
function useMentionsQuery() {
  return useQuery({
    queryKey: ['mentions'],
    queryFn: getMentions,
  });
}

/**
 * Hook for fetching all tags with counts
 */
export function useTags() {
  const tagsQuery = useTagsQuery();

  return {
    tags: tagsQuery.data || [],
    isLoading: tagsQuery.isLoading,
    error: tagsQuery.error,
  };
}

/**
 * Hook for fetching all mentions (people) with counts
 */
export function useMentions() {
  const mentionsQuery = useMentionsQuery();

  return {
    mentions: mentionsQuery.data || [],
    isLoading: mentionsQuery.isLoading,
    error: mentionsQuery.error,
  };
}

/**
 * Hook for getting entry counts (fast COUNT queries for navigation display)
 * Returns total entry count and unassigned entry count
 */
export function useEntryCounts() {
  return useQuery({
    queryKey: ['entryCounts'],
    queryFn: getEntryCounts,
    staleTime: 30000, // Consider fresh for 30 seconds
  });
}
