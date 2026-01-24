/**
 * Core initialization for Trace mobile app
 *
 * This module must be imported BEFORE any @trace/core code is used.
 * It reads configuration from Expo's Constants and calls configureCore().
 */

import Constants from 'expo-constants';
import { configureCore } from '@trace/core';

// Get config from expo's extra (defined in app.config.js)
const extra = Constants.expoConfig?.extra;

// Log API key status in dev builds only
if (__DEV__) {
  console.log('[InitCore] === API KEY CHECK ===');
  console.log('[InitCore] Supabase URL:', extra?.supabaseUrl ? extra.supabaseUrl.substring(0, 30) + '...' : 'MISSING');
  console.log('[InitCore] Supabase Anon Key:', extra?.supabaseAnonKey ? extra.supabaseAnonKey.substring(0, 5) + '...' : 'MISSING');
  console.log('[InitCore] Mapbox Token:', extra?.mapboxAccessToken ? extra.mapboxAccessToken.substring(0, 5) + '...' : 'MISSING');
  console.log('[InitCore] Foursquare Key:', extra?.foursquareApiKey ? extra.foursquareApiKey.substring(0, 5) + '...' : 'MISSING');
  console.log('[InitCore] ======================');
}

// Validate required configuration
if (!extra?.supabaseUrl || !extra?.supabaseAnonKey) {
  console.error('[InitCore] Missing required Supabase configuration!');
  console.error('[InitCore] Make sure .env.local exists with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  console.error('[InitCore] Current extra:', JSON.stringify(extra, null, 2));
}

// Initialize core with configuration from environment
configureCore({
  supabase: {
    url: extra?.supabaseUrl || '',
    anonKey: extra?.supabaseAnonKey || '',
  },
  mapbox: extra?.mapboxAccessToken ? {
    accessToken: extra.mapboxAccessToken,
  } : undefined,
  foursquare: extra?.foursquareApiKey ? {
    apiKey: extra.foursquareApiKey,
  } : undefined,
  // No proxy URL for mobile - we call Foursquare directly
});

if (__DEV__) {
  console.log('[InitCore] Core configured successfully');
}
