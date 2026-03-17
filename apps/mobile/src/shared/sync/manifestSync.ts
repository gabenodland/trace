/**
 * Manifest-Based Sync
 *
 * Replaces timestamp-based incremental pull with manifest comparison.
 * Flow: fetch manifest (IDs + versions) → diff locally → batch fetch diffs.
 *
 * The collection hash makes the common case (nothing changed) a single RPC
 * returning one string. Full content is fetched only for entries that differ.
 */

import * as Crypto from 'expo-crypto';
import { localDB } from '../db/localDB';
import { supabase, Entry, diffEntryManifests, type ManifestDiffResult, type RemoteManifestEntry } from '@trace/core';
import { createScopedLogger } from '../utils/logger';
import { getDeviceName } from '../utils/deviceUtils';
import { processRemoteEntry } from './pullSyncOperations';

const deviceName = getDeviceName();
const log = createScopedLogger(`Manifest:${deviceName}`, '📋');

// ============================================================================
// TYPES
// ============================================================================

interface EntryManifestResponse {
  hash: string;
  entries: RemoteManifestEntry[];
}

// ============================================================================
// LOCAL HASH COMPUTATION
// ============================================================================

/**
 * Compute local entries hash to compare against server hash.
 * Uses base_version (what we think the server has), not version (which may include local edits).
 * Excludes: local_only entries, unsynced creates (don't exist on server), soft-deleted entries.
 */
async function computeLocalEntriesHash(userId: string): Promise<string> {
  // Include ALL entries (including deleted) so hash mismatches when deleted entries are missing locally
  const rows = await localDB.runCustomQuery(
    `SELECT entry_id, COALESCE(base_version, 1) as base_version FROM entries
     WHERE user_id = ? AND local_only = 0
       AND NOT (synced = 0 AND sync_action = 'create')
     ORDER BY LOWER(entry_id)`,
    [userId]
  );

  if (rows.length === 0) return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5, '');

  const pairs = rows.map((r: any) => `${r.entry_id}:${r.base_version}`).join(',');
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5, pairs);
}

// ============================================================================
// MANIFEST PULL (entries)
// ============================================================================

/**
 * Pull entries using manifest-based reconciliation.
 * 1. Fetch atomic {hash, manifest} from server
 * 2. Compare hash to local hash — skip if match
 * 3. Diff manifest against local state
 * 4. Batch fetch only entries that differ
 */
export async function pullEntriesManifest(
  userId: string,
  forceFullPull: boolean,
): Promise<{ new: number; updated: number; deleted: number }> {
  // Step 1: Fetch server manifest (atomic hash + entries)
  const { data: manifestData, error: manifestError } = await supabase.rpc(
    'get_entries_sync_manifest' as any
  );

  if (manifestError) {
    log.error('Failed to fetch entries manifest', { error: manifestError.message });
    throw new Error(`Manifest fetch failed: ${manifestError.message}`);
  }

  const manifest = manifestData as unknown as EntryManifestResponse;
  if (!manifest || !manifest.entries) {
    log.warn('Empty manifest response');
    return { new: 0, updated: 0, deleted: 0 };
  }

  log.info('Manifest fetched', {
    serverEntries: manifest.entries.length,
    serverHash: manifest.hash?.substring(0, 8),
  });

  // Step 2: Hash comparison — skip everything if unchanged
  if (!forceFullPull) {
    const localHash = await computeLocalEntriesHash(userId);
    log.debug('Hash comparison', {
      local: localHash.substring(0, 8),
      server: manifest.hash?.substring(0, 8),
    });

    if (localHash === manifest.hash) {
      log.info('Entries hash match — nothing changed');
      return { new: 0, updated: 0, deleted: 0 };
    }
  }

  // Step 3: Build local manifest and diff
  const localRows = await localDB.runCustomQuery(
    `SELECT entry_id, COALESCE(version, 1) as version, COALESCE(base_version, 1) as base_version,
            deleted_at, synced, sync_action
     FROM entries WHERE user_id = ? AND local_only = 0`,
    [userId]
  );

  const localMap = new Map<string, { version: number; base_version: number; deleted_at: string | null; synced: number; sync_action: string | null }>();
  for (const row of localRows as any[]) {
    localMap.set(row.entry_id, {
      version: row.version,
      base_version: row.base_version,
      deleted_at: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
      synced: row.synced,
      sync_action: row.sync_action,
    });
  }

  const diff = diffEntryManifests(localMap, manifest.entries);

  log.info('Manifest diff', {
    toFetch: diff.toFetch.length,
    toSoftDelete: diff.toSoftDelete.length,
    toReconcile: diff.toReconcile.length,
    localEntries: localMap.size,
    serverEntries: manifest.entries.length,
  });

  let newCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;

  // Pre-fetch local state in bulk to avoid per-entry SQLite lookups
  const allDiffIds = [...diff.toFetch, ...diff.toSoftDelete.map(r => r.entry_id), ...diff.toReconcile];
  const localEntriesMap = new Map<string, Entry | null>();
  const tombstoneSet = new Set<string>();

  if (allDiffIds.length > 0) {
    const LOOKUP_BATCH = 200;
    for (let i = 0; i < allDiffIds.length; i += LOOKUP_BATCH) {
      const batch = allDiffIds.slice(i, i + LOOKUP_BATCH);
      const placeholders = batch.map(() => '?').join(',');

      // Batch fetch full entry data using getEntriesByIds (single query, proper rowToEntry normalization)
      const foundEntries = await localDB.getEntriesByIds(batch);
      const foundMap = new Map<string, Entry>();
      for (const entry of foundEntries) {
        foundMap.set(entry.entry_id, entry);
      }
      for (const id of batch) {
        localEntriesMap.set(id, foundMap.get(id) || null);
      }

      // Batch tombstone check
      const tombstoneRows = await localDB.runCustomQuery(
        `SELECT entry_id FROM entry_tombstones WHERE entry_id IN (${placeholders})`,
        batch
      ).catch(() => []);
      for (const row of tombstoneRows as any[]) {
        tombstoneSet.add(row.entry_id);
      }
    }

    log.debug('Pre-fetched local state', {
      total: allDiffIds.length,
      existLocally: [...localEntriesMap.values()].filter(v => v !== null).length,
      tombstoned: tombstoneSet.size,
    });
  }

  // Step 4: Batch fetch entries that differ from server
  const BATCH_SIZE = 100;
  for (let i = 0; i < diff.toFetch.length; i += BATCH_SIZE) {
    const batch = diff.toFetch.slice(i, i + BATCH_SIZE);
    const { data: remoteEntries, error: fetchError } = await supabase
      .from('entries')
      .select('*')
      .in('entry_id', batch)
      .eq('user_id', userId);

    if (fetchError) {
      log.error('Batch fetch failed', { error: fetchError.message, batchStart: i });
      continue;
    }

    if (!remoteEntries) continue;

    for (const remoteEntry of remoteEntries) {
      try {
        const entryId = (remoteEntry as any).entry_id;
        const result = await processRemoteEntry(remoteEntry, {
          localEntry: localEntriesMap.get(entryId),
          isTombstoned: tombstoneSet.has(entryId),
        });
        if (result === 'new') newCount++;
        else if (result === 'updated') updatedCount++;
        else if (result === 'deleted') deletedCount++;
      } catch (error) {
        log.warn('Failed to process fetched entry', { entryId: (remoteEntry as any).entry_id, error });
      }
    }
  }

  // Step 5: Batch fetch soft-deleted entries (need full content for trash view)
  const softDeleteIds = diff.toSoftDelete.map(r => r.entry_id);
  for (let i = 0; i < softDeleteIds.length; i += BATCH_SIZE) {
    const batch = softDeleteIds.slice(i, i + BATCH_SIZE);
    const { data: deletedEntries, error: fetchError } = await supabase
      .from('entries')
      .select('*')
      .in('entry_id', batch)
      .eq('user_id', userId);

    if (fetchError) {
      log.error('Batch fetch of deleted entries failed', { error: fetchError.message, batchStart: i });
      continue;
    }

    if (!deletedEntries) continue;

    for (const fullEntry of deletedEntries) {
      try {
        const entryId = (fullEntry as any).entry_id;
        const result = await processRemoteEntry(fullEntry, {
          localEntry: localEntriesMap.get(entryId),
          isTombstoned: tombstoneSet.has(entryId),
        });
        if (result === 'deleted') deletedCount++;
      } catch (error) {
        log.warn('Failed to process soft-deleted entry', { entryId: (fullEntry as any).entry_id, error });
      }
    }
  }

  // Step 6: Handle entries missing from server (synced locally but gone from server)
  for (const entryId of diff.toReconcile) {
    if (tombstoneSet.has(entryId)) {
      // Hard-deleted on server — remove locally
      log.debug('Entry tombstoned on server, removing locally', { entryId });
      await localDB.runCustomQuery('DELETE FROM entries WHERE entry_id = ?', [entryId]);
      continue;
    }

    // Missing from server but we think it's synced — mark for re-push
    log.info('Entry missing from server, re-queuing for push', { entryId });
    await localDB.runCustomQuery(
      "UPDATE entries SET synced = 0, sync_action = 'create' WHERE entry_id = ? AND synced = 1",
      [entryId]
    );
  }

  log.info('Manifest pull complete', { new: newCount, updated: updatedCount, deleted: deletedCount });
  return { new: newCount, updated: updatedCount, deleted: deletedCount };
}

// ============================================================================
// FULL PULL (first install fast path)
// ============================================================================

/**
 * Full pull for first install — fetches all entries in one query.
 * Used when local DB is empty (no manifest to diff against).
 */
export async function pullEntriesFull(
  userId: string,
): Promise<{ new: number; updated: number; deleted: number }> {
  log.info('First install detected — using full pull');

  const { data: remoteEntries, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    log.error('Full pull failed', { error: error.message });
    throw new Error(`Full pull failed: ${error.message}`);
  }

  if (!remoteEntries || remoteEntries.length === 0) {
    return { new: 0, updated: 0, deleted: 0 };
  }

  log.info('Full pull fetched entries', { count: remoteEntries.length });

  let newCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;

  for (const remoteEntry of remoteEntries) {
    try {
      const result = await processRemoteEntry(remoteEntry);
      if (result === 'new') newCount++;
      else if (result === 'updated') updatedCount++;
      else if (result === 'deleted') deletedCount++;
    } catch (error) {
      log.warn('Failed to process entry during full pull', { entryId: remoteEntry.entry_id, error });
    }
  }

  return { new: newCount, updated: updatedCount, deleted: deletedCount };
}
