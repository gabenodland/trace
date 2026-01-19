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
// LOCATION LABEL (Single source of truth for display names)
// ============================================================================

/**
 * Location fields that can be used to derive a display label.
 * Works with Location, LocationEntity, entry rows, or any object with these fields.
 */
export interface LocationLabelFields {
  name?: string | null;
  place_name?: string | null;  // Alternative field name (some DB rows)
  city?: string | null;
  neighborhood?: string | null;
  region?: string | null;
  country?: string | null;
}

/**
 * Get the display label for a location.
 *
 * This is the single source of truth for how locations should be labeled across the app.
 * Priority order:
 * 1. name/place_name - Named places like "Starbucks", "Home", etc.
 * 2. city - City name like "Kansas City"
 * 3. neighborhood - Neighborhood like "Westport"
 * 4. region - State/province like "Missouri", "California"
 * 5. country - Country name as last resort
 * 6. "Unnamed Location" - Final fallback when no data available
 *
 * @param location - Object containing location fields (any subset)
 * @returns Display label string, never null/undefined
 *
 * @example
 * // Named place
 * getLocationLabel({ name: "Starbucks", city: "Kansas City" }) // => "Starbucks"
 *
 * // GPS with geocoded data
 * getLocationLabel({ city: "Kansas City", region: "Missouri" }) // => "Kansas City"
 *
 * // No data at all
 * getLocationLabel({}) // => "Unnamed Location"
 */
export function getLocationLabel(location: LocationLabelFields | null | undefined): string {
  if (!location) {
    return 'Unnamed Location';
  }

  // Priority 1: Named place (name or place_name field)
  const name = location.name || location.place_name;
  if (name && name.trim()) {
    return name.trim();
  }

  // Priority 2: City
  if (location.city && location.city.trim()) {
    return location.city.trim();
  }

  // Priority 3: Neighborhood
  if (location.neighborhood && location.neighborhood.trim()) {
    return location.neighborhood.trim();
  }

  // Priority 4: Region (state/province)
  if (location.region && location.region.trim()) {
    return location.region.trim();
  }

  // Priority 5: Country
  if (location.country && location.country.trim()) {
    return location.country.trim();
  }

  // Final fallback
  return 'Unnamed Location';
}

/**
 * Check if a location has any displayable label data beyond "Unnamed Location"
 */
export function hasLocationLabel(location: LocationLabelFields | null | undefined): boolean {
  return getLocationLabel(location) !== 'Unnamed Location';
}

// US state and Canadian province name to abbreviation mapping
const REGION_ABBREVIATIONS: Record<string, string> = {
  // US States
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
  'District of Columbia': 'DC', 'Puerto Rico': 'PR', 'Guam': 'GU', 'U.S. Virgin Islands': 'VI',
  // Canadian Provinces and Territories
  'Alberta': 'AB', 'British Columbia': 'BC', 'Manitoba': 'MB', 'New Brunswick': 'NB',
  'Newfoundland and Labrador': 'NL', 'Newfoundland': 'NL', 'Northwest Territories': 'NT',
  'Nova Scotia': 'NS', 'Nunavut': 'NU', 'Ontario': 'ON', 'Prince Edward Island': 'PE',
  'Quebec': 'QC', 'Québec': 'QC', 'Saskatchewan': 'SK', 'Yukon': 'YT',
};

/**
 * Get state/province abbreviation from full name.
 * Uses lookup for US states and Canadian provinces, falls back to original value for other regions.
 *
 * @param region - Full region name (e.g., "Missouri", "Ontario")
 * @returns Abbreviation if found (e.g., "MO", "ON"), otherwise original value
 *
 * @example
 * getStateAbbreviation("Missouri") // => "MO"
 * getStateAbbreviation("California") // => "CA"
 * getStateAbbreviation("Ontario") // => "ON"
 * getStateAbbreviation("British Columbia") // => "BC"
 * getStateAbbreviation("Bavaria") // => "Bavaria" (not US/CA, returns as-is)
 */
export function getStateAbbreviation(region: string | null | undefined): string {
  if (!region) return '';
  const trimmed = region.trim();
  return REGION_ABBREVIATIONS[trimmed] || trimmed;
}

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

// Maximum distance (meters) for address/poi/postcode/neighborhood to be considered valid
// If the returned feature center is further than this from query point, skip it
// 500 feet = ~152 meters
const MAX_PRECISE_FEATURE_DISTANCE = 152;

/**
 * Calculate distance between query point and feature center
 */
function getFeatureDistanceFromQuery(
  query: [number, number],
  featureCenter: [number, number]
): number {
  const [queryLng, queryLat] = query;
  const [featureLng, featureLat] = featureCenter;
  const result = calculateDistance(
    { latitude: queryLat, longitude: queryLng },
    { latitude: featureLat, longitude: featureLng }
  );
  return result.meters;
}

/**
 * Parse location hierarchy from Mapbox reverse geocode response
 *
 * Distance validation: Address/POI/postcode data is only used if the feature
 * center is within MAX_PRECISE_FEATURE_DISTANCE of the query point.
 * This prevents returning "1160 Michigan Avenue" when you're 700m away in Lake Michigan.
 * City/region/country are always used regardless of distance.
 */
export function parseMapboxHierarchy(
  response: MapboxReverseGeocodeResponse
): MapboxLocationHierarchy {
  const hierarchy: MapboxLocationHierarchy = {};

  if (response.features.length === 0) {
    return hierarchy;
  }

  const feature = response.features[0];
  const queryPoint = response.query as [number, number];

  // Calculate distance from query to feature center (for precise features)
  const distanceToFeature = queryPoint && feature.center
    ? getFeatureDistanceFromQuery(queryPoint, feature.center)
    : 0;

  // Only use POI if it's actually near the query point
  if (feature.place_type.includes('poi')) {
    if (distanceToFeature <= MAX_PRECISE_FEATURE_DISTANCE) {
      hierarchy.poi = feature.text;
    }
  }

  // Only use address if it's actually near the query point
  if (feature.place_type.includes('address')) {
    if (distanceToFeature <= MAX_PRECISE_FEATURE_DISTANCE) {
      hierarchy.address = feature.place_name.split(',')[0];
    }
  }

  // Iterate through ALL features to find hierarchy levels
  // Check both feature place_type AND context arrays
  for (const feat of response.features) {
    const featDistance = queryPoint && feat.center
      ? getFeatureDistanceFromQuery(queryPoint, feat.center)
      : 0;

    const isNearby = featDistance <= MAX_PRECISE_FEATURE_DISTANCE;
    const placeType = feat.place_type[0];

    // Extract from feature's place_type
    switch (placeType) {
      case 'neighborhood':
        if (!hierarchy.neighborhood && isNearby) {
          hierarchy.neighborhood = feat.text;
        }
        break;
      case 'postcode':
        if (!hierarchy.postcode && isNearby) {
          hierarchy.postcode = feat.text;
        }
        break;
      case 'place':
        // City/town - broad enough to always use
        if (!hierarchy.place) {
          hierarchy.place = feat.text;
        }
        break;
      case 'district':
        if (!hierarchy.district) {
          hierarchy.district = feat.text;
        }
        break;
      case 'region':
        if (!hierarchy.region) {
          hierarchy.region = feat.text;
        }
        break;
      case 'country':
        if (!hierarchy.country) {
          hierarchy.country = feat.text;
        }
        break;
    }

    // Also parse context from this feature (if it's nearby or a broad type)
    // This handles cases where hierarchy comes from context, not separate features
    const shouldUseContext = isNearby || ['place', 'district', 'region', 'country'].includes(placeType);
    if (feat.context && shouldUseContext) {
      for (const ctx of feat.context) {
        const [ctxType] = ctx.id.split('.');
        switch (ctxType) {
          case 'neighborhood':
            if (!hierarchy.neighborhood && isNearby) {
              hierarchy.neighborhood = ctx.text;
            }
            break;
          case 'postcode':
            if (!hierarchy.postcode && isNearby) {
              hierarchy.postcode = ctx.text;
            }
            break;
          case 'place':
            if (!hierarchy.place) {
              hierarchy.place = ctx.text;
            }
            break;
          case 'district':
            if (!hierarchy.district) {
              hierarchy.district = ctx.text;
            }
            break;
          case 'region':
            if (!hierarchy.region) {
              hierarchy.region = ctx.text;
            }
            break;
          case 'country':
            if (!hierarchy.country) {
              hierarchy.country = ctx.text;
            }
            break;
        }
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

// ============================================================================
// ENTRY GEOCODING HELPERS
// ============================================================================

/**
 * Entry location fields extracted from geocode response or location snap
 * Maps location hierarchy to entry fields (user-editable)
 */
export interface EntryLocationFields {
  address: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  city: string | null;
  subdivision: string | null;
  region: string | null;
  country: string | null;
  geocode_status: 'success' | 'snapped' | 'no_data';
}

/**
 * Result of location snap attempt
 */
export interface LocationSnapResult {
  /** The matched location, or null if no match within threshold */
  location: {
    location_id: string;
    name: string;
    address: string | null;
    neighborhood: string | null;
    postal_code: string | null;
    city: string | null;
    subdivision: string | null;
    region: string | null;
    country: string | null;
  } | null;
  /** Distance to matched location in meters */
  distanceMeters: number | null;
}

/**
 * Find the nearest saved location within a threshold distance
 *
 * Used for location snapping - match GPS to nearby saved locations before
 * calling the geocode API. 100 feet ≈ 30 meters.
 *
 * The effective snapping threshold is the larger of:
 * - The base threshold (default 30m)
 * - The GPS accuracy (if provided)
 *
 * This means: if GPS accuracy is poor (e.g., 50m), we'll snap within 50m
 * because we might actually be at that location. If accuracy is good (5m),
 * we use the base threshold.
 *
 * @param coords - GPS coordinates to match
 * @param locations - List of saved locations to search
 * @param thresholdMeters - Minimum distance to consider a match (default: 30m = ~100ft)
 * @param accuracy - GPS accuracy in meters (optional). If provided and larger than threshold, used as effective threshold.
 * @returns The nearest matching location or null if none within threshold
 */
export function findNearbyLocation<T extends {
  location_id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  city: string | null;
  subdivision: string | null;
  region: string | null;
  country: string | null;
}>(
  coords: Coordinates,
  locations: T[],
  thresholdMeters: number = 30,
  accuracy?: number | null
): LocationSnapResult {
  // Effective threshold: use GPS accuracy if larger than base threshold
  // This allows snapping when accuracy is poor (we might actually be at the location)
  const effectiveThreshold = Math.max(thresholdMeters, accuracy ?? 0);
  if (!locations || locations.length === 0) {
    return { location: null, distanceMeters: null };
  }

  let nearestLocation: T | null = null;
  let nearestDistance = Infinity;

  for (const loc of locations) {
    const distance = calculateDistance(coords, {
      latitude: loc.latitude,
      longitude: loc.longitude,
    });

    if (distance.meters < nearestDistance && distance.meters <= effectiveThreshold) {
      nearestLocation = loc;
      nearestDistance = distance.meters;
    }
  }

  if (nearestLocation) {
    return {
      location: {
        location_id: nearestLocation.location_id,
        name: nearestLocation.name,
        address: nearestLocation.address,
        neighborhood: nearestLocation.neighborhood,
        postal_code: nearestLocation.postal_code,
        city: nearestLocation.city,
        subdivision: nearestLocation.subdivision,
        region: nearestLocation.region,
        country: nearestLocation.country,
      },
      distanceMeters: nearestDistance,
    };
  }

  return { location: null, distanceMeters: null };
}

/**
 * Convert Mapbox geocode response to entry location fields
 *
 * This is used for auto-geocoding GPS coordinates when an entry is created.
 * Returns the location hierarchy that can be directly applied to the entry.
 *
 * @param response - Mapbox reverse geocode response
 * @returns Entry location fields ready to be merged into the entry
 */
export function geocodeResponseToEntryFields(
  response: MapboxReverseGeocodeResponse
): EntryLocationFields {
  const hierarchy = parseMapboxHierarchy(response);

  // Get street address from the main feature
  let streetAddress: string | null = null;
  if (response.features.length > 0) {
    const feature = response.features[0];
    // Extract the street address from place_name (first part before comma)
    if (feature.place_name) {
      streetAddress = feature.place_name.split(',')[0];
    }
  }

  // Determine if we got any useful data
  // Consider it "no_data" if we have no city, region, or country
  const hasData = !!(hierarchy.place || hierarchy.region || hierarchy.country);

  return {
    address: streetAddress,
    neighborhood: hierarchy.neighborhood || null,
    postal_code: hierarchy.postcode || null,
    city: hierarchy.place || null,
    subdivision: hierarchy.district || null,
    region: hierarchy.region || null,
    country: hierarchy.country || null,
    geocode_status: hasData ? 'success' : 'no_data',
  };
}
