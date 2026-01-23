// React Query hooks for entry operations

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getEntries,
  getEntry,
  createEntry,
  updateEntry,
  deleteEntry,
  archiveEntry,
} from "./entryApi";
import * as entryHelpers from "./entryHelpers";
import { CreateEntryInput, EntryFilter } from "./EntryTypes";

/**
 * Internal: Query hook for fetching entries
 */
function useEntriesQuery(filter?: EntryFilter) {
  return useQuery({
    queryKey: ["entries", filter],
    queryFn: () => getEntries(filter),
  });
}

/**
 * Internal: Query hook for fetching a single entry
 */
function useEntryQuery(id: string | null) {
  return useQuery({
    queryKey: ["entry", id],
    queryFn: () => (id ? getEntry(id) : Promise.resolve(null)),
    enabled: !!id,
  });
}

/**
 * Internal: Mutation hook for creating an entry
 */
function useCreateEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["streams"] }); // Entry counts may change
    },
  });
}

/**
 * Internal: Mutation hook for updating an entry
 */
function useUpdateEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateEntryInput> }) =>
      updateEntry(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["entry", data.entry_id] });
      queryClient.invalidateQueries({ queryKey: ["streams"] }); // Entry counts may change
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
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["streams"] }); // Entry counts may change
    },
  });
}

/**
 * Internal: Mutation hook for archiving/unarchiving an entry
 */
function useArchiveEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      archiveEntry(id, archived),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["entry", data.entry_id] });
    },
  });
}

/**
 * SINGLE SOURCE OF TRUTH: Main hook for entry operations
 *
 * Use this hook in components to access entry data and operations.
 * DO NOT use the internal query/mutation hooks directly.
 */
export function useEntries(filter?: EntryFilter) {
  const entriesQuery = useEntriesQuery(filter);
  const createMutation = useCreateEntryMutation();
  const updateMutation = useUpdateEntryMutation();
  const deleteMutation = useDeleteEntryMutation();
  const archiveMutation = useArchiveEntryMutation();

  return {
    // Data
    entries: entriesQuery.data || [],
    isLoading: entriesQuery.isLoading,
    error: entriesQuery.error,

    // Mutations
    entryMutations: {
      createEntry: async (data: CreateEntryInput) => {
        return createMutation.mutateAsync(data);
      },

      updateEntry: async (id: string, data: Partial<CreateEntryInput>) => {
        return updateMutation.mutateAsync({ id, data });
      },

      deleteEntry: async (id: string) => {
        return deleteMutation.mutateAsync(id);
      },

      archiveEntry: async (id: string, archived: boolean) => {
        return archiveMutation.mutateAsync({ id, archived });
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
      updateEntry: async (data: Partial<CreateEntryInput>) => {
        if (!id) throw new Error("No entry ID provided");
        return updateMutation.mutateAsync({ id, data });
      },

      deleteEntry: async () => {
        if (!id) throw new Error("No entry ID provided");
        return deleteMutation.mutateAsync(id);
      },
    },

    // Helpers (pure functions)
    entryHelpers,
  };
}
