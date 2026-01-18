/**
 * Pull Sync Operations
 *
 * Handles pulling remote changes from Supabase server to local SQLite.
 * Order: Streams → Locations → Entries → Attachments
 */

import { localDB } from '../db/localDB';
import { supabase } from '@trace/core/src/shared/supabase';
import { Entry, LocationEntity } from '@trace/core';
import { deleteAttachmentFromLocalStorage } from '../../modules/attachments/mobileAttachmentApi';
import { createScopedLogger } from '../utils/logger';
import { getDeviceName } from '../../modules/entries/mobileEntryApi';

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
  const { data: { user } } = await supabase.auth.getUser();
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

  // Build set of server stream IDs for missing stream detection
  const serverStreamIds = new Set<string>(
    (remoteStreams || []).map(s => s.stream_id)
  );

  // Process streams from server
  for (const remoteStream of (remoteStreams || [])) {
    try {
      const localStream = await localDB.getStream(remoteStream.stream_id);

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

  return { new: newCount, updated: updatedCount, deleted: 0 };
}

export async function pullLocations(forceFullPull: boolean): Promise<{ new: number; updated: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { new: 0, updated: 0 };

  const { data: remoteLocations, error } = await supabase
    .from('locations')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    log.error('Failed to fetch locations', error);
    return { new: 0, updated: 0 };
  }

  if (!remoteLocations || remoteLocations.length === 0) {
    return { new: 0, updated: 0 };
  }

  let newCount = 0;
  let updatedCount = 0;

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
        // Geo fields (immutable, from geocode)
        geo_address: (remoteLocation as any).geo_address || null,
        geo_neighborhood: (remoteLocation as any).geo_neighborhood || null,
        geo_city: (remoteLocation as any).geo_city || null,
        geo_subdivision: (remoteLocation as any).geo_subdivision || null,
        geo_region: (remoteLocation as any).geo_region || null,
        geo_country: (remoteLocation as any).geo_country || null,
        geo_postal_code: (remoteLocation as any).geo_postal_code || null,
        location_radius: (remoteLocation as { location_radius?: number | null }).location_radius ?? null,
        mapbox_place_id: remoteLocation.mapbox_place_id,
        foursquare_fsq_id: remoteLocation.foursquare_fsq_id,
        created_at: remoteLocation.created_at || new Date().toISOString(),
        updated_at: remoteLocation.updated_at || new Date().toISOString(),
        deleted_at: remoteLocation.deleted_at,
        synced: 1,
        sync_action: null,
      };

      if (!localLocation) {
        await localDB.saveLocation(location);
        await localDB.markLocationSynced(location.location_id);
        newCount++;
      } else if (localLocation.synced !== 0) {
        const hasChanged =
          localLocation.name !== location.name ||
          localLocation.latitude !== location.latitude ||
          localLocation.longitude !== location.longitude ||
          localLocation.address !== location.address ||
          localLocation.city !== location.city;

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

  return { new: newCount, updated: updatedCount };
}

export async function pullEntries(
  forceFullPull: boolean,
  pullStartTime: Date,
  getLastTimestamp: () => Promise<Date | null>
): Promise<{ new: number; updated: number; deleted: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { new: 0, updated: 0, deleted: 0 };

  // Check if database is empty - force full pull
  const entryCount = await localDB.getAllEntries();
  if (entryCount.length === 0 && !forceFullPull) {
    forceFullPull = true;
  }

  const lastPullTimestamp = forceFullPull ? null : await getLastTimestamp();

  let query = supabase
    .from('entries')
    .select('*')
    .eq('user_id', user.id);

  if (lastPullTimestamp) {
    query = query.gt('updated_at', lastPullTimestamp.toISOString());
  }

  query = query.order('updated_at', { ascending: false });

  const { data: remoteEntries, error } = await query;

  if (error) {
    log.error('Failed to fetch entries', error);
    return { new: 0, updated: 0, deleted: 0 };
  }

  if (!remoteEntries || remoteEntries.length === 0) {
    return { new: 0, updated: 0, deleted: 0 };
  }

  let newCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;

  for (const remoteEntry of remoteEntries) {
    try {
      const localEntry = await localDB.getEntry(remoteEntry.entry_id);

      // Handle deleted entries
      if (remoteEntry.deleted_at) {
        if (localEntry) {
          await localDB.deleteEntry(remoteEntry.entry_id);
          deletedCount++;
        }
        continue;
      }

      const entry: Entry = {
        entry_id: remoteEntry.entry_id,
        user_id: remoteEntry.user_id,
        title: remoteEntry.title,
        content: remoteEntry.content,
        tags: remoteEntry.tags || [],
        mentions: remoteEntry.mentions || [],
        stream_id: remoteEntry.stream_id,
        entry_latitude: remoteEntry.entry_latitude || null,
        entry_longitude: remoteEntry.entry_longitude || null,
        location_radius: (remoteEntry as any).location_radius || null,
        location_id: remoteEntry.location_id || null,
        // Location hierarchy (owned by entry)
        place_name: remoteEntry.place_name || null,
        address: remoteEntry.address || null,
        neighborhood: remoteEntry.neighborhood || null,
        postal_code: remoteEntry.postal_code || null,
        city: remoteEntry.city || null,
        subdivision: remoteEntry.subdivision || null,
        region: remoteEntry.region || null,
        country: remoteEntry.country || null,
        geocode_status: ((remoteEntry as any).geocode_status as Entry['geocode_status']) || null,
        // Geo fields (immutable, from geocode)
        geo_address: (remoteEntry as any).geo_address || null,
        geo_neighborhood: (remoteEntry as any).geo_neighborhood || null,
        geo_city: (remoteEntry as any).geo_city || null,
        geo_subdivision: (remoteEntry as any).geo_subdivision || null,
        geo_region: (remoteEntry as any).geo_region || null,
        geo_country: (remoteEntry as any).geo_country || null,
        geo_postal_code: (remoteEntry as any).geo_postal_code || null,
        status: (remoteEntry.status as Entry['status']) || 'none',
        type: remoteEntry.type || null,
        due_date: remoteEntry.due_date,
        completed_at: remoteEntry.completed_at,
        entry_date: remoteEntry.entry_date || remoteEntry.created_at,
        created_at: remoteEntry.created_at,
        updated_at: remoteEntry.updated_at,
        deleted_at: remoteEntry.deleted_at,
        attachments: remoteEntry.attachments,
        priority: remoteEntry.priority || 0,
        rating: remoteEntry.rating || 0.00,
        is_pinned: remoteEntry.is_pinned || false,
        local_only: 0,
        synced: 1,
        sync_action: null,
        version: remoteEntry.version || 1,
        base_version: remoteEntry.version || 1,
        conflict_status: (remoteEntry.conflict_status as Entry['conflict_status']) || null,
        conflict_backup: typeof remoteEntry.conflict_backup === 'string' ? remoteEntry.conflict_backup : null,
        last_edited_by: remoteEntry.last_edited_by || null,
        last_edited_device: remoteEntry.last_edited_device || null,
      };

      if (!localEntry) {
        await localDB.saveEntry(entry);
        await localDB.markSynced(entry.entry_id);
        newCount++;
      } else {
        // Skip if local has unsynced changes (don't overwrite pending edits)
        if (localEntry.synced === 0) {
          log.debug('Skipping entry with unsynced local changes', { entryId: entry.entry_id });
          continue;
        }

        // Use version comparison instead of timestamp
        const remoteVersion = remoteEntry.version || 1;
        const localBaseVersion = localEntry.base_version || 1;

        if (remoteVersion > localBaseVersion) {
          await localDB.updateEntry(entry.entry_id, entry);
          await localDB.markSynced(entry.entry_id);
          updatedCount++;
          log.debug('Entry updated from server', {
            entryId: entry.entry_id,
            remoteVersion,
            localBaseVersion
          });
        }
      }
    } catch (error) {
      log.warn('Failed to process entry', { entryId: remoteEntry.entry_id, error });
    }
  }

  return { new: newCount, updated: updatedCount, deleted: deletedCount };
}

export async function pullAttachments(forceFullPull: boolean): Promise<{ new: number; updated: number; deleted: number }> {
  const { data: { user } } = await supabase.auth.getUser();
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

  for (const remoteAttachment of (remoteAttachments || [])) {
    try {
      const localAttachments = await localDB.runCustomQuery(
        'SELECT * FROM attachments WHERE attachment_id = ?',
        [(remoteAttachment as any).attachment_id]
      );
      const localAttachment = localAttachments.length > 0 ? localAttachments[0] : null;

      const attachment = {
        attachment_id: (remoteAttachment as any).attachment_id,
        entry_id: (remoteAttachment as any).entry_id,
        user_id: (remoteAttachment as any).user_id,
        file_path: (remoteAttachment as any).file_path,
        local_path: localAttachment?.local_path || undefined,
        mime_type: (remoteAttachment as any).mime_type,
        file_size: (remoteAttachment as any).file_size || undefined,
        width: (remoteAttachment as any).width || undefined,
        height: (remoteAttachment as any).height || undefined,
        position: (remoteAttachment as any).position,
        created_at: new Date((remoteAttachment as any).created_at).getTime(),
        updated_at: new Date((remoteAttachment as any).updated_at).getTime(),
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

  // Detect and delete attachments that exist locally but were deleted on server
  try {
    const localSyncedAttachments = await localDB.runCustomQuery(
      'SELECT attachment_id, local_path FROM attachments WHERE user_id = ? AND synced = 1 AND (sync_action IS NULL OR sync_action != ?)',
      [user.id, 'delete']
    );

    for (const localAttachment of localSyncedAttachments) {
      if (!remoteAttachmentIds.has(localAttachment.attachment_id)) {
        log.info('Attachment deleted on server, removing locally', { attachmentId: localAttachment.attachment_id });
        // Delete local file if exists
        if (localAttachment.local_path) {
          try {
            await deleteAttachmentFromLocalStorage(localAttachment.local_path);
          } catch (err) {
            log.warn('Failed to delete local attachment file', { path: localAttachment.local_path, error: err });
          }
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
