import { useEffect, useState, useRef } from "react";
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

// Timeout for initial session fetch (prevents hanging offline)
const SESSION_TIMEOUT_MS = 5000;

/**
 * Helper to add timeout to a promise
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

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

  // Track if initial load is complete to avoid race conditions
  const initialLoadCompleteRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // Get initial session with timeout to handle offline scenarios
    // Supabase getSession() should read from local storage (fast),
    // but may hang if it tries network operations
    const sessionPromise = getSession().catch((error) => {
      console.log("[Auth] getSession error (may be offline):", error?.message || error);
      return null;
    });

    withTimeout(sessionPromise, SESSION_TIMEOUT_MS, null)
      .then((session) => {
        if (!isMounted) return;

        setSessionState(session);
        setUserState(session?.user ?? null);
        setLoading(false);
        initialLoadCompleteRef.current = true;

        if (session) {
          console.log("[Auth] Session restored", { userId: session.user?.id });
        } else {
          console.log("[Auth] No session found (logged out or offline with no cache)");
        }
      });

    // Listen to auth state changes
    // Note: This may try to refresh tokens which can fail offline
    const {
      data: { subscription },
    } = onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      // Only update state after initial load to avoid race conditions
      // where auth change event arrives before getSession resolves
      if (!initialLoadCompleteRef.current) {
        console.log("[Auth] Ignoring auth change before initial load:", _event);
        return;
      }

      console.log("[Auth] Auth state changed:", _event);
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

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
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
