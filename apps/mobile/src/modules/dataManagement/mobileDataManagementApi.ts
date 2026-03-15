/**
 * Mobile Data Management API — device-local queries
 *
 * SQLite counts, file sizes, and privacy data.
 * NOT exported — consumed only by mobileDataManagementHooks.
 *
 * Architecture:
 * Components → Hooks → API (this file) → LocalDB + FileSystem
 */

import * as FileSystem from 'expo-file-system/legacy';
import type { DeviceStorageUsage, PrivateStreamSummary } from '@trace/core';
import { localDB } from '../../shared/db/localDB';
import { createScopedLogger } from '../../shared/utils/logger';

const log = createScopedLogger('DataMgmtApi');

// ============================================================================
// STORAGE
// ============================================================================

/**
 * Get device-local storage usage: SQLite file size + local attachment files.
 */
export async function getDeviceStorageUsage(): Promise<DeviceStorageUsage> {
  // SQLite database file size
  const dbPath = `${FileSystem.documentDirectory}SQLite/trace.db`;
  let database_bytes = 0;
  try {
    const dbInfo = await FileSystem.getInfoAsync(dbPath);
    if (dbInfo.exists && 'size' in dbInfo) {
      database_bytes = dbInfo.size ?? 0;
    }
  } catch (error) {
    log.warn('Could not read database file size', error as Error);
  }

  // Also check WAL file (can be significant)
  try {
    const walInfo = await FileSystem.getInfoAsync(`${dbPath}-wal`);
    if (walInfo.exists && 'size' in walInfo) {
      database_bytes += walInfo.size ?? 0;
    }
  } catch {
    // WAL may not exist, that's fine
  }

  // Sum local attachment file sizes from SQLite
  let attachment_bytes = 0;
  try {
    const result = await localDB.runCustomQuery(
      'SELECT COALESCE(SUM(file_size), 0) as total FROM attachments WHERE local_path IS NOT NULL'
    );
    attachment_bytes = result[0]?.total ?? 0;
  } catch (error) {
    log.warn('Could not sum local attachment sizes', error as Error);
  }

  return {
    database_bytes,
    attachment_bytes,
    total_bytes: database_bytes + attachment_bytes,
  };
}

// ============================================================================
// ENTITY COUNTS
// ============================================================================

/**
 * Get local entity counts per table.
 */
export async function getLocalEntityCounts(): Promise<{
  entries: number;
  streams: number;
  places: number;
  attachments: number;
}> {
  const [entries, streams, places, attachments] = await Promise.all([
    localDB.runCustomQuery('SELECT COUNT(*) as count FROM entries WHERE deleted_at IS NULL'),
    localDB.runCustomQuery('SELECT COUNT(*) as count FROM streams WHERE deleted_at IS NULL'),
    localDB.runCustomQuery('SELECT COUNT(*) as count FROM locations'),
    localDB.runCustomQuery('SELECT COUNT(*) as count FROM attachments'),
  ]);

  return {
    entries: entries[0]?.count ?? 0,
    streams: streams[0]?.count ?? 0,
    places: places[0]?.count ?? 0,
    attachments: attachments[0]?.count ?? 0,
  };
}

/**
 * Get counts of entities in local-only (private) streams.
 */
export async function getPrivateCounts(): Promise<{
  entries: number;
  streams: number;
  attachments: number;
}> {
  const [streams, entries, attachments] = await Promise.all([
    localDB.runCustomQuery(
      'SELECT COUNT(*) as count FROM streams WHERE is_localonly = 1'
    ),
    localDB.runCustomQuery(
      `SELECT COUNT(*) as count FROM entries
       WHERE deleted_at IS NULL
       AND stream_id IN (SELECT stream_id FROM streams WHERE is_localonly = 1)`
    ),
    localDB.runCustomQuery(
      `SELECT COUNT(*) as count FROM attachments
       WHERE entry_id IN (
         SELECT entry_id FROM entries
         WHERE deleted_at IS NULL
           AND stream_id IN (SELECT stream_id FROM streams WHERE is_localonly = 1)
       )`
    ),
  ]);

  return {
    streams: streams[0]?.count ?? 0,
    entries: entries[0]?.count ?? 0,
    attachments: attachments[0]?.count ?? 0,
  };
}

// ============================================================================
// VERSION COUNTS
// ============================================================================

/**
 * Get local entry version (history snapshot) count.
 */
export async function getVersionCount(): Promise<number> {
  try {
    const result = await localDB.runCustomQuery(
      'SELECT COUNT(*) as count FROM entry_versions'
    );
    return result[0]?.count ?? 0;
  } catch (error) {
    log.warn('Could not count entry versions', error as Error);
    return 0;
  }
}

/**
 * Get count of attachments linked to trashed (soft-deleted) entries.
 */
export async function getTrashedAttachmentCount(): Promise<number> {
  try {
    const result = await localDB.runCustomQuery(
      `SELECT COUNT(*) as count FROM attachments
       WHERE entry_id IN (SELECT entry_id FROM entries WHERE deleted_at IS NOT NULL)`
    );
    return result[0]?.count ?? 0;
  } catch (error) {
    log.warn('Could not count trashed attachments', error as Error);
    return 0;
  }
}

// ============================================================================
// PRIVACY
// ============================================================================

/**
 * Get local-only streams with entry and attachment counts for the privacy summary.
 */
export async function getPrivateStreams(): Promise<PrivateStreamSummary[]> {
  const rows = await localDB.runCustomQuery(
    `SELECT
       s.stream_id AS id,
       s.name,
       COALESCE(ec.entry_count, 0) AS entry_count,
       COALESCE(ac.attachment_count, 0) AS attachment_count
     FROM streams s
     LEFT JOIN (
       SELECT stream_id, COUNT(*) AS entry_count
       FROM entries
       WHERE deleted_at IS NULL
       GROUP BY stream_id
     ) ec ON ec.stream_id = s.stream_id
     LEFT JOIN (
       SELECT e.stream_id, COUNT(*) AS attachment_count
       FROM attachments a
       JOIN entries e ON e.entry_id = a.entry_id
       WHERE e.deleted_at IS NULL
       GROUP BY e.stream_id
     ) ac ON ac.stream_id = s.stream_id
     WHERE s.is_localonly = 1
     ORDER BY s.name`
  );

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    entry_count: row.entry_count,
    attachment_count: row.attachment_count,
  }));
}
