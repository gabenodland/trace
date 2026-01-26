// Supabase Edge Function: Foursquare Places API Proxy
// Keeps the Foursquare API key server-side for security
// Used by web app; mobile can call directly or use this proxy
//
// Updated for 2025 Foursquare API migration:
// - New host: places-api.foursquare.com (was api.foursquare.com)
// - No /v3 prefix on endpoints
// - Bearer token auth
// - X-Places-Api-Version header required

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FOURSQUARE_API_KEY = Deno.env.get("FOURSQUARE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

// Foursquare API version (date-based versioning)
const FOURSQUARE_API_VERSION = "2025-06-17";

// CORS headers - adjust origin for production
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // TODO: Restrict to your domains in production
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

// Whitelist of allowed Foursquare endpoints (no /v3 prefix in new API)
const ALLOWED_ENDPOINTS = [
  "/places/search",
  "/autocomplete",
];

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the JWT with Supabase
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the request
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: "Missing endpoint parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate endpoint is allowed
    const isAllowed = ALLOWED_ENDPOINTS.some(allowed => endpoint.startsWith(allowed));
    if (!isAllowed) {
      return new Response(
        JSON.stringify({ error: "Endpoint not allowed", allowed: ALLOWED_ENDPOINTS }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Foursquare URL with query params (new host: places-api.foursquare.com)
    const foursquareUrl = new URL(`https://places-api.foursquare.com${endpoint}`);

    // Forward query params (except 'endpoint')
    url.searchParams.forEach((value, key) => {
      if (key !== "endpoint") {
        foursquareUrl.searchParams.set(key, value);
      }
    });

    // Check for API key
    if (!FOURSQUARE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Foursquare API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Foursquare API (2025 migration: Bearer auth + version header)
    const foursquareResponse = await fetch(foursquareUrl.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${FOURSQUARE_API_KEY}`,
        "Accept": "application/json",
        "X-Places-Api-Version": FOURSQUARE_API_VERSION,
      },
    });

    const data = await foursquareResponse.json();

    // Return response
    return new Response(
      JSON.stringify(data),
      {
        status: foursquareResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Places proxy error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
