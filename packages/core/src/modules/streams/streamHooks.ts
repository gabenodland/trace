// React Query hooks for stream operations

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getStreams,
  createStream,
  findOrCreateStreamByName,
  updateStream,
  deleteStream,
} from "./streamApi";
import * as streamHelpers from "./streamHelpers";
import { UpdateStreamInput } from "./StreamTypes";

/**
 * Internal: Query hook for fetching streams
 */
function useStreamsQuery() {
  return useQuery({
    queryKey: ["streams"],
    queryFn: getStreams,
  });
}

/**
 * Internal: Mutation hook for creating a stream
 */
function useCreateStreamMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => createStream(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["streams"] });
    },
  });
}

/**
 * Internal: Mutation hook for finding or creating stream by name
 */
function useFindOrCreateByNameMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: findOrCreateStreamByName,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["streams"] });
    },
  });
}

/**
 * Internal: Mutation hook for updating a stream
 */
function useUpdateStreamMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStreamInput }) =>
      updateStream(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["streams"] });
    },
  });
}

/**
 * Internal: Mutation hook for deleting a stream
 */
function useDeleteStreamMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reassignToId }: { id: string; reassignToId?: string }) =>
      deleteStream(id, reassignToId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["streams"] });
      queryClient.invalidateQueries({ queryKey: ["entries"] }); // Entries may be affected
    },
  });
}

/**
 * SINGLE SOURCE OF TRUTH: Main hook for stream operations
 *
 * Use this hook in components to access stream data and operations.
 * DO NOT use the internal query/mutation hooks directly.
 */
export function useStreams() {
  const streamsQuery = useStreamsQuery();
  const createMutation = useCreateStreamMutation();
  const findOrCreateMutation = useFindOrCreateByNameMutation();
  const updateMutation = useUpdateStreamMutation();
  const deleteMutation = useDeleteStreamMutation();

  return {
    // Data
    streams: streamsQuery.data || [],
    isLoading: streamsQuery.isLoading,
    error: streamsQuery.error,

    // Mutations
    streamMutations: {
      createStream: async (name: string) => {
        return createMutation.mutateAsync(name);
      },

      findOrCreateByName: async (name: string) => {
        return findOrCreateMutation.mutateAsync(name);
      },

      updateStream: async (id: string, data: UpdateStreamInput) => {
        return updateMutation.mutateAsync({ id, data });
      },

      deleteStream: async (id: string, reassignToId?: string) => {
        return deleteMutation.mutateAsync({ id, reassignToId });
      },
    },

    // Helpers (pure functions)
    streamHelpers,
  };
}
