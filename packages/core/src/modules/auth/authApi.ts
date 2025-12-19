import { supabase } from "../../shared/supabase";
import type { User, Session } from "./AuthTypes";

/**
 * Auth Credentials for email/password authentication
 */
export interface AuthCredentials {
  email: string;
  password: string;
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(credentials: AuthCredentials) {
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error) throw error;
  return data;
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(credentials: AuthCredentials) {
  const { data, error } = await supabase.auth.signUp(credentials);
  if (error) throw error;
  return data;
}

/**
 * Sign in with Google OAuth
 * For web: Opens OAuth popup/redirect
 * For mobile: Returns URL to open in WebBrowser
 */
export async function signInWithGoogle(redirectTo?: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Sign out current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Get current session
 */
export async function getSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * Reset password for email
 */
export async function resetPassword(email: string, redirectTo?: string) {
  const options = redirectTo ? { redirectTo } : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, options);
  if (error) throw error;
}

/**
 * Update password
 */
export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
  return data;
}

/**
 * Refresh session
 */
export async function refreshSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.refreshSession();
  if (error || !session) {
    throw new Error(error?.message || "Failed to refresh session");
  }
  return session;
}

/**
 * Set session manually (for OAuth callbacks)
 */
export async function setSession(access_token: string, refresh_token?: string | null) {
  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token: refresh_token || "",
  });
  if (error) throw error;
  return data;
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
  return supabase.auth.onAuthStateChange(callback);
}