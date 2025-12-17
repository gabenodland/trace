/**
 * Mobile Photo Hooks
 *
 * React Query hooks for local photo operations (SQLite-first)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as photoApi from './mobilePhotoApi';
import type { Photo } from '@trace/core';

/**
 * Query key factory for local photos
 */
export const mobilePhotoKeys = {
  all: ['photos'] as const,
  forEntry: (entryId: string) => [...mobilePhotoKeys.all, 'entry', entryId] as const,
  detail: (id: string) => [...mobilePhotoKeys.all, 'detail', id] as const,
};

/**
 * Hook to get photos for a specific entry
 */
export function usePhotos(entryId: string | null) {
  const queryClient = useQueryClient();

  const photosQuery = useQuery({
    queryKey: entryId ? mobilePhotoKeys.forEntry(entryId) : ['photos', 'disabled'],
    queryFn: () => (entryId ? photoApi.getPhotosForEntry(entryId) : Promise.resolve([])),
    enabled: !!entryId,
    staleTime: 30 * 1000, // 30 seconds - photos change frequently during editing
  });

  const createMutation = useMutation({
    mutationFn: photoApi.createPhoto,
    onSuccess: () => {
      if (entryId) {
        queryClient.invalidateQueries({ queryKey: mobilePhotoKeys.forEntry(entryId) });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: photoApi.deletePhoto,
    onSuccess: () => {
      if (entryId) {
        queryClient.invalidateQueries({ queryKey: mobilePhotoKeys.forEntry(entryId) });
      }
    },
  });

  return {
    photos: (photosQuery.data || []) as Photo[],
    isLoading: photosQuery.isLoading,
    error: photosQuery.error,
    refetch: photosQuery.refetch,

    photoMutations: {
      createPhoto: createMutation.mutateAsync,
      deletePhoto: deleteMutation.mutateAsync,
      isCreating: createMutation.isPending,
      isDeleting: deleteMutation.isPending,
    },
  };
}
