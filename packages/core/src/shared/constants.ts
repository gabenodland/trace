/**
 * Shared Constants - Application-wide constants
 */

// Authentication Error Messages
export const ERROR_MESSAGES = {
  // Authentication errors
  LOGIN_FAILED: "Login Failed",
  SIGNUP_FAILED: "Sign Up Failed",
  GOOGLE_LOGIN_FAILED: "Google Login Failed",
  GOOGLE_SIGNUP_FAILED: "Google Sign Up Failed",

  // OAuth specific errors
  OAUTH_CANCELLED: "OAuth cancelled",
  OAUTH_FAILED: "OAuth failed",
  NO_ACCESS_TOKEN: "No access token received",
  NO_OAUTH_URL: "No OAuth URL received",
  GOOGLE_SIGNIN_ERROR: "Failed to sign in with Google",

  // General errors
  UNKNOWN_ERROR: "An unexpected error occurred",
  NETWORK_ERROR: "Network error occurred",
  SESSION_ERROR: "Session error occurred",
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  ACCOUNT_CREATED: "Account Created!",
  EMAIL_CONFIRMATION: "Please check your email to confirm your account.",
  LOGIN_SUCCESS: "Successfully logged in",
  LOGOUT_SUCCESS: "Successfully logged out",
} as const;

// Info Messages
export const INFO_MESSAGES = {
  LOADING: "Loading...",
  SIGNING_IN: "Signing In...",
  SIGNING_UP: "Signing Up...",
  PROCESSING: "Processing...",
} as const;

// OAuth Constants
export const OAUTH_CONSTANTS = {
  SCHEME: "trace",
  CALLBACK_PATH: "auth/callback",
  FULL_CALLBACK: "trace://auth/callback",
} as const;
