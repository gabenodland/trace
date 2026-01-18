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
 * Hook for creating a new location
 */
export function useCreateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: locationApi.createLocation,
    onSuccess: () => {
      // Invalidate location queries to refetch
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
      // Invalidate location queries to refetch
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.detail(variables.id) });
    },
  });
}

/**
 * Hook for deleting a location
 */
export function useDeleteLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: locationApi.deleteLocation,
    onSuccess: () => {
      // Invalidate location queries to refetch
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
    },
  });
}

/**
 * Hook for updating a location's name and all entries using it
 * This is used when editing a saved location - updates propagate to all entries
 */
export function useUpdateLocationName() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ locationId, newName }: { locationId: string; newName: string }) =>
      locationApi.updateLocationName(locationId, newName),
    onSuccess: (_, variables) => {
      // Invalidate location queries to refetch
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.detail(variables.locationId) });
      // Also invalidate entries since we updated their place_name
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

/**
 * Hook for updating location details (name, address, location_radius) and all entries using it
 * This is used for "Edit Location" which allows editing name, address, and precision.
 * Updates propagate to the location record AND all entries with this location_id.
 */
export function useUpdateLocationDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ locationId, name, address, location_radius }: { locationId: string; name: string; address: string | null; location_radius?: number | null }) =>
      locationApi.updateLocationDetails(locationId, { name, address, location_radius }),
    onSuccess: (_, variables) => {
      // Invalidate location queries to refetch
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: mobileLocationKeys.detail(variables.locationId) });
      // Also invalidate entries since we updated their place_name and address
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}
