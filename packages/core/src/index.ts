// Core package exports
// Export all modules here as they are created

// Modules
export * from "./modules/auth";
export * from "./modules/categories";
export * from "./modules/entries";
export * from "./modules/photos";
export * from "./modules/locations";

// Shared utilities
export * from "./shared/types";
export * from "./shared/database.types";
export * from "./shared/constants";
export { supabase, initializeSupabase } from "./shared/supabase";