/**
 * Mobile-specific entry API
 * Writes to SQLite first (offline-capable), then syncs to Supabase
 */

import { Entry, CreateEntryInput } from '@trace/core';
import { localDB } from '../../shared/db/localDB';
import { supabase } from '@trace/core/src/shared/supabase';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

/**
 * Get device identifier for attribution
 */
function getDeviceName(): string {
  const deviceName = Device.deviceName || 'Unknown Device';
  const platformName = Platform.OS === 'ios' ? 'iOS' : 'Android';
  return `${deviceName} (${platformName})`;
}

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
    // Tagged location coordinates (selected POI/place)
    location_latitude: data.location_latitude || null,
    location_longitude: data.location_longitude || null,
    location_accuracy: data.location_accuracy || null,
    // Location name and hierarchy
    location_name: data.location_name || null,
    location_name_source: data.location_name_source || null,
    location_neighborhood: data.location_neighborhood || null,
    location_postal_code: data.location_postal_code || null,
    location_city: data.location_city || null,
    location_subdivision: data.location_subdivision || null,
    location_region: data.location_region || null,
    location_country: data.location_country || null,
    location_address: data.location_address || null,
    status: data.status || 'none',
    due_date: data.due_date || null,
    completed_at: null,
    entry_date: data.entry_date || new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    attachments: null,
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

  // Save to SQLite immediately (always succeeds, works offline)
  // Sync will be handled by syncQueue in background
  const savedEntry = await localDB.saveEntry(entry);

  return savedEntry;
}

/**
 * Get entries from local database
 */
export async function getEntries(filter?: {
  category_id?: string | null;
  status?: string;
  tag?: string;
  mention?: string;
  includeChildren?: boolean;
  childCategoryIds?: string[];
}): Promise<Entry[]> {
  return await localDB.getAllEntries(filter);
}

/**
 * Get a single entry by ID
 */
export async function getEntry(id: string): Promise<Entry | null> {
  return await localDB.getEntry(id);
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

  // Mark as needing sync (unless explicitly specified otherwise, like during pull sync)
  const updatesWithSync = {
    ...updates,
    // Only override sync fields if not explicitly provided (preserves sync operation behavior)
    synced: updates.synced !== undefined ? updates.synced : 0,
    sync_action: updates.sync_action !== undefined ? updates.sync_action : 'update',
  };

  // Add version tracking and attribution for user edits
  if (isUserEdit) {
    updatesWithSync.version = (currentEntry.version || 1) + 1;
    updatesWithSync.last_edited_by = user?.email || null;
    updatesWithSync.last_edited_device = getDeviceName();
  }

  // Update in SQLite
  // Sync will be handled by syncQueue in background
  const updated = await localDB.updateEntry(id, updatesWithSync);

  return updated;
}

/**
 * Delete an entry (offline-first)
 */
export async function deleteEntry(id: string): Promise<void> {
  // Delete from SQLite (soft delete)
  // Sync will be handled by syncQueue in background
  await localDB.deleteEntry(id);
}

/**
 * Generate UUID (simple implementation)
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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
