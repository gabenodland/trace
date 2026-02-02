/**
 * Device utilities - shared across the app
 * Extracted to avoid circular dependencies
 */

import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * Get formatted device name with platform
 * Example: "Pixel 6a (Android)" or "iPhone 14 (iOS)"
 */
export function getDeviceName(): string {
  const deviceName = Device.deviceName || 'Unknown Device';
  const platformName = Platform.OS === 'ios' ? 'iOS' : 'Android';
  return `${deviceName} (${platformName})`;
}

/**
 * Get raw device name (without platform suffix)
 */
export function getRawDeviceName(): string | null {
  return Device.deviceName || null;
}
