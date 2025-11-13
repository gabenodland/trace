import { createContext, useContext, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthState } from "@trace/core";
import { handleMobileGoogleOAuth } from "../../modules/auth/utils/mobileOAuth";
import { localDB } from "../db/localDB";

// Get the return type of useAuthState and extend with mobile-specific Google OAuth
interface AuthContextType extends ReturnType<typeof useAuthState> {
  signInWithGoogle: () => Promise<{ error: unknown | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Get the query client from the provider above
  const queryClient = useQueryClient();

  // Use the shared auth state hook
  const authState = useAuthState(queryClient);

  // Add mobile-specific Google OAuth
  const signInWithGoogle = async () => {
    return await handleMobileGoogleOAuth();
  };

  // CRITICAL: Set current user ID in local database for multi-user support
  // When user signs in/out or switches accounts, update the local DB filter
  useEffect(() => {
    if (authState.user?.id) {
      // User is signed in - set their ID for query filtering
      localDB.setCurrentUser(authState.user.id);
    } else {
      // User signed out - clear the filter
      localDB.clearCurrentUser();
    }
  }, [authState.user?.id]);

  const value: AuthContextType = {
    ...authState,
    signInWithGoogle,
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
