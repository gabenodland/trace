/**
 * Mobile Profile Hook
 *
 * Wraps the core useProfile hook with offline support.
 * When offline, returns cached profile from AsyncStorage.
 * When online, fetches from Supabase and caches the result.
 */

import { useEffect, useState } from 'react';
import { useProfile as useCoreProfile, type Profile, type ProfileUpdate, type AvatarImageInput } from '@trace/core';
import { useAuth } from '../contexts/AuthContext';
import { getCachedProfile, setCachedProfile } from '../cache/profileCache';

/**
 * Mobile-specific profile hook with offline support
 *
 * @param userId - Optional user ID. If not provided, uses current user
 * @returns Profile data, loading state, mutations, and offline status
 *
 * @example
 * const { profile, isOffline, profileMutations } = useMobileProfile();
 *
 * if (isOffline) {
 *   // Show cached data, disable editing
 * }
 */
export function useMobileProfile(userId?: string) {
  const { user, isOffline } = useAuth();
  const effectiveUserId = userId || user?.id;

  // Cached profile state (used when offline)
  const [cachedProfile, setCachedProfileState] = useState<Profile | null>(null);
  const [cacheLoading, setCacheLoading] = useState(false);

  // Use core hook for online fetching (disabled when offline)
  // Pass undefined instead of null to disable the hook when offline
  const coreProfile = useCoreProfile(isOffline ? undefined : effectiveUserId);

  // Load cached profile when offline
  useEffect(() => {
    if (isOffline && effectiveUserId && !cachedProfile) {
      setCacheLoading(true);
      getCachedProfile(effectiveUserId)
        .then((cached) => {
          setCachedProfileState(cached);
        })
        .finally(() => {
          setCacheLoading(false);
        });
    }
  }, [isOffline, effectiveUserId, cachedProfile]);

  // Cache profile when online fetch succeeds
  useEffect(() => {
    if (!isOffline && coreProfile.profile && effectiveUserId) {
      setCachedProfile(effectiveUserId, coreProfile.profile);
      // Also update local cache state for seamless transition to offline
      setCachedProfileState(coreProfile.profile);
    }
  }, [isOffline, coreProfile.profile, effectiveUserId]);

  // Determine which profile to return
  const profile = isOffline ? cachedProfile : coreProfile.profile;
  const isLoading = isOffline ? cacheLoading : coreProfile.isLoading;
  const error = isOffline ? null : coreProfile.error;

  // Create offline-aware mutations
  const profileMutations = {
    /**
     * Update profile fields (disabled when offline)
     */
    updateProfile: async (updates: ProfileUpdate) => {
      if (isOffline) {
        throw new Error('Cannot update profile while offline');
      }
      return coreProfile.profileMutations.updateProfile(updates);
    },

    /**
     * Upload a new avatar image (disabled when offline)
     */
    uploadAvatar: async (file: File | AvatarImageInput) => {
      if (isOffline) {
        throw new Error('Cannot upload avatar while offline');
      }
      return coreProfile.profileMutations.uploadAvatar(file);
    },

    /**
     * Delete the current avatar (disabled when offline)
     */
    deleteAvatar: async () => {
      if (isOffline) {
        throw new Error('Cannot delete avatar while offline');
      }
      return coreProfile.profileMutations.deleteAvatar();
    },

    /**
     * Check if a username is available (disabled when offline)
     */
    checkUsername: async (username: string) => {
      if (isOffline) {
        return false; // Can't check offline
      }
      return coreProfile.profileMutations.checkUsername(username);
    },

    // Loading states (all false when offline)
    isUpdating: isOffline ? false : coreProfile.profileMutations.isUpdating,
    isUploadingAvatar: isOffline ? false : coreProfile.profileMutations.isUploadingAvatar,
    isDeletingAvatar: isOffline ? false : coreProfile.profileMutations.isDeletingAvatar,
    isCheckingUsername: isOffline ? false : coreProfile.profileMutations.isCheckingUsername,
  };

  return {
    // Data
    profile,
    isLoading,
    error,
    refetch: coreProfile.refetch,

    // Offline status
    isOffline,

    // Mutations
    profileMutations,
  };
}
