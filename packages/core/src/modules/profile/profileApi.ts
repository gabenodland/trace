/**
 * Profile API
 * Database operations for user profiles
 * INTERNAL: These functions are not exported from the module
 */

import { supabase } from "../../shared/supabase";
import type { Profile, ProfileUpdate, AvatarImageInput } from "./ProfileTypes";

/**
 * Get a profile by user ID
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned - profile doesn't exist yet
      return null;
    }
    throw error;
  }

  return data as Profile;
}

/**
 * Get the current authenticated user's profile
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  return getProfile(user.id);
}

/**
 * Update a user's profile (or create if doesn't exist)
 * Uses upsert to handle cases where the trigger didn't create the profile
 */
export async function updateProfile(
  userId: string,
  updates: ProfileUpdate
): Promise<Profile> {
  // First try to update existing profile
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select();

  if (error) throw error;

  // If no rows updated, profile doesn't exist - create it
  if (!data || data.length === 0) {
    // Get user email to generate username
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email || "user@example.com";
    const baseUsername = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "") || "user";

    const { data: newProfile, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        name: updates.name || user?.user_metadata?.name || "User",
        username: baseUsername,
        avatar_url: updates.avatar_url || null,
        profile_complete: updates.profile_complete || false,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return newProfile as Profile;
  }

  return data[0] as Profile;
}

/**
 * Check if a username is available (case-insensitive)
 * Uses the database RPC function
 */
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_username_available", {
    username_param: username,
  });

  if (error) throw error;
  return data as boolean;
}

/**
 * Upload an avatar image to storage
 * Returns the public URL of the uploaded image
 *
 * Supports both web File API and React Native image picker data
 */
export async function uploadAvatar(
  userId: string,
  file: File | AvatarImageInput
): Promise<string> {
  // Determine file extension based on type
  let fileExt = "jpg";
  let uploadData: Blob | ArrayBuffer;
  let contentType = "image/jpeg";

  if (file instanceof File) {
    // Web File API
    fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    contentType = file.type || "image/jpeg";
    uploadData = file;
  } else if ("base64" in file && file.base64) {
    // React Native with base64 data
    fileExt = file.name?.split(".").pop()?.toLowerCase() || "jpg";
    contentType = file.type || "image/jpeg";

    // Convert base64 to ArrayBuffer
    const binaryString = atob(file.base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    uploadData = bytes.buffer;
  } else {
    throw new Error("Invalid file input - must be File or base64 data");
  }

  // File path: {userId}/avatar.{ext}
  const filePath = `${userId}/avatar.${fileExt}`;

  // Upload (upsert to replace existing)
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, uploadData, {
      contentType,
      upsert: true, // Replace existing file
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  // Add cache-busting query param to force refresh
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  return publicUrl;
}

/**
 * Delete a user's avatar from storage
 */
export async function deleteAvatar(userId: string): Promise<void> {
  // List files in user's folder to find their avatar
  const { data: files, error: listError } = await supabase.storage
    .from("avatars")
    .list(userId);

  if (listError) throw listError;

  if (files && files.length > 0) {
    // Delete all files in user's folder (should just be one avatar)
    const filePaths = files.map((file) => `${userId}/${file.name}`);
    const { error: deleteError } = await supabase.storage
      .from("avatars")
      .remove(filePaths);

    if (deleteError) throw deleteError;
  }
}
