/**
 * Mobile Attachment Hooks
 *
 * React Query hooks for local attachment operations (SQLite-first)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as attachmentApi from './mobileAttachmentApi';
import type { Attachment } from '@trace/core';

/**
 * Query key factory for local attachments
 */
export const mobileAttachmentKeys = {
  all: ['attachments'] as const,
  forEntry: (entryId: string) => [...mobileAttachmentKeys.all, 'entry', entryId] as const,
  detail: (id: string) => [...mobileAttachmentKeys.all, 'detail', id] as const,
};

/**
 * Hook to get attachments for a specific entry
 */
export function useAttachments(entryId: string | null) {
  const queryClient = useQueryClient();

  const attachmentsQuery = useQuery({
    queryKey: entryId ? mobileAttachmentKeys.forEntry(entryId) : ['attachments', 'disabled'],
    queryFn: () => (entryId ? attachmentApi.getAttachmentsForEntry(entryId) : Promise.resolve([])),
    enabled: !!entryId,
    staleTime: 30 * 1000, // 30 seconds - attachments change frequently during editing
  });

  const createMutation = useMutation({
    mutationFn: attachmentApi.createAttachment,
    onSuccess: () => {
      if (entryId) {
        queryClient.invalidateQueries({ queryKey: mobileAttachmentKeys.forEntry(entryId) });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: attachmentApi.deleteAttachment,
    onSuccess: () => {
      if (entryId) {
        queryClient.invalidateQueries({ queryKey: mobileAttachmentKeys.forEntry(entryId) });
      }
    },
  });

  return {
    attachments: (attachmentsQuery.data || []) as Attachment[],
    isLoading: attachmentsQuery.isLoading,
    error: attachmentsQuery.error,
    refetch: attachmentsQuery.refetch,

    attachmentMutations: {
      createAttachment: createMutation.mutateAsync,
      deleteAttachment: deleteMutation.mutateAsync,
      isCreating: createMutation.isPending,
      isDeleting: deleteMutation.isPending,
    },
  };
}
