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
import { supabase } from '@trace/core/src/shared/supabase';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { triggerPushSync, refreshEntryFromServer } from '../../shared/sync';
import { createScopedLogger } from '../../shared/utils/logger';

const log = createScopedLogger('EntryApi');

/**
 * Mobile-specific entry filter that extends core EntryFilter
 * Adds mobile-only fields for category hierarchy filtering
 */
export interface MobileEntryFilter extends EntryFilter {
  includeChildren?: boolean;
  childCategoryIds?: string[];
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
function getDeviceName(): string {
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
  // Get user ID
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Generate entry ID
  const entry_id = generateUUID();

  // Create entry object
  const entry: Entry = {
    entry_id,
    user_id: user.id,
    title: data.title || null,
    content: data.content,
    tags: data.tags || [],
    mentions: data.mentions || [],
    category_id: data.category_id || null,
    // GPS coordinates (where user was when creating entry)
    entry_latitude: data.entry_latitude || null,
    entry_longitude: data.entry_longitude || null,
    location_accuracy: data.location_accuracy || null,
    // Location reference (points to locations table)
    location_id: data.location_id || null,
    status: data.status || 'none',
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
    last_edited_by: user.email || null,
    last_edited_device: getDeviceName(),
  };

  log.info('Creating entry', { entryId: entry_id, hasTitle: !!entry.title });

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

  // Get user for attribution
  const { data: { user } } = await supabase.auth.getUser();

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
    updatesWithSync.last_edited_by = user?.email || null;
    updatesWithSync.last_edited_device = getDeviceName();
  }

  log.info('Updating entry', { entryId: id, isUserEdit });

  // Update in SQLite
  const updated = await localDB.updateEntry(id, updatesWithSync);

  // Trigger sync in background (non-blocking)
  if (isUserEdit) {
    triggerPushSync();
  }

  return updated;
}

/**
 * Delete an entry (offline-first, soft delete)
 */
export async function deleteEntry(id: string): Promise<void> {
  log.info('Deleting entry', { entryId: id });

  // Delete from SQLite (soft delete)
  await localDB.deleteEntry(id);

  // Trigger sync in background (non-blocking)
  triggerPushSync();
}
