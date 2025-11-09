import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import config from "../../config.json";

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

// Configuration from package-level config.json - easy to find and modify
export const supabase = createClient<Database>(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      ...(AsyncStorage ? { storage: AsyncStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true, // Required for OAuth redirects on web
    },
  }
);

// For backwards compatibility - allow apps to override
export function initializeSupabase(url?: string, anonKey?: string) {
  return createClient<Database>(
    url || config.supabase.url,
    anonKey || config.supabase.anonKey,
    {
      auth: {
        ...(AsyncStorage ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    }
  );
}