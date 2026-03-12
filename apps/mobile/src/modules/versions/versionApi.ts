/**
 * Version API — SQLite queries for the entry_versions table
 *
 * Internal to the versions module — not exported from index.ts.
 */

import { localDB } from '../../shared/db/localDB';
import { updateEntry } from '../entries/mobileEntryApi';
import { createScopedLogger } from '../../shared/utils/logger';
import { buildSnapshot, generateChangeSummary } from './versionHelpers';
import { getDeviceId } from '../../config/appVersionService';
import type { Entry } from '@trace/core';
import type { EntryVersion, EntrySnapshot } from './VersionTypes';
import { generateUUID } from '../../shared/utils/uuid';

const log = createScopedLogger('VersionApi');

/**
 * Parse a raw SQLite row into an EntryVersion, deserializing JSON fields.
 */
function parseVersionRow(row: any): EntryVersion {
  return {
    ...row,
    snapshot: row.snapshot ? JSON.parse(row.snapshot) : null,
    attachment_ids: row.attachment_ids ? JSON.parse(row.attachment_ids) : null,
    // SQLite stores timestamps as Unix ms (number) — convert to ISO string for type consistency
    created_at: typeof row.created_at === 'number' ? new Date(row.created_at).toISOString() : row.created_at,
    device_created_at: typeof row.device_created_at === 'number' ? new Date(row.device_created_at).toISOString() : row.device_created_at,
  };
}

/**
 * Get all versions for a given entry, ordered by created_at DESC
 */
export async function getVersionsForEntry(entryId: string): Promise<EntryVersion[]> {
  log.debug('getVersionsForEntry called', { entryId });
  try {
    const rows = await localDB.runCustomQuery(
      'SELECT * FROM entry_versions WHERE entry_id = ? ORDER BY created_at DESC',
      [entryId]
    );
    return rows.map(parseVersionRow);
  } catch (error) {
    log.error('Failed to get versions for entry', error, { entryId });
    throw error;
  }
}

/**
 * Get a single version by ID with full snapshot
 */
export async function getVersionById(versionId: string): Promise<EntryVersion | null> {
  log.debug('getVersionById called', { versionId });
  try {
    const rows = await localDB.runCustomQuery(
      'SELECT * FROM entry_versions WHERE version_id = ? LIMIT 1',
      [versionId]
    );
    if (rows.length === 0) return null;
    return parseVersionRow(rows[0]);
  } catch (error) {
    log.error('Failed to get version by id', error, { versionId });
    throw error;
  }
}

/**
 * Input type for createVersion — version_number is computed atomically by the INSERT.
 */
export type CreateVersionInput = Omit<EntryVersion, 'version_id' | 'version_number' | 'synced' | 'sync_action'>;

/**
 * Insert a new version into SQLite with synced=0, sync_action='create'.
 *
 * version_number is computed atomically via a subquery:
 *   (SELECT COALESCE(MAX(version_number) + 1, 0) FROM entry_versions
 *    WHERE entry_id = ? AND base_entry_version IS ?)
 *
 * This scopes the sub-number to the (entry_id, base_entry_version) pair,
 * so each new sync version resets the counter: 5.0, 5.1, 5.2, then 6.0, 6.1...
 * SQLite serializes writes, making this race-free.
 */
export async function createVersion(version: CreateVersionInput): Promise<string> {
  const versionId = generateUUID();
  const baseVersion = version.base_entry_version != null ? String(version.base_entry_version) : null;
  log.debug('createVersion called', { versionId, entryId: version.entry_id, baseVersion });
  try {
    const now = Date.now();
    await localDB.runCustomQuery(
      `INSERT INTO entry_versions (
        version_id, entry_id, user_id, version_number, trigger,
        snapshot, attachment_ids, change_summary, device_id,
        triggered_by_device, device_created_at, base_entry_version,
        created_at, synced, sync_action
      ) VALUES (
        ?, ?, ?,
        (SELECT COALESCE(MAX(version_number) + 1, 0) FROM entry_versions WHERE entry_id = ? AND base_entry_version IS ?),
        ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'create'
      )`,
      [
        versionId,
        version.entry_id,
        version.user_id,
        version.entry_id,   // subquery: entry_id
        baseVersion,         // subquery: base_entry_version
        version.trigger,
        JSON.stringify(version.snapshot),
        version.attachment_ids ? JSON.stringify(version.attachment_ids) : null,
        version.change_summary ?? null,
        version.device_id ?? null,
        version.triggered_by_device ?? null,
        version.device_created_at ?? null,
        baseVersion,
        version.created_at ? new Date(version.created_at).getTime() : now,
      ]
    );
    return versionId;
  } catch (error) {
    log.error('Failed to create version', error, { versionId, entryId: version.entry_id });
    throw error;
  }
}

/**
 * Get all versions that haven't been synced to Supabase yet
 */
export async function getUnsyncedVersions(): Promise<EntryVersion[]> {
  log.debug('getUnsyncedVersions called');
  try {
    const rows = await localDB.runCustomQuery(
      "SELECT * FROM entry_versions WHERE synced = 0 AND sync_action = 'create'",
      []
    );
    return rows.map(parseVersionRow);
  } catch (error) {
    log.error('Failed to get unsynced versions', error);
    throw error;
  }
}

/**
 * Mark a version as synced after successful push to Supabase
 */
export async function markVersionSynced(versionId: string): Promise<void> {
  log.debug('markVersionSynced called', { versionId });
  try {
    await localDB.runCustomQuery(
      'UPDATE entry_versions SET synced = 1, sync_action = NULL WHERE version_id = ?',
      [versionId]
    );
  } catch (error) {
    log.error('Failed to mark version synced', error, { versionId });
    throw error;
  }
}

/**
 * Delete all versions for a given entry (used when entry is hard-deleted)
 */
export async function deleteVersionsForEntry(entryId: string): Promise<void> {
  log.debug('deleteVersionsForEntry called', { entryId });
  try {
    await localDB.runCustomQuery(
      'DELETE FROM entry_versions WHERE entry_id = ?',
      [entryId]
    );
  } catch (error) {
    log.error('Failed to delete versions for entry', error, { entryId });
    throw error;
  }
}

/**
 * Restore an entry to a previous version's snapshot.
 *
 * Steps:
 * 1. Read the current entry state
 * 2. Snapshot the current state as a 'restore' version (preserves pre-restore state)
 * 3. Overwrite the entry with the target snapshot's fields
 *
 * Returns the version_id of the pre-restore snapshot.
 */
export async function restoreFromVersion(
  entryId: string,
  targetSnapshot: EntrySnapshot,
  userId: string,
  targetAttachmentIds?: string[] | null,
): Promise<string> {
  log.info('restoreFromVersion called', { entryId: entryId.substring(0, 8) });

  // 1. Get the current entry
  const rows = await localDB.runCustomQuery(
    'SELECT * FROM entries WHERE entry_id = ? LIMIT 1',
    [entryId]
  );
  if (rows.length === 0) throw new Error(`Entry ${entryId} not found`);
  const currentEntry = rows[0];

  // 2. Snapshot current state before overwriting
  const currentSnapshot = buildSnapshot(currentEntry);
  const changeSummary = generateChangeSummary(targetSnapshot, currentSnapshot);
  const deviceId = await getDeviceId();
  const now = new Date().toISOString();

  // Fetch current attachment IDs so the snapshot includes images
  let attachmentIds: string[] | null = null;
  try {
    const attachments = await localDB.getAttachmentsForEntry(entryId);
    if (attachments.length > 0) {
      attachmentIds = attachments.map(a => a.attachment_id);
    }
  } catch (e) {
    log.debug('Failed to fetch attachment IDs for snapshot', { entryId, error: e });
  }

  const preRestoreVersionId = await createVersion({
    entry_id: entryId,
    user_id: userId,
    trigger: 'restore',
    snapshot: currentSnapshot,
    attachment_ids: attachmentIds,
    change_summary: `restored to earlier version${changeSummary ? ` (${changeSummary})` : ''}`,
    device_id: deviceId,
    triggered_by_device: null,
    device_created_at: now,
    base_entry_version: String(currentEntry.base_version || 1),
    created_at: now,
  });

  // 3. Overwrite entry with target snapshot fields
  const restoreData: Partial<Entry> = {
    title: targetSnapshot.title ?? '',
    content: targetSnapshot.content ?? '',
    status: (targetSnapshot.status as Entry['status']) ?? 'none',
    type: targetSnapshot.type ?? null,
    priority: targetSnapshot.priority ?? 0,
    rating: targetSnapshot.rating ?? 0,
    tags: targetSnapshot.tags ?? [],
    mentions: targetSnapshot.mentions ?? [],
    stream_id: targetSnapshot.stream_id ?? null,
    due_date: targetSnapshot.due_date ?? null,
    completed_at: targetSnapshot.completed_at ?? null,
    is_pinned: targetSnapshot.is_pinned ?? false,
    entry_date: targetSnapshot.entry_date ?? null,
    entry_latitude: targetSnapshot.entry_latitude ?? null,
    entry_longitude: targetSnapshot.entry_longitude ?? null,
    location_id: targetSnapshot.location_id ?? null,
    geocode_status: (targetSnapshot.geocode_status as Entry['geocode_status']) ?? null,
    place_name: targetSnapshot.place_name ?? null,
    address: targetSnapshot.address ?? null,
    neighborhood: targetSnapshot.neighborhood ?? null,
    postal_code: targetSnapshot.postal_code ?? null,
    city: targetSnapshot.city ?? null,
    subdivision: targetSnapshot.subdivision ?? null,
    region: targetSnapshot.region ?? null,
    country: targetSnapshot.country ?? null,
  };
  await updateEntry(entryId, restoreData);

  // 4. Reconcile attachments to match the target version
  log.debug('Attachment reconciliation starting', {
    entryId: entryId.substring(0, 8),
    targetCount: targetAttachmentIds?.length ?? 0,
  });

  if (targetAttachmentIds) {
    try {
      const targetSet = new Set(targetAttachmentIds);
      const currentAttachments = await localDB.getAttachmentsForEntry(entryId);
      const currentIds = new Set(currentAttachments.map(a => a.attachment_id));

      // Soft-delete attachments that exist now but weren't in the target version
      for (const att of currentAttachments) {
        if (!targetSet.has(att.attachment_id)) {
          log.debug('Soft-deleting attachment not in target', { attachmentId: att.attachment_id.substring(0, 8) });
          await localDB.deleteAttachment(att.attachment_id);
        }
      }

      // Un-delete attachments that were in the target version but are currently soft-deleted
      const missingIds = targetAttachmentIds.filter(id => !currentIds.has(id));

      if (missingIds.length > 0) {
        for (const id of missingIds) {
          // Check if row exists before attempting un-delete
          const rows = await localDB.runCustomQuery(
            'SELECT attachment_id FROM attachments WHERE attachment_id = ? AND entry_id = ?',
            [id, entryId]
          );

          if (rows.length === 0) {
            log.warn('Cannot un-delete attachment — row not found (may have been hard-deleted)', {
              attachmentId: id.substring(0, 8),
            });
            continue;
          }

          await localDB.runCustomQuery(
            'UPDATE attachments SET deleted_at = NULL, sync_action = NULL, synced = 0 WHERE attachment_id = ? AND entry_id = ?',
            [id, entryId]
          );
        }
      }

      log.info('Attachment reconciliation complete', {
        entryId: entryId.substring(0, 8),
        targetCount: targetAttachmentIds.length,
        currentCount: currentAttachments.length,
        missingCount: missingIds.length,
      });
    } catch (error) {
      // Non-fatal — entry fields are already restored
      log.warn('Failed to reconcile attachments during restore', { entryId, error });
    }
  } else {
    log.debug('Skipping attachment reconciliation — no targetAttachmentIds');
  }

  log.info('Entry restored from version', {
    entryId: entryId.substring(0, 8),
    preRestoreVersionId: preRestoreVersionId.substring(0, 8),
  });

  return preRestoreVersionId;
}

/**
 * Create a new entry from a version snapshot.
 * Uses the snapshot's content/metadata but generates a fresh ID, timestamps,
 * and prefixes the title with "Copy of".
 *
 * Returns the new entry ID for navigation.
 */
export async function createCopyFromSnapshot(
  snapshot: EntrySnapshot,
  userId: string,
): Promise<string> {
  const entry_id = generateUUID();
  const now = new Date().toISOString();
  const deviceId = await getDeviceId();

  const entry: Entry = {
    entry_id,
    user_id: userId,
    title: snapshot.title ? `Copy of ${snapshot.title}` : 'Copy of Untitled',
    content: snapshot.content ?? '',
    tags: snapshot.tags ?? [],
    mentions: snapshot.mentions ?? [],
    stream_id: snapshot.stream_id ?? null,
    entry_latitude: snapshot.entry_latitude ?? null,
    entry_longitude: snapshot.entry_longitude ?? null,
    location_id: snapshot.location_id ?? null,
    place_name: snapshot.place_name ?? null,
    address: snapshot.address ?? null,
    neighborhood: snapshot.neighborhood ?? null,
    postal_code: snapshot.postal_code ?? null,
    city: snapshot.city ?? null,
    subdivision: snapshot.subdivision ?? null,
    region: snapshot.region ?? null,
    country: snapshot.country ?? null,
    geocode_status: (snapshot.geocode_status as Entry['geocode_status']) ?? null,
    status: (snapshot.status as Entry['status']) ?? 'none',
    type: snapshot.type ?? null,
    due_date: snapshot.due_date ?? null,
    completed_at: null,
    entry_date: now,
    created_at: now,
    updated_at: now,
    attachments: null,
    priority: snapshot.priority ?? 0,
    rating: snapshot.rating ?? 0,
    is_pinned: false,
    is_archived: false,
    local_only: 0,
    synced: 0,
    sync_action: 'create',
    version: 1,
    base_version: 1,
    conflict_status: null,
    conflict_backup: null,
    last_edited_by: null,
    last_edited_device: deviceId,
  };

  await localDB.saveEntry(entry);

  log.info('Created copy from snapshot', { newEntryId: entry_id.substring(0, 8) });

  return entry_id;
}
