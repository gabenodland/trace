/**
 * Manifest Diff Algorithm
 *
 * Pure functions for comparing remote manifests against local state.
 * Used by the manifest-based sync system to determine what needs
 * to be fetched, soft-deleted, or reconciled.
 *
 * These functions have NO side effects — no DB, no network.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RemoteManifestEntry {
  entry_id: string;
  version: number;
  deleted_at: string | null;
}

export interface LocalManifestEntry {
  version: number;
  base_version: number;
  deleted_at: string | null;
  synced: number;
  sync_action: string | null;
}

export interface ManifestDiffResult {
  /** Entry IDs to fetch full content for (missing locally or server has newer version) */
  toFetch: string[];
  /** Remote entries that are soft-deleted but not locally */
  toSoftDelete: RemoteManifestEntry[];
  /** Entry IDs that exist locally (synced=1) but are missing from server */
  toReconcile: string[];
}

// ============================================================================
// DIFF ALGORITHM
// ============================================================================

/**
 * Diff remote manifest against local state.
 * Returns lists of entries to fetch, soft-delete, or reconcile.
 *
 * Rules:
 * - Missing locally + live → toFetch
 * - Missing locally + deleted → toSoftDelete (save as placeholder for trash)
 * - Server version > local base_version → toFetch
 * - Server deleted, local alive → toSoftDelete
 * - Local synced=0 → skip (push will handle)
 * - Local synced=1, missing from server → toReconcile
 * - Versions match → skip (in sync)
 */
export function diffEntryManifests(
  localMap: Map<string, LocalManifestEntry>,
  remoteManifest: RemoteManifestEntry[],
): ManifestDiffResult {
  const toFetch: string[] = [];
  const toSoftDelete: RemoteManifestEntry[] = [];
  const toReconcile: string[] = [];
  const remoteIds = new Set<string>();

  for (const remote of remoteManifest) {
    remoteIds.add(remote.entry_id);
    const local = localMap.get(remote.entry_id);

    if (!local) {
      // Missing locally
      if (remote.deleted_at) {
        toSoftDelete.push(remote);
      } else {
        toFetch.push(remote.entry_id);
      }
      continue;
    }

    // Server soft-deleted, local is live
    if (remote.deleted_at && !local.deleted_at) {
      toSoftDelete.push(remote);
      continue;
    }

    // Both deleted — skip
    if (remote.deleted_at && local.deleted_at) {
      continue;
    }

    // Local has pending changes — skip, push handles it
    if (local.synced === 0) {
      continue;
    }

    // Server has newer version
    if (remote.version > (local.base_version || 1)) {
      toFetch.push(remote.entry_id);
    }
  }

  // Detect entries missing from server that we think are synced
  for (const [entryId, local] of localMap) {
    if (local.synced === 1 && !local.deleted_at && !remoteIds.has(entryId)) {
      toReconcile.push(entryId);
    }
  }

  return { toFetch, toSoftDelete, toReconcile };
}
