/**
 * Attachment Hooks
 *
 * React Query hooks for attachment operations
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import * as attachmentApi from './attachmentApi';
import type { Attachment, CreateAttachmentInput, UpdateAttachmentInput } from './AttachmentTypes';

/**
 * Query key factory for attachments
 */
export const attachmentKeys = {
  all: ['attachments'] as const,
  lists: () => [...attachmentKeys.all, 'list'] as const,
  list: (userId?: string) => [...attachmentKeys.lists(), userId] as const,
  entries: () => [...attachmentKeys.all, 'entry'] as const,
  entry: (entryId: string) => [...attachmentKeys.entries(), entryId] as const,
  detail: (attachmentId: string) => [...attachmentKeys.all, 'detail', attachmentId] as const,
};

/**
 * Hook to get attachments for a specific entry
 */
export function useAttachmentsForEntry(entryId: string): UseQueryResult<Attachment[], Error> {
  return useQuery({
    queryKey: attachmentKeys.entry(entryId),
    queryFn: () => attachmentApi.getAttachmentsForEntry(entryId),
    enabled: !!entryId,
  });
}

/**
 * Hook to get a single attachment
 */
export function useAttachment(attachmentId: string): UseQueryResult<Attachment, Error> {
  return useQuery({
    queryKey: attachmentKeys.detail(attachmentId),
    queryFn: () => attachmentApi.getAttachment(attachmentId),
    enabled: !!attachmentId,
  });
}

/**
 * Hook to create an attachment
 */
export function useCreateAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAttachmentInput) => attachmentApi.createAttachment(input),
    onSuccess: (newAttachment) => {
      // Invalidate attachments for this entry
      queryClient.invalidateQueries({ queryKey: attachmentKeys.entry(newAttachment.entry_id) });
      queryClient.invalidateQueries({ queryKey: attachmentKeys.lists() });
    },
  });
}

/**
 * Hook to update an attachment
 */
export function useUpdateAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ attachmentId, updates }: { attachmentId: string; updates: UpdateAttachmentInput }) =>
      attachmentApi.updateAttachment(attachmentId, updates),
    onSuccess: (updatedAttachment) => {
      // Update cache
      queryClient.setQueryData(attachmentKeys.detail(updatedAttachment.attachment_id), updatedAttachment);
      queryClient.invalidateQueries({ queryKey: attachmentKeys.entry(updatedAttachment.entry_id) });
    },
  });
}

/**
 * Hook to delete an attachment
 */
export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ attachmentId }: { attachmentId: string; entryId: string }) =>
      attachmentApi.deleteAttachment(attachmentId),
    onSuccess: (_, variables) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: attachmentKeys.entry(variables.entryId) });
      queryClient.invalidateQueries({ queryKey: attachmentKeys.lists() });
    },
  });
}

/**
 * Hook to upload attachment file
 */
export function useUploadAttachmentFile() {
  return useMutation({
    mutationFn: ({
      filePath,
      fileData,
      contentType,
    }: {
      filePath: string;
      fileData: Blob | File;
      contentType: string;
    }) => attachmentApi.uploadAttachmentFile(filePath, fileData, contentType),
  });
}

/**
 * Hook to delete attachment file
 */
export function useDeleteAttachmentFile() {
  return useMutation({
    mutationFn: (filePath: string) => attachmentApi.deleteAttachmentFile(filePath),
  });
}
