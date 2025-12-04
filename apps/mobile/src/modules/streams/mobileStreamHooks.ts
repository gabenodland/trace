/**
 * Mobile-specific stream hooks
 * Uses SQLite local database instead of direct Supabase calls
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStreams,
  getStream,
  createStream,
  updateStream,
  deleteStream,
} from './mobileStreamApi';
import type { UpdateStreamInput } from '@trace/core';
import * as streamHelpers from '@trace/core/src/modules/streams/streamHelpers';

/**
 * Internal: Query hook for fetching streams from local SQLite
 */
function useStreamsQuery() {
  return useQuery({
    queryKey: ['streams'],
    queryFn: getStreams,
  });
}

/**
 * Internal: Query hook for fetching a single stream
 */
function useStreamQuery(streamId: string | null) {
  return useQuery({
    queryKey: ['stream', streamId],
    queryFn: () => streamId ? getStream(streamId) : Promise.resolve(null),
    enabled: !!streamId,
  });
}

/**
 * Internal: Mutation hook for creating a stream (offline-first)
 */
function useCreateStreamMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, color, icon }: {
      name: string;
      color?: string | null;
      icon?: string | null;
    }) => createStream({ name, color, icon }),
    onSuccess: () => {
      // Invalidate queries to trigger refresh
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      queryClient.invalidateQueries({ queryKey: ['unsyncedCount'] });
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      queryClient.invalidateQueries({ queryKey: ['stream', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['unsyncedCount'] });
    },
  });
}

/**
 * Internal: Mutation hook for deleting a stream
 */
function useDeleteStreamMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteStream,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      queryClient.invalidateQueries({ queryKey: ['entries'] }); // Entries may be affected
      queryClient.invalidateQueries({ queryKey: ['unsyncedCount'] });
    },
  });
}

/**
 * SINGLE SOURCE OF TRUTH: Main hook for stream operations (mobile version)
 * Uses local SQLite database for offline-first functionality
 */
export function useStreams() {
  const streamsQuery = useStreamsQuery();
  const createMutation = useCreateStreamMutation();
  const updateMutation = useUpdateStreamMutation();
  const deleteMutation = useDeleteStreamMutation();

  return {
    // Data
    streams: streamsQuery.data || [],
    isLoading: streamsQuery.isLoading,
    error: streamsQuery.error,

    // Mutations (offline-capable)
    streamMutations: {
      createStream: async (
        name: string,
        color?: string | null,
        icon?: string | null
      ) => {
        return createMutation.mutateAsync({ name, color, icon });
      },

      updateStream: async (id: string, data: UpdateStreamInput) => {
        return updateMutation.mutateAsync({ id, data });
      },

      deleteStream: async (id: string) => {
        return deleteMutation.mutateAsync(id);
      },
    },

    // Helpers (pure functions)
    streamHelpers,
  };
}

/**
 * Hook for fetching a single stream by ID
 */
export function useStream(streamId: string | null) {
  const streamQuery = useStreamQuery(streamId);
  const updateMutation = useUpdateStreamMutation();
  const deleteMutation = useDeleteStreamMutation();

  return {
    // Data
    stream: streamQuery.data || null,
    isLoading: streamQuery.isLoading,
    error: streamQuery.error,

    // Mutations (offline-capable)
    streamMutations: {
      updateStream: async (data: UpdateStreamInput) => {
        if (!streamId) throw new Error('No stream ID provided');
        return updateMutation.mutateAsync({ id: streamId, data });
      },

      deleteStream: async () => {
        if (!streamId) throw new Error('No stream ID provided');
        return deleteMutation.mutateAsync(streamId);
      },
    },

    // Helpers (pure functions)
    streamHelpers,
  };
}
