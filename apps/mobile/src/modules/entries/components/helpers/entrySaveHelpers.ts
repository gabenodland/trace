import { extractTagsAndMentions, locationToCreateInput, type Location as LocationType } from "@trace/core";
import { createLocation } from '../../../locations/mobileLocationApi';

/** Geocode status for tracking how location hierarchy data was obtained */
export type GeocodeStatus =
  | "pending"
  | "success"
  | "snapped"
  | "no_data"
  | "error"
  | "manual"
  | null;

/**
 * GPS fields for entry save operations
 */
export interface GpsFields {
  entry_latitude: number | null;
  entry_longitude: number | null;
  location_radius: number | null;
}

/**
 * Location hierarchy fields for entry save operations
 */
export interface LocationHierarchyFields {
  place_name: string | null;
  address: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  city: string | null;
  subdivision: string | null;
  region: string | null;
  country: string | null;
  geocode_status: GeocodeStatus | null;
}

/**
 * Build GPS fields from location data for entry save.
 * Extracts coordinates and privacy radius.
 */
export function buildGpsFields(locationData: LocationType | null): GpsFields {
  if (locationData) {
    return {
      entry_latitude: locationData.latitude,
      entry_longitude: locationData.longitude,
      location_radius: locationData.locationRadius ?? null,
    };
  }
  return {
    entry_latitude: null,
    entry_longitude: null,
    location_radius: null,
  };
}

/**
 * Build location hierarchy fields from location data for entry save.
 * These are copied directly to the entry (entry-owned data model).
 */
export function buildLocationHierarchyFields(
  locationData: LocationType | null,
  geocodeStatus: GeocodeStatus | null
): LocationHierarchyFields {
  if (locationData) {
    return {
      place_name: locationData.name || null,
      address: locationData.address || null,
      neighborhood: locationData.neighborhood || null,
      postal_code: locationData.postalCode || null,
      city: locationData.city || null,
      subdivision: locationData.subdivision || null,
      region: locationData.region || null,
      country: locationData.country || null,
      geocode_status: geocodeStatus,
    };
  }
  return {
    place_name: null,
    address: null,
    neighborhood: null,
    postal_code: null,
    city: null,
    subdivision: null,
    region: null,
    country: null,
    geocode_status: geocodeStatus,
  };
}

/**
 * Get or create a location ID from location data.
 * Reuses existing location_id if present, otherwise creates new location.
 *
 * @returns location_id or null if no named location
 */
export async function getOrCreateLocationId(
  locationData: LocationType | null
): Promise<string | null> {
  if (!locationData || !locationData.name) {
    return null;
  }

  // Check if this is a saved location (has existing location_id)
  if (locationData.location_id) {
    return locationData.location_id;
  }

  // Create a new location in the locations table
  const locationInput = locationToCreateInput(locationData);
  const savedLocation = await createLocation(locationInput);
  return savedLocation.location_id;
}

/**
 * Extract tags and mentions from content HTML.
 * Wrapper around core extractTagsAndMentions for consistency.
 */
export function extractContentMetadata(content: string): { tags: string[]; mentions: string[] } {
  return extractTagsAndMentions(content);
}

/**
 * Check if entry has user-provided content worth saving.
 * GPS and named location alone aren't enough - need title, text, or photos.
 */
export function hasUserContent(
  title: string,
  content: string,
  photoCount: number
): boolean {
  const textContent = content.replace(/<[^>]*>/g, '').trim();
  const hasTitle = title.trim().length > 0;
  const hasTextContent = textContent.length > 0;
  const hasPhotos = photoCount > 0;

  return hasTitle || hasTextContent || hasPhotos;
}
