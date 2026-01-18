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
  bbox?: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
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
  // Quality fields for filtering low-quality POIs
  popularity?: number;           // 0-1 scale based on foot traffic
  rating?: number;               // 0-10 based on user votes
  verified?: boolean;            // Place claimed by owner
  price?: number;                // 1-4 price tier
  stats?: {
    total_photos?: number;
    total_ratings?: number;
    total_tips?: number;
  };
  chains?: Array<{
    id: string;
    name: string;
  }>;
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
  // Database ID (if this location was previously saved)
  location_id?: string;

  // Display coordinates (respecting privacy level)
  latitude: number;
  longitude: number;

  // Original GPS coordinates (exact reading, for entry_latitude/entry_longitude)
  originalLatitude?: number;
  originalLongitude?: number;
  // User-selected radius for location generalization (privacy feature)
  locationRadius?: number | null;

  // Basic info (required)
  name: string | null;
  source: LocationNameSource;

  // Location hierarchy - display fields (user-editable)
  address?: string | null;
  category?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
  city?: string | null;
  subdivision?: string | null;
  region?: string | null;
  country?: string | null;

  // Geo fields - immutable original data from reverse geocode (for filtering/sorting)
  geoAddress?: string | null;
  geoNeighborhood?: string | null;
  geoCity?: string | null;
  geoSubdivision?: string | null;
  geoRegion?: string | null;
  geoCountry?: string | null;
  geoPostalCode?: string | null;

  // Privacy level selected by user
  privacyLevel?: 'exact' | 'address' | 'postal_code' | 'neighborhood' | 'city' | 'subdivision' | 'region' | 'country';

  // Metadata
  distance?: number;

  // Full Mapbox response (temporary, for privacy level selection)
  mapboxJson?: MapboxReverseGeocodeResponse | null;
}

/**
 * Location entity stored in database (locations table)
 * This is the canonical storage format for locations
 */
export interface LocationEntity {
  location_id: string;
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
  source: string | null; // 'mapbox_poi', 'foursquare', 'user_custom', 'gps'
  // Display fields (user-editable)
  address: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  city: string | null;
  subdivision: string | null;
  region: string | null;
  country: string | null;
  // Geo fields - immutable original data from reverse geocode (for filtering/sorting)
  geo_address: string | null;
  geo_neighborhood: string | null;
  geo_city: string | null;
  geo_subdivision: string | null;
  geo_region: string | null;
  geo_country: string | null;
  geo_postal_code: string | null;
  // User-selected radius for location generalization (privacy feature)
  location_radius: number | null;
  mapbox_place_id: string | null;
  foursquare_fsq_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  // Sync tracking fields (mobile only)
  synced?: number;
  sync_action?: 'create' | 'update' | 'delete' | null;
}

/**
 * Input for creating a new location
 */
export interface CreateLocationInput {
  name: string;
  latitude: number;
  longitude: number;
  source?: string;
  // Display fields (user-editable)
  address?: string | null;
  neighborhood?: string | null;
  postal_code?: string | null;
  city?: string | null;
  subdivision?: string | null;
  region?: string | null;
  country?: string | null;
  // Geo fields - immutable original data from reverse geocode
  geo_address?: string | null;
  geo_neighborhood?: string | null;
  geo_city?: string | null;
  geo_subdivision?: string | null;
  geo_region?: string | null;
  geo_country?: string | null;
  geo_postal_code?: string | null;
  // User-selected radius for location generalization (privacy feature)
  location_radius?: number | null;
  mapbox_place_id?: string | null;
  foursquare_fsq_id?: string | null;
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
  subdivision?: string;
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
 * Convert LocationEntity (database) to Location object (component communication)
 */
export function locationFromEntity(entity: LocationEntity): Location {
  return {
    latitude: entity.latitude,
    longitude: entity.longitude,
    name: entity.name,
    source: (entity.source as LocationNameSource) || 'user_custom',
    address: entity.address || null,
    neighborhood: entity.neighborhood || null,
    postalCode: entity.postal_code || null,
    city: entity.city || null,
    subdivision: entity.subdivision || null,
    region: entity.region || null,
    country: entity.country || null,
    // Geo fields (immutable, from geocode)
    geoAddress: entity.geo_address || null,
    geoNeighborhood: entity.geo_neighborhood || null,
    geoCity: entity.geo_city || null,
    geoSubdivision: entity.geo_subdivision || null,
    geoRegion: entity.geo_region || null,
    geoCountry: entity.geo_country || null,
    geoPostalCode: entity.geo_postal_code || null,
  };
}

/**
 * Convert Location object to CreateLocationInput for database insertion
 */
export function locationToCreateInput(location: Location): CreateLocationInput {
  return {
    name: location.name || 'Unknown Location',
    latitude: location.latitude,
    longitude: location.longitude,
    source: location.source,
    address: location.address,
    neighborhood: location.neighborhood,
    postal_code: location.postalCode,
    city: location.city,
    subdivision: location.subdivision,
    region: location.region,
    country: location.country,
    location_radius: location.locationRadius,
    // Geo fields (immutable, from geocode)
    geo_address: location.geoAddress,
    geo_neighborhood: location.geoNeighborhood,
    geo_city: location.geoCity,
    geo_subdivision: location.geoSubdivision,
    geo_region: location.geoRegion,
    geo_country: location.geoCountry,
    geo_postal_code: location.geoPostalCode,
  };
}

/**
 * Convert Location object to entry GPS fields
 * Returns object with entry_latitude/entry_longitude for GPS capture
 */
export function locationToEntryGpsFields(location: Location | null) {
  if (!location) {
    return {
      entry_latitude: null,
      entry_longitude: null,
      location_radius: null,
    };
  }

  return {
    // GPS coordinates (where user was when creating entry - original exact coordinates)
    entry_latitude: location.originalLatitude ?? location.latitude,
    entry_longitude: location.originalLongitude ?? location.longitude,
    location_radius: location.locationRadius ?? null,
  };
}
