// Auth module exports
// Following the pattern: export hooks, types, and helpers
// Export specific API functions needed for platform-specific OAuth

export * from "./authHooks";
export * from "./AuthTypes";
export * from "./authHelpers";

// Export API functions for auth operations
// These are used by mobile AuthContext for offline-first auth
export {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOut,
  getSession,
  setSession,
  onAuthStateChange,
} from "./authApi";