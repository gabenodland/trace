import { extractTagsAndMentions, type Location as LocationType } from "@trace/core";

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
 * Extracts coordinates.
 */
export function buildGpsFields(locationData: LocationType | null): GpsFields {
  if (locationData) {
    return {
      entry_latitude: locationData.latitude,
      entry_longitude: locationData.longitude,
    };
  }
  return {
    entry_latitude: null,
    entry_longitude: null,
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
 * Get location ID from location data.
 * Returns existing location_id if the user chose "Save to My Places" in the
 * location picker (which creates the location record at picker-dismiss time).
 * Returns null otherwise — entry saves with denormalized fields only.
 */
export function getLocationId(
  locationData: LocationType | null
): string | null {
  return locationData?.location_id ?? null;
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
