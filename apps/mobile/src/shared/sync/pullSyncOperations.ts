/**
 * Pull Sync Operations
 *
 * Handles pulling remote changes from Supabase server to local SQLite.
 * Order: Streams → Locations → Entries → Attachments
 */

import { localDB } from '../db/localDB';
import { supabase, Entry, LocationEntity } from '@trace/core';
import { createScopedLogger } from '../utils/logger';
import { isNetworkError } from '../utils/networkUtils';
import { getDeviceName } from '../utils/deviceUtils';
import { getDeviceId } from '../../config/appVersionService';
import { createVersion } from '../../modules/versions/versionApi';
import { createSyncOverwriteIfNeeded } from '../../modules/versions/syncOverwriteHelper';

// Lazy imports to break circular dependency
let _deleteAttachmentFromLocalStorage: ((path: string) => Promise<void>) | null = null;
let _getAttachmentLocalPath: ((userId: string, entryId: string, attachmentId: string) => string) | null = null;
async function loadAttachmentHelpers() {
  if (!_deleteAttachmentFromLocalStorage || !_getAttachmentLocalPath) {
    const module = await import('../../modules/attachments/mobileAttachmentApi');
    _deleteAttachmentFromLocalStorage = module.deleteAttachmentFromLocalStorage;
    _getAttachmentLocalPath = module.getAttachmentLocalPath;
  }
  return { deleteAttachmentFromLocalStorage: _deleteAttachmentFromLocalStorage!, getAttachmentLocalPath: _getAttachmentLocalPath! };
}

const deviceName = getDeviceName();
const log = createScopedLogger(`Pull:${deviceName}`, '⬇️');

// ============================================================================
// TIMESTAMP MANAGEMENT
// ============================================================================

export async function getLastPullTimestamp(): Promise<Date | null> {
  try {
    const result = await localDB.runCustomQuery(
      'SELECT value FROM sync_metadata WHERE key = ?',
      ['last_pull_timestamp']
    );
    if (result.length > 0 && result[0].value) {
      return new Date(parseInt(result[0].value));
    }
    return null;
  } catch (error) {
    return null;
  }
}

export async function saveLastPullTimestamp(timestamp: Date): Promise<void> {
  await localDB.runCustomQuery(
    'INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)',
    ['last_pull_timestamp', timestamp.getTime().toString(), Date.now()]
  );
}

// ============================================================================
// PULL OPERATIONS
// ============================================================================

export async function pullStreams(forceFullPull: boolean): Promise<{ new: number; updated: number; deleted: number }> {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return { new: 0, updated: 0, deleted: 0 };

  const { data: remoteStreams, error } = await supabase
    .from('streams')
    .select('*')
    .eq('user_id', user.id)
    .order('name');

  if (error) {
    log.error('Failed to fetch streams', error);
    return { new: 0, updated: 0, deleted: 0 };
  }

  let newCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;

  // Build set of server stream IDs (non-deleted) for missing stream detection
  const serverStreamIds = new Set<string>(
    (remoteStreams || []).filter(s => !s.deleted_at).map(s => s.stream_id)
  );

  // Process streams from server
  for (const remoteStream of (remoteStreams || [])) {
    try {
      const localStream = await localDB.getStream(remoteStream.stream_id);

      // Handle soft-deleted streams: remove locally
      if (remoteStream.deleted_at) {
        if (localStream && localStream.sync_action !== 'delete') {
          log.info('Stream soft-deleted on server, removing locally', {
            streamId: remoteStream.stream_id,
            name: remoteStream.name,
          });
          // Move local entries to Inbox and hard-delete the local stream row
          await localDB.removeStreamLocally(remoteStream.stream_id);
          deletedCount++;
        }
        continue;
      }

      const stream = {
        ...remoteStream,
        synced: 1,
        sync_action: null,
      };

      if (!localStream) {
        await localDB.saveStream(stream);
        await localDB.markStreamSynced(stream.stream_id);
        newCount++;
      } else if (localStream.synced !== 0) {
        // Check ALL stream fields for changes
        const serverStream = stream as any;

        // Helper to normalize arrays for comparison
        const arraysEqual = (a: any, b: any): boolean => {
          const arrA = Array.isArray(a) ? a : [];
          const arrB = Array.isArray(b) ? b : [];
          return JSON.stringify(arrA) === JSON.stringify(arrB);
        };

        const hasChanged =
          // Basic fields
          localStream.name !== serverStream.name ||
          localStream.color !== serverStream.color ||
          localStream.icon !== serverStream.icon ||
          // Template fields
          localStream.entry_title_template !== serverStream.entry_title_template ||
          localStream.entry_content_template !== serverStream.entry_content_template ||
          // Feature toggles
          localStream.entry_use_rating !== serverStream.entry_use_rating ||
          localStream.entry_rating_type !== serverStream.entry_rating_type ||
          localStream.entry_use_priority !== serverStream.entry_use_priority ||
          localStream.entry_use_status !== serverStream.entry_use_status ||
          localStream.entry_use_duedates !== serverStream.entry_use_duedates ||
          localStream.entry_use_location !== serverStream.entry_use_location ||
          localStream.entry_use_photos !== serverStream.entry_use_photos ||
          localStream.entry_content_type !== serverStream.entry_content_type ||
          // Status configuration (arrays)
          !arraysEqual(localStream.entry_statuses, serverStream.entry_statuses) ||
          localStream.entry_default_status !== serverStream.entry_default_status ||
          // Type configuration
          localStream.entry_use_type !== serverStream.entry_use_type ||
          !arraysEqual(localStream.entry_types, serverStream.entry_types) ||
          // Privacy settings
          localStream.is_private !== serverStream.is_private;

        if (hasChanged) {
          await localDB.updateStream(stream.stream_id, stream);
          await localDB.markStreamSynced(stream.stream_id);
          updatedCount++;
        }
      }
    } catch (error) {
      log.warn('Failed to process stream', { streamId: remoteStream.stream_id, error });
    }
  }

  // Detect local streams that exist but are missing from server
  // Mark them for re-push rather than deleting
  try {
    const localStreams = await localDB.getAllStreams();
    let markedForPush = 0;

    for (const localStream of localStreams) {
      // Skip streams already pending sync
      if (localStream.synced === 0) {
        continue;
      }

      // If stream exists locally (marked synced) but not on server,
      // it was likely never pushed successfully - mark for re-push
      if (!serverStreamIds.has(localStream.stream_id)) {
        log.warn('Stream missing from server, marking for re-push', {
          streamId: localStream.stream_id,
          name: localStream.name,
        });

        await localDB.runCustomQuery(
          'UPDATE streams SET synced = 0, sync_action = \'create\' WHERE stream_id = ?',
          [localStream.stream_id]
        );

        markedForPush++;
      }
    }

    if (markedForPush > 0) {
      log.debug(`Marked ${markedForPush} missing streams for re-push`);
    }
  } catch (error) {
    log.warn('Failed to check for missing streams', { error });
  }

  return { new: newCount, updated: updatedCount, deleted: deletedCount };
}

export async function pullLocations(forceFullPull: boolean): Promise<{ new: number; updated: number; deleted: number }> {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return { new: 0, updated: 0, deleted: 0 };

  // Fetch ALL locations including soft-deleted (so deletes propagate to other devices)
  const { data: remoteLocations, error } = await supabase
    .from('locations')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    log.error('Failed to fetch locations', error);
    return { new: 0, updated: 0, deleted: 0 };
  }

  if (!remoteLocations || remoteLocations.length === 0) {
    return { new: 0, updated: 0, deleted: 0 };
  }

  let newCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;

  for (const remoteLocation of remoteLocations) {
    try {
      const localLocation = await localDB.getLocation(remoteLocation.location_id);

      const location: LocationEntity = {
        location_id: remoteLocation.location_id,
        user_id: remoteLocation.user_id,
        name: remoteLocation.name,
        latitude: remoteLocation.latitude,
        longitude: remoteLocation.longitude,
        source: remoteLocation.source,
        address: remoteLocation.address,
        neighborhood: remoteLocation.neighborhood,
        postal_code: remoteLocation.postal_code,
        city: remoteLocation.city,
        subdivision: remoteLocation.subdivision,
        region: remoteLocation.region,
        country: remoteLocation.country,
        mapbox_place_id: remoteLocation.mapbox_place_id,
        foursquare_fsq_id: remoteLocation.foursquare_fsq_id,
        merge_ignore_ids: remoteLocation.merge_ignore_ids || null,
        created_at: remoteLocation.created_at || new Date().toISOString(),
        updated_at: remoteLocation.updated_at || new Date().toISOString(),
        deleted_at: remoteLocation.deleted_at,
        synced: 1,
        sync_action: null,
      };

      // Handle soft-deleted locations — mirror delete locally
      if (remoteLocation.deleted_at) {
        if (localLocation && !localLocation.deleted_at) {
          await localDB.saveLocation(location);
          await localDB.markLocationSynced(location.location_id);
          deletedCount++;
        } else if (!localLocation) {
          // Deleted on server, never had it locally — skip
        }
        continue;
      }

      if (!localLocation) {
        await localDB.saveLocation(location);
        await localDB.markLocationSynced(location.location_id);
        newCount++;
      } else if (localLocation.synced !== 0) {
        // Compare all mutable fields
        const hasChanged =
          localLocation.name !== location.name ||
          localLocation.latitude !== location.latitude ||
          localLocation.longitude !== location.longitude ||
          localLocation.source !== location.source ||
          localLocation.address !== location.address ||
          localLocation.neighborhood !== location.neighborhood ||
          localLocation.postal_code !== location.postal_code ||
          localLocation.city !== location.city ||
          localLocation.subdivision !== location.subdivision ||
          localLocation.region !== location.region ||
          localLocation.country !== location.country ||
          localLocation.mapbox_place_id !== location.mapbox_place_id ||
          localLocation.foursquare_fsq_id !== location.foursquare_fsq_id ||
          localLocation.merge_ignore_ids !== location.merge_ignore_ids ||
          localLocation.deleted_at !== location.deleted_at;

        if (hasChanged) {
          await localDB.saveLocation(location);
          await localDB.markLocationSynced(location.location_id);
          updatedCount++;
        }
      }
    } catch (error) {
      log.warn('Failed to process location', { locationId: remoteLocation.location_id, error });
    }
  }

  return { new: newCount, updated: updatedCount, deleted: deletedCount };
}

// ============================================================================
// ENTRY PROCESSING HELPERS (shared by pull sync and manifest sync)
// ============================================================================

/** Map a remote Supabase entry row to a local Entry object */
export function remoteToEntry(remote: any, options?: { clearLocationId?: boolean }): Entry {
  return {
    entry_id: remote.entry_id,
    user_id: remote.user_id,
    title: remote.title,
    content: remote.content,
    tags: remote.tags || [],
    mentions: remote.mentions || [],
    stream_id: remote.stream_id,
    entry_latitude: remote.entry_latitude || null,
    entry_longitude: remote.entry_longitude || null,
    location_id: options?.clearLocationId ? null : (remote.location_id || null),
    place_name: remote.place_name || null,
    address: remote.address || null,
    neighborhood: remote.neighborhood || null,
    postal_code: remote.postal_code || null,
    city: remote.city || null,
    subdivision: remote.subdivision || null,
    region: remote.region || null,
    country: remote.country || null,
    geocode_status: remote.geocode_status || null,
    status: (remote.status as Entry['status']) || 'none',
    type: remote.type || null,
    due_date: remote.due_date,
    completed_at: remote.completed_at,
    entry_date: remote.entry_date || remote.created_at,
    created_at: remote.created_at,
    updated_at: remote.updated_at,
    deleted_at: remote.deleted_at,
    attachments: null,
    priority: remote.priority || 0,
    rating: remote.rating || 0.00,
    is_pinned: remote.is_pinned || false,
    is_archived: remote.is_archived || false,
    local_only: 0,
    synced: 1,
    sync_action: null,
    version: remote.version || 1,
    base_version: remote.version || 1,
    conflict_status: (remote.conflict_status as Entry['conflict_status']) || null,
    conflict_backup: typeof remote.conflict_backup === 'string' ? remote.conflict_backup : null,
    last_edited_by: remote.last_edited_by || null,
    last_edited_device: remote.last_edited_device || null,
  } as Entry;
}

/**
 * Process a single remote entry during pull sync.
 * Handles: tombstone check, soft-delete mirroring, new entry insertion,
 * version comparison, sync overwrite creation.
 * Returns: 'new' | 'updated' | 'deleted' | 'skipped'
 *
 * Options allow callers to pass pre-fetched local state to avoid
 * redundant SQLite lookups (e.g., manifest sync pre-fetches in bulk).
 */
export async function processRemoteEntry(
  remoteEntry: any,
  options?: {
    /** Pre-fetched local entry, or null if known to not exist locally. Undefined = lookup needed. */
    localEntry?: Entry | null;
    /** Pre-checked tombstone status. Undefined = lookup needed. */
    isTombstoned?: boolean;
  },
): Promise<'new' | 'updated' | 'deleted' | 'skipped'> {
  // Skip entries that have been hard-deleted (tombstoned)
  const isTombstoned = options?.isTombstoned ?? await localDB.hasTombstone(remoteEntry.entry_id);
  if (isTombstoned) return 'skipped';

  const localEntry = options?.localEntry !== undefined ? options.localEntry : await localDB.getEntry(remoteEntry.entry_id);

  // Handle deleted entries — mirror soft-delete locally
  if (remoteEntry.deleted_at) {
    if (localEntry && !localEntry.deleted_at) {
      await localDB.updateEntry(remoteEntry.entry_id, {
        ...localEntry,
        deleted_at: remoteEntry.deleted_at,
        location_id: null,
        synced: 1,
        sync_action: null,
      } as any);
      return 'deleted';
    } else if (!localEntry) {
      // Entry deleted on server that we never had — save as deleted placeholder
      const entry = remoteToEntry(remoteEntry, { clearLocationId: true });
      await localDB.saveEntry(entry);
      return 'deleted';
    }
    // Already deleted locally — skip
    return 'skipped';
  }

  // Live entry
  const entry = remoteToEntry(remoteEntry);

  if (!localEntry) {
    await localDB.saveEntry(entry);
    await localDB.markSynced(entry.entry_id);
    return 'new';
  }

  // Skip if local has unsynced changes (don't overwrite pending edits)
  if (localEntry.synced === 0) {
    log.debug('Skipping entry with unsynced local changes', { entryId: entry.entry_id });
    return 'skipped';
  }

  // Version comparison
  const remoteVersion = remoteEntry.version || 1;
  const localBaseVersion = localEntry.base_version || 1;

  if (remoteVersion > localBaseVersion) {
    const localDeviceId = await getDeviceId();
    await createSyncOverwriteIfNeeded({
      entryId: entry.entry_id,
      userId: entry.user_id,
      localEntry,
      remoteEntry: entry,
      localDeviceId,
      triggeredByDevice: entry.last_edited_device || null,
    });

    await localDB.updateEntry(entry.entry_id, entry);
    await localDB.markSynced(entry.entry_id);
    log.debug('Entry updated from server', {
      entryId: entry.entry_id,
      remoteVersion,
      localBaseVersion,
    });
    return 'updated';
  }

  return 'skipped';
}

export async function pullEntries(
  forceFullPull: boolean,
  pullStartTime: Date,
  getLastTimestamp: () => Promise<Date | null>
): Promise<{ new: number; updated: number; deleted: number }> {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return { new: 0, updated: 0, deleted: 0 };

  // Use manifest-based sync (lazy import to avoid circular deps)
  const { pullEntriesManifest, pullEntriesFull } = await import('./manifestSync');

  // First install: empty local DB → full pull fast path
  const entryCount = await localDB.runCustomQuery(
    'SELECT COUNT(*) as c FROM entries WHERE user_id = ?',
    [user.id]
  );
  if ((entryCount as any[])[0]?.c === 0) {
    return pullEntriesFull(user.id);
  }

  // Normal path: manifest-based reconciliation
  return pullEntriesManifest(user.id, forceFullPull);
}

export async function pullAttachments(forceFullPull: boolean): Promise<{ new: number; updated: number; deleted: number }> {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return { new: 0, updated: 0, deleted: 0 };

  const { data: remoteAttachments, error } = await supabase
    .from('attachments' as any)
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    log.error('Failed to fetch attachments', error);
    return { new: 0, updated: 0, deleted: 0 };
  }

  let newCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;

  // Build set of remote attachment IDs for deletion detection
  const remoteAttachmentIds = new Set<string>(
    (remoteAttachments || []).map((a: any) => a.attachment_id)
  );

  // Batch-fetch all local attachments for this user in one query instead of N+1
  const allRemoteIds = (remoteAttachments || []).map((a: any) => a.attachment_id as string);
  const localAttachmentMap = new Map<string, any>();
  if (allRemoteIds.length > 0) {
    const placeholders = allRemoteIds.map(() => '?').join(',');
    const localRows = await localDB.runUserQuery(
      `SELECT * FROM attachments WHERE attachment_id IN (${placeholders}) AND user_id = ?`,
      allRemoteIds
    );
    for (const row of localRows) {
      localAttachmentMap.set(row.attachment_id, row);
    }
  }

  for (const remoteAttachment of (remoteAttachments || [])) {
    try {
      const ra = remoteAttachment as any;
      const localAttachment = localAttachmentMap.get(ra.attachment_id) ?? null;

      // Handle soft-deleted attachments from server
      if (ra.deleted_at) {
        if (localAttachment && !localAttachment.deleted_at) {
          // Server soft-deleted this attachment — mirror locally
          const deletedAtMs = new Date(ra.deleted_at).getTime();
          await localDB.updateAttachment(ra.attachment_id, {
            deleted_at: deletedAtMs,
            synced: 1,
            sync_action: null,
          });
          deletedCount++;
          log.debug('Attachment soft-deleted from server', { attachmentId: ra.attachment_id });
        }
        continue;
      }

      const attachment = {
        attachment_id: ra.attachment_id,
        entry_id: ra.entry_id,
        user_id: ra.user_id,
        file_path: ra.file_path,
        // local_path deliberately omitted — derived from deterministic path, not stored
        mime_type: ra.mime_type,
        file_size: ra.file_size || undefined,
        width: ra.width || undefined,
        height: ra.height || undefined,
        position: ra.position,
        created_at: new Date(ra.created_at).getTime(),
        updated_at: new Date(ra.updated_at).getTime(),
        uploaded: true,
        synced: 1,
        sync_action: null,
      };

      if (!localAttachment) {
        await localDB.createAttachment(attachment, true);
        newCount++;
      } else {
        const hasChanged =
          localAttachment.position !== attachment.position ||
          localAttachment.mime_type !== attachment.mime_type;

        if (hasChanged) {
          await localDB.updateAttachment(attachment.attachment_id, attachment);
          updatedCount++;
        }
      }
    } catch (error) {
      log.warn('Failed to process attachment', { attachmentId: (remoteAttachment as any).attachment_id, error });
    }
  }

  // Detect attachments that exist locally (synced) but are completely gone from server
  // These were hard-deleted on server (e.g. by cleanup job) — permanently remove locally
  try {
    const localSyncedAttachments = await localDB.runCustomQuery(
      'SELECT attachment_id, entry_id, user_id FROM attachments WHERE user_id = ? AND synced = 1 AND deleted_at IS NULL AND (sync_action IS NULL OR sync_action != ?)',
      [user.id, 'delete']
    );

    const helpers = await loadAttachmentHelpers();
    for (const localAttachment of localSyncedAttachments) {
      if (!remoteAttachmentIds.has(localAttachment.attachment_id)) {
        log.info('Attachment missing from server, removing locally', { attachmentId: localAttachment.attachment_id });
        // Delete local file at deterministic path
        try {
          const localPath = helpers.getAttachmentLocalPath(localAttachment.user_id, localAttachment.entry_id, localAttachment.attachment_id);
          await helpers.deleteAttachmentFromLocalStorage(localPath);
        } catch {
          // File may not exist — that's fine
        }
        // Permanently delete from local DB
        await localDB.permanentlyDeleteAttachment(localAttachment.attachment_id);
        deletedCount++;
      }
    }
  } catch (error) {
    log.warn('Failed to detect deleted attachments', { error });
  }

  return { new: newCount, updated: updatedCount, deleted: deletedCount };
}

export async function pullEntryVersions(forceFullPull: boolean): Promise<{ new: number; updated: number }> {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return { new: 0, updated: 0 };

  // Incremental pull: only fetch versions newer than our last pull.
  // Versions are immutable — once created they never change, so we only need new ones.
  let lastPullMs: number | null = null;
  if (!forceFullPull) {
    try {
      const tsResult = await localDB.runCustomQuery(
        "SELECT value FROM sync_metadata WHERE key = ?",
        ['last_version_pull_timestamp']
      );
      if (tsResult.length > 0 && tsResult[0].value) {
        lastPullMs = parseInt(tsResult[0].value);
      }
    } catch {
      // Fall through to full pull
    }
  }

  let query = supabase
    .from('entry_versions' as any)
    .select('*')
    .eq('user_id', user.id);

  if (lastPullMs) {
    query = query.gt('created_at', new Date(lastPullMs).toISOString());
  }

  query = query.order('created_at', { ascending: false }).limit(5000);

  const { data: remoteVersions, error } = await query;

  if (error) {
    log.error('[VersionSync] Pull: Supabase fetch FAILED', error);
    return { new: 0, updated: 0 };
  }

  log.info('[VersionSync] Pull: fetched from Supabase', {
    count: remoteVersions?.length ?? 0,
    incremental: !!lastPullMs,
  });

  if (!remoteVersions || remoteVersions.length === 0) {
    return { new: 0, updated: 0 };
  }

  let newCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const remoteVersion of remoteVersions) {
    try {
      const rv = remoteVersion as any;

      // Stringify snapshot for SQLite TEXT column
      const snapshotText = typeof rv.snapshot === 'string'
        ? rv.snapshot
        : JSON.stringify(rv.snapshot);

      // Stringify attachment_ids for SQLite TEXT column
      const attachmentIdsText = rv.attachment_ids
        ? (typeof rv.attachment_ids === 'string' ? rv.attachment_ids : JSON.stringify(rv.attachment_ids))
        : null;

      // Convert ISO timestamps to Unix ms
      const createdAtMs = rv.created_at ? new Date(rv.created_at).getTime() : Date.now();
      const deviceCreatedAtMs = rv.device_created_at ? new Date(rv.device_created_at).getTime() : null;

      // Versions are immutable — INSERT OR IGNORE skips duplicates without wasting writes
      const result = await localDB.runCustomQuery(
        `INSERT OR IGNORE INTO entry_versions (
          version_id, entry_id, user_id, version_number, trigger, snapshot,
          attachment_ids, change_summary, device_id, triggered_by_device,
          device_created_at, base_entry_version, created_at, synced, sync_action
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)`,
        [
          rv.version_id,
          rv.entry_id,
          rv.user_id,
          rv.version_number,
          rv.trigger,
          snapshotText,
          attachmentIdsText,
          rv.change_summary || null,
          rv.device_id || null,
          rv.triggered_by_device || null,
          deviceCreatedAtMs,
          rv.base_entry_version || null,
          createdAtMs,
        ]
      );
      // INSERT OR IGNORE: duplicates silently skipped. Count reflects processed, not necessarily new.
      newCount++;
    } catch (error) {
      errorCount++;
      log.error('[VersionSync] Pull: FAILED to insert version', error, {
        versionId: (remoteVersion as any).version_id,
        entryId: (remoteVersion as any).entry_id,
      });
    }
  }

  // Save the pull timestamp for incremental pulls
  try {
    await localDB.runCustomQuery(
      'INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)',
      ['last_version_pull_timestamp', Date.now().toString(), Date.now()]
    );
  } catch {
    log.warn('[VersionSync] Failed to save version pull timestamp');
  }

  log.info('[VersionSync] Pull: complete', { new: newCount, errors: errorCount });

  return { new: newCount, updated: 0 };
}

// ============================================================================
// TOMBSTONES
// ============================================================================

export async function pullTombstones(): Promise<{ deleted: number }> {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return { deleted: 0 };

  // Get last tombstone pull timestamp
  let lastPullTimestamp: string | null = null;
  try {
    const rows = await localDB.runCustomQuery(
      'SELECT value FROM sync_metadata WHERE key = ?',
      ['last_tombstone_pull_timestamp']
    );
    if (rows.length > 0) {
      lastPullTimestamp = new Date(parseInt(rows[0].value)).toISOString();
    }
  } catch {
    // First pull
  }

  let query = (supabase.from as any)('entry_tombstones')
    .select('entry_id, user_id, hard_deleted_at')
    .eq('user_id', user.id);

  if (lastPullTimestamp) {
    query = query.gt('hard_deleted_at', lastPullTimestamp);
  }

  const { data: tombstones, error } = await query as { data: any[] | null; error: any };

  if (error) {
    log.error('Failed to pull tombstones', error);
    return { deleted: 0 };
  }

  if (!tombstones || tombstones.length === 0) {
    return { deleted: 0 };
  }

  let deletedCount = 0;

  for (const tombstone of tombstones) {
    try {
      // Check if we have this entry locally — if so, hard-delete it
      const localEntry = await localDB.getEntry(tombstone.entry_id);
      if (localEntry) {
        // Hard-delete locally without creating another tombstone
        await localDB.runUserQuery('DELETE FROM attachments WHERE entry_id = ? AND user_id = ?', [tombstone.entry_id]);
        await localDB.runUserQuery('DELETE FROM entry_versions WHERE entry_id = ? AND user_id = ?', [tombstone.entry_id]);
        await localDB.runUserQuery('DELETE FROM entries WHERE entry_id = ? AND user_id = ?', [tombstone.entry_id]);
        deletedCount++;
      }

      // Save the tombstone locally (already synced)
      const hardDeletedAtMs = new Date(tombstone.hard_deleted_at).getTime();
      await localDB.saveTombstone(tombstone.entry_id, tombstone.user_id, hardDeletedAtMs);
    } catch (err) {
      log.warn('Failed to process tombstone', { entryId: tombstone.entry_id, error: err });
    }
  }

  // Save pull timestamp
  try {
    await localDB.runCustomQuery(
      'INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)',
      ['last_tombstone_pull_timestamp', Date.now().toString(), Date.now()]
    );
  } catch {
    log.warn('Failed to save tombstone pull timestamp');
  }

  if (deletedCount > 0) {
    log.info('Pulled tombstones', { deleted: deletedCount, total: tombstones.length });
  }

  return { deleted: deletedCount };
}
