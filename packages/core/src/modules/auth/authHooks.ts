import { useEffect, useState } from "react";
import { Session, User } from "./AuthTypes";
import type { QueryClient } from "@tanstack/react-query";
import {
  signInWithEmail as signInWithEmailApi,
  signUpWithEmail as signUpWithEmailApi,
  signInWithGoogle as signInWithGoogleApi,
  signOut as signOutApi,
  getSession,
  onAuthStateChange,
} from "./authApi";
import * as authHelpers from "./authHelpers";

/**
 * Unified hook for auth - exposes auth state, mutations, and helpers
 * This is the PRIMARY hook to use in components
 * @param queryClient - Optional QueryClient for cache management
 * @returns Object with auth state, mutations, and helpers
 *
 * @example
 * const { user, isAuthenticated, authMutations, authHelpers } = useAuthState(queryClient);
 *
 * // Use state
 * if (isAuthenticated) { ... }
 *
 * // Use mutations
 * authMutations.signInWithEmail(email, password)
 * authMutations.signOut()
 *
 * // Use helpers
 * const isValid = authHelpers.validateEmail(email)
 */
export function useAuthState(queryClient?: QueryClient) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    getSession()
      .then(async (session) => {
        setSessionState(session);
        setUserState(session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    // Listen to auth state changes
    const {
      data: { subscription },
    } = onAuthStateChange((_event, session) => {
      setSessionState(session);
      setUserState(session?.user ?? null);

      if (!session) {
        // User signed out - clear all cached data
        setLoading(false);
        if (queryClient) {
          queryClient.clear();
          console.log("[Auth] User signed out - cleared query cache");
        }
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  // Mutation functions wrapped for easier use
  const authMutations = {
    signInWithEmail: async (email: string, password: string) => {
      return await signInWithEmailApi({ email, password });
    },
    signUpWithEmail: async (email: string, password: string) => {
      return await signUpWithEmailApi({ email, password });
    },
    signInWithGoogle: async (redirectTo?: string) => {
      return await signInWithGoogleApi(redirectTo);
    },
    signOut: async () => {
      await signOutApi();
      // Clear all cached queries to prevent data leakage between users
      if (queryClient) {
        queryClient.clear();
        console.log("[Auth] Cleared query cache on sign out");
      }
    },
  };

  return {
    // State
    session,
    user,
    isLoading: loading,
    loading, // Backward compatibility
    isAuthenticated: !!user,

    // Mutations
    authMutations,

    // Backward compatibility - expose mutations at top level
    signInWithEmail: authMutations.signInWithEmail,
    signUpWithEmail: authMutations.signUpWithEmail,
    signOut: authMutations.signOut,

    // Helpers - all pure validation functions
    authHelpers,

    // For platform-specific OAuth implementations
    setSession: setSessionState,
    setUser: setUserState,
  };
}

export type AuthState = ReturnType<typeof useAuthState>;
