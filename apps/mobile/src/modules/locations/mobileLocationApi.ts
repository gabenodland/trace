/**
 * Mobile Location API - Offline-first location operations
 *
 * All reads come from local SQLite.
 * Writes go to SQLite first, then sync in background.
 *
 * Architecture:
 * Components → Hooks → API (this file) → LocalDB
 *                                      ↓
 *                                  SyncService (background)
 */

import { LocationEntity, CreateLocationInput } from '@trace/core';
import { localDB } from '../../shared/db/localDB';
import { triggerPushSync } from '../../shared/sync';
import { createScopedLogger } from '../../shared/utils/logger';

const log = createScopedLogger('LocationApi');

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
 * Get a single location by ID
 */
export async function getLocation(id: string): Promise<LocationEntity | null> {
  log.debug('Getting location', { id });
  return await localDB.getLocation(id);
}

/**
 * Get all locations for current user
 */
export async function getLocations(): Promise<LocationEntity[]> {
  log.debug('Getting all locations');
  return await localDB.getAllLocations();
}

/**
 * Get locations with entry counts (for display in lists)
 */
export async function getLocationsWithCounts(): Promise<Array<LocationEntity & { entry_count: number }>> {
  log.debug('Getting locations with counts');
  return await localDB.getLocationsWithCounts();
}

/**
 * Get unsynced locations
 */
export async function getUnsyncedLocations(): Promise<LocationEntity[]> {
  return await localDB.getUnsyncedLocations();
}

// ============================================================================
// WRITE OPERATIONS (local first, then sync)
// ============================================================================

/**
 * Create a new location (offline-first)
 * Writes to local SQLite immediately, syncs to Supabase in background
 */
export async function createLocation(data: CreateLocationInput): Promise<LocationEntity> {
  // Get user ID from LocalDB (cached from login)
  const userId = localDB.getCurrentUserId();
  if (!userId) throw new Error('Not authenticated');

  // Generate location ID
  const location_id = generateUUID();
  const now = new Date().toISOString();

  // Create location object
  const location: LocationEntity = {
    location_id,
    user_id: userId,
    name: data.name,
    latitude: data.latitude,
    longitude: data.longitude,
    source: data.source || null,
    address: data.address || null,
    neighborhood: data.neighborhood || null,
    postal_code: data.postal_code || null,
    city: data.city || null,
    subdivision: data.subdivision || null,
    region: data.region || null,
    country: data.country || null,
    mapbox_place_id: data.mapbox_place_id || null,
    foursquare_fsq_id: data.foursquare_fsq_id || null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    synced: 0,
    sync_action: 'create',
  };

  log.info('Creating location', { locationId: location_id, name: data.name });

  // Save to SQLite immediately
  const savedLocation = await localDB.saveLocation(location);

  // Trigger sync in background (non-blocking)
  triggerPushSync();

  return savedLocation;
}

/**
 * Update a location (offline-first)
 */
export async function updateLocation(
  id: string,
  updates: Partial<LocationEntity>
): Promise<LocationEntity> {
  // Determine if this is a user edit or sync operation
  const isUserEdit = updates.sync_action === undefined || updates.sync_action === 'update';

  const updatesWithSync = {
    ...updates,
    synced: updates.synced !== undefined ? updates.synced : 0,
    sync_action: updates.sync_action !== undefined ? updates.sync_action : 'update',
  };

  log.info('Updating location', { locationId: id, isUserEdit });

  const updated = await localDB.updateLocation(id, updatesWithSync);

  // Trigger sync in background (non-blocking)
  if (isUserEdit) {
    triggerPushSync();
  }

  return updated;
}

/**
 * Delete a location (offline-first, soft delete)
 */
export async function deleteLocation(id: string): Promise<void> {
  log.info('Deleting location', { locationId: id });

  await localDB.deleteLocation(id);

  // Trigger sync in background (non-blocking)
  triggerPushSync();
}

/**
 * Mark location as synced (internal use by sync service)
 */
export async function markLocationSynced(id: string): Promise<void> {
  await localDB.markLocationSynced(id);
}
