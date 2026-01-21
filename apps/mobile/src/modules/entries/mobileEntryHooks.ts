/**
 * Mobile-specific entry hooks
 * Uses SQLite local database instead of direct Supabase calls
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
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
  getLocationHierarchy,
  getNoLocationCount,
  MobileEntryFilter,
} from './mobileEntryApi';
import { CreateEntryInput, Entry } from '@trace/core';
import * as entryHelpers from '@trace/core/src/modules/entries/entryHelpers';
import { buildLocationTree } from '@trace/core/src/modules/entries/entryHelpers';
import type { LocationTreeNode } from '@trace/core/src/modules/entries/EntryTypes';

// Re-export types for consumers
export type { MobileEntryFilter } from './mobileEntryApi';

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
 * @param id - Entry ID to fetch
 * @param options - Optional configuration
 * @param options.refreshFirst - If true, refresh from server before returning (use when editing)
 */
function useEntryQuery(id: string | null, options?: { refreshFirst?: boolean }) {
  const queryClient = useQueryClient();

  return useQuery({
    // Use same query key for both local and refresh - this ensures cache consistency
    queryKey: ['entry', id],
    queryFn: () => (id ? getEntry(id, { refreshFirst: options?.refreshFirst }) : Promise.resolve(null)),
    enabled: !!id,
    // Show cached entry from list immediately while fetching fresh data
    // This eliminates the loading spinner when navigating from entry list
    placeholderData: () => {
      if (!id) return undefined;
      // Look for this entry in any cached entries list
      const entriesQueries = queryClient.getQueriesData<Entry[]>({ queryKey: ['entries'] });
      for (const [, entries] of entriesQueries) {
        if (entries) {
          const found = entries.find(e => e.entry_id === id);
          if (found) return found;
        }
      }
      return undefined;
    },
    // staleTime: 0 means always refetch in background, but placeholderData shows instantly
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
      queryClient.invalidateQueries({ queryKey: ['locationHierarchy'] });
    },
  });
}

/**
 * Internal: Mutation hook for updating an entry
 * Uses cache patching instead of invalidation for smooth UI updates
 */
function useUpdateEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Entry> }) =>
      updateEntry(id, data),
    onSuccess: (updatedEntry) => {
      // Patch the single entry cache directly
      queryClient.setQueryData(['entry', updatedEntry.entry_id], updatedEntry);

      // Patch the entry in all entries list caches (smooth update, no flash)
      queryClient.setQueriesData(
        { queryKey: ['entries'] },
        (oldData: Entry[] | undefined) => {
          if (!oldData) return oldData;

          const index = oldData.findIndex(e => e.entry_id === updatedEntry.entry_id);
          if (index === -1) return oldData;

          const newData = [...oldData];
          newData[index] = updatedEntry;
          return newData;
        }
      );

      // These are less critical - can still invalidate for background refresh
      // Tags/mentions only change if content changed, streams only if stream_id changed
      queryClient.invalidateQueries({ queryKey: ['unsyncedCount'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['mentions'] });
      queryClient.invalidateQueries({ queryKey: ['locationHierarchy'] });
    },
  });
}

/**
 * Internal: Mutation hook for deleting an entry
 * Uses cache patching to remove entry smoothly
 */
function useDeleteEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteEntry,
    onSuccess: (_, deletedId) => {
      // Remove from single entry cache
      queryClient.removeQueries({ queryKey: ['entry', deletedId] });

      // Remove from all entries list caches (smooth removal, no flash)
      queryClient.setQueriesData(
        { queryKey: ['entries'] },
        (oldData: Entry[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.filter(e => e.entry_id !== deletedId);
        }
      );

      // These need refresh after delete
      queryClient.invalidateQueries({ queryKey: ['entryCounts'] });
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      queryClient.invalidateQueries({ queryKey: ['unsyncedCount'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['mentions'] });
      queryClient.invalidateQueries({ queryKey: ['locationHierarchy'] });
    },
  });
}

/**
 * Internal: Mutation hook for copying an entry
 * Entry is saved to DB immediately, returns new entry ID
 */
function useCopyEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => copyEntry(id),
    onSuccess: () => {
      // Invalidate entries list since new entry was created
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
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

  // Memoize entries to prevent new empty array reference on every render
  const entries = useMemo(() => entriesQuery.data || [], [entriesQuery.data]);

  return {
    // Data
    entries,
    isLoading: entriesQuery.isLoading,
    isFetching: entriesQuery.isFetching,
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

      copyEntry: async (id: string): Promise<string> => {
        return copyMutation.mutateAsync(id);
      },
    },

    // Helpers (pure functions)
    entryHelpers,
  };
}

/**
 * Hook for fetching a single entry by ID
 * @param id - Entry ID to fetch
 * @param options - Optional configuration
 * @param options.refreshFirst - If true, refresh from server before returning (recommended for editing)
 */
export function useEntry(id: string | null, options?: { refreshFirst?: boolean }) {
  const entryQuery = useEntryQuery(id, options);
  const updateMutation = useUpdateEntryMutation();
  const deleteMutation = useDeleteEntryMutation();

  return {
    // Data
    entry: entryQuery.data || null,
    isLoading: entryQuery.isLoading,
    error: entryQuery.error,
    refetch: entryQuery.refetch,

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

/**
 * Hook for location hierarchy - builds a tree from entry location fields
 * Used in drawer navigation for hierarchical location filtering
 *
 * @returns Tree of locations: country → region → city → place_name
 */
export function useLocationHierarchy() {
  return useQuery<LocationTreeNode[]>({
    queryKey: ['locationHierarchy'],
    queryFn: async () => {
      const rows = await getLocationHierarchy();
      const noLocationCount = await getNoLocationCount();
      return buildLocationTree(rows, noLocationCount);
    },
    staleTime: 60 * 1000, // Consider fresh for 1 minute
  });
}
