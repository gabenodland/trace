/**
 * Device Hooks — React Query hooks for device operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as deviceApi from './deviceApi';
import type { Device } from './DeviceTypes';

export const deviceKeys = {
  all: ['devices'] as const,
  list: () => [...deviceKeys.all, 'list'] as const,
};

/**
 * Hook to get all devices for the current user
 */
export function useDevices() {
  return useQuery<Device[], Error>({
    queryKey: deviceKeys.list(),
    queryFn: () => deviceApi.getDevices(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/**
 * Hook for updating a device's custom name
 */
export function useUpdateDeviceName() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deviceId, customName }: { deviceId: string; customName: string | null }) =>
      deviceApi.updateDeviceCustomName(deviceId, customName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deviceKeys.all });
    },
  });
}

/**
 * Hook for deactivating a device (remote sign-out)
 */
export function useDeactivateDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: string) => deviceApi.deactivateDevice(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deviceKeys.all });
    },
  });
}

/**
 * Hook for reactivating a deactivated device
 */
export function useReactivateDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: string) => deviceApi.reactivateDevice(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deviceKeys.all });
    },
  });
}

/**
 * Hook for hard-deleting a deactivated device
 */
export function useRemoveDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: string) => deviceApi.removeDevice(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deviceKeys.all });
    },
  });
}
