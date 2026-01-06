/**
 * Profile Types
 * Type definitions for user profile data
 */

/**
 * User profile from database
 */
export interface Profile {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  profile_complete: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Fields that can be updated on a profile
 */
export interface ProfileUpdate {
  name?: string;
  username?: string;
  avatar_url?: string | null;
  profile_complete?: boolean;
}

/**
 * Data required to create a profile (mostly handled by trigger)
 */
export interface ProfileCreation {
  id: string;
  name: string;
  username: string;
}

/**
 * Result of username validation
 */
export interface UsernameValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Result of name validation
 */
export interface NameValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Image file input for avatar upload
 * Supports both web File API and React Native image picker
 */
export interface AvatarImageInput {
  // React Native path
  uri?: string;
  type?: string;
  name?: string;
  base64?: string;
  // Web File API - handled by File object directly
}
