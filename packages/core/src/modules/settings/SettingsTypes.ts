/**
 * Settings Types - User preferences and app configuration
 *
 * All user settings are stored as a single object for efficient persistence.
 */

// ============================================================================
// UNIT TYPES
// ============================================================================

export type UnitSystem = 'metric' | 'imperial';

export interface UnitOption {
  value: UnitSystem;
  label: string;
  description: string;
}

export const UNIT_OPTIONS: UnitOption[] = [
  {
    value: 'metric',
    label: 'Metric',
    description: 'Meters, kilometers',
  },
  {
    value: 'imperial',
    label: 'Imperial',
    description: 'Feet, miles',
  },
];

// ============================================================================
// IMAGE QUALITY SETTINGS
// ============================================================================

export type ImageQuality = 'full' | 'high' | 'standard' | 'small';

export interface ImageQualityOption {
  value: ImageQuality;
  label: string;
  description: string;
}

export const IMAGE_QUALITY_OPTIONS: ImageQualityOption[] = [
  {
    value: 'full',
    label: 'Full Quality',
    description: 'No additional compression. Gallery photos preserve original quality.',
  },
  {
    value: 'high',
    label: 'High',
    description: '2560px max, 90% quality (~1-3 MB)',
  },
  {
    value: 'standard',
    label: 'Standard',
    description: '1280px max, 70% quality (~300 KB-1 MB)',
  },
  {
    value: 'small',
    label: 'Small',
    description: '800px max, 50% quality (~100-300 KB)',
  },
];

/**
 * Image quality preset configurations
 */
export const IMAGE_QUALITY_PRESETS: Record<ImageQuality, { maxWidth: number | null; compress: number }> = {
  full: { maxWidth: null, compress: 1.0 },
  high: { maxWidth: 2560, compress: 0.9 },
  standard: { maxWidth: 1280, compress: 0.7 },
  small: { maxWidth: 800, compress: 0.5 },
};

// ============================================================================
// STREAM VIEW PREFERENCES
// ============================================================================

import type { EntrySortMode, EntrySortOrder, EntryDisplayMode } from '../entries/EntryDisplayTypes';

/**
 * View preferences for a single stream (sort + display)
 */
export interface StreamSortPreference {
  sortMode: EntrySortMode;
  sortOrder: EntrySortOrder;
  showPinnedFirst: boolean;
  displayMode: EntryDisplayMode;
}

// ============================================================================
// USER SETTINGS
// ============================================================================

/**
 * Main user settings interface
 * Add new settings here as the app grows
 */
export interface UserSettings {
  // Display preferences
  units: UnitSystem;

  // Location preferences
  captureGpsLocation: boolean;

  // Photo preferences
  imageQuality: ImageQuality;

  // Per-stream sort preferences (streamId -> preferences)
  streamSortPreferences: Record<string, StreamSortPreference>;

  // Future settings can be added here:
  // theme: 'light' | 'dark' | 'system';
  // dateFormat: 'US' | 'EU' | 'ISO';
  // notificationsEnabled: boolean;
}

/**
 * Default settings for new users
 */
export const DEFAULT_SETTINGS: UserSettings = {
  units: 'metric',
  captureGpsLocation: true,
  imageQuality: 'standard',
  streamSortPreferences: {},
};

/**
 * Storage key for persisting settings
 */
export const SETTINGS_STORAGE_KEY = 'user_settings';
