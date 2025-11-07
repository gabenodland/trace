/**
 * Pure utility functions for auth-related operations
 * No side effects, no API calls - just data transformation and validation
 */

import type { User } from "../../shared/types";

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get user display name (prioritize full name, then username, then email)
 */
export function getUserDisplayName(user: User | null): string {
  if (!user) return "Guest";
  return user.full_name || user.username || user.email;
}

/**
 * Get user initials for avatar
 */
export function getUserInitials(user: User | null): string {
  if (!user) return "?";

  const displayName = getUserDisplayName(user);
  const parts = displayName.split(" ").filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return displayName.substring(0, 2).toUpperCase();
}

/**
 * Check if a session is expired
 */
export function isSessionExpired(expiresAt?: number): boolean {
  if (!expiresAt) return false;
  return Date.now() >= expiresAt * 1000;
}

/**
 * Format auth error messages for display
 */
export function formatAuthError(error: any): string {
  if (typeof error === "string") return error;

  // Handle Supabase auth errors
  if (error?.message) {
    switch (error.message) {
      case "Invalid login credentials":
        return "Invalid email or password";
      case "User already registered":
        return "An account with this email already exists";
      case "Email not confirmed":
        return "Please check your email to verify your account";
      default:
        return error.message;
    }
  }

  return "An unexpected error occurred. Please try again.";
}