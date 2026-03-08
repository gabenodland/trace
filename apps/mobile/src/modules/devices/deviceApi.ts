/**
 * Device API — Supabase queries for the devices table
 *
 * This queries Supabase directly (not SQLite) since device data is server-only.
 * RLS filters by auth.uid() = user_id automatically.
 */

import { getSupabase } from '@trace/core';
import { createScopedLogger } from '../../shared/utils/logger';
import type { Device } from './DeviceTypes';

const log = createScopedLogger('DeviceApi');

/**
 * Get all devices for the current user, ordered by last seen
 */
export async function getDevices(): Promise<Device[]> {
  const { data, error } = await getSupabase()
    .from('devices')
    .select('*')
    .order('last_seen_at', { ascending: false });

  if (error) {
    log.error('Failed to fetch devices', error);
    throw error;
  }

  return data || [];
}

/**
 * Update a device's custom name
 */
export async function updateDeviceCustomName(deviceId: string, customName: string | null): Promise<void> {
  const { error } = await getSupabase()
    .from('devices')
    .update({ custom_name: customName })
    .eq('device_id', deviceId);

  if (error) {
    log.error('Failed to update device name', error);
    throw error;
  }
}

/**
 * Deactivate a device — sets is_active = false, triggering remote sign-out
 */
export async function deactivateDevice(deviceId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('devices')
    .update({ is_active: false })
    .eq('device_id', deviceId);

  if (error) {
    log.error('Failed to deactivate device', error);
    throw error;
  }
}

/**
 * Reactivate a previously deactivated device
 */
export async function reactivateDevice(deviceId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('devices')
    .update({ is_active: true })
    .eq('device_id', deviceId);

  if (error) {
    log.error('Failed to reactivate device', error);
    throw error;
  }
}

/**
 * Hard-delete a device row. Only call on already-deactivated devices.
 */
export async function removeDevice(deviceId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('devices')
    .delete()
    .eq('device_id', deviceId);

  if (error) {
    log.error('Failed to remove device', error);
    throw error;
  }
}

/**
 * Update a device's last_seen_at timestamp.
 * Called after successful sync as a heartbeat.
 */
export async function updateDeviceLastSeen(deviceId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('device_id', deviceId);

  if (error) {
    log.warn('Failed to update device last_seen_at', error);
  }
}

/**
 * Check if the current device is still active.
 * Used on reconnect/foreground to detect remote deactivation.
 */
export async function checkDeviceActive(deviceId: string): Promise<boolean> {
  const supabase = getSupabase();

  // Grab session for diagnostics — don't let it throw on network failure
  const session = await supabase.auth.getSession()
    .then(({ data }) => data.session)
    .catch(() => null);

  const { data, error } = await supabase
    .from('devices')
    .select('is_active')
    .eq('device_id', deviceId)
    .maybeSingle();

  if (error) {
    log.error('Failed to check device status', error);
    return true; // Fail open — don't sign out on network errors
  }

  // No row could mean: (a) device not registered yet, (b) hard-deleted,
  // or (c) RLS filtered everything because auth token is stale/expired.
  // Fail open in all cases — a real deactivation sets is_active=false, not delete.
  if (!data) {
    log.warn('checkDeviceActive: no row returned', {
      deviceId,
      hasSession: !!session,
      userId: session?.user?.id ?? 'none',
    });
    return true;
  }

  if (!data.is_active) {
    log.warn('checkDeviceActive: device explicitly deactivated', {
      deviceId,
      hasSession: !!session,
    });
  }

  return data.is_active;
}
