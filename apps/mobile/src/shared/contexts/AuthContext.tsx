import { createContext, useContext, useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createScopedLogger, LogScopes } from "../utils/logger";
import {
  type Session,
  type User,
  getSession,
  onAuthStateChange,
  signInWithEmail as signInWithEmailApi,
  signUpWithEmail as signUpWithEmailApi,
  signOut as signOutApi,
  // Auth helpers - imported individually, bundled into object for context
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateLoginForm,
  validateSignupForm,
  AUTH_VALIDATION,
} from "@trace/core";

// Bundle auth helpers into object for context (matches useAuthState pattern)
const authHelpers = {
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateLoginForm,
  validateSignupForm,
  AUTH_VALIDATION,
};
import { handleMobileGoogleOAuth } from "../../modules/auth/utils/mobileOAuth";
import { localDB } from "../db/localDB";

const log = createScopedLogger(LogScopes.Auth);

// Supabase stores session with this key format
const SUPABASE_AUTH_KEY = "sb-lsszorssvkavegobmqic-auth-token";

// Auth context type matching useAuthState return type
interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  loading: boolean;
  isAuthenticated: boolean;
  isOffline: boolean;
  authMutations: {
    signInWithEmail: (email: string, password: string) => Promise<any>;
    signUpWithEmail: (email: string, password: string) => Promise<any>;
    signOut: () => Promise<void>;
  };
  signInWithEmail: (email: string, password: string) => Promise<any>;
  signUpWithEmail: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: unknown | null }>;
  authHelpers: typeof authHelpers;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Read cached Supabase session directly from AsyncStorage
 * This is instant and works offline
 */
async function getCachedSession(): Promise<Session | null> {
  try {
    const data = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);
    if (!data) return null;

    const parsed = JSON.parse(data);
    // Supabase stores { currentSession: { ... }, expiresAt: ... }
    const session = parsed?.currentSession || parsed;

    if (session?.access_token && session?.user) {
      return session as Session;
    }
    return null;
  } catch (error) {
    log.error("Failed to read cached session", error);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  const initialLoadCompleteRef = useRef(false);

  // Initialize auth - check network first, use cache if offline
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        // Check network status first (instant)
        const netState = await NetInfo.fetch();
        const online = !!(netState.isConnected && netState.isInternetReachable);

        if (!isMounted) return;
        setIsOffline(!online);

        if (!online) {
          // OFFLINE: Read cached session directly from AsyncStorage (instant)
          log.debug("Offline - reading cached session");
          const cachedSession = await getCachedSession();

          if (!isMounted) return;

          if (cachedSession) {
            log.info("Restored session from cache (offline)", { userId: cachedSession.user?.id });
            setSession(cachedSession);
            setUser(cachedSession.user ?? null);
          } else {
            log.debug("No cached session (offline, not logged in)");
          }

          setIsLoading(false);
          initialLoadCompleteRef.current = true;
          return;
        }

        // ONLINE: Use normal Supabase flow
        log.debug("Online - fetching session from Supabase");
        const supabaseSession = await getSession();

        if (!isMounted) return;

        setSession(supabaseSession);
        setUser(supabaseSession?.user ?? null);
        setIsLoading(false);
        initialLoadCompleteRef.current = true;

        if (supabaseSession) {
          log.info("Session restored from Supabase", { userId: supabaseSession.user?.id });
        } else {
          log.debug("No session (not logged in)");
        }
      } catch (error) {
        log.error("Init error, falling back to cache", error);

        if (!isMounted) return;

        // On any error, try cached session
        const cachedSession = await getCachedSession();
        setSession(cachedSession);
        setUser(cachedSession?.user ?? null);
        setIsLoading(false);
        initialLoadCompleteRef.current = true;
      }
    }

    initAuth();

    // Listen to auth state changes (for login/logout while app is open)
    const { data: { subscription } } = onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;

      // Skip events before initial load to avoid race conditions
      if (!initialLoadCompleteRef.current) {
        log.debug("Ignoring auth change before init", { event: _event });
        return;
      }

      log.info("Auth state changed", { event: _event });
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setIsOffline(false); // If we got an auth event, we're online

      if (!newSession && queryClient) {
        queryClient.clear();
        log.info("Signed out - cleared query cache");
      }
    });

    // Listen to network changes
    const netUnsubscribe = NetInfo.addEventListener((state) => {
      if (!isMounted) return;
      const online = !!(state.isConnected && state.isInternetReachable);
      setIsOffline(!online);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      netUnsubscribe();
    };
  }, [queryClient]);

  // CRITICAL: Set current user ID in local database for multi-user support
  useEffect(() => {
    if (user?.id) {
      localDB.setCurrentUser(user.id);
    } else {
      localDB.clearCurrentUser();
    }
  }, [user?.id]);

  // Auth mutations
  const signInWithEmail = async (email: string, password: string) => {
    return await signInWithEmailApi({ email, password });
  };

  const signUpWithEmail = async (email: string, password: string) => {
    return await signUpWithEmailApi({ email, password });
  };

  const signOut = async () => {
    await signOutApi();
    if (queryClient) {
      queryClient.clear();
      log.info("Cleared query cache on sign out");
    }
  };

  const signInWithGoogle = async () => {
    return await handleMobileGoogleOAuth();
  };

  const value: AuthContextType = {
    session,
    user,
    isLoading,
    loading: isLoading,
    isAuthenticated: !!user,
    isOffline,
    authMutations: { signInWithEmail, signUpWithEmail, signOut },
    signInWithEmail,
    signUpWithEmail,
    signOut,
    signInWithGoogle,
    authHelpers,
    setSession,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
