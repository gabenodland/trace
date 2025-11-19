/**
 * Location Helpers - Pure utility functions for location operations
 *
 * All functions are pure (no side effects) and can be used anywhere.
 */

import type {
  Coordinates,
  DistanceResult,
  LocationPrecision,
  MapboxFeature,
  MapboxReverseGeocodeResponse,
  MapboxLocationHierarchy,
  FoursquarePlace,
  POIItem,
  LocationData,
} from './LocationTypes';

// ============================================================================
// DISTANCE CALCULATION
// ============================================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters, kilometers, and miles
 */
export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates
): DistanceResult {
  const R = 6371000; // Earth's radius in meters

  const lat1 = toRadians(coord1.latitude);
  const lat2 = toRadians(coord2.latitude);
  const deltaLat = toRadians(coord2.latitude - coord1.latitude);
  const deltaLng = toRadians(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const meters = R * c;

  return {
    meters,
    kilometers: meters / 1000,
    miles: meters / 1609.34,
  };
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  // Handle invalid inputs
  if (typeof meters !== 'number' || isNaN(meters) || meters < 0) {
    return '—';
  }

  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

// ============================================================================
// MAPBOX RESPONSE PARSING
// ============================================================================

/**
 * Parse location hierarchy from Mapbox reverse geocode response
 */
export function parseMapboxHierarchy(
  response: MapboxReverseGeocodeResponse
): MapboxLocationHierarchy {
  const hierarchy: MapboxLocationHierarchy = {};

  if (response.features.length === 0) {
    return hierarchy;
  }

  const feature = response.features[0];

  // Check if this is a POI
  if (feature.place_type.includes('poi')) {
    hierarchy.poi = feature.text;
  }

  // Check if this is an address
  if (feature.place_type.includes('address')) {
    hierarchy.address = feature.place_name.split(',')[0];
  }

  // Parse context for hierarchy
  if (feature.context) {
    for (const ctx of feature.context) {
      const [type] = ctx.id.split('.');

      switch (type) {
        case 'neighborhood':
          hierarchy.neighborhood = ctx.text;
          break;
        case 'postcode':
          hierarchy.postcode = ctx.text;
          break;
        case 'place':
          hierarchy.place = ctx.text;
          break;
        case 'district':
          hierarchy.district = ctx.text;
          break;
        case 'region':
          hierarchy.region = ctx.text;
          break;
        case 'country':
          hierarchy.country = ctx.text;
          break;
      }
    }
  }

  return hierarchy;
}

/**
 * Extract coordinates from Mapbox feature
 */
export function extractMapboxCoordinates(feature: MapboxFeature): Coordinates {
  const [longitude, latitude] = feature.center;
  return { latitude, longitude };
}

// ============================================================================
// FOURSQUARE RESPONSE PARSING
// ============================================================================

/**
 * Convert Foursquare place to POI item for display
 */
export function foursquareToPOI(place: FoursquarePlace): POIItem {
  try {
    console.log('[foursquareToPOI] Converting place:', place.name);

    // Use fsq_place_id or fsq_id (different responses use different field names)
    const id = place.fsq_place_id || place.fsq_id || place.name;
    const category = place.categories?.[0]?.name || 'Place';

    // Ensure address is a string or undefined (never an object)
    const formattedAddress = place.location?.formatted_address;
    const address = place.location?.address;
    const addressString = typeof formattedAddress === 'string' ? formattedAddress :
                          typeof address === 'string' ? address :
                          undefined;

    // Extract location hierarchy from Foursquare response
    const city = place.location?.locality || undefined;
    const region = place.location?.region || undefined;
    const country = place.location?.country || undefined;
    const postalCode = place.location?.postcode || undefined;

    const poi = {
      id,
      source: 'foursquare' as const,
      name: place.name,
      address: addressString,
      category,
      distance: place.distance,
      latitude: place.latitude,
      longitude: place.longitude,
      // Include location hierarchy from Foursquare
      city,
      region,
      country,
      postalCode,
    };

    console.log('[foursquareToPOI] ✅ Successfully converted to POI:', poi.name, 'with hierarchy:', { city, region, country, postalCode });
    return poi;
  } catch (error) {
    console.error('[foursquareToPOI] ❌ Error converting place:', place.name, error);
    throw error;
  }
}

/**
 * Convert Mapbox feature to POI item for display
 */
export function mapboxToPOI(feature: MapboxFeature): POIItem {
  return {
    id: feature.id,
    source: 'mapbox',
    name: feature.text,
    address: feature.place_name,
    category: feature.properties.category,
    latitude: feature.center[1],
    longitude: feature.center[0],
  };
}

// ============================================================================
// PRIVACY & PRECISION
// ============================================================================

/**
 * Adjust coordinates based on privacy precision level
 * Returns modified coordinates for public display
 */
export function adjustCoordinatesForPrecision(
  gpsCoords: Coordinates,
  _hierarchyData: MapboxLocationHierarchy,
  precision: LocationPrecision
): Coordinates | null {
  switch (precision) {
    case 'coords':
      // Return exact GPS coordinates
      return gpsCoords;

    case 'poi':
    case 'address':
    case 'neighborhood':
      // For these levels, we'd ideally return the POI/address/neighborhood center
      // For now, round coordinates to ~100m precision
      return {
        latitude: Math.round(gpsCoords.latitude * 1000) / 1000,
        longitude: Math.round(gpsCoords.longitude * 1000) / 1000,
      };

    case 'city':
      // City level - very approximate coordinates
      return {
        latitude: Math.round(gpsCoords.latitude * 10) / 10,
        longitude: Math.round(gpsCoords.longitude * 10) / 10,
      };

    case 'region':
      // Region level - even more approximate
      return {
        latitude: Math.round(gpsCoords.latitude * 5) / 5,
        longitude: Math.round(gpsCoords.longitude * 5) / 5,
      };

    case 'country':
      // Country level - no specific coordinates
      return null;

    default:
      return gpsCoords;
  }
}

/**
 * Get display text for location based on precision level
 */
export function getLocationDisplayText(
  locationData: LocationData
): string | null {
  if (!locationData.precision) {
    return locationData.name;
  }

  switch (locationData.precision) {
    case 'coords':
      return locationData.name || `${locationData.latitude?.toFixed(6)}, ${locationData.longitude?.toFixed(6)}`;

    case 'poi':
    case 'address':
      return locationData.name;

    case 'neighborhood':
      return locationData.neighborhood || locationData.city;

    case 'city':
      return locationData.city;

    case 'region':
      return locationData.region;

    case 'country':
      return locationData.country;

    default:
      return locationData.name;
  }
}

// ============================================================================
// LOCATION MATCHING & SNAPPING
// ============================================================================

/**
 * Check if two locations are the same place
 * Uses FSQ ID, Mapbox place ID, or distance + name matching
 */
export function isSameLocation(
  loc1: Partial<LocationData>,
  loc2: Partial<LocationData>
): boolean {
  // Check Foursquare ID match
  if (loc1.foursquareFsqId && loc2.foursquareFsqId) {
    return loc1.foursquareFsqId === loc2.foursquareFsqId;
  }

  // Check Mapbox place ID match
  if (loc1.mapboxPlaceId && loc2.mapboxPlaceId) {
    return loc1.mapboxPlaceId === loc2.mapboxPlaceId;
  }

  // Check distance + name match
  if (
    loc1.gpsLatitude && loc1.gpsLongitude &&
    loc2.gpsLatitude && loc2.gpsLongitude &&
    loc1.nameOriginal && loc2.nameOriginal
  ) {
    const distance = calculateDistance(
      { latitude: loc1.gpsLatitude, longitude: loc1.gpsLongitude },
      { latitude: loc2.gpsLatitude, longitude: loc2.gpsLongitude }
    );

    // Within 100 meters and same original name
    return distance.meters <= 100 && loc1.nameOriginal === loc2.nameOriginal;
  }

  return false;
}

/**
 * Round coordinates to specified decimal places
 */
export function roundCoordinates(coords: Coordinates, decimals: number): Coordinates {
  const factor = Math.pow(10, decimals);
  return {
    latitude: Math.round(coords.latitude * factor) / factor,
    longitude: Math.round(coords.longitude * factor) / factor,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate latitude value
 */
export function isValidLatitude(lat: number): boolean {
  return lat >= -90 && lat <= 90;
}

/**
 * Validate longitude value
 */
export function isValidLongitude(lng: number): boolean {
  return lng >= -180 && lng <= 180;
}

/**
 * Validate coordinates object
 */
export function isValidCoordinates(coords: Coordinates): boolean {
  return isValidLatitude(coords.latitude) && isValidLongitude(coords.longitude);
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format coordinates for display
 */
export function formatCoordinates(coords: Coordinates, decimals: number = 6): string {
  return `${coords.latitude.toFixed(decimals)}, ${coords.longitude.toFixed(decimals)}`;
}

/**
 * Format full address from location data
 */
export function formatFullAddress(locationData: LocationData): string {
  const parts: string[] = [];

  if (locationData.name) parts.push(locationData.name);
  if (locationData.neighborhood) parts.push(locationData.neighborhood);
  if (locationData.city) parts.push(locationData.city);
  if (locationData.region) parts.push(locationData.region);
  if (locationData.country) parts.push(locationData.country);

  return parts.join(', ');
}
