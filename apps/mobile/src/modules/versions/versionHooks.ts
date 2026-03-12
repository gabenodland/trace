/**
 * Version Hooks — React Query hooks for version operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as versionApi from './versionApi';
import type { EntryVersion, EntrySnapshot } from './VersionTypes';

export const versionKeys = {
  all: ['versions'] as const,
  forEntry: (entryId: string) => [...versionKeys.all, 'entry', entryId] as const,
};

/**
 * Hook to get all versions for a given entry
 */
export function useVersions(entryId: string) {
  return useQuery<EntryVersion[], Error>({
    queryKey: versionKeys.forEntry(entryId),
    queryFn: () => versionApi.getVersionsForEntry(entryId),
    enabled: !!entryId,
  });
}

/**
 * Hook to get a single version by ID
 */
export function useVersion(versionId: string) {
  return useQuery<EntryVersion | null, Error>({
    queryKey: [...versionKeys.all, 'detail', versionId] as const,
    queryFn: () => versionApi.getVersionById(versionId),
    enabled: !!versionId,
  });
}

/**
 * Hook for creating a new version
 */
export function useCreateVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (version: versionApi.CreateVersionInput) =>
      versionApi.createVersion(version),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: versionKeys.forEntry(variables.entry_id) });
    },
  });
}

/**
 * Hook for restoring an entry to a previous version's snapshot.
 * Creates a pre-restore snapshot, then overwrites the entry.
 * Invalidates both version and entry caches.
 */
export function useRestoreVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entryId, snapshot, userId, attachmentIds }: {
      entryId: string;
      snapshot: EntrySnapshot;
      userId: string;
      attachmentIds?: string[] | null;
    }) => versionApi.restoreFromVersion(entryId, snapshot, userId, attachmentIds),
    onSuccess: (_data, variables) => {
      // Invalidate versions cache (new pre-restore version was created)
      queryClient.invalidateQueries({ queryKey: versionKeys.forEntry(variables.entryId) });
      // Invalidate entry cache (entry fields were overwritten)
      queryClient.invalidateQueries({ queryKey: ['entry', variables.entryId] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['entryCounts'] });
      // Invalidate attachment caches (attachments may have been reconciled)
      queryClient.invalidateQueries({ queryKey: ['attachments', 'entry', variables.entryId] });
      queryClient.invalidateQueries({ queryKey: ['attachmentCounts'] });
    },
  });
}

/**
 * Hook for creating a new entry from a version snapshot.
 * Invalidates entries cache so lists pick up the new copy.
 */
export function useCopyFromSnapshot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ snapshot, userId }: {
      snapshot: EntrySnapshot;
      userId: string;
    }) => versionApi.createCopyFromSnapshot(snapshot, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['entryCounts'] });
    },
  });
}
