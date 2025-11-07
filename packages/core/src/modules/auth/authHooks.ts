import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  login,
  signUp,
  logout,
  getCurrentUser,
  refreshSession,
  resetPassword,
  updatePassword
} from "./authApi";
import type { LoginCredentials, SignupData, AuthSession } from "./AuthTypes";
import type { User } from "../../shared/types";

// Query keys
const QUERY_KEYS = {
  currentUser: ["auth", "currentUser"],
  session: ["auth", "session"],
};

/**
 * Hook to get the current user
 */
function useCurrentUserQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.currentUser,
    queryFn: getCurrentUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to handle user login
 */
function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: (session: AuthSession) => {
      // Update the current user in the cache
      queryClient.setQueryData(QUERY_KEYS.currentUser, session.user);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.currentUser });
    },
  });
}

/**
 * Hook to handle user signup
 */
function useSignupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signUp,
    onSuccess: (session: AuthSession) => {
      // Update the current user in the cache
      queryClient.setQueryData(QUERY_KEYS.currentUser, session.user);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.currentUser });
    },
  });
}

/**
 * Hook to handle user logout
 */
function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Clear all auth-related queries
      queryClient.setQueryData(QUERY_KEYS.currentUser, null);
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      // Optionally clear all queries
      queryClient.clear();
    },
  });
}

/**
 * Hook to handle password reset
 */
function useResetPasswordMutation() {
  return useMutation({
    mutationFn: resetPassword,
  });
}

/**
 * Hook to handle password update
 */
function useUpdatePasswordMutation() {
  return useMutation({
    mutationFn: updatePassword,
  });
}

/**
 * Main auth hook - THE SINGLE SOURCE OF TRUTH for authentication
 */
export function useAuth() {
  const userQuery = useCurrentUserQuery();
  const loginMutation = useLoginMutation();
  const signupMutation = useSignupMutation();
  const logoutMutation = useLogoutMutation();
  const resetPasswordMutation = useResetPasswordMutation();
  const updatePasswordMutation = useUpdatePasswordMutation();

  return {
    // Data
    user: userQuery.data || null,
    isAuthenticated: !!userQuery.data,
    isLoading: userQuery.isLoading,
    error: userQuery.error,

    // Mutations
    authMutations: {
      login: loginMutation.mutateAsync,
      signup: signupMutation.mutateAsync,
      logout: logoutMutation.mutateAsync,
      resetPassword: resetPasswordMutation.mutateAsync,
      updatePassword: updatePasswordMutation.mutateAsync,
    },

    // Loading states for mutations
    isLoginLoading: loginMutation.isPending,
    isSignupLoading: signupMutation.isPending,
    isLogoutLoading: logoutMutation.isPending,
  };
}