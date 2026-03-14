/**
 * Push Sync Operations
 *
 * Handles pushing local changes to Supabase server.
 * Order: Streams → Locations → Entries → Attachments → Deletes
 */

import { localDB } from '../db/localDB';
import { supabase, Entry, LocationEntity, isCompletedStatus, ALL_STATUSES, EntryStatus } from '@trace/core';
import { createScopedLogger } from '../utils/logger';
import { getDeviceName } from '../utils/deviceUtils';
import { getDeviceId } from '../../config/appVersionService';
import { createVersion, buildSnapshot } from '../../modules/versions';

// Lazy import to break circular dependency
let _uploadAttachmentToSupabase: ((localPath: string, remotePath: string) => Promise<{ url: string; size: number }>) | null = null;
async function uploadAttachmentToSupabase(localPath: string, remotePath: string): Promise<{ url: string; size: number }> {
  if (!_uploadAttachmentToSupabase) {
    const module = await import('../../modules/attachments/mobileAttachmentApi');
    _uploadAttachmentToSupabase = module.uploadAttachmentToSupabase;
  }
  return _uploadAttachmentToSupabase(localPath, remotePath);
}

const deviceName = getDeviceName();
const log = createScopedLogger(`Push:${deviceName}`, '⬆️');

// ============================================================================
// PUSH OPERATIONS
// ============================================================================

export async function pushStreams(): Promise<{ success: number; errors: number }> {
  const unsyncedStreams = await localDB.getUnsyncedStreams();
  if (unsyncedStreams.length === 0) {
    return { success: 0, errors: 0 };
  }

  let success = 0;
  let errors = 0;

  for (const stream of unsyncedStreams) {
    // Skip local-only streams - mark as synced so they don't reappear in queue
    if (stream.is_localonly) {
      log.debug('Skipping local-only stream', { streamId: stream.stream_id, name: stream.name });
      await localDB.markStreamSynced(stream.stream_id);
      continue;
    }

    try {
      await syncStream(stream);
      success++;
    } catch (error) {
      log.warn('Failed to push stream', { streamId: stream.stream_id, error });
      await localDB.recordStreamSyncError(stream.stream_id, error instanceof Error ? error.message : String(error));
      errors++;
    }
  }

  return { success, errors };
}

export async function pushLocations(): Promise<{ success: number; errors: number }> {
  const unsyncedLocations = await localDB.getUnsyncedLocations();
  if (unsyncedLocations.length === 0) {
    return { success: 0, errors: 0 };
  }

  let success = 0;
  let errors = 0;

  for (const location of unsyncedLocations) {
    try {
      await syncLocation(location);
      success++;
    } catch (error) {
      log.warn('Failed to push location', { locationId: location.location_id, error });
      await localDB.recordLocationSyncError(location.location_id, error instanceof Error ? error.message : String(error));
      errors++;
    }
  }

  return { success, errors };
}

export async function pushEntries(
  localOnlyStreamIds: Set<string>,
  markPushing: (entryId: string) => void,
  unmarkPushing: (entryId: string) => void
): Promise<{ success: number; errors: number }> {
  const unsyncedEntries = await localDB.getUnsyncedEntries();
  const entriesToPush = unsyncedEntries.filter(e => e.sync_action !== 'delete');

  if (entriesToPush.length === 0) {
    return { success: 0, errors: 0 };
  }

  let success = 0;
  let errors = 0;

  for (const entry of entriesToPush) {
    // Skip entries from local-only streams - mark as synced so they don't reappear in queue
    if (entry.stream_id && localOnlyStreamIds.has(entry.stream_id)) {
      log.debug('Skipping local-only entry', { entryId: entry.entry_id, streamId: entry.stream_id });
      await localDB.markSynced(entry.entry_id);
      continue;
    }

    try {
      await syncEntry(entry, markPushing, unmarkPushing);
      success++;
    } catch (error) {
      log.warn('Failed to push entry', { entryId: entry.entry_id, error });
      await localDB.recordSyncError(entry.entry_id, error instanceof Error ? error.message : String(error));
      errors++;
    }
  }

  return { success, errors };
}

export async function pushEntryDeletes(
  localOnlyStreamIds: Set<string>,
  markPushing: (entryId: string) => void,
  unmarkPushing: (entryId: string) => void
): Promise<{ success: number; errors: number }> {
  const unsyncedEntries = await localDB.getUnsyncedEntries();
  const entriesToDelete = unsyncedEntries.filter(e => e.sync_action === 'delete');

  if (entriesToDelete.length === 0) {
    return { success: 0, errors: 0 };
  }

  let success = 0;
  let errors = 0;

  for (const entry of entriesToDelete) {
    // Skip deletes for entries from local-only streams - they were never synced
    if (entry.stream_id && localOnlyStreamIds.has(entry.stream_id)) {
      log.debug('Skipping local-only entry delete', { entryId: entry.entry_id, streamId: entry.stream_id });
      await localDB.markSynced(entry.entry_id);
      continue;
    }

    try {
      await syncEntry(entry, markPushing, unmarkPushing);
      success++;
    } catch (error) {
      log.warn('Failed to push entry delete', { entryId: entry.entry_id, error });
      await localDB.recordSyncError(entry.entry_id, error instanceof Error ? error.message : String(error));
      errors++;
    }
  }

  return { success, errors };
}

export async function pushAttachments(localOnlyStreamIds: Set<string>): Promise<{ success: number; errors: number }> {
  let success = 0;
  let errors = 0;

  // Upload attachment files
  const attachmentsToUpload = await localDB.getAttachmentsNeedingUpload();
  if (attachmentsToUpload.length > 0) {
    log.debug('Uploading attachment files', { count: attachmentsToUpload.length });

    for (const attachment of attachmentsToUpload) {
      // Check if attachment's entry belongs to local-only stream
      const entry = await localDB.getEntry(attachment.entry_id);
      if (entry && entry.stream_id && localOnlyStreamIds.has(entry.stream_id)) {
        log.debug('Skipping local-only attachment upload', { attachmentId: attachment.attachment_id, streamId: entry.stream_id });
        // Mark as uploaded so it doesn't keep trying
        await localDB.updateAttachment(attachment.attachment_id, { uploaded: true, synced: 1, sync_action: null });
        continue;
      }

      try {
        if (attachment.local_path) {
          await uploadAttachmentToSupabase(attachment.local_path, attachment.file_path);
          await localDB.updateAttachment(attachment.attachment_id, { uploaded: true });
          success++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Local file does not exist') || errorMessage.includes('File not found')) {
          log.debug('Attachment file missing locally (orphaned)', { attachmentId: attachment.attachment_id });
          await localDB.updateAttachment(attachment.attachment_id, { uploaded: true });
        } else {
          log.warn('Failed to upload attachment', { attachmentId: attachment.attachment_id, error });
        }
        errors++;
      }
    }
  }

  // Sync attachment metadata
  const attachmentsNeedingSync = await localDB.getAttachmentsNeedingSync();
  const attachmentsToCreateOrUpdate = attachmentsNeedingSync.filter(a => a.sync_action !== 'delete');

  if (attachmentsToCreateOrUpdate.length > 0) {
    log.debug('Syncing attachment metadata', { count: attachmentsToCreateOrUpdate.length });

    for (const attachment of attachmentsToCreateOrUpdate) {
      try {
        if (!attachment.file_size || !attachment.mime_type) {
          log.debug('Skipping incomplete attachment', { attachmentId: attachment.attachment_id });
          await localDB.updateAttachment(attachment.attachment_id, { synced: 1, sync_action: null });
          continue;
        }

        const entry = await localDB.getEntry(attachment.entry_id);
        if (!entry || entry.deleted_at) {
          log.debug('Skipping orphaned attachment', { attachmentId: attachment.attachment_id });
          await localDB.deleteAttachment(attachment.attachment_id);
          continue;
        }

        // Skip attachments from local-only streams - mark as synced so they don't keep trying
        if (entry.stream_id && localOnlyStreamIds.has(entry.stream_id)) {
          log.debug('Skipping local-only attachment metadata sync', { attachmentId: attachment.attachment_id, streamId: entry.stream_id });
          await localDB.updateAttachment(attachment.attachment_id, { synced: 1, sync_action: null });
          continue;
        }

        const { error } = await supabase
          .from('attachments' as any)
          .upsert({
            attachment_id: attachment.attachment_id,
            entry_id: attachment.entry_id,
            user_id: attachment.user_id,
            file_path: attachment.file_path,
            mime_type: attachment.mime_type,
            file_size: attachment.file_size,
            width: attachment.width || null,
            height: attachment.height || null,
            position: attachment.position,
          });

        if (error) throw error;

        await localDB.updateAttachment(attachment.attachment_id, { synced: 1, sync_action: null });
        success++;
      } catch (error) {
        log.warn('Failed to sync attachment metadata', { attachmentId: attachment.attachment_id, error });
        errors++;
      }
    }
  }

  // Soft-delete attachments on server (set deleted_at, keep file in storage for version history)
  const attachmentsToDelete = attachmentsNeedingSync.filter(a => a.sync_action === 'delete');
  if (attachmentsToDelete.length > 0) {
    log.debug('Soft-deleting attachments on server', { count: attachmentsToDelete.length });

    for (const attachment of attachmentsToDelete) {
      try {
        // Convert local deleted_at (Unix ms) to ISO string for Supabase
        const deletedAtISO = attachment.deleted_at
          ? new Date(attachment.deleted_at).toISOString()
          : new Date().toISOString();

        const { error: dbError } = await supabase
          .from('attachments' as any)
          .update({ deleted_at: deletedAtISO })
          .eq('attachment_id', attachment.attachment_id);

        if (dbError) {
          log.error('Failed to soft-delete attachment on server', { attachmentId: attachment.attachment_id, error: dbError });
        }

        // Mark as synced locally — row stays for version history
        await localDB.updateAttachment(attachment.attachment_id, { synced: 1, sync_action: null });
        success++;
      } catch (error) {
        log.error('Failed to soft-delete attachment', { attachmentId: attachment.attachment_id, error });
        errors++;
      }
    }
  }

  return { success, errors };
}

export async function pushEntryVersions(): Promise<{ success: number; errors: number }> {
  let success = 0;
  let errors = 0;

  // Get unsynced versions whose parent entry is already synced on server
  const unsyncedVersions = await localDB.runCustomQuery(
    `SELECT ev.* FROM entry_versions ev
     INNER JOIN entries e ON ev.entry_id = e.entry_id
     WHERE ev.synced = 0 AND e.synced = 1
     AND e.deleted_at IS NULL AND (e.sync_action IS NULL OR e.sync_action != 'delete')`,
    []
  );

  log.info('[VersionSync] Push: found unsynced versions', { count: unsyncedVersions.length });

  if (unsyncedVersions.length === 0) {
    return { success: 0, errors: 0 };
  }

  for (const version of unsyncedVersions) {
    try {
      // Parse snapshot from JSON text to object for Supabase JSONB
      let snapshotObj = version.snapshot;
      if (typeof snapshotObj === 'string') {
        try {
          snapshotObj = JSON.parse(snapshotObj);
        } catch {
          log.warn('Failed to parse version snapshot JSON', { versionId: version.version_id });
          continue;
        }
      }

      // Parse attachment_ids from JSON text to array
      let attachmentIdsArr = version.attachment_ids;
      if (typeof attachmentIdsArr === 'string') {
        try {
          attachmentIdsArr = JSON.parse(attachmentIdsArr);
        } catch {
          attachmentIdsArr = null;
        }
      }

      const supabaseData = {
        version_id: version.version_id,
        entry_id: version.entry_id,
        user_id: version.user_id,
        version_number: version.version_number,
        trigger: version.trigger,
        snapshot: snapshotObj,
        attachment_ids: attachmentIdsArr,
        change_summary: version.change_summary || null,
        device_id: version.device_id || null,
        triggered_by_device: version.triggered_by_device || null,
        device_created_at: version.device_created_at
          ? new Date(version.device_created_at).toISOString()
          : null,
        base_entry_version: version.base_entry_version || null,
        created_at: typeof version.created_at === 'number'
          ? new Date(version.created_at).toISOString()
          : version.created_at,
      };

      const { error } = await supabase
        .from('entry_versions' as any)
        .upsert(supabaseData, { onConflict: 'version_id' });

      if (error) {
        throw new Error(`Supabase upsert failed: ${error.message}`);
      }

      // Mark as synced in local SQLite
      await localDB.runCustomQuery(
        'UPDATE entry_versions SET synced = 1, sync_action = NULL WHERE version_id = ?',
        [version.version_id]
      );
      success++;
      log.info('[VersionSync] Push: upserted version', {
        versionId: version.version_id.substring(0, 8),
        entryId: version.entry_id.substring(0, 8),
        trigger: version.trigger,
        baseVersion: version.base_entry_version,
      });
    } catch (error) {
      log.error('[VersionSync] Push FAILED for version', error, {
        versionId: version.version_id,
        entryId: version.entry_id,
      });
      errors++;
    }
  }

  log.info('[VersionSync] Push: complete', { success, errors });

  return { success, errors };
}

// ============================================================================
// INDIVIDUAL SYNC OPERATIONS
// ============================================================================

async function syncEntry(
  entry: Entry,
  markPushing: (entryId: string) => void,
  unmarkPushing: (entryId: string) => void
): Promise<void> {
  const { sync_action } = entry;

  // Track this entry as currently pushing to prevent realtime race condition
  markPushing(entry.entry_id);

  try {
    // Validate and sanitize status - ensure it's a valid value for the database constraint
    const validStatuses = ALL_STATUSES.map(s => s.value);
    let sanitizedStatus: EntryStatus = entry.status;

    if (!validStatuses.includes(entry.status)) {
      // Map legacy status values to new ones
      if (entry.status === 'incomplete' as unknown as EntryStatus) {
        sanitizedStatus = 'todo';
      } else if (entry.status === 'complete' as unknown as EntryStatus) {
        sanitizedStatus = 'done';
      } else {
        log.warn('Invalid status, defaulting to none', { entryId: entry.entry_id, status: entry.status });
        sanitizedStatus = 'none';
      }
    }

    // Enforce completed_at constraint
    let completedAtValue: string | null = null;
    if (isCompletedStatus(sanitizedStatus)) {
      if (entry.completed_at) {
        completedAtValue = typeof entry.completed_at === 'number'
          ? new Date(entry.completed_at).toISOString()
          : entry.completed_at;
      } else {
        completedAtValue = new Date().toISOString();
      }
    }

    const supabaseData = {
      entry_id: entry.entry_id,
      user_id: entry.user_id,
      title: entry.title,
      content: entry.content,
      tags: entry.tags,
      mentions: entry.mentions,
      stream_id: entry.stream_id,
      entry_date: entry.entry_date && (typeof entry.entry_date === 'number'
        ? new Date(entry.entry_date).toISOString()
        : entry.entry_date),
      entry_latitude: entry.entry_latitude,
      entry_longitude: entry.entry_longitude,
      location_id: entry.location_id,
      // Location hierarchy (owned by entry)
      place_name: entry.place_name || null,
      address: entry.address || null,
      neighborhood: entry.neighborhood || null,
      postal_code: entry.postal_code || null,
      city: entry.city || null,
      subdivision: entry.subdivision || null,
      region: entry.region || null,
      country: entry.country || null,
      geocode_status: entry.geocode_status || null,
      status: sanitizedStatus,
      type: entry.type || null,
      due_date: entry.due_date && (typeof entry.due_date === 'number'
        ? new Date(entry.due_date).toISOString()
        : entry.due_date),
      completed_at: completedAtValue,
      priority: entry.priority ?? 0,
      rating: entry.rating ?? 0,
      is_pinned: entry.is_pinned ?? false,
      created_at: typeof entry.created_at === 'number'
        ? new Date(entry.created_at).toISOString()
        : entry.created_at,
      updated_at: typeof entry.updated_at === 'number'
        ? new Date(entry.updated_at).toISOString()
        : entry.updated_at,
      deleted_at: entry.deleted_at && (typeof entry.deleted_at === 'number'
        ? new Date(entry.deleted_at).toISOString()
        : entry.deleted_at),
      conflict_status: entry.conflict_status || null,
      conflict_backup: entry.conflict_backup || null,
      last_edited_by: entry.last_edited_by || null,
      last_edited_device: entry.last_edited_device || null,
    };

    if (sync_action === 'create' || sync_action === 'update') {
      log.debug('Syncing entry', {
        entryId: entry.entry_id,
        sync_action,
        status: supabaseData.status,
      });

      if (sync_action === 'create') {
        const { data: upsertedEntry, error } = await supabase
          .from('entries')
          .upsert(supabaseData, { onConflict: 'entry_id' })
          .select('version')
          .single();

        if (error) {
          throw new Error(`Supabase create failed: ${error.message}`);
        }

        const serverVersion = upsertedEntry?.version || 1;
        await localDB.updateEntry(entry.entry_id, {
          version: serverVersion,
          base_version: serverVersion,
          synced: 1,
          sync_action: null,
          sync_error: null,
        });
      } else {
        // For updates, use OPTIMISTIC LOCKING with conditional update
        const localBaseVersion = entry.base_version || 1;

        const { data: updatedEntry, error: updateError } = await supabase
          .from('entries')
          .update(supabaseData)
          .eq('entry_id', entry.entry_id)
          .eq('version', localBaseVersion)
          .select('version, title, content, status, tags, mentions, last_edited_by, last_edited_device')
          .maybeSingle();

        if (updateError) {
          throw new Error(`Supabase update failed: ${updateError.message}`);
        }

        if (!updatedEntry) {
          // OPTIMISTIC LOCK FAILED: Server version changed
          log.warn('Optimistic lock failed - version mismatch', {
            entryId: entry.entry_id,
            localBaseVersion,
          });

          const { data: serverEntry, error: fetchError } = await supabase
            .from('entries')
            .select('version, title, content, status, type, priority, rating, tags, mentions, stream_id, due_date, completed_at, is_pinned, entry_date, is_archived, entry_latitude, entry_longitude, location_id, geocode_status, place_name, address, neighborhood, postal_code, city, subdivision, region, country, last_edited_by, last_edited_device')
            .eq('entry_id', entry.entry_id)
            .single();

          if (fetchError || !serverEntry) {
            throw new Error('Conflict detected but failed to fetch server state');
          }

          const serverVersion = (serverEntry as any).version || 1;
          const serverData = serverEntry as any;

          // Preserve local state as a conflict version before overwriting
          try {
            const localSnapshot = buildSnapshot(entry);
            const deviceId = await getDeviceId();
            const now = new Date().toISOString();
            // Get current attachment IDs for this entry (active only)
            const entryAttachments = await localDB.getAttachmentsForEntry(entry.entry_id);
            const attachmentIds = entryAttachments.map(a => a.attachment_id);
            await createVersion({
              entry_id: entry.entry_id,
              user_id: entry.user_id,
              trigger: 'conflict',
              snapshot: localSnapshot,
              attachment_ids: attachmentIds.length > 0 ? attachmentIds : null,
              change_summary: 'local backup before conflict resolution',
              device_id: deviceId,
              triggered_by_device: serverData.last_edited_device || null,
              device_created_at: now,
              base_entry_version: String(entry.base_version || 1),
              created_at: now,
            });
            log.info('Saved local state as conflict version', { entryId: entry.entry_id });
          } catch (versionError) {
            log.warn('Failed to save conflict version (non-fatal)', { entryId: entry.entry_id, error: versionError });
          }

          // Server wins - take server version (all substantive fields)
          await localDB.updateEntry(entry.entry_id, {
            title: serverData.title,
            content: serverData.content,
            status: serverData.status,
            type: serverData.type,
            priority: serverData.priority,
            rating: serverData.rating,
            tags: serverData.tags,
            mentions: serverData.mentions,
            stream_id: serverData.stream_id,
            due_date: serverData.due_date,
            completed_at: serverData.completed_at,
            is_pinned: serverData.is_pinned,
            entry_date: serverData.entry_date,
            is_archived: serverData.is_archived,
            entry_latitude: serverData.entry_latitude,
            entry_longitude: serverData.entry_longitude,
            location_id: serverData.location_id,
            geocode_status: serverData.geocode_status,
            place_name: serverData.place_name,
            address: serverData.address,
            neighborhood: serverData.neighborhood,
            postal_code: serverData.postal_code,
            city: serverData.city,
            subdivision: serverData.subdivision,
            region: serverData.region,
            country: serverData.country,
            version: serverVersion,
            base_version: serverVersion,
            last_edited_by: serverData.last_edited_by,
            last_edited_device: serverData.last_edited_device,
            conflict_status: null, // No UI reads this yet — set when conflict resolution UI is built
            synced: 1,
            sync_action: null,
            sync_error: null,
          });

          log.warn('Version conflict resolved - server version accepted', {
            entryId: entry.entry_id,
            serverVersion,
          });

          return;
        }

        const serverVersion = updatedEntry.version || 1;
        await localDB.updateEntry(entry.entry_id, {
          version: serverVersion,
          base_version: serverVersion,
          synced: 1,
          sync_action: null,
          sync_error: null,
        });
      }

    } else if (sync_action === 'delete') {
      const { data: existingEntry } = await supabase
        .from('entries')
        .select('entry_id')
        .eq('entry_id', entry.entry_id)
        .maybeSingle();

      if (existingEntry) {
        const { error } = await supabase
          .from('entries')
          .update({
            deleted_at: entry.deleted_at || new Date().toISOString(),
            location_id: null,
          })
          .eq('entry_id', entry.entry_id);

        if (error && error.code !== '42501') {
          throw new Error(`Supabase delete failed: ${error.message}`);
        }
      }

      await localDB.markSynced(entry.entry_id);
    }
  } finally {
    // Always remove from tracking set, even on error
    unmarkPushing(entry.entry_id);
  }
}

async function syncStream(stream: any): Promise<void> {
  const { sync_action } = stream;

  // Helper: Convert SQLite integer (0/1) to boolean
  const toBool = (val: any): boolean => val === 1 || val === true;

  // Helper: Parse JSON string to array (for Postgres TEXT[])
  const toArray = (val: any): string[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.startsWith('[')) {
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    }
    return [];
  };

  const supabaseData = {
    stream_id: stream.stream_id,
    user_id: stream.user_id,
    name: stream.name,
    entry_count: stream.entry_count || 0,
    color: stream.color,
    icon: stream.icon,
    created_at: typeof stream.created_at === 'number'
      ? new Date(stream.created_at).toISOString()
      : stream.created_at,
    updated_at: typeof (stream.updated_at || stream.created_at) === 'number'
      ? new Date(stream.updated_at || stream.created_at).toISOString()
      : (stream.updated_at || stream.created_at),
    entry_title_template: stream.entry_title_template || null,
    entry_content_template: stream.entry_content_template || null,
    entry_use_rating: toBool(stream.entry_use_rating),
    entry_rating_type: stream.entry_rating_type || 'stars',
    entry_use_priority: toBool(stream.entry_use_priority),
    entry_use_status: toBool(stream.entry_use_status),
    entry_use_duedates: toBool(stream.entry_use_duedates),
    entry_use_location: toBool(stream.entry_use_location),
    entry_use_photos: toBool(stream.entry_use_photos),
    entry_content_type: stream.entry_content_type || 'richformat',
    entry_statuses: toArray(stream.entry_statuses),
    entry_default_status: stream.entry_default_status || 'new',
    entry_use_type: toBool(stream.entry_use_type),
    entry_types: toArray(stream.entry_types),
    is_private: toBool(stream.is_private),
  };

  if (sync_action === 'create' || sync_action === 'update') {
    const { error } = await supabase
      .from('streams')
      .upsert(supabaseData, { onConflict: 'stream_id' });

    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`);
    }
  } else if (sync_action === 'delete') {
    // Nullify stream_id on server entries first to avoid FK constraint violation
    const { error: detachError } = await supabase
      .from('entries')
      .update({ stream_id: null })
      .eq('stream_id', stream.stream_id);

    if (detachError) {
      throw new Error(`Failed to detach entries before stream delete: ${detachError.message}`);
    }

    const { error } = await supabase
      .from('streams')
      .delete()
      .eq('stream_id', stream.stream_id);

    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }
  }

  await localDB.markStreamSynced(stream.stream_id);
}

async function syncLocation(location: LocationEntity): Promise<void> {
  const { sync_action } = location;

  const supabaseData = {
    location_id: location.location_id,
    user_id: location.user_id,
    name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    source: location.source,
    address: location.address,
    neighborhood: location.neighborhood,
    postal_code: location.postal_code,
    city: location.city,
    subdivision: location.subdivision,
    region: location.region,
    country: location.country,
    mapbox_place_id: location.mapbox_place_id,
    foursquare_fsq_id: location.foursquare_fsq_id,
    merge_ignore_ids: location.merge_ignore_ids || null,
    created_at: location.created_at,
    updated_at: location.updated_at,
    deleted_at: location.deleted_at,
  };

  if (sync_action === 'create' || sync_action === 'update') {
    const { error } = await supabase
      .from('locations')
      .upsert(supabaseData, { onConflict: 'location_id' });

    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`);
    }
  } else if (sync_action === 'delete') {
    const { error } = await supabase
      .from('locations')
      .update({ deleted_at: location.deleted_at || new Date().toISOString() })
      .eq('location_id', location.location_id);

    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }
  }

  await localDB.markLocationSynced(location.location_id);
}
