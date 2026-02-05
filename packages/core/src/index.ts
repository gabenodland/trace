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
export * from "./modules/subscriptions";
// Editor module NOT exported - only used in editor-web build (has Tiptap deps not in mobile)

// Shared utilities
export * from "./shared/types";
export * from "./shared/database.types";
export * from "./shared/constants";
export * from "./shared/featureGates";
export { supabase, getSupabase } from "./shared/supabase";
export { configureCore, isCoreConfigured } from "./shared/config";
export type { CoreConfig } from "./shared/config";
