import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseConfig, isCoreConfigured } from "./config";

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

// Lazy-initialized Supabase client
let supabaseClient: SupabaseClient<Database> | null = null;

/**
 * Get the Supabase client instance.
 * Creates the client on first call using configuration from configureCore().
 *
 * @throws Error if configureCore() hasn't been called
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!supabaseClient) {
    if (!isCoreConfigured()) {
      throw new Error(
        '[Supabase] Core not configured. Call configureCore() at app startup before using Supabase.'
      );
    }

    const { url, anonKey } = getSupabaseConfig();
    const AsyncStorage = getAsyncStorage();

    supabaseClient = createClient<Database>(url, anonKey, {
      auth: {
        ...(AsyncStorage ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true, // Required for OAuth redirects on web
      },
    });
  }

  return supabaseClient;
}

/**
 * Supabase client accessor using Proxy for backwards compatibility.
 * Allows existing code using `supabase.from(...)` to continue working.
 *
 * @example
 * import { supabase } from '@trace/core';
 * const { data } = await supabase.from('entries').select('*');
 */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop: string | symbol) {
    const client = getSupabase();
    const value = client[prop as keyof SupabaseClient<Database>];
    // Bind methods to the client instance
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

/**
 * Reset the Supabase client (mainly for testing)
 * @internal
 */
export function resetSupabaseClient(): void {
  supabaseClient = null;
}
