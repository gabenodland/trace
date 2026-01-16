/**
 * Location API - Mapbox and Foursquare API wrappers with caching
 *
 * Internal API layer for location services.
 * NOT exported from module - used only by hooks.
 */

import type {
  MapboxReverseGeocodeResponse,
  FoursquareNearbyResponse,
  FoursquareAutocompleteResponse,
  ReverseGeocodeRequest,
  NearbyPOIRequest,
  LocationAutocompleteRequest,
  GeocodeCache,
  POICache,
  TilequeryResponse,
  GeographicFeature,
} from './LocationTypes';
import config from '../../../config.json';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Configuration from package-level config.json - easy to find and modify
let mapboxAccessToken: string = config.mapbox.accessToken;
let foursquareApiKey: string = config.foursquare.apiKey;

/**
 * Configure location API credentials
 * For backwards compatibility - allows apps to override config.json
 */
export function configureLocationAPI(apiConfig: {
  mapboxAccessToken: string;
  foursquareApiKey: string;
}) {
  mapboxAccessToken = apiConfig.mapboxAccessToken;
  foursquareApiKey = apiConfig.foursquareApiKey;
}

// ============================================================================
// IN-MEMORY CACHE
// ============================================================================

const geocodeCache = new Map<string, GeocodeCache>();
const poiCache = new Map<string, POICache>();

// Cache durations
const GEOCODE_CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
const POI_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;      // 7 days

/**
 * Generate cache key for geocoding (round to 5 decimals ~1m precision)
 */
function geocodeCacheKey(lat: number, lng: number): string {
  const roundedLat = Math.round(lat * 100000) / 100000;
  const roundedLng = Math.round(lng * 100000) / 100000;
  return `${roundedLat},${roundedLng}`;
}

/**
 * Generate cache key for POI search
 */
function poiCacheKey(lat: number, lng: number, radius: number): string {
  const roundedLat = Math.round(lat * 10000) / 10000; // ~10m precision for POI
  const roundedLng = Math.round(lng * 10000) / 10000;
  return `${roundedLat},${roundedLng},${radius}`;
}

/**
 * Clear expired cache entries
 */
function clearExpiredCache() {
  const now = Date.now();

  // Clear expired geocode cache
  for (const [key, entry] of geocodeCache.entries()) {
    if (entry.expiresAt < now) {
      geocodeCache.delete(key);
    }
  }

  // Clear expired POI cache
  for (const [key, entry] of poiCache.entries()) {
    if (entry.expiresAt < now) {
      poiCache.delete(key);
    }
  }
}

// Run cache cleanup every hour
setInterval(clearExpiredCache, 60 * 60 * 1000);

// ============================================================================
// MAPBOX GEOCODING API
// ============================================================================

/**
 * Reverse geocode coordinates to address and hierarchy
 * Uses cache to reduce API calls by 60-80%
 *
 * @internal Not exported - use hooks
 */
export async function reverseGeocode(
  request: ReverseGeocodeRequest
): Promise<MapboxReverseGeocodeResponse> {
  if (!mapboxAccessToken) {
    throw new Error('Mapbox access token not configured. Call configureLocationAPI() first.');
  }

  const { latitude, longitude } = request;

  // Check cache first
  const cacheKey = geocodeCacheKey(latitude, longitude);
  const cached = geocodeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.response;
  }

  // Make API request
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json`);
  url.searchParams.set('access_token', mapboxAccessToken);
  url.searchParams.set('types', 'poi,address,neighborhood,postcode,place,district,region,country');
  // Remove limit parameter to get all geographic levels (address, city, region, country, etc.)
  // url.searchParams.set('limit', '1');

  const response = await fetch(url.toString());

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
    throw new Error(`Mapbox API error: ${errorBody.message || response.statusText}`);
  }

  const data = await response.json() as MapboxReverseGeocodeResponse;

  // Cache the result
  const now = Date.now();
  geocodeCache.set(cacheKey, {
    key: cacheKey,
    response: data,
    timestamp: now,
    expiresAt: now + GEOCODE_CACHE_DURATION,
  });

  return data;
}

/**
 * Forward geocode a search query to coordinates
 *
 * @internal Not exported - use hooks
 */
export async function forwardGeocode(
  query: string,
  options?: {
    proximity?: { latitude: number; longitude: number };
    limit?: number;
  }
): Promise<MapboxReverseGeocodeResponse> {
  if (!mapboxAccessToken) {
    throw new Error('Mapbox access token not configured. Call configureLocationAPI() first.');
  }

  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
  url.searchParams.set('access_token', mapboxAccessToken);
  url.searchParams.set('types', 'poi,address,place');
  url.searchParams.set('limit', String(options?.limit || 10));

  if (options?.proximity) {
    url.searchParams.set('proximity', `${options.proximity.longitude},${options.proximity.latitude}`);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
    throw new Error(`Mapbox API error: ${errorBody.message || response.statusText}`);
  }

  return response.json() as Promise<MapboxReverseGeocodeResponse>;
}

// ============================================================================
// MAPBOX TILEQUERY API
// ============================================================================

/**
 * Query Mapbox vector tiles for geographic features at a location
 * Used to get feature names like "Pacific Ocean" or "Lake Michigan" when
 * reverse geocoding returns no address data.
 *
 * @param latitude - Latitude to query
 * @param longitude - Longitude to query
 * @returns Geographic feature if found, null otherwise
 *
 * @internal Not exported - use hooks
 */
export async function tilequeryGeographicFeature(
  latitude: number,
  longitude: number
): Promise<GeographicFeature | null> {
  if (!mapboxAccessToken) {
    throw new Error('Mapbox access token not configured. Call configureLocationAPI() first.');
  }

  // Query the natural_label layer from mapbox-streets-v8 tileset
  // Use large radius (100km) since geographic features can be sparse
  const url = new URL(
    `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${longitude},${latitude}.json`
  );
  url.searchParams.set('access_token', mapboxAccessToken);
  url.searchParams.set('layers', 'natural_label');
  url.searchParams.set('radius', '100000'); // 100km radius
  url.searchParams.set('limit', '5'); // Get top 5 features

  console.log('[LocationAPI] 🗺️ Tilequery request:', url.toString().replace(mapboxAccessToken, '***'));

  const response = await fetch(url.toString());

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
    console.error('[LocationAPI] ❌ Tilequery error:', errorBody);
    throw new Error(`Mapbox Tilequery API error: ${errorBody.message || response.statusText}`);
  }

  const data = await response.json() as TilequeryResponse;
  console.log('[LocationAPI] 🗺️ Tilequery response:', JSON.stringify(data, null, 2));

  if (!data.features || data.features.length === 0) {
    console.log('[LocationAPI] 🗺️ No geographic features found');
    return null;
  }

  // Find the most relevant feature (prefer major water bodies)
  // Water class priority: larger/named bodies first, then streams/creeks
  // Order matters: earlier = higher priority
  const waterClassPriority = [
    'ocean',      // 0 - Highest priority
    'sea',        // 1
    'bay',        // 2
    'water',      // 3 - Lakes, large bodies
    'river',      // 4 - Named rivers
    'reservoir',  // 5
    'canal',      // 6
    'wetland',    // 7
    'glacier',    // 8
    'stream',     // 9 - Creeks, streams - lowest water priority
  ];

  // Sort features by: water class priority, sizerank, then distance
  const sortedFeatures = [...data.features].sort((a, b) => {
    const aClass = a.properties.class || '';
    const bClass = b.properties.class || '';
    const aPriority = waterClassPriority.indexOf(aClass);
    const bPriority = waterClassPriority.indexOf(bClass);
    const aIsWater = aPriority !== -1;
    const bIsWater = bPriority !== -1;

    // Water features first
    if (aIsWater && !bIsWater) return -1;
    if (!aIsWater && bIsWater) return 1;

    // Both are water: prefer higher priority class (river > stream)
    if (aIsWater && bIsWater && aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // Then by sizerank (lower = more prominent)
    const aRank = a.properties.sizerank ?? 16;
    const bRank = b.properties.sizerank ?? 16;
    if (aRank !== bRank) {
      return aRank - bRank;
    }

    // Finally by distance (closer = better)
    return a.properties.tilequery.distance - b.properties.tilequery.distance;
  });

  const bestFeature = sortedFeatures[0];
  const name = bestFeature.properties.name_en || bestFeature.properties.name;

  if (!name) {
    console.log('[LocationAPI] 🗺️ Feature found but no name');
    return null;
  }

  const result: GeographicFeature = {
    name,
    class: bestFeature.properties.class || 'unknown',
    distance: bestFeature.properties.tilequery.distance,
    sizerank: bestFeature.properties.sizerank,
  };

  console.log('[LocationAPI] 🗺️ Found geographic feature:', result);
  return result;
}

// ============================================================================
// FOURSQUARE PLACES API
// ============================================================================

/**
 * Search nearby POIs using Foursquare Places API
 * Uses cache to reduce API calls
 *
 * @internal Not exported - use hooks
 */
export async function searchNearbyPOIs(
  request: NearbyPOIRequest
): Promise<FoursquareNearbyResponse> {
  console.log('[LocationAPI] searchNearbyPOIs called with:', request);

  if (!foursquareApiKey) {
    console.error('[LocationAPI] ❌ Foursquare API key not configured!');
    throw new Error('Foursquare API key not configured. Call configureLocationAPI() first.');
  }

  const { latitude, longitude, radius = 500, limit = 50 } = request;

  // Check cache first
  const cacheKey = poiCacheKey(latitude, longitude, radius);
  const cached = poiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    console.log('[LocationAPI] ✅ Using cached POI data for:', cacheKey);
    return cached.response;
  }

  // Make API request - Use new Places API endpoint
  // Note: Premium fields (stats, popularity, rating) require paid tier - using default fields only
  const url = `https://places-api.foursquare.com/places/search?ll=${latitude},${longitude}&sort=DISTANCE&radius=${radius}&limit=${limit}`;

  console.log('[LocationAPI] 🌐 Fetching nearby POIs from Foursquare...');
  console.log('[LocationAPI] URL:', url);
  console.log('[LocationAPI] API Key (first 10 chars):', foursquareApiKey.substring(0, 10) + '...');

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${foursquareApiKey}`,
      'Accept': 'application/json',
      'X-Places-Api-Version': '2025-06-17',
    },
  });

  console.log('[LocationAPI] Response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
    throw new Error(`Foursquare API error: ${errorBody.message || response.statusText}`);
  }

  const data = await response.json() as FoursquareNearbyResponse;

  console.log('[LocationAPI] ✅ Received', data.results?.length || 0, 'POIs from Foursquare');
  if (data.results && data.results.length > 0) {
    console.log('[LocationAPI] First POI name:', data.results[0].name);
    console.log('[LocationAPI] First POI full object:', JSON.stringify(data.results[0], null, 2));
  }

  // Cache the result
  const now = Date.now();
  poiCache.set(cacheKey, {
    key: cacheKey,
    response: data,
    timestamp: now,
    expiresAt: now + POI_CACHE_DURATION,
  });

  console.log('[LocationAPI] Cached POI data for:', cacheKey);

  return data;
}

/**
 * Autocomplete location search using Foursquare Places API
 *
 * @internal Not exported - use hooks
 */
export async function autocompleteLocation(
  request: LocationAutocompleteRequest
): Promise<FoursquareAutocompleteResponse> {
  console.log('[LocationAPI] autocompleteLocation called with:', request);

  if (!foursquareApiKey) {
    console.error('[LocationAPI] ❌ Foursquare API key not configured!');
    throw new Error('Foursquare API key not configured. Call configureLocationAPI() first.');
  }

  const { query, latitude, longitude, limit = 10 } = request;

  // Build URL with query parameters - matching Location Builder autocomplete params
  let url = `https://places-api.foursquare.com/autocomplete?query=${encodeURIComponent(query)}&limit=${limit}&radius=50000`;

  if (latitude !== undefined && longitude !== undefined) {
    url += `&ll=${latitude},${longitude}`;
  }

  console.log('[LocationAPI] 🔍 Searching for:', query);
  console.log('[LocationAPI] URL:', url);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${foursquareApiKey}`,
      'Accept': 'application/json',
      'X-Places-Api-Version': '2025-06-17',
    },
  });

  console.log('[LocationAPI] Response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
    console.error('[LocationAPI] ❌ API error:', errorBody);
    throw new Error(`Foursquare API error: ${errorBody.message || response.statusText}`);
  }

  const data = await response.json() as FoursquareAutocompleteResponse;
  console.log('[LocationAPI] ✅ Received', data.results?.length || 0, 'autocomplete results');
  if (data.results && data.results.length > 0) {
    console.log('[LocationAPI] First result:', data.results[0].name);
  }

  return data;
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Clear all cached location data
 */
export function clearLocationCache() {
  geocodeCache.clear();
  poiCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    geocode: {
      size: geocodeCache.size,
      entries: Array.from(geocodeCache.values()).map(e => ({
        key: e.key,
        timestamp: new Date(e.timestamp).toISOString(),
        expiresAt: new Date(e.expiresAt).toISOString(),
      })),
    },
    poi: {
      size: poiCache.size,
      entries: Array.from(poiCache.values()).map(e => ({
        key: e.key,
        timestamp: new Date(e.timestamp).toISOString(),
        expiresAt: new Date(e.expiresAt).toISOString(),
      })),
    },
  };
}
