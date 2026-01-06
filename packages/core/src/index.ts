// Core package exports
// Export all modules here as they are created

// Modules
export * from "./modules/auth";
export * from "./modules/profile";
export * from "./modules/streams";
export * from "./modules/entries";
export * from "./modules/attachments";
export * from "./modules/locations";
export * from "./modules/settings";

// Shared utilities
export * from "./shared/types";
export * from "./shared/database.types";
export * from "./shared/constants";
export { supabase, initializeSupabase } from "./shared/supabase";