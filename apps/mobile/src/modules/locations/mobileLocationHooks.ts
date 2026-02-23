/**
 * Mobile Location Hooks
 *
 * React Query hooks for local location operations (SQLite-first)
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { LocationEntity } from '@trace/core';
import * as locationApi from './mobileLocationApi';

/**
 * Query key factory for local locations
 */
export const mobileLocationKeys = {
  all: ['locations'] as const,
  list: () => [...mobileLocationKeys.all, 'list'] as const,
  withCounts: () => [...mobileLocationKeys.all, 'withCounts'] as const,
  detail: (id: string) => [...mobileLocationKeys.all, 'detail', id] as const,
  entryOnlyGroups: () => [...mobileLocationKeys.all, 'entryOnlyGroups'] as const,
  entryDerivedPlaces: () => [...mobileLocationKeys.all, 'entryDerivedPlaces'] as const,
  healthCounts: () => [...mobileLocationKeys.all, 'healthCounts'] as const,
};

/**
 * Hook to get all saved locations from local SQLite
 */
export function useLocations(): UseQueryResult<LocationEntity[], Error> {
  return useQuery({
    queryKey: mobileLocationKeys.list(),
    queryFn: () => locationApi.getLocations(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get locations with entry counts
 * Useful for displaying locations with usage statistics
 */
export function useLocationsWithCounts(): UseQueryResult<Array<LocationEntity & { entry_count: number }>, Error> {
  return useQuery({
    queryKey: mobileLocationKeys.withCounts(),
    queryFn: () => locationApi.getLocationsWithCounts(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get a single location by ID
 */
export function useLocation(id: string | null): UseQueryResult<LocationEntity | null, Error> {
  return useQuery({
    queryKey: id ? mobileLocationKeys.detail(id) : ['locations', 'detail', 'disabled'],
    queryFn: () => (id ? locationApi.getLocation(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get entry-only location groups
 * Entries with GPS but no saved location, grouped by city/region/country
 */
export function useEntryOnlyLocationGroups() {
  return useQuery({
    queryKey: mobileLocationKeys.entryOnlyGroups(),
    queryFn: () => locationApi.getEntryOnlyLocationGroups(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get location health counts for the health tab
 */
export function useLocationHealthCounts() {
  return useQuery({
    queryKey: mobileLocationKeys.healthCounts(),
    queryFn: () => locationApi.getLocationHealthCounts(),
    staleTime: 2 * 60 * 1000, // 2 minutes — health data changes more often
  });
}

/**
 * Hook for creating a new location
 */
export function useCreateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: locationApi.createLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
    },
  });
}

/**
 * Hook for updating a location
 */
export function useUpdateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<LocationEntity> }) =>
      locationApi.updateLocation(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.detail(variables.id) });
    },
  });
}

/**
 * Hook for deleting a location
 * Also nulls out location_id on referencing entries (keeping denormalized fields)
 */
export function useDeleteLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: locationApi.deleteLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

/**
 * Hook for updating a location's name and all entries using it
 */
export function useUpdateLocationName() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ locationId, newName }: { locationId: string; newName: string }) =>
      locationApi.updateLocationName(locationId, newName),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.detail(variables.locationId) });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

/**
 * Hook for updating location details (name, address) and all entries using it
 */
export function useUpdateLocationDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ locationId, name, address }: { locationId: string; name: string; address: string | null }) =>
      locationApi.updateLocationDetails(locationId, { name, address }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.detail(variables.locationId) });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

/**
 * Hook to get entry-derived places (entries not in locations table, grouped by place_name + address)
 */
export function useEntryDerivedPlaces() {
  return useQuery({
    queryKey: mobileLocationKeys.entryDerivedPlaces(),
    queryFn: () => locationApi.getEntryDerivedPlaces(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for promoting an entry-derived place to a saved location (favorite)
 */
export function usePromoteEntryPlace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: locationApi.promoteEntryPlaceToLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

/**
 * Hook for merging unlinked entries into an existing saved location.
 * Links entries and copies all address fields from the saved location.
 */
export function useMergeEntriesToLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ locationId, placeMatch }: {
      locationId: string;
      placeMatch: { place_name: string | null; address: string | null; city: string | null; region: string | null; country: string | null };
    }) => locationApi.mergeEntriesToLocation(locationId, placeMatch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

/**
 * Hook for merging two saved locations (My Places).
 * Moves entries from loser to winner and soft-deletes the loser.
 */
export function useMergeTwoSavedLocations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ winnerId, loserId }: { winnerId: string; loserId: string }) =>
      locationApi.mergeTwoSavedLocations(winnerId, loserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

/**
 * Hook for dismissing a merge suggestion between two saved locations.
 * Adds each to the other's ignore list so it won't be suggested again.
 */
export function useDismissMergeSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ locationIdA, locationIdB }: { locationIdA: string; locationIdB: string }) =>
      locationApi.dismissMergeSuggestion(locationIdA, locationIdB),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
    },
  });
}

/**
 * Hook for updating place data on entries matching a place group (unlinked entries)
 */
export function useUpdateEntryPlaceData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ match, updates }: {
      match: { place_name: string | null; address: string | null; city: string | null; region: string | null; country: string | null };
      updates: { name: string; address: string | null };
    }) => locationApi.updateEntryPlaceData(match, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

// ============================================================================
// CLEANUP MUTATION HOOKS
// ============================================================================

/**
 * Hook for merging duplicate locations
 */
export function useMergeDuplicateLocations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: locationApi.mergeDuplicateLocations,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

/**
 * Hook for enriching location hierarchy data
 */
export function useEnrichLocationHierarchy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (onProgress?: (current: number, total: number) => void) =>
      locationApi.enrichLocationHierarchy(onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
    },
  });
}

/**
 * Hook for enriching a single location's hierarchy data
 */
export function useEnrichSingleLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: locationApi.enrichSingleLocation,
    onSuccess: (_, locationId) => {
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.detail(locationId) });
    },
  });
}

/**
 * Hook for snapping unlinked entries to nearby saved locations (local, no API)
 */
export function useSnapEntriesToLocations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (onProgress?: (current: number, total: number) => void) =>
      locationApi.snapEntriesToLocations(onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

/**
 * Hook for geocoding entries via Mapbox reverse geocode API
 */
export function useGeocodeEntries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (onProgress?: (current: number, total: number) => void) =>
      locationApi.geocodeEntries(onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

/**
 * Hook for deleting unused locations (0 entries)
 */
export function useDeleteUnusedLocations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: locationApi.deleteUnusedLocations,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
    },
  });
}
