/**
 * Profile Cache Service
 *
 * Caches profile data in AsyncStorage for offline access.
 * Profile data changes rarely, so a 30-day cache is appropriate.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Profile } from '@trace/core';
import { createScopedLogger, LogScopes } from '../utils/logger';

const log = createScopedLogger(LogScopes.Cache);

const PROFILE_CACHE_KEY = 'trace_profile_cache';
const CACHE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface CachedProfile {
  profile: Profile;
  cachedAt: number;
}

/**
 * Get cached profile for a user
 * Returns null if no cache or cache expired
 */
export async function getCachedProfile(userId: string): Promise<Profile | null> {
  try {
    const data = await AsyncStorage.getItem(`${PROFILE_CACHE_KEY}_${userId}`);
    if (!data) return null;

    const cached: CachedProfile = JSON.parse(data);

    // Check if cache has expired
    if (Date.now() - cached.cachedAt > CACHE_DURATION_MS) {
      await AsyncStorage.removeItem(`${PROFILE_CACHE_KEY}_${userId}`);
      log.debug('Cache expired, removed', { userId });
      return null;
    }

    log.debug('Loaded from cache', { userId, cachedAt: new Date(cached.cachedAt).toISOString() });
    return cached.profile;
  } catch (error) {
    log.warn('Failed to read cache', { userId, error });
    return null;
  }
}

/**
 * Save profile to cache
 */
export async function setCachedProfile(userId: string, profile: Profile): Promise<void> {
  try {
    const cached: CachedProfile = {
      profile,
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(`${PROFILE_CACHE_KEY}_${userId}`, JSON.stringify(cached));
    log.debug('Saved to cache', { userId });
  } catch (error) {
    log.warn('Failed to write cache', { userId, error });
  }
}

/**
 * Clear profile cache for a user (e.g., on logout)
 */
export async function clearProfileCache(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${PROFILE_CACHE_KEY}_${userId}`);
    log.debug('Cleared cache', { userId });
  } catch (error) {
    log.warn('Failed to clear cache', { userId, error });
  }
}

/**
 * Clear all profile caches (e.g., on app reset)
 */
export async function clearAllProfileCaches(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const profileKeys = keys.filter(key => key.startsWith(PROFILE_CACHE_KEY));
    if (profileKeys.length > 0) {
      await AsyncStorage.multiRemove(profileKeys);
      log.debug('Cleared all caches', { count: profileKeys.length });
    }
  } catch (error) {
    log.warn('Failed to clear all caches', { error });
  }
}
