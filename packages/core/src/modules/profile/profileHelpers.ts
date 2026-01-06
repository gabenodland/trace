/**
 * Profile Helpers
 * Pure validation and utility functions for profile data
 */

import type { UsernameValidationResult, NameValidationResult } from "./ProfileTypes";

// Constants
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const NAME_MAX_LENGTH = 50;
export const AVATAR_MAX_SIZE_MB = 5;
export const AVATAR_MAX_SIZE_BYTES = AVATAR_MAX_SIZE_MB * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// Username must be alphanumeric with underscores, no consecutive underscores
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const CONSECUTIVE_UNDERSCORE_REGEX = /__/;

/**
 * Validates a username
 * Rules:
 * - 3-30 characters
 * - Only alphanumeric and underscores
 * - No consecutive underscores
 */
export function validateUsername(username: string): UsernameValidationResult {
  const trimmed = username.trim();

  if (!trimmed) {
    return { isValid: false, error: "Username is required" };
  }

  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return { isValid: false, error: `Username must be at least ${USERNAME_MIN_LENGTH} characters` };
  }

  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return { isValid: false, error: `Username must be at most ${USERNAME_MAX_LENGTH} characters` };
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    return { isValid: false, error: "Username can only contain letters, numbers, and underscores" };
  }

  if (CONSECUTIVE_UNDERSCORE_REGEX.test(trimmed)) {
    return { isValid: false, error: "Username cannot have consecutive underscores" };
  }

  return { isValid: true };
}

/**
 * Validates a display name
 * Rules:
 * - Required (not empty)
 * - Max 50 characters
 */
export function validateName(name: string): NameValidationResult {
  const trimmed = name.trim();

  if (!trimmed) {
    return { isValid: false, error: "Name is required" };
  }

  if (trimmed.length > NAME_MAX_LENGTH) {
    return { isValid: false, error: `Name must be at most ${NAME_MAX_LENGTH} characters` };
  }

  return { isValid: true };
}

/**
 * Validates an image file for avatar upload
 * Rules:
 * - Must be jpeg, png, or webp
 * - Max 5MB
 */
export function validateImageFile(
  file: { type?: string; size?: number } | null
): { isValid: boolean; error?: string } {
  if (!file) {
    return { isValid: false, error: "No file selected" };
  }

  if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { isValid: false, error: "Image must be JPEG, PNG, or WebP" };
  }

  if (file.size && file.size > AVATAR_MAX_SIZE_BYTES) {
    return { isValid: false, error: `Image must be smaller than ${AVATAR_MAX_SIZE_MB}MB` };
  }

  return { isValid: true };
}

/**
 * Generates a default avatar URL using UI Avatars service
 * Returns a URL that generates an avatar with the user's initials
 */
export function getDefaultAvatarUrl(name: string): string {
  const encodedName = encodeURIComponent(name || "User");
  return `https://ui-avatars.com/api/?name=${encodedName}&background=3b82f6&color=ffffff&size=256&bold=true`;
}

/**
 * Gets the display avatar URL - returns custom avatar or default
 */
export function getAvatarUrl(avatarUrl: string | null, name: string): string {
  return avatarUrl || getDefaultAvatarUrl(name);
}

/**
 * Formats a username with @ prefix for display
 */
export function formatUsername(username: string): string {
  return `@${username}`;
}

/**
 * Extracts initials from a name (max 2 characters)
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
