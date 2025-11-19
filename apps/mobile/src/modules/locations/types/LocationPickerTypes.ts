/**
 * LocationPicker Internal Types
 *
 * Clean separation between:
 * - Selection state (what user has chosen)
 * - UI state (tabs, loading)
 * - API state (managed by React Query hooks)
 */

import type { Location, POIItem, MapboxReverseGeocodeResponse } from '@trace/core';

/**
 * Privacy level options for location obfuscation
 */
export type PrivacyLevel =
  | 'exact'          // Exact coordinates
  | 'address'        // Street address level
  | 'postal_code'    // Postal code level
  | 'neighborhood'   // Neighborhood level
  | 'city'           // City level
  | 'subdivision'    // County/subdivision level
  | 'region'         // State/province level
  | 'country';       // Country level

/**
 * Coordinates for a specific privacy level
 */
export interface PrivacyLevelCoords {
  latitude: number;
  longitude: number;
  label: string; // Display name for this level
}

/**
 * Single source of truth for the current location selection
 */
export interface LocationSelection {
  // Core selection data
  type: 'none' | 'poi' | 'map_tap' | 'existing';
  location: Location | null;

  // Temporary data while loading
  tempCoordinates?: { latitude: number; longitude: number };
  isLoadingDetails: boolean;

  // Privacy/precision level (exact coordinates by default)
  privacyLevel: PrivacyLevel;
}

/**
 * UI state (separate from selection)
 */
export interface LocationPickerUI {
  showingDetails: boolean; // true = showing location info, false = showing POI list
  searchQuery: string;
  editableNameInput: string;
}

/**
 * Map state (separate from selection)
 */
export interface MapState {
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | undefined;
  markerPosition: {
    latitude: number;
    longitude: number;
  } | undefined;
}

/**
 * Helper to create an empty selection
 */
export function createEmptySelection(): LocationSelection {
  return {
    type: 'none',
    location: null,
    isLoadingDetails: false,
    privacyLevel: 'exact',
  };
}

/**
 * Helper to create selection from existing location
 */
export function createSelectionFromLocation(location: Location): LocationSelection {
  return {
    type: 'existing',
    location,
    isLoadingDetails: false,
    // Restore saved privacy level or default to exact
    privacyLevel: location.privacyLevel || 'exact',
  };
}

/**
 * Helper to create selection from POI
 */
export function createSelectionFromPOI(poi: POIItem): LocationSelection {
  return {
    type: 'poi',
    location: {
      latitude: poi.latitude,
      longitude: poi.longitude,
      name: poi.name,
      source: poi.source === 'foursquare' ? 'foursquare_poi' :
              poi.source === 'google' ? 'google_poi' : 'user_custom',
      address: poi.address || null,
      category: poi.category || null,
      city: poi.city || null,
      region: poi.region || null,
      country: poi.country || null,
      postalCode: poi.postalCode || null,
      neighborhood: poi.neighborhood || null,
      subdivision: poi.subdivision || null,
      distance: poi.distance,
    },
    isLoadingDetails: true, // Will be enriched with reverse geocoding
    privacyLevel: 'exact',
  };
}

/**
 * Helper to create selection from map tap
 */
export function createSelectionFromMapTap(
  latitude: number,
  longitude: number
): LocationSelection {
  return {
    type: 'map_tap',
    location: {
      latitude,
      longitude,
      name: null, // Will be filled by reverse geocoding
      source: 'user_custom',
    },
    tempCoordinates: { latitude, longitude },
    isLoadingDetails: true,
    privacyLevel: 'exact',
  };
}

/**
 * Extract coordinates for each privacy level from Mapbox response
 * Returns a map of privacy level → coordinates with center point
 *
 * Mapbox returns multiple features in the features array, each representing
 * a different geographic level (address, neighborhood, city, region, country).
 * Each feature has its own center coordinate and bbox.
 */
export function extractPrivacyLevelCoords(
  mapboxResponse: MapboxReverseGeocodeResponse | null | undefined,
  exactCoords: { latitude: number; longitude: number }
): Map<PrivacyLevel, PrivacyLevelCoords> {
  const coords = new Map<PrivacyLevel, PrivacyLevelCoords>();

  // Always have exact coordinates
  coords.set('exact', {
    latitude: exactCoords.latitude,
    longitude: exactCoords.longitude,
    label: `${exactCoords.latitude.toFixed(6)}, ${exactCoords.longitude.toFixed(6)}`,
  });

  if (!mapboxResponse || !mapboxResponse.features || mapboxResponse.features.length === 0) {
    return coords;
  }

  // Process each feature in the features array
  // Each feature represents a different geographic level with its own center
  mapboxResponse.features.forEach((feature) => {
    const type = feature.id.split('.')[0]; // e.g., "place.441272556" → "place"
    const center = feature.center; // [longitude, latitude]

    if (!center) return;

    const centerLat = center[1]; // Mapbox is [lon, lat]
    const centerLon = center[0];

    console.log(`[extractPrivacyLevelCoords] Feature ${type}: ${feature.text}`, {
      center,
      bbox: feature.bbox,
      coords: [centerLat, centerLon]
    });

    switch (type) {
      case 'address':
        coords.set('address', {
          latitude: centerLat,
          longitude: centerLon,
          label: feature.place_name || feature.text,
        });
        break;
      case 'postcode':
        coords.set('postal_code', {
          latitude: centerLat,
          longitude: centerLon,
          label: feature.text,
        });
        break;
      case 'neighborhood':
      case 'locality': // Sometimes used for neighborhood
        coords.set('neighborhood', {
          latitude: centerLat,
          longitude: centerLon,
          label: feature.text,
        });
        break;
      case 'place': // City
        coords.set('city', {
          latitude: centerLat,
          longitude: centerLon,
          label: feature.text,
        });
        break;
      case 'district': // County/subdivision
        coords.set('subdivision', {
          latitude: centerLat,
          longitude: centerLon,
          label: feature.text,
        });
        break;
      case 'region': // State/province
        coords.set('region', {
          latitude: centerLat,
          longitude: centerLon,
          label: feature.text,
        });
        break;
      case 'country':
        coords.set('country', {
          latitude: centerLat,
          longitude: centerLon,
          label: feature.text,
        });
        break;
    }
  });

  return coords;
}
