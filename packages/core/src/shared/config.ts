/**
 * Configuration injection system for @trace/core
 *
 * Apps (mobile/web) provide configuration at startup via configureCore().
 * This keeps API keys out of the core package and allows each platform
 * to manage secrets differently (Expo env vars, Vite env vars, etc.)
 */

export interface CoreConfig {
  supabase: {
    url: string;
    anonKey: string;
  };
  mapbox?: {
    accessToken: string;
  };
  foursquare?: {
    apiKey: string;
  };
  /** Base URL for Foursquare proxy (web uses this instead of direct API) */
  foursquareProxyUrl?: string;
}

// Internal state - NOT exported
let config: CoreConfig | null = null;
let configWarningShown = false;

/**
 * Initialize core configuration - call once at app startup BEFORE using any core functions.
 *
 * @example
 * // In mobile app startup:
 * import { configureCore } from '@trace/core';
 *
 * configureCore({
 *   supabase: {
 *     url: Constants.expoConfig.extra.supabaseUrl,
 *     anonKey: Constants.expoConfig.extra.supabaseAnonKey,
 *   },
 *   mapbox: {
 *     accessToken: Constants.expoConfig.extra.mapboxAccessToken,
 *   },
 *   foursquare: {
 *     apiKey: Constants.expoConfig.extra.foursquareApiKey,
 *   },
 * });
 */
export function configureCore(appConfig: CoreConfig): void {
  if (config !== null && !configWarningShown) {
    console.warn('[Core] configureCore() called multiple times. Using first configuration.');
    configWarningShown = true;
    return;
  }

  // Validate required fields
  if (!appConfig.supabase?.url || !appConfig.supabase?.anonKey) {
    throw new Error('[Core] configureCore() requires supabase.url and supabase.anonKey');
  }

  config = appConfig;
}

/**
 * Check if core has been configured
 */
export function isCoreConfigured(): boolean {
  return config !== null;
}

/**
 * Get the full configuration - throws if not initialized
 */
export function getConfig(): CoreConfig {
  if (config === null) {
    throw new Error(
      '[Core] Core not configured. Call configureCore() at app startup before using any core functions.'
    );
  }
  return config;
}

/**
 * Get Supabase configuration
 */
export function getSupabaseConfig(): CoreConfig['supabase'] {
  return getConfig().supabase;
}

/**
 * Get Mapbox configuration (may be undefined if not configured)
 */
export function getMapboxConfig(): CoreConfig['mapbox'] | undefined {
  return getConfig().mapbox;
}

/**
 * Get Foursquare configuration (may be undefined if not configured)
 */
export function getFoursquareConfig(): CoreConfig['foursquare'] | undefined {
  return getConfig().foursquare;
}

/**
 * Get Foursquare proxy URL (for web, where direct API calls expose the key)
 */
export function getFoursquareProxyUrl(): string | undefined {
  return getConfig().foursquareProxyUrl;
}

/**
 * Reset configuration (mainly for testing)
 * @internal
 */
export function resetCoreConfig(): void {
  config = null;
  configWarningShown = false;
}
