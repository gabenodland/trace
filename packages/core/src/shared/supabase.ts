import { createClient } from "@supabase/supabase-js";
import config from "../../config.json";

// Dynamic AsyncStorage loading for React Native
function getAsyncStorage() {
  try {
    const isReactNative =
      (typeof navigator !== "undefined" && navigator.product === "ReactNative") ||
      (typeof global !== "undefined" && (global as any).__fbBatchedBridge);

    if (isReactNative) {
      const AsyncStorageModule = require("@react-native-async-storage/async-storage");
      return AsyncStorageModule.default || AsyncStorageModule;
    }
  } catch (e) {
    // Web environment
  }
  return undefined;
}

const AsyncStorage = getAsyncStorage();

export const supabase = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: {
    ...(AsyncStorage ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});