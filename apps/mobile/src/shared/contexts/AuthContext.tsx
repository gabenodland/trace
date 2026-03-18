import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createScopedLogger, LogScopes } from "../utils/logger";
import { destroySync } from "../sync";
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
import {
  saveOfflineAccount,
  removeOfflineAccount,
  getOfflineAccounts,
  hasOfflineAccount,
  type OfflineAccountRecord,
} from "../utils/offlineAccess";

const log = createScopedLogger(LogScopes.Auth);

// Supabase stores session with this key format
const SUPABASE_AUTH_KEY = "sb-lsszorssvkavegobmqic-auth-token";
const OFFLINE_ACCESS_ENABLED_KEY = "trace-offline-access-enabled";

// Auth context type matching useAuthState return type
interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  loading: boolean;
  isAuthenticated: boolean;
  isOffline: boolean;
  isOfflineAuth: boolean;
  offlineAccessEnabled: boolean;
  setOfflineAccess: (enabled: boolean, profileData?: { displayName: string; avatarUrl: string | null }) => Promise<void>;
  offlineAccounts: OfflineAccountRecord[];
  continueOfflineAs: (userId: string) => void;
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
  const [isOffline, setIsOffline] = useState(true); // Conservative: assume offline until confirmed
  const [isOfflineAuth, setIsOfflineAuth] = useState(false);
  const [offlineAccessEnabled, setOfflineAccessEnabledState] = useState(false);
  const [offlineAccounts, setOfflineAccounts] = useState<OfflineAccountRecord[]>([]);

  const initialLoadCompleteRef = useRef(false);
  const isOfflineAuthRef = useRef(false);

  // Initialize auth - check network first, use cache if offline
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        // Load offline access state
        const [enabledFlag, accounts] = await Promise.all([
          AsyncStorage.getItem(OFFLINE_ACCESS_ENABLED_KEY),
          getOfflineAccounts(),
        ]);
        if (isMounted) {
          setOfflineAccessEnabledState(enabledFlag === "true");
          setOfflineAccounts(accounts);
        }

        // Check network status first (instant)
        // Strict === true: treat null/undefined as offline (conservative)
        const netState = await NetInfo.fetch();
        const online = netState.isConnected === true && netState.isInternetReachable === true;

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
            // Offline accounts are shown on login screen — user taps to continue
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

      // When in offline/biometric auth mode, ignore SIGNED_IN from a stale token —
      // the old Supabase session may still be valid server-side even after local sign-out.
      // User must explicitly sign in again to leave local-only mode.
      if (isOfflineAuthRef.current && _event === 'SIGNED_IN') {
        log.info("Ignoring SIGNED_IN in offline auth mode — explicit sign-in required");
        return;
      }

      log.info("Auth state changed", { event: _event });
      setSession(newSession);
      setUser(newSession?.user ?? null);
      // Network state is owned by NetInfo listener only — auth events say nothing about connectivity

      // Reactivate device on fresh sign-in (not session restore).
      // This runs after initial load, so SIGNED_IN = user just authenticated.
      if (_event === 'SIGNED_IN' && newSession?.user) {
        import('../../config/appVersionService').then(({ reactivateCurrentDevice }) => {
          reactivateCurrentDevice(newSession.user.id).catch((err) => {
            log.error('Failed to reactivate device on sign-in', err);
          });
        });
      }

      if (!newSession && queryClient) {
        queryClient.clear();
        log.info("Signed out - cleared query cache");
      }
    });

    // Listen to network changes — sole authority on isOffline
    const netUnsubscribe = NetInfo.addEventListener((state) => {
      if (!isMounted) return;
      const online = state.isConnected === true && state.isInternetReachable === true;
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

  // Auth mutations - wrapped in useCallback for stable references
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    return await signInWithEmailApi({ email, password });
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    return await signUpWithEmailApi({ email, password });
  }, []);

  const signOut = useCallback(async () => {
    // Tear down sync service BEFORE killing the auth session.
    destroySync();

    // If offline access is enabled, preserve the account record before wiping the session
    // so the user can restore access from the login screen without network.
    const currentUser = user;
    if (offlineAccessEnabled && currentUser?.id && currentUser?.email) {
      // Profile display name is stored in the record — read current value to preserve it
      const existing = await getOfflineAccounts();
      const existingRecord = existing.find(r => r.userId === currentUser.id);
      await saveOfflineAccount({
        userId: currentUser.id,
        email: currentUser.email,
        displayName: existingRecord?.displayName ?? currentUser.email,
        avatarUrl: existingRecord?.avatarUrl ?? null,
      });
      // Update state so login screen shows the account immediately after sign-out
      setOfflineAccounts(await getOfflineAccounts());
    }

    // Kill the token immediately — don't let it survive sign-out regardless of network state
    await AsyncStorage.removeItem(SUPABASE_AUTH_KEY);

    // Clear React auth state — UI transitions to login screen right away
    isOfflineAuthRef.current = false;
    setSession(null);
    setUser(null);
    setIsOfflineAuth(false);
    if (queryClient) {
      queryClient.clear();
      log.info("Cleared query cache on sign out");
    }

    // Tell Supabase server to invalidate the session — best effort, non-blocking
    signOutApi().catch(err => {
      log.warn('signOut server call failed (expected when offline)', { error: err instanceof Error ? err.message : String(err) });
    });
  }, [queryClient, user, offlineAccessEnabled]);

  const signInWithGoogle = useCallback(async () => {
    return await handleMobileGoogleOAuth();
  }, []);

  const setOfflineAccess = useCallback(async (
    enabled: boolean,
    profileData?: { displayName: string; avatarUrl: string | null }
  ) => {
    await AsyncStorage.setItem(OFFLINE_ACCESS_ENABLED_KEY, enabled ? "true" : "false");
    setOfflineAccessEnabledState(enabled);

    if (enabled && user?.id && user?.email) {
      // Save account record and update in-memory state so the login screen
      // shows the biometric button immediately without requiring a restart.
      const record: Omit<OfflineAccountRecord, 'savedAt'> = {
        userId: user.id,
        email: user.email,
        displayName: profileData?.displayName ?? user.email,
        avatarUrl: profileData?.avatarUrl ?? null,
      };
      await saveOfflineAccount(record);
      setOfflineAccounts(prev => {
        const filtered = prev.filter(r => r.userId !== user.id);
        return [...filtered, { ...record, savedAt: Date.now() }];
      });
    } else if (!enabled && user?.id) {
      await removeOfflineAccount(user.id);
      setOfflineAccounts(prev => prev.filter(r => r.userId !== user.id));
    }

    log.info("Offline access toggled", { enabled });
  }, [user?.id, user?.email]);

  // Called from login screen when user taps "Continue as [name]" while offline
  const continueOfflineAs = useCallback((userId: string) => {
    const record = offlineAccounts.find(r => r.userId === userId);
    if (!record) return;
    // Build a minimal user object sufficient for localDB tenant scoping.
    // Only `id` and `email` are populated — all other Supabase User fields are undefined.
    // All code that runs in offline/local-only mode MUST null-check optional user fields.
    isOfflineAuthRef.current = true;
    setIsOfflineAuth(true);
    setUser({ id: record.userId, email: record.email } as User);
    log.info("Restored offline auth", { userId });
  }, [offlineAccounts]);

  // Memoize authMutations object for stable reference
  const authMutations = useMemo(() => ({
    signInWithEmail,
    signUpWithEmail,
    signOut,
  }), [signInWithEmail, signUpWithEmail, signOut]);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo<AuthContextType>(() => ({
    session,
    user,
    isLoading,
    loading: isLoading,
    isAuthenticated: !!user,
    isOffline,
    isOfflineAuth,
    offlineAccessEnabled,
    setOfflineAccess,
    offlineAccounts,
    continueOfflineAs,
    authMutations,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    signInWithGoogle,
    authHelpers,
    setSession,
    setUser,
  }), [
    session,
    user,
    isLoading,
    isOffline,
    isOfflineAuth,
    offlineAccessEnabled,
    setOfflineAccess,
    offlineAccounts,
    continueOfflineAs,
    authMutations,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    signInWithGoogle,
  ]);

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
