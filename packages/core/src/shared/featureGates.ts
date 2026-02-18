/**
 * Feature Gates - Centralized feature access control
 *
 * Single source of truth for what features are available at each subscription tier.
 * Use hasFeature() for boolean features and getFeatureLimit() for numeric limits.
 */

// ============================================================================
// TYPES
// ============================================================================

export type SubscriptionTier = 'free' | 'pro';

export type SubscriptionPlatform = 'ios' | 'android' | 'web' | 'manual';

// Boolean features (on/off)
export type BooleanFeature =
  // Sync & Backup
  | 'cloudSync'
  | 'crossDeviceSync'
  | 'autoBackup'
  | 'fullExport'
  // Location
  | 'autoGeoLookup'
  | 'poiSearch'
  | 'locationHistory'
  // Appearance
  | 'allThemes'
  | 'allFonts'
  | 'customAccentColors'
  | 'appIconOptions'
  // Stats
  | 'advancedStats'
  | 'activityHeatmap'
  | 'wordCountAnalytics'
  // Streams
  | 'streamTemplates'
  // Integrations
  | 'apiAccess'
  // Advanced
  | 'fullTextSearch'
  | 'entryVersioning'
  | 'widgets'
  // Quality
  | 'highQualityImages'
  // Future
  | 'sharing'
  | 'collaboration';

// Limit-based features (numbers)
export type LimitFeature =
  | 'maxStorageMB'
  | 'maxEntries'
  | 'maxPhotosPerEntry'
  | 'maxDevices'
  | 'maxStreams'
  | 'maxTemplates'
  | 'maxTags'
  | 'maxReminders';

// ============================================================================
// FEATURE CONFIGURATION
// ============================================================================

/**
 * Boolean features and which tiers have access
 * Add tier to array to grant access
 */
const BOOLEAN_FEATURES: Record<BooleanFeature, SubscriptionTier[]> = {
  // Sync & Backup
  cloudSync: ['pro'],
  crossDeviceSync: ['pro'],
  autoBackup: ['pro'],
  fullExport: ['pro'],

  // Location
  autoGeoLookup: ['pro'],
  poiSearch: ['pro'],
  locationHistory: ['pro'],

  // Appearance
  allThemes: ['pro'],
  allFonts: ['pro'],
  customAccentColors: ['pro'],
  appIconOptions: ['pro'],

  // Stats
  advancedStats: ['pro'],
  activityHeatmap: ['pro'],
  wordCountAnalytics: ['pro'],

  // Streams
  streamTemplates: ['pro'],

  // Integrations
  apiAccess: ['pro'],

  // Advanced
  fullTextSearch: ['pro'],
  entryVersioning: ['pro'],
  widgets: ['pro'],

  // Quality
  highQualityImages: ['pro'],

  // Future
  sharing: ['pro'],
  collaboration: ['pro'],
};

/**
 * Numeric limits per tier
 * Use Infinity for unlimited
 */
const FEATURE_LIMITS: Record<LimitFeature, Record<SubscriptionTier, number>> = {
  maxStorageMB: { free: 100, pro: 5000 },
  maxEntries: { free: 500, pro: Infinity },
  maxPhotosPerEntry: { free: 3, pro: 20 },
  maxDevices: { free: 2, pro: Infinity },
  maxStreams: { free: 5, pro: Infinity },
  maxTemplates: { free: 2, pro: Infinity },
  maxTags: { free: 10, pro: Infinity },
  maxReminders: { free: 1, pro: Infinity },
};

// ============================================================================
// FEATURE CHECK FUNCTIONS
// ============================================================================

/**
 * Check if a boolean feature is available for a subscription tier
 */
export function hasFeature(feature: BooleanFeature, tier: SubscriptionTier): boolean {
  return BOOLEAN_FEATURES[feature]?.includes(tier) ?? false;
}

/**
 * Get the numeric limit for a feature at a subscription tier
 */
export function getFeatureLimit(feature: LimitFeature, tier: SubscriptionTier): number {
  return FEATURE_LIMITS[feature]?.[tier] ?? 0;
}

/**
 * Check if a numeric limit has been reached
 */
export function isLimitReached(
  feature: LimitFeature,
  tier: SubscriptionTier,
  currentValue: number
): boolean {
  const limit = getFeatureLimit(feature, tier);
  return currentValue >= limit;
}

/**
 * Get all features available for a tier (for display purposes)
 */
export function getFeaturesForTier(tier: SubscriptionTier): {
  booleanFeatures: BooleanFeature[];
  limits: Record<LimitFeature, number>;
} {
  const booleanFeatures = (Object.keys(BOOLEAN_FEATURES) as BooleanFeature[])
    .filter(feature => hasFeature(feature, tier));

  const limits = {} as Record<LimitFeature, number>;
  for (const feature of Object.keys(FEATURE_LIMITS) as LimitFeature[]) {
    limits[feature] = getFeatureLimit(feature, tier);
  }

  return { booleanFeatures, limits };
}

/**
 * Get the effective tier considering dev mode and expiration
 */
export function getEffectiveTier(
  tier: SubscriptionTier,
  expiresAt: string | null,
  isDevMode: boolean
): SubscriptionTier {
  // Dev mode = always pro
  if (isDevMode) return 'pro';

  // Check if subscription expired
  if (expiresAt) {
    const expired = new Date(expiresAt) < new Date();
    if (expired) return 'free';
  }

  return tier;
}

// ============================================================================
// FEATURE DISPLAY NAMES (for UI)
// ============================================================================

export const FEATURE_DISPLAY_NAMES: Record<BooleanFeature | LimitFeature, string> = {
  // Boolean features
  cloudSync: 'Cloud Sync',
  crossDeviceSync: 'Cross-Device Sync',
  autoBackup: 'Auto Backup',
  fullExport: 'Full Export (PDF, CSV)',
  autoGeoLookup: 'Auto Location Detection',
  poiSearch: 'POI Search',
  locationHistory: 'Location History Map',
  allThemes: 'All Themes',
  allFonts: 'All Fonts',
  customAccentColors: 'Custom Accent Colors',
  appIconOptions: 'App Icon Options',
  advancedStats: 'Advanced Statistics',
  activityHeatmap: 'Activity Heatmap',
  wordCountAnalytics: 'Word Count Analytics',
  streamTemplates: 'Stream Templates',
  apiAccess: 'API Access',
  fullTextSearch: 'Full-Text Search',
  entryVersioning: 'Entry Version History',
  widgets: 'Home Screen Widgets',
  highQualityImages: 'High Quality Images',
  sharing: 'Share Entries',
  collaboration: 'Collaborate with Others',

  // Limit features
  maxStorageMB: 'Storage',
  maxEntries: 'Entries',
  maxPhotosPerEntry: 'Photos per Entry',
  maxDevices: 'Devices',
  maxStreams: 'Streams',
  maxTemplates: 'Templates',
  maxTags: 'Tags',
  maxReminders: 'Reminders',
};
