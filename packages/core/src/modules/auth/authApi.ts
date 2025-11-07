import { supabase } from "../../shared/supabase";
import type { LoginCredentials, SignupData, AuthSession } from "./AuthTypes";
import type { User } from "../../shared/types";

/**
 * Sign up a new user
 */
export async function signUp(data: SignupData): Promise<AuthSession> {
  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        full_name: data.full_name,
        username: data.username,
      },
    },
  });

  if (error) throw error;
  if (!authData.session) throw new Error("No session returned after signup");

  return authData.session as AuthSession;
}

/**
 * Log in an existing user
 */
export async function login(credentials: LoginCredentials): Promise<AuthSession> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) throw error;
  if (!data.session) throw new Error("No session returned after login");

  return data.session as AuthSession;
}

/**
 * Log out the current user
 */
export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get the current user
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) return null;

  return {
    id: user.id,
    email: user.email!,
    username: user.user_metadata?.username,
    full_name: user.user_metadata?.full_name,
    avatar_url: user.user_metadata?.avatar_url,
    created_at: user.created_at,
    updated_at: user.updated_at || user.created_at,
  };
}

/**
 * Refresh the current session
 */
export async function refreshSession(): Promise<AuthSession | null> {
  const { data, error } = await supabase.auth.refreshSession();

  if (error) throw error;
  return data.session as AuthSession | null;
}

/**
 * Reset password for a user
 */
export async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) throw error;
}

/**
 * Update password for the current user
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}