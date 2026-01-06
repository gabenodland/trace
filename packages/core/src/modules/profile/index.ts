/**
 * Profile Module
 * Exports public API for profile management
 */

// Hooks - the unified hook is the primary export
export { useProfile } from "./profileHooks";

// Types - all type definitions
export type {
  Profile,
  ProfileUpdate,
  ProfileCreation,
  UsernameValidationResult,
  NameValidationResult,
  AvatarImageInput,
} from "./ProfileTypes";

// Helpers - pure validation and utility functions
export {
  validateUsername,
  validateName,
  validateImageFile,
  getDefaultAvatarUrl,
  getAvatarUrl,
  formatUsername,
  getInitials,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  NAME_MAX_LENGTH,
  AVATAR_MAX_SIZE_MB,
  AVATAR_MAX_SIZE_BYTES,
  ALLOWED_IMAGE_TYPES,
} from "./profileHelpers";

// Selected API functions (for direct use when needed)
export { checkUsernameAvailable } from "./profileApi";
