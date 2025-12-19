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
import type { PendingPhoto } from './components/hooks/useCaptureFormState';

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
}

/**
 * Options for read operations
 */
export interface ReadOptions {
  /** If true, pulls latest from server before reading (requires network) */
  refreshFirst?: boolean;
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
    location_accuracy: data.location_accuracy || null,
    // Location reference (points to locations table)
    location_id: data.location_id || null,
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
  const updatesWithSync = {
    ...updates,
    synced: updates.synced !== undefined ? updates.synced : 0,
    sync_action: updates.sync_action !== undefined ? updates.sync_action : 'update',
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
 * Result of copying an entry - returns unsaved entry data and copied photos
 * Entry is NOT saved to database until user clicks save in CaptureForm
 */
export interface CopiedEntryData {
  entry: Entry;
  pendingPhotos: PendingPhoto[];
  hasTime: boolean;
}

/**
 * Copy an entry (in-memory only - not saved until user confirms)
 * Creates a new entry object with copied attributes, current date/time, fresh GPS, and duplicated photos
 * Does NOT save to database - returns data for CaptureForm to display and save later
 */
export async function copyEntry(
  id: string,
  gpsCoords?: { latitude: number; longitude: number; accuracy?: number }
): Promise<CopiedEntryData> {
  // Get the original entry
  const originalEntry = await localDB.getEntry(id);
  if (!originalEntry) throw new Error('Entry not found');

  // Get user ID from LocalDB (cached from login)
  const userId = localDB.getCurrentUserId();
  if (!userId) throw new Error('Not authenticated');

  // Generate new entry ID
  const entry_id = generateUUID();

  // Determine if original entry included time (has non-zero milliseconds or specific time)
  // Check if time was set by looking at whether it's midnight UTC
  // Default to current time if no entry_date on original
  let hasTime = true;
  if (originalEntry.entry_date) {
    const originalDate = new Date(originalEntry.entry_date);
    hasTime = originalDate.getUTCHours() !== 0 ||
              originalDate.getUTCMinutes() !== 0 ||
              originalDate.getUTCSeconds() !== 0 ||
              originalDate.getUTCMilliseconds() !== 0;
  }

  // Create new date - if original had time, use current time; otherwise just use current date at midnight
  let newEntryDate: string;
  if (hasTime) {
    newEntryDate = new Date().toISOString();
  } else {
    // Set to midnight UTC for date-only entries
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    newEntryDate = now.toISOString();
  }

  // Create new title
  const newTitle = originalEntry.title
    ? `Copy of ${originalEntry.title}`
    : 'Copy of Untitled';

  // Create the copied entry (NOT saved to DB)
  const entry: Entry = {
    entry_id,
    user_id: userId,
    title: newTitle,
    content: originalEntry.content,
    tags: originalEntry.tags || [],
    mentions: originalEntry.mentions || [],
    stream_id: originalEntry.stream_id,
    // Fresh GPS coordinates
    entry_latitude: gpsCoords?.latitude || null,
    entry_longitude: gpsCoords?.longitude || null,
    location_accuracy: gpsCoords?.accuracy || null,
    // Keep the same location reference if set
    location_id: originalEntry.location_id,
    // Copy status, type, and task-related fields
    status: originalEntry.status || 'none',
    type: originalEntry.type || null,
    due_date: originalEntry.due_date,
    completed_at: null, // New copy is not completed
    entry_date: newEntryDate,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    attachments: null, // Don't copy attachments
    // Copy priority, rating, but not pinned state
    priority: originalEntry.priority || 0,
    rating: originalEntry.rating || 0.00,
    is_pinned: false, // New copy is not pinned
    local_only: originalEntry.local_only || 0,
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

  // Copy photos from the original entry
  const pendingPhotos = await copyPhotosForEntry(id, entry_id, userId);

  log.debug('Copying entry (in-memory)', {
    originalId: id,
    newId: entry_id,
    hasTime,
    hasGps: !!gpsCoords,
    photoCount: pendingPhotos.length,
  });

  // DO NOT save to database - return unsaved data for CaptureForm
  return {
    entry,
    pendingPhotos,
    hasTime,
  };
}

/**
 * Copy photos from one entry to a new entry
 * Duplicates the actual photo files to new paths and returns PendingPhoto objects
 */
async function copyPhotosForEntry(
  originalEntryId: string,
  newEntryId: string,
  userId: string
): Promise<PendingPhoto[]> {
  const pendingPhotos: PendingPhoto[] = [];

  try {
    // Get photos from the original entry
    const originalPhotos = await localDB.getPhotosForEntry(originalEntryId);

    if (originalPhotos.length === 0) {
      return pendingPhotos;
    }

    log.debug('Copying photos', { originalEntryId, newEntryId, count: originalPhotos.length });

    // Create directory for new entry's photos
    const newDirPath = `${FileSystem.documentDirectory}photos/${userId}/${newEntryId}/`;
    await FileSystem.makeDirectoryAsync(newDirPath, { intermediates: true });

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

      // Create pending photo object
      const pendingPhoto: PendingPhoto = {
        photoId: newPhotoId,
        localPath: newLocalPath,
        filePath: `${userId}/${newEntryId}/${newPhotoId}.jpg`,
        mimeType: photo.mime_type || 'image/jpeg',
        fileSize: photo.file_size || 0,
        width: photo.width || 0,
        height: photo.height || 0,
        position: photo.position || pendingPhotos.length,
      };

      pendingPhotos.push(pendingPhoto);
      log.debug('Photo copied', { originalId: photo.photo_id, newId: newPhotoId });
    }

    log.info('Photos copied successfully', { count: pendingPhotos.length });
  } catch (error) {
    log.error('Failed to copy photos', error);
    // Don't throw - copying photos is non-critical, entry can still be created
  }

  return pendingPhotos;
}
