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

import { LocationEntity, CreateLocationInput, reverseGeocode, parseMapboxHierarchy, findNearbyLocation, geocodeResponseToEntryFields } from '@trace/core';
import { localDB } from '../../shared/db/localDB';
// Import directly from syncApi to avoid circular dependency through sync/index.ts
import { triggerPushSync } from '../../shared/sync/syncApi';
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
 *
 * Also nulls out location_id on all referencing entries while keeping
 * their denormalized fields (place_name, address, city, etc.) intact
 * so entries still display their location info.
 */
export async function deleteLocation(id: string): Promise<void> {
  log.info('Deleting location', { locationId: id });

  try {
    await localDB.execSQL('BEGIN');

    // Soft-delete the location record
    await localDB.deleteLocation(id);

    // Null out location_id on entries but keep denormalized fields
    await localDB.runCustomQuery(
      `UPDATE entries SET location_id = NULL, updated_at = ?, synced = 0,
         sync_action = CASE WHEN sync_action = 'create' THEN 'create' ELSE 'update' END
       WHERE location_id = ? AND deleted_at IS NULL`,
      [new Date().toISOString(), id]
    );

    await localDB.execSQL('COMMIT');
  } catch (error) {
    await localDB.execSQL('ROLLBACK');
    throw error;
  }

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
 * Update location details (name, address) and propagate to all entries
 *
 * This is used for "Edit Location" which allows editing name and address.
 * Updates:
 * 1. The location record's name and address
 * 2. All entries with this location_id - syncs ALL hierarchy fields (place_name, address,
 *    neighborhood, postal_code, city, subdivision, region, country)
 *
 * Returns the number of entries updated
 */
export async function updateLocationDetails(
  locationId: string,
  updates: { name: string; address: string | null }
): Promise<{ location: LocationEntity; entriesUpdated: number }> {
  log.info('Updating location details and entries', { locationId, name: updates.name, hasAddress: !!updates.address });

  // Update the location record
  const updatedLocation = await updateLocation(locationId, {
    name: updates.name,
    address: updates.address,
  });

  // Update all entries that reference this location - sync ALL hierarchy fields
  // Note: We don't update updated_at since the entry content itself hasn't changed,
  // only the denormalized location data. This preserves "last edited" semantics.
  await localDB.runCustomQuery(
    `UPDATE entries
     SET place_name = ?,
         address = ?,
         neighborhood = ?,
         postal_code = ?,
         city = ?,
         subdivision = ?,
         region = ?,
         country = ?,
         synced = 0,
         sync_action = CASE WHEN sync_action = 'create' THEN 'create' ELSE 'update' END
     WHERE location_id = ? AND deleted_at IS NULL`,
    [
      updatedLocation.name,
      updatedLocation.address,
      updatedLocation.neighborhood,
      updatedLocation.postal_code,
      updatedLocation.city,
      updatedLocation.subdivision,
      updatedLocation.region,
      updatedLocation.country,
      locationId
    ]
  );

  // Get the count of updated entries
  const countResult = await localDB.runCustomQuery(
    `SELECT changes() as count`
  );
  const count = countResult[0]?.count ?? 0;

  log.info('Updated location and synced all hierarchy fields to entries', { locationId, entriesUpdated: count });

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

// ============================================================================
// READ OPERATIONS — Location Management
// ============================================================================

/**
 * Get entry-only location groups (entries with GPS but no saved location)
 */
export async function getEntryOnlyLocationGroups() {
  return await localDB.getEntryOnlyLocationGroups();
}

/**
 * Get location health counts for the health tab
 */
export async function getLocationHealthCounts() {
  return await localDB.getLocationHealthCounts();
}

/**
 * Get entry-derived places (all entries grouped by place_name + address)
 * Uses denormalized entry data directly — universal view regardless of location_id.
 */
export async function getEntryDerivedPlaces() {
  return await localDB.getEntryDerivedPlaces();
}

/**
 * Promote an entry-derived place to a saved location (favorite).
 * Creates a location record from the place data, then links all matching entries to it.
 */
export async function promoteEntryPlaceToLocation(place: {
  place_name: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  avg_latitude: number;
  avg_longitude: number;
}): Promise<LocationEntity> {
  const name = place.place_name || place.city || 'Unknown Place';

  // Check for existing location with same name+address (auto-merge)
  const existing = await findDuplicateLocation(name, place.address);
  if (existing) {
    log.info('Promote: auto-merging with existing location', { existingId: existing.location_id, name });
    // Just link matching entries to the existing location
    await linkMatchingEntries(existing.location_id, place);
    return existing;
  }

  // Create new location
  const savedLocation = await createLocation({
    name,
    latitude: place.avg_latitude,
    longitude: place.avg_longitude,
    source: 'promoted',
    address: place.address,
    city: place.city,
    region: place.region,
    country: place.country,
  });

  // Link matching entries
  await linkMatchingEntries(savedLocation.location_id, place);

  return savedLocation;
}

/**
 * Update place data on all entries matching a place group (for unlinked entries).
 * Used when editing entry-derived places that aren't in the locations table.
 */
export async function updateEntryPlaceData(
  match: { place_name: string | null; address: string | null; city: string | null; region: string | null; country: string | null },
  updates: { name: string; address: string | null }
): Promise<number> {
  log.info('Updating entry place data', { oldName: match.place_name, newName: updates.name });

  try {
    await localDB.execSQL('BEGIN');

    await localDB.runCustomQuery(
      `UPDATE entries SET
         place_name = ?,
         address = ?,
         synced = 0,
         sync_action = CASE WHEN sync_action = 'create' THEN 'create' ELSE 'update' END
       WHERE deleted_at IS NULL
         AND COALESCE(place_name, '') = ?
         AND COALESCE(address, '') = ?
         AND COALESCE(city, '') = ?
         AND COALESCE(region, '') = ?
         AND COALESCE(country, '') = ?`,
      [
        updates.name,
        updates.address,
        match.place_name || '',
        match.address || '',
        match.city || '',
        match.region || '',
        match.country || '',
      ]
    );

    const countResult = await localDB.runCustomQuery('SELECT changes() as count');
    const count = countResult[0]?.count ?? 0;

    await localDB.execSQL('COMMIT');

    if (count > 0) triggerPushSync();
    log.info('Updated entry place data', { entriesUpdated: count });
    return count;
  } catch (error) {
    await localDB.execSQL('ROLLBACK');
    throw error;
  }
}

/**
 * Link entries matching a place group to a location_id.
 * Matches on place_name + address (using COALESCE for nulls).
 */
async function linkMatchingEntries(
  locationId: string,
  place: { place_name: string | null; address: string | null; city: string | null; region: string | null; country: string | null }
): Promise<number> {
  try {
    await localDB.execSQL('BEGIN');

    await localDB.runCustomQuery(
      `UPDATE entries SET
         location_id = ?,
         geocode_status = 'snapped',
         synced = 0,
         sync_action = CASE WHEN sync_action = 'create' THEN 'create' ELSE 'update' END
       WHERE deleted_at IS NULL
         AND COALESCE(place_name, '') = ?
         AND COALESCE(address, '') = ?
         AND COALESCE(city, '') = ?
         AND COALESCE(region, '') = ?
         AND COALESCE(country, '') = ?`,
      [
        locationId,
        place.place_name || '',
        place.address || '',
        place.city || '',
        place.region || '',
        place.country || '',
      ]
    );

    const countResult = await localDB.runCustomQuery('SELECT changes() as count');
    const count = countResult[0]?.count ?? 0;

    await localDB.execSQL('COMMIT');

    if (count > 0) triggerPushSync();
    log.info('Linked entries to promoted location', { locationId, entriesLinked: count });
    return count;
  } catch (error) {
    await localDB.execSQL('ROLLBACK');
    throw error;
  }
}

/**
 * Merge unlinked entry group into an existing saved location.
 * Sets location_id AND copies all address fields from the saved location to entries.
 */
export async function mergeEntriesToLocation(
  locationId: string,
  placeMatch: { place_name: string | null; address: string | null; city: string | null; region: string | null; country: string | null }
): Promise<number> {
  const location = await localDB.getLocation(locationId);
  if (!location) {
    log.error('mergeEntriesToLocation: location not found', null, { locationId });
    return 0;
  }

  log.info('Merging entries to saved location', {
    locationId,
    locationName: location.name,
    matchName: placeMatch.place_name,
  });

  await localDB.runCustomQuery(
    `UPDATE entries SET
       location_id = ?,
       place_name = ?,
       address = ?,
       neighborhood = ?,
       postal_code = ?,
       city = ?,
       subdivision = ?,
       region = ?,
       country = ?,
       geocode_status = 'snapped',
       synced = 0,
       sync_action = CASE WHEN sync_action = 'create' THEN 'create' ELSE 'update' END,
       updated_at = ?
     WHERE deleted_at IS NULL
       AND location_id IS NULL
       AND COALESCE(place_name, '') = ?
       AND COALESCE(address, '') = ?
       AND COALESCE(city, '') = ?
       AND COALESCE(region, '') = ?
       AND COALESCE(country, '') = ?`,
    [
      locationId,
      location.name,
      location.address,
      location.neighborhood,
      location.postal_code,
      location.city,
      location.subdivision,
      location.region,
      location.country,
      new Date().toISOString(),
      placeMatch.place_name || '',
      placeMatch.address || '',
      placeMatch.city || '',
      placeMatch.region || '',
      placeMatch.country || '',
    ]
  );

  const countResult = await localDB.runCustomQuery('SELECT changes() as count');
  const count = countResult[0]?.count ?? 0;

  if (count > 0) triggerPushSync();
  log.info('Merged entries to location', { locationId, entriesMerged: count });
  return count;
}

/**
 * Merge two saved locations (My Places). Moves all entries from the loser
 * to the winner and soft-deletes the loser location.
 * The caller decides which is the winner (user picks the name they want to keep).
 */
export async function mergeTwoSavedLocations(
  winnerId: string,
  loserId: string,
): Promise<number> {
  const winner = await localDB.getLocation(winnerId);
  const loser = await localDB.getLocation(loserId);
  if (!winner || !loser) {
    log.error('mergeTwoSavedLocations: location not found', null, { winnerId, loserId });
    return 0;
  }

  log.info('Merging saved locations', {
    winnerId,
    winnerName: winner.name,
    loserId,
    loserName: loser.name,
  });

  try {
    await localDB.execSQL('BEGIN');

    // Move all entries from loser to winner, update address fields to match winner
    await localDB.runCustomQuery(
      `UPDATE entries SET
         location_id = ?,
         place_name = ?,
         address = ?,
         neighborhood = ?,
         postal_code = ?,
         city = ?,
         subdivision = ?,
         region = ?,
         country = ?,
         synced = 0,
         sync_action = CASE WHEN sync_action = 'create' THEN 'create' ELSE 'update' END,
         updated_at = ?
       WHERE location_id = ? AND deleted_at IS NULL`,
      [
        winnerId,
        winner.name,
        winner.address,
        winner.neighborhood,
        winner.postal_code,
        winner.city,
        winner.subdivision,
        winner.region,
        winner.country,
        new Date().toISOString(),
        loserId,
      ]
    );

    const countResult = await localDB.runCustomQuery('SELECT changes() as count');
    const count = countResult[0]?.count ?? 0;

    // Soft-delete the loser location
    await localDB.runCustomQuery(
      `UPDATE locations SET deleted_at = ?, synced = 0, sync_action = 'delete' WHERE location_id = ?`,
      [new Date().toISOString(), loserId]
    );

    await localDB.execSQL('COMMIT');

    if (count > 0) triggerPushSync();
    log.info('Merged saved locations', { winnerId, loserId, entriesMoved: count });
    return count;
  } catch (error) {
    await localDB.execSQL('ROLLBACK');
    throw error;
  }
}

/**
 * Dismiss a merge suggestion between two saved locations.
 * Adds each location's ID to the other's merge_ignore_ids list (bidirectional).
 */
export async function dismissMergeSuggestion(
  locationIdA: string,
  locationIdB: string,
): Promise<void> {
  const addToIgnoreList = async (locationId: string, ignoreId: string) => {
    const loc = await localDB.getLocation(locationId);
    if (!loc) return;

    let ignoreIds: string[] = [];
    if (loc.merge_ignore_ids) {
      try {
        const parsed = JSON.parse(loc.merge_ignore_ids);
        if (Array.isArray(parsed)) ignoreIds = parsed;
      } catch { /* ignore parse errors */ }
    }

    if (ignoreIds.includes(ignoreId)) return; // already dismissed
    ignoreIds.push(ignoreId);

    await localDB.runCustomQuery(
      `UPDATE locations SET merge_ignore_ids = ?, synced = 0,
         sync_action = CASE WHEN sync_action = 'create' THEN 'create' ELSE 'update' END,
         updated_at = ?
       WHERE location_id = ?`,
      [JSON.stringify(ignoreIds), new Date().toISOString(), locationId]
    );
  };

  await addToIgnoreList(locationIdA, locationIdB);
  await addToIgnoreList(locationIdB, locationIdA);

  triggerPushSync();
  log.info('Dismissed merge suggestion', { locationIdA, locationIdB });
}

// ============================================================================
// CLEANUP OPERATIONS — Location Management
// ============================================================================

export interface CleanupResult {
  processed: number;
  errors: number;
  details?: string;
}

/**
 * Merge duplicate locations (same name + address)
 * Keeps the location with most entries, moves entries from losers to winner, deletes losers.
 */
export async function mergeDuplicateLocations(): Promise<CleanupResult> {
  log.info('Starting duplicate location merge');
  let totalMerged = 0;
  let totalErrors = 0;

  // Keep merging until no more duplicates found
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const duplicates = await localDB.runCustomQuery(`
      SELECT LOWER(name) as name_lower, LOWER(COALESCE(address, '')) as address_lower, COUNT(*) as count
      FROM locations
      WHERE deleted_at IS NULL
      GROUP BY LOWER(name), LOWER(COALESCE(address, ''))
      HAVING COUNT(*) > 1
      LIMIT 1
    `);

    if (duplicates.length === 0) break;

    const dup = duplicates[0];
    try {
      const matchingLocations = await localDB.runCustomQuery(
        `SELECT l.location_id, l.name, l.address,
          (SELECT COUNT(*) FROM entries e WHERE e.location_id = l.location_id AND e.deleted_at IS NULL) as entry_count
        FROM locations l
        WHERE LOWER(l.name) = ? AND LOWER(COALESCE(l.address, '')) = ? AND l.deleted_at IS NULL
        ORDER BY entry_count DESC`,
        [dup.name_lower, dup.address_lower]
      );

      if (matchingLocations.length < 2) break;

      const winner = matchingLocations[0];
      const losers = matchingLocations.slice(1);

      try {
        await localDB.execSQL('BEGIN');
        for (const loser of losers) {
          await localDB.runCustomQuery(
            `UPDATE entries SET location_id = ?, synced = 0,
               sync_action = CASE WHEN sync_action = 'create' THEN 'create' ELSE 'update' END
             WHERE location_id = ? AND deleted_at IS NULL`,
            [winner.location_id, loser.location_id]
          );
          await localDB.runCustomQuery(
            `UPDATE locations SET deleted_at = ?, synced = 0, sync_action = 'delete' WHERE location_id = ?`,
            [new Date().toISOString(), loser.location_id]
          );
        }
        await localDB.execSQL('COMMIT');
      } catch (txErr) {
        await localDB.execSQL('ROLLBACK');
        throw txErr;
      }
      totalMerged += losers.length;
    } catch (err) {
      log.error('Failed to merge duplicate', err);
      totalErrors++;
      break;
    }
  }

  if (totalMerged > 0) triggerPushSync();
  log.info('Duplicate merge complete', { merged: totalMerged, errors: totalErrors });
  return { processed: totalMerged, errors: totalErrors };
}

/**
 * Enrich locations with missing hierarchy data via Mapbox reverse geocoding
 * Fills in NULL city/region/country fields.
 */
export async function enrichLocationHierarchy(
  onProgress?: (current: number, total: number) => void
): Promise<CleanupResult> {
  log.info('Starting location hierarchy enrichment');

  const locationsToEnrich = await localDB.runCustomQuery(`
    SELECT location_id, name, latitude, longitude
    FROM locations
    WHERE deleted_at IS NULL
      AND (neighborhood IS NULL OR postal_code IS NULL OR city IS NULL
           OR subdivision IS NULL OR region IS NULL OR country IS NULL)
  `);

  if (locationsToEnrich.length === 0) {
    return { processed: 0, errors: 0 };
  }

  let enrichedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < locationsToEnrich.length; i++) {
    const loc = locationsToEnrich[i];
    onProgress?.(i + 1, locationsToEnrich.length);

    try {
      const response = await reverseGeocode({ latitude: loc.latitude, longitude: loc.longitude });
      const hierarchy = parseMapboxHierarchy(response);

      await localDB.runCustomQuery(
        `UPDATE locations SET
          neighborhood = COALESCE(neighborhood, ?),
          postal_code = COALESCE(postal_code, ?),
          city = COALESCE(city, ?),
          subdivision = COALESCE(subdivision, ?),
          region = COALESCE(region, ?),
          country = COALESCE(country, ?),
          synced = 0,
          sync_action = CASE WHEN sync_action = 'create' THEN 'create' ELSE 'update' END,
          updated_at = ?
        WHERE location_id = ?`,
        [
          hierarchy.neighborhood || null,
          hierarchy.postcode || null,
          hierarchy.place || null,
          hierarchy.district || null,
          hierarchy.region || null,
          hierarchy.country || null,
          new Date().toISOString(),
          loc.location_id,
        ]
      );
      enrichedCount++;

      // Rate limiting
      if (i < locationsToEnrich.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (err) {
      log.error('Failed to enrich location', err, { locationName: loc.name });
      errorCount++;
    }
  }

  if (enrichedCount > 0) triggerPushSync();
  log.info('Enrichment complete', { enriched: enrichedCount, errors: errorCount });
  return { processed: enrichedCount, errors: errorCount };
}

/**
 * Enrich a single location's hierarchy data via Mapbox reverse geocoding
 */
export async function enrichSingleLocation(locationId: string): Promise<boolean> {
  const loc = await localDB.getLocation(locationId);
  if (!loc) return false;

  try {
    const response = await reverseGeocode({ latitude: loc.latitude, longitude: loc.longitude });
    const hierarchy = parseMapboxHierarchy(response);

    await localDB.runCustomQuery(
      `UPDATE locations SET
        neighborhood = COALESCE(neighborhood, ?),
        postal_code = COALESCE(postal_code, ?),
        city = COALESCE(city, ?),
        subdivision = COALESCE(subdivision, ?),
        region = COALESCE(region, ?),
        country = COALESCE(country, ?),
        synced = 0,
        sync_action = CASE WHEN sync_action = 'create' THEN 'create' ELSE 'update' END,
        updated_at = ?
      WHERE location_id = ?`,
      [
        hierarchy.neighborhood || null,
        hierarchy.postcode || null,
        hierarchy.place || null,
        hierarchy.district || null,
        hierarchy.region || null,
        hierarchy.country || null,
        new Date().toISOString(),
        locationId,
      ]
    );
    triggerPushSync();
    return true;
  } catch (err) {
    log.error('Failed to enrich single location', err, { locationId });
    return false;
  }
}

/**
 * Snap unlinked entries to saved locations (within 30m) or geocode via Mapbox
 */
/**
 * Snap unlinked entries to nearby saved locations (within 30m).
 * Local-only — no API calls. Links entry to the saved location by setting
 * location_id and copying its address fields.
 */
export async function snapEntriesToLocations(
  onProgress?: (current: number, total: number) => void
): Promise<{ snapped: number; errors: number }> {
  log.info('Starting entry snap');

  const SNAP_THRESHOLD_METERS = 30;

  // Entries without a location_id that have GPS
  const entriesToProcess = await localDB.runCustomQuery(`
    SELECT entry_id, entry_latitude, entry_longitude
    FROM entries
    WHERE deleted_at IS NULL
      AND entry_latitude IS NOT NULL
      AND entry_longitude IS NOT NULL
      AND location_id IS NULL
  `);

  if (entriesToProcess.length === 0) {
    return { snapped: 0, errors: 0 };
  }

  const allLocations = await localDB.getAllLocations();
  let snappedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < entriesToProcess.length; i++) {
    const entry = entriesToProcess[i];
    onProgress?.(i + 1, entriesToProcess.length);

    try {
      const snapResult = findNearbyLocation(
        { latitude: entry.entry_latitude, longitude: entry.entry_longitude },
        allLocations,
        SNAP_THRESHOLD_METERS
      );

      if (snapResult.location) {
        await localDB.runCustomQuery(
          `UPDATE entries SET
            location_id = ?, place_name = ?, address = ?,
            neighborhood = ?, postal_code = ?, city = ?,
            subdivision = ?, region = ?, country = ?,
            geocode_status = 'snapped', synced = 0,
            sync_action = CASE WHEN sync_action = 'create' THEN 'create' ELSE 'update' END,
            updated_at = ?
          WHERE entry_id = ?`,
          [
            snapResult.location.location_id,
            snapResult.location.name,
            snapResult.location.address,
            snapResult.location.neighborhood,
            snapResult.location.postal_code,
            snapResult.location.city,
            snapResult.location.subdivision,
            snapResult.location.region,
            snapResult.location.country,
            new Date().toISOString(),
            entry.entry_id,
          ]
        );
        snappedCount++;
      }
    } catch (err) {
      log.error('Failed to snap entry', err, { entryId: entry.entry_id });
      errorCount++;
    }
  }

  if (snappedCount > 0) triggerPushSync();
  log.info('Snap complete', { snapped: snappedCount, errors: errorCount });
  return { snapped: snappedCount, errors: errorCount };
}

/**
 * Geocode entries that have GPS but no address data.
 * Calls Mapbox reverse geocode API to resolve address/city/region/country.
 */
export async function geocodeEntries(
  onProgress?: (current: number, total: number) => void
): Promise<{ geocoded: number; noData: number; errors: number }> {
  log.info('Starting entry geocode');

  const entriesToProcess = await localDB.runCustomQuery(`
    SELECT entry_id, entry_latitude, entry_longitude
    FROM entries
    WHERE deleted_at IS NULL
      AND entry_latitude IS NOT NULL
      AND entry_longitude IS NOT NULL
      AND (geocode_status IS NULL OR geocode_status = 'error')
  `);

  if (entriesToProcess.length === 0) {
    return { geocoded: 0, noData: 0, errors: 0 };
  }

  let geocodedCount = 0;
  let noDataCount = 0;
  let errorCount = 0;

  for (let i = 0; i < entriesToProcess.length; i++) {
    const entry = entriesToProcess[i];
    onProgress?.(i + 1, entriesToProcess.length);

    try {
      const response = await reverseGeocode({
        latitude: entry.entry_latitude,
        longitude: entry.entry_longitude,
      });
      const fields = geocodeResponseToEntryFields(response);

      await localDB.runCustomQuery(
        `UPDATE entries SET
          address = ?, neighborhood = ?, postal_code = ?,
          city = ?, subdivision = ?, region = ?, country = ?,
          geocode_status = ?, synced = 0,
          sync_action = CASE WHEN sync_action = 'create' THEN 'create' ELSE 'update' END,
          updated_at = ?
        WHERE entry_id = ?`,
        [
          fields.address, fields.neighborhood, fields.postal_code,
          fields.city, fields.subdivision, fields.region, fields.country,
          fields.geocode_status,
          new Date().toISOString(),
          entry.entry_id,
        ]
      );

      if (fields.geocode_status === 'success') {
        geocodedCount++;
      } else {
        noDataCount++;
      }

      // Rate limiting for API calls
      if (i < entriesToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (err) {
      log.error('Failed to geocode entry', err, { entryId: entry.entry_id });
      errorCount++;
    }
  }

  if (geocodedCount > 0) triggerPushSync();
  log.info('Geocode complete', { geocoded: geocodedCount, noData: noDataCount, errors: errorCount });
  return { geocoded: geocodedCount, noData: noDataCount, errors: errorCount };
}

/**
 * Delete locations that are not referenced by any entry
 */
export async function deleteUnusedLocations(): Promise<CleanupResult> {
  log.info('Deleting unused locations');

  const unusedLocations = await localDB.runCustomQuery(`
    SELECT l.location_id, l.name
    FROM locations l
    LEFT JOIN entries e ON l.location_id = e.location_id AND e.deleted_at IS NULL
    WHERE l.deleted_at IS NULL AND e.entry_id IS NULL
  `);

  if (unusedLocations.length === 0) {
    return { processed: 0, errors: 0 };
  }

  let deletedCount = 0;
  let errorCount = 0;

  for (const loc of unusedLocations) {
    try {
      await localDB.runCustomQuery(
        `UPDATE locations SET deleted_at = ?, synced = 0, sync_action = 'delete' WHERE location_id = ?`,
        [new Date().toISOString(), loc.location_id]
      );
      deletedCount++;
    } catch (err) {
      log.error('Failed to delete unused location', err, { locationId: loc.location_id });
      errorCount++;
    }
  }

  if (deletedCount > 0) triggerPushSync();
  log.info('Unused location cleanup complete', { deleted: deletedCount, errors: errorCount });
  return { processed: deletedCount, errors: errorCount };
}
