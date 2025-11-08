import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Dynamic AsyncStorage loading for React Native
function getAsyncStorage() {
  try {
    // Check if we're in React Native environment by checking for __fbBatchedBridge
    // This is a more reliable check that works in both dev and production
    if (typeof global !== "undefined" && (global as any).__fbBatchedBridge) {
      const AsyncStorageModule = require("@react-native-async-storage/async-storage");
      return AsyncStorageModule.default || AsyncStorageModule;
    }
  } catch (e) {
    // Not in React Native environment
  }
  return undefined;
}

const AsyncStorage = getAsyncStorage();

// Supabase configuration
// Apps (web/mobile) should provide these via environment variables
let supabaseUrl: string;
let supabaseAnonKey: string;

try {
  // Try to load from config.json (fallback for development)
  const config = require("../../config.json");
  supabaseUrl = config.supabase.url;
  supabaseAnonKey = config.supabase.anonKey;
} catch (e) {
  // Config.json not found - environment variables must be provided by app
  supabaseUrl = "";
  supabaseAnonKey = "";
}

// Allow apps to override with their own config
export function initializeSupabase(url?: string, anonKey?: string) {
  const finalUrl = url || supabaseUrl;
  const finalKey = anonKey || supabaseAnonKey;

  if (!finalUrl || !finalKey) {
    throw new Error(
      "Supabase configuration missing. Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables or create packages/core/config.json"
    );
  }

  return createClient<Database>(finalUrl, finalKey, {
    auth: {
      ...(AsyncStorage ? { storage: AsyncStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

// Default client instance
export const supabase: SupabaseClient<Database> = initializeSupabase();