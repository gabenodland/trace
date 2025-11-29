/**
 * LocationPicker Internal Types
 *
 * Clean separation between:
 * - Selection state (what user has chosen)
 * - UI state (tabs, loading)
 * - API state (managed by React Query hooks)
 */

import type { Location, POIItem } from '@trace/core';

/**
 * LocationPicker operating modes:
 * - 'select': Interactive - browse nearby/search, click map/POI to move marker
 * - 'create': Marker locked - enter name, OK/Select New/Remove buttons
 * - 'view': Read-only - only Select New/Remove buttons shown
 */
export type LocationPickerMode = 'select' | 'create' | 'view';

/**
 * Single source of truth for the current location selection
 */
export interface LocationSelection {
  // Core selection data
  type: 'none' | 'poi' | 'map_tap' | 'existing';
  location: Location | null;

  // Temporary data while loading
  tempCoordinates?: { latitude: number; longitude: number } | null;
  isLoadingDetails: boolean;

  // Optional: reuse existing location_id when selecting from saved locations
  locationId?: string;
}

/**
 * UI state (separate from selection)
 */
export interface LocationPickerUI {
  showingDetails: boolean; // true = showing location info, false = showing POI list
  searchQuery: string;
  editableNameInput: string;
  quickSelectMode?: boolean; // true = auto-complete after enrichment (from Select button)
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
  };
}
