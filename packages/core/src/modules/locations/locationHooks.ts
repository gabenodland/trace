/**
 * Location Hooks
 *
 * React Query hooks for location operations
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import * as locationApi from './locationApi';
import * as locationHelpers from './locationHelpers';
import type {
  MapboxReverseGeocodeResponse,
  ReverseGeocodeRequest,
  NearbyPOIRequest,
  LocationAutocompleteRequest,
  POIItem,
  MapboxLocationHierarchy,
} from './LocationTypes';

/**
 * Query key factory for locations
 */
export const locationKeys = {
  all: ['locations'] as const,
  geocode: (lat: number, lng: number) => [...locationKeys.all, 'geocode', lat, lng] as const,
  nearby: (lat: number, lng: number, radius: number) => [...locationKeys.all, 'nearby', lat, lng, radius] as const,
  autocomplete: (query: string) => [...locationKeys.all, 'autocomplete', query] as const,
};

/**
 * Hook to reverse geocode coordinates to address
 * Returns Mapbox geocoding response with location hierarchy
 */
export function useReverseGeocode(
  request: ReverseGeocodeRequest | null
): UseQueryResult<MapboxReverseGeocodeResponse, Error> {
  return useQuery({
    queryKey: request
      ? locationKeys.geocode(request.latitude, request.longitude)
      : ['locations', 'geocode', 'disabled'],
    queryFn: () => locationApi.reverseGeocode(request!),
    enabled: !!request && locationHelpers.isValidCoordinates(request),
    staleTime: 30 * 24 * 60 * 60 * 1000, // 30 days - matches API cache
  });
}

/**
 * Hook to search nearby POIs
 * Returns Foursquare places near the specified location
 */
export function useNearbyPOIs(
  request: NearbyPOIRequest | null
): UseQueryResult<POIItem[], Error> {
  const enabled = !!request && locationHelpers.isValidCoordinates(request);

  return useQuery({
    queryKey: request
      ? locationKeys.nearby(request.latitude, request.longitude, request.radius || 500)
      : ['locations', 'nearby', 'disabled'],
    queryFn: async () => {
      // This only logs when the query actually executes (cache miss), not on every render
      console.log('📍 [NearbyPOIs] Fetching POIs for', request?.latitude.toFixed(4), request?.longitude.toFixed(4));

      const response = await locationApi.searchNearbyPOIs(request!);

      // Note: Quality filtering (stats, popularity, rating) requires premium API tier
      // For now, return all results - may add filtering later if premium access is enabled

      // Convert Foursquare places to POI items
      const pois = response.results.map(place => locationHelpers.foursquareToPOI(place));
      console.log('📍 [NearbyPOIs] Received', pois.length, 'POIs');
      return pois;
    },
    enabled,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days - matches API cache
  });
}

/**
 * Hook to autocomplete location search
 * Returns Foursquare autocomplete results
 */
export function useLocationAutocomplete(
  request: LocationAutocompleteRequest | null
): UseQueryResult<POIItem[], Error> {
  return useQuery({
    queryKey: request
      ? locationKeys.autocomplete(request.query)
      : ['locations', 'autocomplete', 'disabled'],
    queryFn: async () => {
      const response = await locationApi.autocompleteLocation(request!);
      // Convert Foursquare places to POI items
      // Autocomplete API wraps data in a 'place' object for type='place' results
      return response.results
        .filter((result: any) => result.type === 'place') // Only show actual places
        .map((result: any) => locationHelpers.foursquareToPOI(result.place || result));
    },
    enabled: !!request && request.query.length >= 2, // Minimum 2 characters for search
    staleTime: 5 * 60 * 1000, // 5 minutes for autocomplete
  });
}

/**
 * Hook to parse location hierarchy from geocode response
 * Useful for extracting city, region, country, etc.
 */
export function useLocationHierarchy(
  geocodeResponse: MapboxReverseGeocodeResponse | undefined
): MapboxLocationHierarchy | null {
  if (!geocodeResponse || geocodeResponse.features.length === 0) {
    return null;
  }

  return locationHelpers.parseMapboxHierarchy(geocodeResponse);
}

// Export helpers for use in components
export { locationHelpers };
