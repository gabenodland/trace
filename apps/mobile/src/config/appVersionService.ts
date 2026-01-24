/**
 * App Version Service
 *
 * Handles:
 * 1. Version check against minimum/latest version from server
 * 2. Session logging (track which version users are on)
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { getSupabase } from '@trace/core';

// Version comparison helper (semver-like)
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;
    if (aPart < bPart) return -1;
    if (aPart > bPart) return 1;
  }
  return 0;
}

export interface VersionRequirements {
  minimum_version: string;
  latest_version: string;
  update_url_ios: string;
  update_url_android: string;
  update_message?: string;
}

export type VersionStatus =
  | { status: 'ok' }
  | { status: 'update_available'; message?: string; url: string }
  | { status: 'force_update'; message?: string; url: string }
  | { status: 'error'; error: string };

/**
 * Get current app version
 */
export function getAppVersion(): string {
  return Constants.expoConfig?.version || '1.0.0';
}

/**
 * Get build number
 */
export function getBuildNumber(): string | undefined {
  if (Platform.OS === 'ios') {
    return Constants.expoConfig?.ios?.buildNumber;
  }
  return Constants.expoConfig?.android?.versionCode?.toString();
}

/**
 * Check app version against server requirements
 * Call this on app startup to determine if user needs to update
 */
export async function checkAppVersion(): Promise<VersionStatus> {
  try {
    const { data, error } = await getSupabase()
      .from('app_config')
      .select('value')
      .eq('key', 'version_requirements')
      .single();

    if (error) {
      console.error('[VersionCheck] Failed to fetch version requirements:', error);
      // Don't block app if we can't check version
      return { status: 'ok' };
    }

    const requirements = data.value as unknown as VersionRequirements;
    const currentVersion = getAppVersion();
    const updateUrl = Platform.OS === 'ios'
      ? requirements.update_url_ios
      : requirements.update_url_android;

    // Check if version is below minimum (force update)
    if (compareVersions(currentVersion, requirements.minimum_version) < 0) {
      return {
        status: 'force_update',
        message: requirements.update_message || 'Please update to continue using Trace.',
        url: updateUrl,
      };
    }

    // Check if newer version is available (optional update)
    if (compareVersions(currentVersion, requirements.latest_version) < 0) {
      return {
        status: 'update_available',
        message: requirements.update_message || 'A new version of Trace is available!',
        url: updateUrl,
      };
    }

    return { status: 'ok' };
  } catch (err) {
    console.error('[VersionCheck] Error:', err);
    // Don't block app on errors
    return { status: 'ok' };
  }
}

/**
 * Log user session with device/version info
 * Call this when user authenticates
 */
export async function logAppSession(userId: string): Promise<void> {
  try {
    const sessionData = {
      user_id: userId,
      app_version: getAppVersion(),
      build_number: getBuildNumber() || null,
      platform: Platform.OS,
      os_version: Platform.Version?.toString() || null,
      device_model: Device.modelName || null,
      last_seen_at: new Date().toISOString(),
    };

    const { error } = await getSupabase()
      .from('app_sessions')
      .upsert(sessionData, { onConflict: 'user_id' });

    if (error) {
      console.error('[AppSession] Failed to log session:', error);
    } else if (__DEV__) {
      console.log('[AppSession] Session logged:', sessionData.app_version, sessionData.platform);
    }
  } catch (err) {
    console.error('[AppSession] Error:', err);
    // Non-critical, don't throw
  }
}
