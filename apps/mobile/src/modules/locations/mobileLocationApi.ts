/**
 * Mobile-specific location API
 * Writes to SQLite first (offline-capable), then syncs to Supabase
 */

import { LocationEntity, CreateLocationInput } from '@trace/core';
import { localDB } from '../../shared/db/localDB';
import { supabase } from '@trace/core/src/shared/supabase';

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
 * Create a new location (offline-first)
 * Writes to local SQLite immediately, syncs to Supabase in background
 */
export async function createLocation(data: CreateLocationInput): Promise<LocationEntity> {
  // Get user ID
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Generate location ID
  const location_id = generateUUID();
  const now = new Date().toISOString();

  // Create location object
  const location: LocationEntity = {
    location_id,
    user_id: user.id,
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

  // Save to SQLite immediately
  const savedLocation = await localDB.saveLocation(location);

  return savedLocation;
}

/**
 * Get a single location by ID
 */
export async function getLocation(id: string): Promise<LocationEntity | null> {
  return await localDB.getLocation(id);
}

/**
 * Get all locations for current user
 */
export async function getLocations(): Promise<LocationEntity[]> {
  return await localDB.getAllLocations();
}

/**
 * Get locations with entry counts (for display in lists)
 */
export async function getLocationsWithCounts(): Promise<Array<LocationEntity & { entry_count: number }>> {
  return await localDB.getLocationsWithCounts();
}

/**
 * Update a location
 */
export async function updateLocation(
  id: string,
  updates: Partial<LocationEntity>
): Promise<LocationEntity> {
  const updatesWithSync = {
    ...updates,
    synced: updates.synced !== undefined ? updates.synced : 0,
    sync_action: updates.sync_action !== undefined ? updates.sync_action : 'update',
  };

  return await localDB.updateLocation(id, updatesWithSync);
}

/**
 * Delete a location (soft delete)
 */
export async function deleteLocation(id: string): Promise<void> {
  await localDB.deleteLocation(id);
}

/**
 * Get unsynced locations
 */
export async function getUnsyncedLocations(): Promise<LocationEntity[]> {
  return await localDB.getUnsyncedLocations();
}

/**
 * Mark location as synced
 */
export async function markLocationSynced(id: string): Promise<void> {
  await localDB.markLocationSynced(id);
}
