/**
 * Entry Location Helpers
 *
 * Pure utility functions for converting between entry location fields
 * and Location objects used by LocationPicker and save logic.
 */

import type { Location } from '@trace/core';
import type { EntryWithRelations } from '../../EntryWithRelationsTypes';

/**
 * Build a Location object from entry GPS/location fields.
 *
 * Used by:
 * - LocationPicker to display current location
 * - Save logic to pass to location helpers
 *
 * @param entry - Entry with location fields (entry_latitude, entry_longitude, etc.)
 * @returns Location object or null if no coordinates
 */
export function buildLocationFromEntry(entry: EntryWithRelations | null): Location | null {
  if (!entry?.entry_latitude || !entry?.entry_longitude) return null;

  return {
    latitude: entry.entry_latitude,
    longitude: entry.entry_longitude,
    location_id: entry.location_id ?? undefined,
    name: entry.place_name ?? null,
    source: 'user_custom',
    address: entry.address ?? undefined,
    neighborhood: entry.neighborhood ?? undefined,
    postalCode: entry.postal_code ?? undefined,
    city: entry.city ?? undefined,
    subdivision: entry.subdivision ?? undefined,
    region: entry.region ?? undefined,
    country: entry.country ?? undefined,
  };
}
