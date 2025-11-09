// Public API for categories module

// Export the main hook (SINGLE SOURCE OF TRUTH)
export { useCategories } from "./categoryHooks";

// Export all types
export * from "./CategoryTypes";

// Export all helpers
export * from "./categoryHelpers";

// DO NOT export API functions - they are internal only
