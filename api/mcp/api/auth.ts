// MCP API Key Authentication
// Validates API keys against the api_keys table using server-side bcrypt verification

import { createClient } from "@supabase/supabase-js";
import type { AuthResult } from "./types";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

// API key format: tr_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
const API_KEY_PREFIX = "tr_live_";

/**
 * Validate an API key and return auth details if valid
 * Uses PostgreSQL's crypt() function for bcrypt verification (more reliable than JS implementation)
 */
export async function validateApiKey(apiKey: string): Promise<AuthResult | null> {
  // Basic format check
  if (!apiKey || !apiKey.startsWith(API_KEY_PREFIX) || apiKey.length < 20) {
    console.error("[MCP Auth] Invalid API key format");
    return null;
  }

  // Create client - verify_api_key is SECURITY DEFINER so anon key works
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    // Call the verify_api_key function which does bcrypt verification server-side
    console.log("[MCP Auth] Verifying key via RPC, prefix:", apiKey.substring(0, 16));
    const { data, error } = await supabase.rpc("verify_api_key", {
      p_full_key: apiKey,
    });

    if (error) {
      console.error("[MCP Auth] RPC error:", error.message);
      return null;
    }

    // The function returns an array with 0 or 1 rows
    const records = data as Array<{
      api_key_id: string;
      user_id: string;
      name: string;
      scope: string;
    }>;

    if (!records || records.length === 0) {
      console.error("[MCP Auth] Key not found or invalid");
      return null;
    }

    const record = records[0];
    console.log("[MCP Auth] Key verified successfully for user:", record.user_id);

    return {
      userId: record.user_id,
      scope: record.scope as "read" | "full",
      keyId: record.api_key_id,
      keyName: record.name,
    };
  } catch (err) {
    console.error("[MCP Auth] Validation error:", err);
    return null;
  }
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Check if an auth result has required scope
 */
export function hasScope(auth: AuthResult, requiredScope: "read" | "full"): boolean {
  if (requiredScope === "read") {
    // Both 'read' and 'full' can read
    return true;
  }
  // Only 'full' scope can write
  return auth.scope === "full";
}
