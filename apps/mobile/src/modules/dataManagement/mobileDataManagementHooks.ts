/**
 * Mobile Data Management Hooks
 *
 * Composes core (Supabase) hooks with local (SQLite) queries
 * to provide complete data management state for the UI.
 */

import { useQuery } from '@tanstack/react-query';
import { useCloudStorageUsage, useTrash } from '@trace/core';
import type { DeviceStorageUsage, PrivateStreamSummary } from '@trace/core';
import * as api from './mobileDataManagementApi';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const dataManagementKeys = {
  all: ['dataManagement'] as const,
  deviceStorage: () => [...dataManagementKeys.all, 'deviceStorage'] as const,
  localCounts: () => [...dataManagementKeys.all, 'localCounts'] as const,
  privateCounts: () => [...dataManagementKeys.all, 'privateCounts'] as const,
  privateStreams: () => [...dataManagementKeys.all, 'privateStreams'] as const,
};

// ============================================================================
// DEVICE STORAGE
// ============================================================================

/**
 * Device-local storage usage (SQLite file + local attachment files).
 * Informational only — no tier limit.
 */
export function useDeviceStorageUsage() {
  const query = useQuery<DeviceStorageUsage>({
    queryKey: dataManagementKeys.deviceStorage(),
    queryFn: api.getDeviceStorageUsage,
    staleTime: 5 * 60 * 1000,
  });

  return {
    deviceStorage: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

// ============================================================================
// DATA INVENTORY
// ============================================================================

/**
 * Combined data inventory — local counts + cloud counts + private counts.
 * Cloud counts and trash counts come from core's useCloudStorageUsage and useTrash hooks.
 * This hook provides the local side.
 */
export function useDataInventory() {
  const localCountsQuery = useQuery({
    queryKey: dataManagementKeys.localCounts(),
    queryFn: api.getLocalEntityCounts,
    staleTime: 5 * 60 * 1000,
  });

  const privateCountsQuery = useQuery({
    queryKey: dataManagementKeys.privateCounts(),
    queryFn: api.getPrivateCounts,
    staleTime: 5 * 60 * 1000,
  });

  const versionCountQuery = useQuery({
    queryKey: [...dataManagementKeys.all, 'versionCount'] as const,
    queryFn: api.getVersionCount,
    staleTime: 5 * 60 * 1000,
  });

  const trashedAttachmentsQuery = useQuery({
    queryKey: [...dataManagementKeys.all, 'trashedAttachments'] as const,
    queryFn: api.getTrashedAttachmentCount,
    staleTime: 5 * 60 * 1000,
  });

  return {
    localCounts: localCountsQuery.data ?? null,
    privateCounts: privateCountsQuery.data ?? null,
    versionCount: versionCountQuery.data ?? 0,
    trashedAttachmentCount: trashedAttachmentsQuery.data ?? 0,
    isLoading: localCountsQuery.isLoading || privateCountsQuery.isLoading || versionCountQuery.isLoading || trashedAttachmentsQuery.isLoading,
    refetch: () => {
      localCountsQuery.refetch();
      privateCountsQuery.refetch();
      versionCountQuery.refetch();
      trashedAttachmentsQuery.refetch();
    },
  };
}

// ============================================================================
// PRIVACY SUMMARY
// ============================================================================

/**
 * Local-only streams with entry/attachment counts for the privacy summary.
 */
export function usePrivacySummary() {
  const query = useQuery<PrivateStreamSummary[]>({
    queryKey: dataManagementKeys.privateStreams(),
    queryFn: api.getPrivateStreams,
    staleTime: 5 * 60 * 1000,
  });

  return {
    privateStreams: query.data ?? [],
    hasPrivateStreams: (query.data?.length ?? 0) > 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

// ============================================================================
// RE-EXPORTS for convenience
// ============================================================================

// Re-export core hooks so screens only need one import
export { useCloudStorageUsage, useTrash };
