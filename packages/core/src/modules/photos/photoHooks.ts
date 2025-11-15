/**
 * Photo Hooks
 *
 * React Query hooks for photo operations
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import * as photoApi from './photoApi';
import type { Photo, CreatePhotoInput, UpdatePhotoInput } from './PhotoTypes';

/**
 * Query key factory for photos
 */
export const photoKeys = {
  all: ['photos'] as const,
  lists: () => [...photoKeys.all, 'list'] as const,
  list: (userId?: string) => [...photoKeys.lists(), userId] as const,
  entries: () => [...photoKeys.all, 'entry'] as const,
  entry: (entryId: string) => [...photoKeys.entries(), entryId] as const,
  detail: (photoId: string) => [...photoKeys.all, 'detail', photoId] as const,
};

/**
 * Hook to get photos for a specific entry
 */
export function usePhotosForEntry(entryId: string): UseQueryResult<Photo[], Error> {
  return useQuery({
    queryKey: photoKeys.entry(entryId),
    queryFn: () => photoApi.getPhotosForEntry(entryId),
    enabled: !!entryId,
  });
}

/**
 * Hook to get a single photo
 */
export function usePhoto(photoId: string): UseQueryResult<Photo, Error> {
  return useQuery({
    queryKey: photoKeys.detail(photoId),
    queryFn: () => photoApi.getPhoto(photoId),
    enabled: !!photoId,
  });
}

/**
 * Hook to create a photo
 */
export function useCreatePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePhotoInput) => photoApi.createPhoto(input),
    onSuccess: (newPhoto) => {
      // Invalidate photos for this entry
      queryClient.invalidateQueries({ queryKey: photoKeys.entry(newPhoto.entry_id) });
      queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
    },
  });
}

/**
 * Hook to update a photo
 */
export function useUpdatePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ photoId, updates }: { photoId: string; updates: UpdatePhotoInput }) =>
      photoApi.updatePhoto(photoId, updates),
    onSuccess: (updatedPhoto) => {
      // Update cache
      queryClient.setQueryData(photoKeys.detail(updatedPhoto.photo_id), updatedPhoto);
      queryClient.invalidateQueries({ queryKey: photoKeys.entry(updatedPhoto.entry_id) });
    },
  });
}

/**
 * Hook to delete a photo
 */
export function useDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ photoId }: { photoId: string; entryId: string }) =>
      photoApi.deletePhoto(photoId),
    onSuccess: (_, variables) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: photoKeys.entry(variables.entryId) });
      queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
    },
  });
}

/**
 * Hook to upload photo file
 */
export function useUploadPhotoFile() {
  return useMutation({
    mutationFn: ({
      filePath,
      fileData,
      contentType,
    }: {
      filePath: string;
      fileData: Blob | File;
      contentType: string;
    }) => photoApi.uploadPhotoFile(filePath, fileData, contentType),
  });
}

/**
 * Hook to delete photo file
 */
export function useDeletePhotoFile() {
  return useMutation({
    mutationFn: (filePath: string) => photoApi.deletePhotoFile(filePath),
  });
}
