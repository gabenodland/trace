/**
 * Profile Hooks
 * React Query hooks for profile data management
 * Exposes ONE unified hook as the single source of truth
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Profile, ProfileUpdate, AvatarImageInput } from "./ProfileTypes";
import {
  getProfile,
  getCurrentProfile,
  updateProfile,
  checkUsernameAvailable,
  uploadAvatar,
  deleteAvatar,
} from "./profileApi";

// Query keys
const PROFILE_KEYS = {
  all: ["profiles"] as const,
  detail: (userId: string) => ["profiles", userId] as const,
  current: () => ["profiles", "current"] as const,
  usernameCheck: (username: string) => ["profiles", "username-check", username] as const,
};

/**
 * Internal hook for fetching a profile by ID
 */
function useProfileQuery(userId: string | null | undefined) {
  return useQuery({
    queryKey: userId ? PROFILE_KEYS.detail(userId) : PROFILE_KEYS.current(),
    queryFn: async () => {
      if (userId) {
        return getProfile(userId);
      }
      return getCurrentProfile();
    },
    enabled: userId !== null, // Allow undefined (current user) but not null (disabled)
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Internal mutation for updating profile
 */
function useUpdateProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      updates,
    }: {
      userId: string;
      updates: ProfileUpdate;
    }) => {
      return updateProfile(userId, updates);
    },
    onMutate: async ({ userId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: PROFILE_KEYS.detail(userId) });
      await queryClient.cancelQueries({ queryKey: PROFILE_KEYS.current() });

      // Snapshot previous value
      const previousProfile = queryClient.getQueryData<Profile>(
        PROFILE_KEYS.detail(userId)
      );

      // Optimistically update
      if (previousProfile) {
        const optimisticProfile = { ...previousProfile, ...updates };
        queryClient.setQueryData(PROFILE_KEYS.detail(userId), optimisticProfile);
        queryClient.setQueryData(PROFILE_KEYS.current(), optimisticProfile);
      }

      return { previousProfile };
    },
    onError: (_err, { userId }, context) => {
      // Rollback on error
      if (context?.previousProfile) {
        queryClient.setQueryData(PROFILE_KEYS.detail(userId), context.previousProfile);
        queryClient.setQueryData(PROFILE_KEYS.current(), context.previousProfile);
      }
    },
    onSettled: (_data, _error, { userId }) => {
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(userId) });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.current() });
    },
  });
}

/**
 * Internal mutation for uploading avatar
 */
function useUploadAvatarMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      file,
    }: {
      userId: string;
      file: File | AvatarImageInput;
    }) => {
      // Upload avatar and get URL
      const avatarUrl = await uploadAvatar(userId, file);

      // Update profile with new avatar URL
      await updateProfile(userId, { avatar_url: avatarUrl });

      return avatarUrl;
    },
    onSettled: (_data, _error, { userId }) => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(userId) });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.current() });
    },
  });
}

/**
 * Internal mutation for deleting avatar
 */
function useDeleteAvatarMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      // Delete from storage
      await deleteAvatar(userId);

      // Update profile to remove avatar URL
      await updateProfile(userId, { avatar_url: null });
    },
    onSettled: (_data, _error, { userId }) => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(userId) });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.current() });
    },
  });
}

/**
 * Hook to check username availability
 * Debounce this on the component side for better UX
 */
function useCheckUsernameMutation() {
  return useMutation({
    mutationFn: async (username: string) => {
      return checkUsernameAvailable(username);
    },
  });
}

/**
 * THE UNIFIED PROFILE HOOK
 * This is the single source of truth for profile data
 *
 * @param userId - Optional user ID. If not provided, fetches current user's profile
 * @returns Profile data, loading state, and mutation functions
 *
 * @example
 * // Get current user's profile
 * const { profile, profileMutations } = useProfile();
 *
 * // Get specific user's profile
 * const { profile } = useProfile(userId);
 *
 * // Update profile
 * await profileMutations.updateProfile({ name: "New Name" });
 *
 * // Upload avatar
 * await profileMutations.uploadAvatar(imageFile);
 */
export function useProfile(userId?: string) {
  const profileQuery = useProfileQuery(userId);
  const updateMutation = useUpdateProfileMutation();
  const uploadAvatarMutation = useUploadAvatarMutation();
  const deleteAvatarMutation = useDeleteAvatarMutation();
  const checkUsernameMutation = useCheckUsernameMutation();

  // Get the effective user ID (from profile or provided)
  const effectiveUserId = userId || profileQuery.data?.id;

  return {
    // Data
    profile: profileQuery.data ?? null,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    refetch: profileQuery.refetch,

    // Mutations
    profileMutations: {
      /**
       * Update profile fields
       */
      updateProfile: async (updates: ProfileUpdate) => {
        if (!effectiveUserId) throw new Error("No user ID available");
        return updateMutation.mutateAsync({ userId: effectiveUserId, updates });
      },

      /**
       * Upload a new avatar image
       */
      uploadAvatar: async (file: File | AvatarImageInput) => {
        if (!effectiveUserId) throw new Error("No user ID available");
        return uploadAvatarMutation.mutateAsync({ userId: effectiveUserId, file });
      },

      /**
       * Delete the current avatar
       */
      deleteAvatar: async () => {
        if (!effectiveUserId) throw new Error("No user ID available");
        return deleteAvatarMutation.mutateAsync({ userId: effectiveUserId });
      },

      /**
       * Check if a username is available
       */
      checkUsername: async (username: string) => {
        return checkUsernameMutation.mutateAsync(username);
      },

      // Loading states
      isUpdating: updateMutation.isPending,
      isUploadingAvatar: uploadAvatarMutation.isPending,
      isDeletingAvatar: deleteAvatarMutation.isPending,
      isCheckingUsername: checkUsernameMutation.isPending,
    },
  };
}
