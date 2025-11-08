// Auth module exports
// Following the pattern: export hooks, types, and helpers
// Export specific API functions needed for platform-specific OAuth

export * from "./authHooks";
export * from "./AuthTypes";
export * from "./authHelpers";

// Export specific API functions needed for OAuth integration
export { signInWithGoogle, setSession, onAuthStateChange } from "./authApi";