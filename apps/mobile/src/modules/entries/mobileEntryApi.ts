/**
 * Mobile Entry API - Offline-first entry operations
 *
 * All reads come from local SQLite.
 * Writes go to SQLite first, then sync in background.
 * Use { refreshFirst: true } for critical reads (editing).
 *
 * Architecture:
 * Components → Hooks → API (this file) → LocalDB
 *                                      ↓
 *                                  SyncService (background)
 */

import { Entry, CreateEntryInput, EntryFilter } from '@trace/core';
import { localDB } from '../../shared/db/localDB';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import { triggerPushSync, refreshEntryFromServer } from '../../shared/sync';
import { createScopedLogger } from '../../shared/utils/logger';

const log = createScopedLogger('EntryApi');

/**
 * Mobile-specific entry filter that extends core EntryFilter
 */
export interface MobileEntryFilter extends EntryFilter {
  // Extends core EntryFilter which now uses stream_id

  /**
   * When true, exclude entries from streams marked as private (is_private = 1).
   * This is automatically applied when viewing "All Entries" to hide private streams.
   * When viewing a specific stream directly, this should be false.
   */
  excludePrivateStreams?: boolean;

  // Location hierarchy filters (filter entries by location fields)
  // For places, use location_id (stable UUID) instead of GPS coords
  filter_country?: string;
  filter_region?: string;
  filter_city?: string;
  filter_neighborhood?: string;
  filter_place_name?: string;
  filter_no_location?: boolean; // Filter entries with no location data
}

/**
 * Options for read operations
 */
export interface ReadOptions {
  /** If true, pulls latest from server before reading (requires network) */
  refreshFirst?: boolean;
}

/**
 * Parse a drawer selection ID (stream, tag, location, geo hierarchy) into a MobileEntryFilter.
 * Used by EntryListScreen, MapScreen, and CalendarScreen for consistent filtering.
 *
 * @param selectedStreamId - The selection ID from drawer (stream UUID, "all", "no-stream", "tag:X", "location:UUID", "geo:type:value:...")
 * @returns MobileEntryFilter object for useEntries hook
 */
export function parseStreamIdToFilter(selectedStreamId: string | null): MobileEntryFilter {
  // "All" / "Home" - fetch all entries
  if (selectedStreamId === "all") {
    return {};
  }

  // No Stream - show only entries without a stream
  if (selectedStreamId === "no-stream" || selectedStreamId === null) {
    return { stream_id: null };
  }

  // Navigation items - treat like "all"
  if (selectedStreamId === "streams" || selectedStreamId === "events" ||
      selectedStreamId === "tags" || selectedStreamId === "people") {
    return {};
  }

  // Handle tag: prefix
  if (selectedStreamId.startsWith("tag:")) {
    const tag = selectedStreamId.substring(4);
    return { tag };
  }

  // Handle mention: prefix
  if (selectedStreamId.startsWith("mention:")) {
    const mention = selectedStreamId.substring(8);
    return { mention };
  }

  // Handle location: prefix (place with location_id)
  if (selectedStreamId.startsWith("location:")) {
    const locationId = selectedStreamId.substring(9);
    return { location_id: locationId };
  }

  // Handle geo: hierarchy filters (country, region, city, neighborhood, place, none)
  if (selectedStreamId.startsWith("geo:")) {
    const parts = selectedStreamId.split(':');
    const geoType = parts[1];

    if (geoType === 'none') {
      return { filter_no_location: true };
    } else if (geoType === 'country') {
      const countryName = parts.slice(2).join(':');
      return { filter_country: countryName };
    } else if (geoType === 'region') {
      const regionName = parts[2];
      const countryName = parts[3] || undefined;
      return {
        filter_region: regionName,
        ...(countryName && { filter_country: countryName }),
      };
    } else if (geoType === 'city') {
      const cityName = parts[2];
      const regionName = parts[3] || undefined;
      const countryName = parts[4] || undefined;
      return {
        filter_city: cityName,
        ...(regionName && { filter_region: regionName }),
        ...(countryName && { filter_country: countryName }),
      };
    } else if (geoType === 'neighborhood') {
      const neighborhoodName = parts[2];
      const cityName = parts[3] || undefined;
      const regionName = parts[4] || undefined;
      const countryName = parts[5] || undefined;
      return {
        filter_neighborhood: neighborhoodName,
        ...(cityName && { filter_city: cityName }),
        ...(regionName && { filter_region: regionName }),
        ...(countryName && { filter_country: countryName }),
      };
    } else if (geoType === 'place') {
      const placeName = parts[2];
      const cityName = parts[3] || undefined;
      const regionName = parts[4] || undefined;
      const countryName = parts[5] || undefined;
      return {
        filter_place_name: placeName,
        ...(cityName && { filter_city: cityName }),
        ...(regionName && { filter_region: regionName }),
        ...(countryName && { filter_country: countryName }),
      };
    }
  }

  // Default: Specific stream ID
  return { stream_id: selectedStreamId };
}

/**
 * Get device identifier for attribution
 */
export function getDeviceName(): string {
  const deviceName = Device.deviceName || 'Unknown Device';
  const platformName = Platform.OS === 'ios' ? 'iOS' : 'Android';
  return `${deviceName} (${platformName})`;
}

/**
 * Generate UUID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================================================
// READ OPERATIONS (always from local SQLite)
// ============================================================================

/**
 * Get entries from local database
 */
export async function getEntries(filter?: MobileEntryFilter): Promise<Entry[]> {
  log.debug('Getting entries', { filter });
  return await localDB.getAllEntries(filter);
}

/**
 * Get a single entry by ID
 * Use { refreshFirst: true } before editing to ensure latest version
 */
export async function getEntry(id: string, options?: ReadOptions): Promise<Entry | null> {
  log.debug('Getting entry', { id, options });

  // Optionally refresh from server first (for editing)
  if (options?.refreshFirst) {
    const updated = await refreshEntryFromServer(id);
    if (updated) {
      log.debug('Entry refreshed from server', { id });
    }
  }

  return await localDB.getEntry(id);
}

/**
 * Get count of unsynced entries
 */
export async function getUnsyncedCount(): Promise<number> {
  return await localDB.getUnsyncedCount();
}

/**
 * Get entry counts for navigation display (fast COUNT queries)
 */
export async function getEntryCounts(): Promise<{ total: number; noStream: number }> {
  return await localDB.getEntryCounts();
}

/**
 * Get all unsynced entries
 */
export async function getUnsyncedEntries(): Promise<Entry[]> {
  return await localDB.getUnsyncedEntries();
}

/**
 * Get all unique tags with entry counts
 */
export async function getTags(): Promise<Array<{ tag: string; count: number }>> {
  return await localDB.getAllTags();
}

/**
 * Get all unique mentions (people) with entry counts
 */
export async function getMentions(): Promise<Array<{ mention: string; count: number }>> {
  return await localDB.getAllMentions();
}

// ============================================================================
// WRITE OPERATIONS (local first, then sync)
// ============================================================================

/**
 * Create a new entry (offline-first)
 * Writes to local SQLite immediately, syncs to Supabase in background
 */
export async function createEntry(data: CreateEntryInput): Promise<Entry> {
  // Get user ID from LocalDB (cached from login)
  const userId = localDB.getCurrentUserId();
  if (!userId) throw new Error('Not authenticated');

  // Generate entry ID
  const entry_id = generateUUID();

  // Create entry object
  const entry: Entry = {
    entry_id,
    user_id: userId,
    title: data.title || null,
    content: data.content,
    tags: data.tags || [],
    mentions: data.mentions || [],
    stream_id: data.stream_id || null,
    // GPS coordinates (where user was when creating entry)
    entry_latitude: data.entry_latitude || null,
    entry_longitude: data.entry_longitude || null,
    location_radius: data.location_radius || null,
    // Location reference (optional - points to anchor in locations table)
    location_id: data.location_id || null,
    // Location hierarchy (owned by entry - copied from anchor or reverse geocode)
    place_name: data.place_name || null,
    address: data.address || null,
    neighborhood: data.neighborhood || null,
    postal_code: data.postal_code || null,
    city: data.city || null,
    subdivision: data.subdivision || null,
    region: data.region || null,
    country: data.country || null,
    geocode_status: data.geocode_status || null,
    status: data.status || 'none',
    type: data.type || null,
    due_date: data.due_date || null,
    completed_at: null,
    entry_date: data.entry_date || new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    attachments: null,
    // Priority, rating, and pinning fields
    priority: 0,
    rating: 0.00,
    is_pinned: false,
    is_archived: false,
    local_only: data.local_only || 0,
    synced: 0,
    sync_action: 'create',
    // Conflict resolution fields
    version: 1,
    base_version: 1,
    conflict_status: null,
    conflict_backup: null,
    last_edited_by: null, // Will be set during sync if needed
    last_edited_device: getDeviceName(),
  };

  log.debug('Creating entry', { entryId: entry_id, hasTitle: !!entry.title });

  // Save to SQLite immediately (always succeeds, works offline)
  const savedEntry = await localDB.saveEntry(entry);

  // Trigger sync in background (non-blocking)
  triggerPushSync();

  return savedEntry;
}

/**
 * Update an entry (offline-first)
 */
export async function updateEntry(
  id: string,
  updates: Partial<Entry>
): Promise<Entry> {
  // Get current entry to increment version
  const currentEntry = await localDB.getEntry(id);
  if (!currentEntry) throw new Error('Entry not found');

  // Determine if this is a user edit (needs version increment) or a sync operation
  const isUserEdit = updates.sync_action === undefined || updates.sync_action === 'update';

  // Mark as needing sync (unless explicitly specified otherwise)
  // IMPORTANT: Preserve 'create' sync_action if entry was never successfully synced
  // This handles the case where initial create failed (e.g., network error) and user edits again
  // Without this, sync would try to UPDATE a non-existent server entry, causing conflict errors
  const shouldPreserveCreate = currentEntry.sync_action === 'create' && currentEntry.synced === 0;
  const updatesWithSync = {
    ...updates,
    synced: updates.synced !== undefined ? updates.synced : 0,
    sync_action: updates.sync_action !== undefined
      ? updates.sync_action
      : (shouldPreserveCreate ? 'create' : 'update'),
  };

  // Add version tracking and attribution for user edits
  if (isUserEdit) {
    updatesWithSync.version = (currentEntry.version || 1) + 1;
    updatesWithSync.last_edited_by = null; // Will be set during sync if needed
    updatesWithSync.last_edited_device = getDeviceName();
  }

  log.debug('Updating entry', {
    entryId: id,
    isUserEdit,
    synced: updatesWithSync.synced,
    sync_action: updatesWithSync.sync_action,
    version: updatesWithSync.version,
    currentBaseVersion: currentEntry.base_version,
  });

  // Update in SQLite
  const updated = await localDB.updateEntry(id, updatesWithSync);

  log.debug('Entry updated in SQLite', { entryId: id, synced: updated.synced });

  // Trigger sync in background (non-blocking)
  if (isUserEdit) {
    log.debug('Triggering push sync for user edit');
    triggerPushSync();
  }

  return updated;
}

/**
 * Delete an entry (offline-first, soft delete)
 */
export async function deleteEntry(id: string): Promise<void> {
  log.debug('Deleting entry', { entryId: id });

  // Delete from SQLite (soft delete)
  await localDB.deleteEntry(id);

  // Trigger sync in background (non-blocking)
  triggerPushSync();
}

/**
 * Archive/unarchive an entry (offline-first)
 * Simply updates the is_archived flag
 */
export async function archiveEntry(id: string, archived: boolean): Promise<Entry> {
  log.debug('Archiving entry', { entryId: id, archived });

  // Update the is_archived field
  const updated = await updateEntry(id, { is_archived: archived });

  return updated;
}

/**
 * Copy an entry - creates a duplicate and saves it to DB immediately
 * Returns the new entry ID for navigation to EntryScreen
 */
export async function copyEntry(id: string): Promise<string> {
  // Get the original entry
  const originalEntry = await localDB.getEntry(id);
  if (!originalEntry) throw new Error('Entry not found');

  // Get user ID from LocalDB (cached from login)
  const userId = localDB.getCurrentUserId();
  if (!userId) throw new Error('Not authenticated');

  // Generate new entry ID
  const entry_id = generateUUID();

  // Use current date/time for the copy
  const newEntryDate = new Date().toISOString();

  // Create new title
  const newTitle = originalEntry.title
    ? `Copy of ${originalEntry.title}`
    : 'Copy of Untitled';

  // Create the copied entry with ALL fields from original
  const entry: Entry = {
    entry_id,
    user_id: userId,
    title: newTitle,
    content: originalEntry.content,
    tags: originalEntry.tags || [],
    mentions: originalEntry.mentions || [],
    stream_id: originalEntry.stream_id,
    // Copy all location fields from original
    entry_latitude: originalEntry.entry_latitude,
    entry_longitude: originalEntry.entry_longitude,
    location_radius: originalEntry.location_radius,
    location_id: originalEntry.location_id,
    place_name: originalEntry.place_name,
    address: originalEntry.address,
    neighborhood: originalEntry.neighborhood,
    postal_code: originalEntry.postal_code,
    city: originalEntry.city,
    subdivision: originalEntry.subdivision,
    region: originalEntry.region,
    country: originalEntry.country,
    geocode_status: originalEntry.geocode_status,
    // Copy status, type, and task-related fields
    status: originalEntry.status || 'none',
    type: originalEntry.type || null,
    due_date: originalEntry.due_date,
    completed_at: null, // New copy is not completed
    entry_date: newEntryDate,
    created_at: newEntryDate,
    updated_at: newEntryDate,
    attachments: null,
    // Copy priority, rating, but not pinned or archived state
    priority: originalEntry.priority || 0,
    rating: originalEntry.rating || 0.00,
    is_pinned: false, // New copy is not pinned
    is_archived: false, // New copy is not archived
    local_only: originalEntry.local_only || 0,
    synced: 0,
    sync_action: 'create',
    // Conflict resolution fields
    version: 1,
    base_version: 1,
    conflict_status: null,
    conflict_backup: null,
    last_edited_by: null,
    last_edited_device: getDeviceName(),
  };

  // Save entry to database
  await localDB.saveEntry(entry);

  // Copy photos from the original entry and save to DB
  await copyPhotosForEntry(id, entry_id, userId);

  log.info('Entry copied', {
    originalId: id,
    newId: entry_id,
    hasLocation: !!(originalEntry.entry_latitude || originalEntry.location_id),
  });

  // Trigger sync in background
  triggerPushSync();

  // Return new entry ID for navigation
  return entry_id;
}

/**
 * Copy photos from one entry to a new entry
 * Duplicates the photo files and saves attachment records to DB
 */
async function copyPhotosForEntry(
  originalEntryId: string,
  newEntryId: string,
  userId: string
): Promise<void> {
  try {
    // Get photos from the original entry
    const originalPhotos = await localDB.getAttachmentsForEntry(originalEntryId);

    if (originalPhotos.length === 0) {
      return;
    }

    log.debug('Copying photos', { originalEntryId, newEntryId, count: originalPhotos.length });

    // Create directory for new entry's photos
    const newDirPath = `${FileSystem.documentDirectory}photos/${userId}/${newEntryId}/`;
    await FileSystem.makeDirectoryAsync(newDirPath, { intermediates: true });

    let copiedCount = 0;
    for (const photo of originalPhotos) {
      // Generate new photo ID
      const newPhotoId = generateUUID();

      // Check if source file exists
      if (!photo.local_path) {
        log.warn('Photo has no local path, skipping', { photoId: photo.photo_id });
        continue;
      }

      const sourceFileInfo = await FileSystem.getInfoAsync(photo.local_path);
      if (!sourceFileInfo.exists) {
        log.warn('Photo file not found, skipping', { photoId: photo.photo_id, path: photo.local_path });
        continue;
      }

      // Copy the file to new location
      const newLocalPath = `${newDirPath}${newPhotoId}.jpg`;
      await FileSystem.copyAsync({
        from: photo.local_path,
        to: newLocalPath,
      });

      // Save attachment record to DB
      await localDB.createAttachment({
        attachment_id: newPhotoId,
        entry_id: newEntryId,
        user_id: userId,
        file_path: `${userId}/${newEntryId}/${newPhotoId}.jpg`,
        local_path: newLocalPath,
        mime_type: photo.mime_type || 'image/jpeg',
        file_size: photo.file_size || 0,
        width: photo.width || 0,
        height: photo.height || 0,
        position: photo.position || copiedCount,
        uploaded: false, // Needs to be uploaded
      });

      copiedCount++;
      log.debug('Photo copied', { originalId: photo.photo_id, newId: newPhotoId });
    }

    if (copiedCount > 0) {
      log.info('Photos copied successfully', { count: copiedCount });
    }
  } catch (error) {
    log.error('Failed to copy photos', error);
    // Don't throw - copying photos is non-critical, entry can still be created
  }
}

// ============================================================================
// LOCATION HIERARCHY (for drawer navigation)
// ============================================================================

/**
 * Get location hierarchy aggregated from entries
 * Returns rows with country, region, city, neighborhood, place_name, location_id, and entry counts
 * location_id is the stable unique identifier for places (no GPS jitter issues)
 */
export async function getLocationHierarchy(): Promise<Array<{
  country: string | null;
  region: string | null;
  city: string | null;
  neighborhood: string | null;
  place_name: string | null;
  location_id: string | null;
  entry_count: number;
}>> {
  return await localDB.getLocationHierarchy();
}

/**
 * Get count of entries with no location data
 */
export async function getNoLocationCount(): Promise<number> {
  return await localDB.getNoLocationCount();
}
