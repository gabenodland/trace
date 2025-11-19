/**
 * Location Types
 *
 * Type definitions for location/mapping features including geocoding,
 * POI discovery, and privacy controls.
 */

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

/**
 * Source of the location name
 */
export type LocationNameSource =
  | 'mapbox_poi'      // POI from Mapbox reverse geocoding
  | 'foursquare_poi'  // POI from Foursquare nearby/autocomplete
  | 'google_poi'      // POI from Google Maps marker tap
  | 'user_custom';    // User-typed custom name

/**
 * Privacy precision levels for location sharing
 * From most precise to least precise
 */
export type LocationPrecision =
  | 'coords'         // Exact coordinates (lat/lng)
  | 'poi'            // Point of interest (specific place)
  | 'address'        // Street address level
  | 'neighborhood'   // Neighborhood level
  | 'city'           // City level
  | 'region'         // State/province level
  | 'country';       // Country level

// ============================================================================
// MAPBOX API TYPES
// ============================================================================

/**
 * Mapbox Geocoding Feature (simplified)
 * Full response at: https://docs.mapbox.com/api/search/geocoding/
 */
export interface MapboxFeature {
  id: string;                    // Mapbox place ID
  type: 'Feature';
  place_type: string[];          // ['poi', 'address', 'place', etc.]
  text: string;                  // Place name
  place_name: string;            // Full formatted address
  center: [number, number];      // [longitude, latitude]
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    category?: string;
  };
  context?: Array<{
    id: string;
    text: string;
    short_code?: string;
    center?: [number, number];  // [longitude, latitude] - center of this context item
  }>;
}

/**
 * Mapbox Reverse Geocoding Response
 */
export interface MapboxReverseGeocodeResponse {
  type: 'FeatureCollection';
  features: MapboxFeature[];
  query: [number, number];      // [longitude, latitude]
}

/**
 * Parsed location hierarchy from Mapbox response
 */
export interface MapboxLocationHierarchy {
  poi?: string;                  // POI name if available
  address?: string;              // Street address
  neighborhood?: string;
  postcode?: string;
  place?: string;                // City
  district?: string;             // County/subdivision
  region?: string;               // State/province
  country?: string;
}

// ============================================================================
// FOURSQUARE API TYPES
// ============================================================================

/**
 * Foursquare Place (simplified)
 * Full response at: https://location.foursquare.com/developer/reference/place-search
 */
export interface FoursquarePlace {
  fsq_id?: string;               // Foursquare unique ID (optional in some responses)
  fsq_place_id?: string;         // Alternative ID field name
  name: string;                  // Place name
  latitude: number;              // Latitude (directly on object)
  longitude: number;             // Longitude (directly on object)
  location: {
    address?: string;
    locality?: string;           // City
    region?: string;             // State/province
    postcode?: string;
    country?: string;
    formatted_address?: string;
  };
  categories: Array<{
    id?: number;
    fsq_category_id?: string;    // Foursquare category ID
    name: string;
    short_name?: string;
    plural_name?: string;
    icon?: {
      prefix: string;
      suffix: string;
    };
  }>;
  distance?: number;             // Distance from search point (meters)
}

/**
 * Foursquare Nearby Search Response
 */
export interface FoursquareNearbyResponse {
  results: FoursquarePlace[];
  context?: {
    geo_bounds?: {
      circle: {
        center: {
          latitude: number;
          longitude: number;
        };
        radius: number;
      };
    };
  };
}

/**
 * Foursquare Autocomplete Response
 */
export interface FoursquareAutocompleteResponse {
  results: FoursquarePlace[];
}

// ============================================================================
// APP LOCATION TYPES
// ============================================================================

/**
 * Complete location data structure
 * Maps to entries table location fields
 */
export interface LocationData {
  // GPS coordinates (private, exact, never changes)
  gpsLatitude: number | null;
  gpsLongitude: number | null;

  // Display coordinates (public, respects privacy level)
  latitude: number | null;
  longitude: number | null;

  // Location name
  name: string | null;                      // Current display name (user-editable)
  nameOriginal: string | null;              // Original from API (readonly, for matching)
  nameSource: LocationNameSource | null;    // Source of the name

  // Location hierarchy (API-only, never user-typed)
  neighborhood: string | null;
  postalCode: string | null;
  city: string | null;
  subdivision: string | null;               // County
  region: string | null;                    // State/province
  country: string | null;

  // Privacy and metadata
  precision: LocationPrecision | null;      // Selected privacy level

  // API identifiers (for deduplication)
  mapboxPlaceId: string | null;
  foursquareFsqId: string | null;

  // Full API response (for future features)
  mapboxJson: MapboxReverseGeocodeResponse | null;
}

/**
 * Simplified Location object for component communication
 * This is the canonical type passed between LocationPicker and CaptureForm
 */
export interface Location {
  // Display coordinates (respecting privacy level)
  latitude: number;
  longitude: number;

  // Original GPS coordinates (exact reading, for entry_latitude/entry_longitude)
  originalLatitude?: number;
  originalLongitude?: number;
  accuracy?: number | null;

  // Basic info (required)
  name: string | null;
  source: LocationNameSource;

  // Location hierarchy (optional, from Mapbox/Foursquare)
  address?: string | null;
  category?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
  city?: string | null;
  subdivision?: string | null;
  region?: string | null;
  country?: string | null;

  // Privacy level selected by user
  privacyLevel?: 'exact' | 'address' | 'postal_code' | 'neighborhood' | 'city' | 'subdivision' | 'region' | 'country';

  // Metadata
  distance?: number;

  // Full Mapbox response (temporary, for privacy level selection)
  mapboxJson?: MapboxReverseGeocodeResponse | null;
}

/**
 * Location capture from GPS
 */
export interface LocationCapture {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
}

/**
 * Location suggestion from snapping query
 */
export interface LocationSuggestion {
  name: string;
  nameOriginal: string | null;
  city: string | null;
  usageCount: number;
  foursquareFsqId: string | null;
  distance?: number;                        // Distance from current GPS (meters)
}

/**
 * POI for display in picker
 */
export interface POIItem {
  id: string;                               // fsq_id or mapbox place_id
  source: 'foursquare' | 'mapbox' | 'google';
  name: string;
  address?: string;
  category?: string;
  distance?: number;                        // Distance from search point (meters)
  latitude: number;
  longitude: number;
  // Location hierarchy (from API response)
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  neighborhood?: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request for reverse geocoding (GPS → address)
 */
export interface ReverseGeocodeRequest {
  latitude: number;
  longitude: number;
}

/**
 * Request for nearby POI search
 */
export interface NearbyPOIRequest {
  latitude: number;
  longitude: number;
  radius?: number;                          // Search radius in meters (default 500)
  limit?: number;                           // Max results (default 20)
}

/**
 * Request for location autocomplete/search
 */
export interface LocationAutocompleteRequest {
  query: string;
  latitude?: number;                        // For proximity bias
  longitude?: number;
  limit?: number;                           // Max results (default 10)
}

/**
 * Generic API error
 */
export interface LocationAPIError {
  code: string;
  message: string;
  details?: any;
}

// ============================================================================
// CACHE TYPES
// ============================================================================

/**
 * Cache entry for geocoding results
 */
export interface GeocodeCache {
  key: string;                              // lat,lng rounded to 5 decimals
  response: MapboxReverseGeocodeResponse;
  timestamp: number;
  expiresAt: number;
}

/**
 * Cache entry for Foursquare POI results
 */
export interface POICache {
  key: string;                              // lat,lng,radius
  response: FoursquareNearbyResponse;
  timestamp: number;
  expiresAt: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Coordinates object
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Bounding box
 */
export interface BoundingBox {
  northEast: Coordinates;
  southWest: Coordinates;
}

/**
 * Distance calculation result
 */
export interface DistanceResult {
  meters: number;
  kilometers: number;
  miles: number;
}

// ============================================================================
// LOCATION HELPER FUNCTIONS
// ============================================================================

/**
 * Create an empty location object
 */
export function createEmptyLocation(): Location {
  return {
    latitude: 0,
    longitude: 0,
    name: null,
    source: 'user_custom',
  };
}

/**
 * Convert Entry database fields to Location object
 * Prioritizes location_latitude/longitude (tagged location) over entry_latitude/longitude (GPS capture)
 */
export function locationFromEntry(entry: {
  entry_latitude?: number | null;
  entry_longitude?: number | null;
  location_latitude?: number | null;
  location_longitude?: number | null;
  location_accuracy?: number | null;
  location_name?: string | null;
  location_name_source?: string | null;
  location_address?: string | null;
  location_neighborhood?: string | null;
  location_postal_code?: string | null;
  location_city?: string | null;
  location_subdivision?: string | null;
  location_region?: string | null;
  location_country?: string | null;
}): Location | null {
  // Check if location data exists - prioritize tagged location, fallback to GPS
  const hasLocation = (entry.location_latitude && entry.location_longitude) ||
                      (entry.entry_latitude && entry.entry_longitude);

  if (!hasLocation) return null;

  // Use location_latitude/longitude (tagged location) if set, otherwise fallback to entry GPS
  const displayLat = entry.location_latitude ?? entry.entry_latitude!;
  const displayLon = entry.location_longitude ?? entry.entry_longitude!;

  return {
    // Display coordinates (tagged location respecting privacy, or GPS if not tagged)
    latitude: displayLat,
    longitude: displayLon,
    // Original GPS coordinates (for LocationPicker to know where entry was created)
    originalLatitude: entry.entry_latitude ?? undefined,
    originalLongitude: entry.entry_longitude ?? undefined,
    accuracy: entry.location_accuracy,
    name: entry.location_name || null,
    source: (entry.location_name_source as LocationNameSource) || 'user_custom',
    address: entry.location_address || null,
    neighborhood: entry.location_neighborhood || null,
    postalCode: entry.location_postal_code || null,
    city: entry.location_city || null,
    subdivision: entry.location_subdivision || null,
    region: entry.location_region || null,
    country: entry.location_country || null,
  };
}

/**
 * Convert Location object to Entry database fields
 * Returns object with entry_latitude/entry_longitude and location_* fields
 */
export function locationToEntryFields(location: Location | null) {
  if (!location) {
    return {
      entry_latitude: null,
      entry_longitude: null,
      location_latitude: null,
      location_longitude: null,
      location_accuracy: null,
      location_name: null,
      location_name_source: null,
      location_address: null,
      location_neighborhood: null,
      location_postal_code: null,
      location_city: null,
      location_subdivision: null,
      location_region: null,
      location_country: null,
    };
  }

  return {
    // GPS coordinates (where user was when creating entry - original exact coordinates)
    entry_latitude: location.originalLatitude ?? location.latitude,
    entry_longitude: location.originalLongitude ?? location.longitude,
    // Tagged location coordinates (respecting privacy level)
    location_latitude: location.latitude,
    location_longitude: location.longitude,
    location_accuracy: location.accuracy,
    location_name: location.name,
    location_name_source: location.source,
    location_address: location.address,
    location_neighborhood: location.neighborhood,
    location_postal_code: location.postalCode,
    location_city: location.city,
    location_subdivision: location.subdivision,
    location_region: location.region,
    location_country: location.country,
  };
}
