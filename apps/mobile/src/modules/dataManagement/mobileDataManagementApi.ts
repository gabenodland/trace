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
 * Get stream and place counts (top-level summary blocks).
 */
export async function getTopLevelCounts(): Promise<{
  streams: number;
  places: number;
}> {
  const [streams, places] = await Promise.all([
    localDB.runCustomQuery('SELECT COUNT(*) as count FROM streams'),
    localDB.runCustomQuery('SELECT COUNT(*) as count FROM locations WHERE deleted_at IS NULL'),
  ]);

  const result = {
    streams: streams[0]?.count ?? 0,
    places: places[0]?.count ?? 0,
  };
  log.info('getTopLevelCounts', { streams: result.streams, places: result.places });
  return result;
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
// SUMMARIES (counts + sizes)
// ============================================================================

export interface DataSummary {
  entryCount: number;
  attachmentCount: number;
  attachmentBytes: number;
  versionCount: number;
}

/**
 * Summary of live (non-deleted) entries: counts and sizes.
 */
export async function getEntrySummary(): Promise<DataSummary> {
  const [entries, attachments, versions] = await Promise.all([
    localDB.runCustomQuery(
      'SELECT COUNT(*) as count FROM entries WHERE deleted_at IS NULL'
    ),
    localDB.runCustomQuery(
      `SELECT COUNT(*) as count, COALESCE(SUM(a.file_size), 0) as bytes
       FROM attachments a
       JOIN entries e ON e.entry_id = a.entry_id
       WHERE e.deleted_at IS NULL`
    ),
    localDB.runCustomQuery(
      `SELECT COUNT(*) as count FROM entry_versions
       WHERE entry_id IN (SELECT entry_id FROM entries WHERE deleted_at IS NULL)`
    ),
  ]);

  const result = {
    entryCount: entries[0]?.count ?? 0,
    attachmentCount: attachments[0]?.count ?? 0,
    attachmentBytes: attachments[0]?.bytes ?? 0,
    versionCount: versions[0]?.count ?? 0,
  };
  log.info('getEntrySummary', { entries: result.entryCount, attachments: result.attachmentCount, bytes: result.attachmentBytes, versions: result.versionCount });
  return result;
}

/**
 * Summary of deleted entries: counts and sizes.
 */
export async function getDeletedEntrySummary(): Promise<DataSummary> {
  const [entries, attachments, versions] = await Promise.all([
    localDB.runCustomQuery(
      'SELECT COUNT(*) as count FROM entries WHERE deleted_at IS NOT NULL'
    ),
    localDB.runCustomQuery(
      `SELECT COUNT(*) as count, COALESCE(SUM(a.file_size), 0) as bytes
       FROM attachments a
       JOIN entries e ON e.entry_id = a.entry_id
       WHERE e.deleted_at IS NOT NULL`
    ),
    localDB.runCustomQuery(
      `SELECT COUNT(*) as count FROM entry_versions
       WHERE entry_id IN (SELECT entry_id FROM entries WHERE deleted_at IS NOT NULL)`
    ),
  ]);

  const result = {
    entryCount: entries[0]?.count ?? 0,
    attachmentCount: attachments[0]?.count ?? 0,
    attachmentBytes: attachments[0]?.bytes ?? 0,
    versionCount: versions[0]?.count ?? 0,
  };
  log.info('getDeletedEntrySummary', { entries: result.entryCount, attachments: result.attachmentCount, bytes: result.attachmentBytes, versions: result.versionCount });
  return result;
}

// ============================================================================
// ENTRY LIST (for entries screen)
// ============================================================================

export interface EntryListItem {
  id: string;
  title: string | null;
  content: string | null;
  stream_name: string | null;
  stream_id: string | null;
  created_at: string;
  updated_at: string;
  content_bytes: number;
  attachment_count: number;
  attachment_bytes: number;
}

/**
 * Get all live entries with attachment counts and sizes for the entries list screen.
 */
export async function getEntryListItems(): Promise<EntryListItem[]> {
  const rows = await localDB.runCustomQuery(
    `SELECT
       e.entry_id,
       e.title,
       e.content,
       e.stream_id,
       s.name as stream_name,
       e.created_at,
       e.updated_at,
       LENGTH(COALESCE(e.content, '')) + LENGTH(COALESCE(e.title, '')) as content_bytes,
       COALESCE(att.count, 0) as attachment_count,
       COALESCE(att.bytes, 0) as attachment_bytes
     FROM entries e
     LEFT JOIN streams s ON s.stream_id = e.stream_id
     LEFT JOIN (
       SELECT entry_id, COUNT(*) as count, COALESCE(SUM(file_size), 0) as bytes
       FROM attachments
       GROUP BY entry_id
     ) att ON att.entry_id = e.entry_id
     WHERE e.deleted_at IS NULL
     ORDER BY e.updated_at DESC`
  );

  return rows.map((r: any) => ({
    id: r.entry_id,
    title: r.title,
    content: r.content ?? null,
    stream_name: r.stream_name ?? null,
    stream_id: r.stream_id ?? null,
    created_at: typeof r.created_at === 'number'
      ? new Date(r.created_at).toISOString()
      : r.created_at ?? '',
    updated_at: typeof r.updated_at === 'number'
      ? new Date(r.updated_at).toISOString()
      : r.updated_at ?? '',
    content_bytes: r.content_bytes ?? 0,
    attachment_count: r.attachment_count,
    attachment_bytes: r.attachment_bytes,
  }));
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
// TRASH (LOCAL)
// ============================================================================

/**
 * Get all soft-deleted entries from local SQLite (for trash screen).
 */
export async function getLocalDeletedEntries() {
  const rows = await localDB.runCustomQuery(
    `SELECT
       e.entry_id, e.title, e.content, e.stream_id, e.deleted_at,
       s.name as stream_name,
       LENGTH(COALESCE(e.content, '')) + LENGTH(COALESCE(e.title, '')) as content_bytes,
       COALESCE(att.count, 0) as attachment_count,
       COALESCE(att.bytes, 0) as attachment_bytes
     FROM entries e
     LEFT JOIN streams s ON s.stream_id = e.stream_id
     LEFT JOIN (
       SELECT entry_id, COUNT(*) as count, COALESCE(SUM(file_size), 0) as bytes
       FROM attachments
       GROUP BY entry_id
     ) att ON att.entry_id = e.entry_id
     WHERE e.deleted_at IS NOT NULL
     ORDER BY e.deleted_at DESC`
  );

  return rows.map((r: any) => ({
    id: r.entry_id,
    title: r.title,
    content: r.content ?? null,
    stream_name: r.stream_name ?? null,
    stream_id: r.stream_id ?? null,
    deleted_at: typeof r.deleted_at === 'number'
      ? new Date(r.deleted_at).toISOString()
      : r.deleted_at ?? '',
    content_bytes: r.content_bytes ?? 0,
    attachment_count: r.attachment_count,
    attachment_bytes: r.attachment_bytes,
  }));
}

/**
 * Get count of soft-deleted entries locally.
 */
export async function getLocalDeletedEntryCount(): Promise<number> {
  try {
    const result = await localDB.runCustomQuery(
      'SELECT COUNT(*) as count FROM entries WHERE deleted_at IS NOT NULL'
    );
    return result[0]?.count ?? 0;
  } catch (error) {
    log.warn('Could not count deleted entries', error as Error);
    return 0;
  }
}

/**
 * Restore a soft-deleted entry locally.
 * Returns whether the entry was moved to inbox (original stream deleted).
 */
export async function restoreEntryLocally(entryId: string): Promise<{ restored_to_inbox: boolean }> {
  return localDB.restoreEntry(entryId);
}

/**
 * Check if an entry's stream is deleted and get its name (for pre-restore UI messaging).
 */
export async function getStreamStatusForRestore(streamId: string | null): Promise<{ deleted: boolean; name: string | null }> {
  if (!streamId) return { deleted: false, name: null };
  const rows = await localDB.runCustomQuery(
    `SELECT name, deleted_at FROM streams WHERE stream_id = ?`,
    [streamId]
  );
  if (!rows.length) return { deleted: true, name: null };
  return { deleted: rows[0].deleted_at !== null, name: rows[0].name };
}

/**
 * Hard-delete an entry permanently from local SQLite.
 */
export async function hardDeleteEntryLocally(entryId: string): Promise<void> {
  await localDB.hardDeleteEntry(entryId);
}

/**
 * Empty all trash — hard-delete all soft-deleted entries.
 * Uses purgeExpiredTrash with 0-day retention to clear everything.
 */
export async function emptyTrash(): Promise<number> {
  return localDB.purgeExpiredTrash(0);
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
