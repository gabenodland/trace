/**
 * Core initialization for Trace mobile app
 *
 * This module must be imported BEFORE any @trace/core code is used.
 * It reads configuration from Expo's Constants and calls configureCore().
 */

import Constants from 'expo-constants';
import { configureCore } from '@trace/core';
import { createScopedLogger, LogScopes } from '../shared/utils/logger';

const log = createScopedLogger(LogScopes.Init);

// Get config from expo's extra (defined in app.config.js)
const extra = Constants.expoConfig?.extra;

// Log API key status in dev builds only
if (__DEV__) {
  log.debug('API key check', {
    supabaseUrl: extra?.supabaseUrl ? extra.supabaseUrl.substring(0, 30) + '...' : 'MISSING',
    supabaseAnonKey: extra?.supabaseAnonKey ? extra.supabaseAnonKey.substring(0, 5) + '...' : 'MISSING',
    mapboxToken: extra?.mapboxAccessToken ? extra.mapboxAccessToken.substring(0, 5) + '...' : 'MISSING',
    foursquareKey: extra?.foursquareApiKey ? extra.foursquareApiKey.substring(0, 5) + '...' : 'MISSING',
  });
}

// Validate required configuration
if (!extra?.supabaseUrl || !extra?.supabaseAnonKey) {
  log.error('Missing required Supabase configuration! Make sure .env.local exists with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY', undefined, { extra });
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
  log.info('Core configured successfully');
}
