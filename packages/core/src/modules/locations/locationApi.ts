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
} from './LocationTypes';
import {
  getMapboxConfig,
  getFoursquareConfig,
  getFoursquareProxyUrl,
  getSupabaseConfig,
} from '../../shared/config';
import { getSupabase } from '../../shared/supabase';

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
// HELPER: Get auth token for proxy calls
// ============================================================================

async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

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
  const mapboxConfig = getMapboxConfig();
  const mapboxAccessToken = mapboxConfig?.accessToken;

  if (!mapboxAccessToken) {
    throw new Error('Mapbox access token not configured. Call configureCore() with mapbox.accessToken.');
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

// ============================================================================
// FOURSQUARE PLACES API (Updated for 2025 API Migration)
// New host: places-api.foursquare.com
// New auth: Bearer token with service key
// Version header: X-Places-Api-Version required
// ============================================================================

// Foursquare API version (date-based versioning)
const FOURSQUARE_API_VERSION = '2025-06-17';

/**
 * Search nearby POIs using Foursquare Places API
 * Uses cache to reduce API calls.
 * Supports both direct API (mobile) and proxy (web) modes.
 *
 * @internal Not exported - use hooks
 */
export async function searchNearbyPOIs(
  request: NearbyPOIRequest
): Promise<FoursquareNearbyResponse> {
  const { latitude, longitude, radius = 500, limit = 50 } = request;

  // Check cache first
  const cacheKey = poiCacheKey(latitude, longitude, radius);
  const cached = poiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.response;
  }

  // Determine if we should use proxy or direct API
  const proxyUrl = getFoursquareProxyUrl();
  const foursquareConfig = getFoursquareConfig();
  const foursquareApiKey = foursquareConfig?.apiKey;

  let data: FoursquareNearbyResponse;

  if (proxyUrl) {
    // Use proxy (web) - key stays server-side
    data = await fetchViaProxy(
      proxyUrl,
      `/places/search?ll=${latitude},${longitude}&sort=DISTANCE&radius=${radius}&limit=${limit}`
    );
  } else if (foursquareApiKey) {
    // Direct API call (mobile) - using new places-api.foursquare.com host
    data = await fetchFoursquareDirect(
      `https://places-api.foursquare.com/places/search?ll=${latitude},${longitude}&sort=DISTANCE&radius=${radius}&limit=${limit}`,
      foursquareApiKey
    );
  } else {
    throw new Error('Foursquare not configured. Provide either foursquare.apiKey or foursquareProxyUrl.');
  }

  // Cache the result
  const now = Date.now();
  poiCache.set(cacheKey, {
    key: cacheKey,
    response: data,
    timestamp: now,
    expiresAt: now + POI_CACHE_DURATION,
  });

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
  const { query, latitude, longitude, limit = 20 } = request;

  // Normalize query
  const normalizedQuery = query.toLowerCase().trim();

  // Build endpoint (new format without /v3 prefix)
  let endpoint = `/autocomplete?query=${encodeURIComponent(normalizedQuery)}&limit=${limit}&radius=50000`;
  if (latitude !== undefined && longitude !== undefined) {
    endpoint += `&ll=${latitude},${longitude}`;
  }

  // Determine if we should use proxy or direct API
  const proxyUrl = getFoursquareProxyUrl();
  const foursquareConfig = getFoursquareConfig();
  const foursquareApiKey = foursquareConfig?.apiKey;

  let data: FoursquareAutocompleteResponse;

  if (proxyUrl) {
    data = await fetchViaProxy(proxyUrl, endpoint);
  } else if (foursquareApiKey) {
    data = await fetchFoursquareDirect(
      `https://places-api.foursquare.com${endpoint}`,
      foursquareApiKey
    );
  } else {
    throw new Error('Foursquare not configured. Provide either foursquare.apiKey or foursquareProxyUrl.');
  }

  return data;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Fetch from Foursquare directly (mobile with service key)
 * Updated for 2025 API migration:
 * - Uses Bearer token auth instead of raw API key
 * - Requires X-Places-Api-Version header
 */
async function fetchFoursquareDirect(url: string, apiKey: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'X-Places-Api-Version': FOURSQUARE_API_VERSION,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
    throw new Error(`Foursquare API error: ${errorBody.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch via Supabase Edge Function proxy (web)
 */
async function fetchViaProxy(proxyUrl: string, endpoint: string): Promise<any> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Authentication required for location services');
  }

  const { anonKey } = getSupabaseConfig();
  const fullUrl = `${proxyUrl}?endpoint=${encodeURIComponent(endpoint)}`;

  const response = await fetch(fullUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': anonKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
    throw new Error(`Foursquare proxy error: ${errorBody.message || response.statusText}`);
  }

  return response.json();
}
