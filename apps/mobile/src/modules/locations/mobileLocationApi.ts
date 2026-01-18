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
 * Find an existing location with the same name and address (for auto-merge)
 * Returns null if no duplicate found
 */
export async function findDuplicateLocation(name: string, address: string | null): Promise<LocationEntity | null> {
  if (!name) return null;

  const normalizedName = name.toLowerCase().trim();
  const normalizedAddress = address?.toLowerCase().trim() || null;

  const allLocations = await localDB.getAllLocations();

  // Find location with same name AND address (both must match)
  const duplicate = allLocations.find(loc => {
    const locName = loc.name.toLowerCase().trim();
    const locAddress = loc.address?.toLowerCase().trim() || null;

    // Name must match
    if (locName !== normalizedName) return false;

    // If both have addresses, they must match
    if (normalizedAddress && locAddress) {
      return locAddress === normalizedAddress;
    }

    // If neither has an address, consider it a match (same name, both no address)
    if (!normalizedAddress && !locAddress) {
      return true;
    }

    // One has address, one doesn't - not a duplicate
    return false;
  });

  return duplicate || null;
}

/**
 * Create a new location (offline-first)
 * Writes to local SQLite immediately, syncs to Supabase in background
 *
 * Auto-merge: If a location with the same name and address already exists,
 * returns the existing location instead of creating a duplicate.
 */
export async function createLocation(data: CreateLocationInput): Promise<LocationEntity> {
  // Get user ID from LocalDB (cached from login)
  const userId = localDB.getCurrentUserId();
  if (!userId) throw new Error('Not authenticated');

  // Auto-merge: Check for existing location with same name and address
  const existingLocation = await findDuplicateLocation(data.name, data.address || null);
  if (existingLocation) {
    log.info('Auto-merging with existing location', {
      existingId: existingLocation.location_id,
      name: data.name,
      address: data.address,
    });
    return existingLocation;
  }

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
    location_radius: data.location_radius ?? null,
    // Geo fields (immutable, from geocode)
    geo_address: data.geo_address || null,
    geo_neighborhood: data.geo_neighborhood || null,
    geo_city: data.geo_city || null,
    geo_subdivision: data.geo_subdivision || null,
    geo_region: data.geo_region || null,
    geo_country: data.geo_country || null,
    geo_postal_code: data.geo_postal_code || null,
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
 * Update a location's name and propagate to all entries using it
 *
 * This updates:
 * 1. The location record's name
 * 2. All entries with this location_id - their place_name field
 *
 * Returns the number of entries updated
 */
export async function updateLocationName(
  locationId: string,
  newName: string
): Promise<{ location: LocationEntity; entriesUpdated: number }> {
  log.info('Updating location name and entries', { locationId, newName });

  // Update the location record
  const updatedLocation = await updateLocation(locationId, { name: newName });

  // Update all entries that reference this location
  // Note: We don't update updated_at since the entry content itself hasn't changed,
  // only the denormalized location name. This preserves "last edited" semantics.
  const entriesUpdated = await localDB.runCustomQuery(
    `UPDATE entries
     SET place_name = ?,
         synced = 0,
         sync_action = CASE WHEN sync_action = 'create' THEN 'create' ELSE 'update' END
     WHERE location_id = ? AND deleted_at IS NULL`,
    [newName, locationId]
  );

  // Get the count of updated entries
  const countResult = await localDB.runCustomQuery(
    `SELECT changes() as count`
  );
  const count = countResult[0]?.count ?? 0;

  log.info('Updated location and entries', { locationId, entriesUpdated: count });

  // Trigger sync
  triggerPushSync();

  return { location: updatedLocation, entriesUpdated: count };
}

/**
 * Update location details (name, address, accuracy) and propagate to all entries
 *
 * This is used for "Edit Location" which allows editing name, address, and precision.
 * Updates:
 * 1. The location record's name, address, and accuracy
 * 2. All entries with this location_id - their place_name and address fields
 *
 * Returns the number of entries updated
 */
export async function updateLocationDetails(
  locationId: string,
  updates: { name: string; address: string | null; location_radius?: number | null }
): Promise<{ location: LocationEntity; entriesUpdated: number }> {
  log.info('Updating location details and entries', { locationId, name: updates.name, hasAddress: !!updates.address, location_radius: updates.location_radius });

  // Update the location record
  const updatedLocation = await updateLocation(locationId, {
    name: updates.name,
    address: updates.address,
    ...(updates.location_radius !== undefined && { location_radius: updates.location_radius }),
  });

  // Update all entries that reference this location
  // Note: We don't update updated_at since the entry content itself hasn't changed,
  // only the denormalized location data. This preserves "last edited" semantics.
  await localDB.runCustomQuery(
    `UPDATE entries
     SET place_name = ?,
         address = ?,
         location_radius = ?,
         synced = 0,
         sync_action = CASE WHEN sync_action = 'create' THEN 'create' ELSE 'update' END
     WHERE location_id = ? AND deleted_at IS NULL`,
    [updates.name, updates.address, updates.location_radius ?? null, locationId]
  );

  // Get the count of updated entries
  const countResult = await localDB.runCustomQuery(
    `SELECT changes() as count`
  );
  const count = countResult[0]?.count ?? 0;

  log.info('Updated location and entries', { locationId, entriesUpdated: count });

  // Trigger sync
  triggerPushSync();

  return { location: updatedLocation, entriesUpdated: count };
}

/**
 * Mark location as synced (internal use by sync service)
 */
export async function markLocationSynced(id: string): Promise<void> {
  await localDB.markLocationSynced(id);
}
