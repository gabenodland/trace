/**
 * Settings Types - User preferences and app configuration
 *
 * All user settings are stored as a single object for efficient persistence.
 */

import type { EntrySortMode, EntrySortOrder, EntryDisplayMode } from '../entries/EntryDisplayTypes';

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
// PRIORITY TYPES
// ============================================================================

/**
 * Priority level value (stored as integer on entry.priority)
 * Higher number = higher priority
 */
export type PriorityLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Priority category for theme-aware coloring
 * Maps to theme.colors.priority[category]
 */
export type PriorityCategory = 'urgent' | 'high' | 'medium' | 'low' | 'none';

/**
 * Priority level info for UI display
 */
export interface PriorityInfo {
  value: PriorityLevel;
  label: string;
  color: string;           // Fallback color (used if no theme)
  category: PriorityCategory; // Maps to theme.colors.priority[category]
}

/**
 * All priority levels with their display info
 * Ordered from highest to lowest for UI display
 */
export const ALL_PRIORITIES: PriorityInfo[] = [
  { value: 4, label: "Urgent", color: "#ef4444", category: "urgent" },
  { value: 3, label: "High", color: "#f97316", category: "high" },
  { value: 2, label: "Medium", color: "#eab308", category: "medium" },
  { value: 1, label: "Low", color: "#3b82f6", category: "low" },
  { value: 0, label: "None", color: "#9ca3af", category: "none" },
];

/**
 * Get priority info by value
 */
export function getPriorityInfo(value: number): PriorityInfo | undefined {
  return ALL_PRIORITIES.find(p => p.value === value);
}

/**
 * Get priority label
 */
export function getPriorityLabel(value: number): string {
  return getPriorityInfo(value)?.label || "None";
}

/**
 * Get priority category for theme-aware coloring
 */
export function getPriorityCategory(value: number): PriorityCategory {
  return getPriorityInfo(value)?.category || "none";
}

// ============================================================================
// DUE DATE PRESET TYPES
// ============================================================================

/**
 * Due date filter presets
 */
export type DueDatePreset =
  | 'all'           // No filter
  | 'overdue'       // Due date < today
  | 'today'         // Due date = today
  | 'this_week'     // Due date within current week
  | 'next_week'     // Due date within next week
  | 'has_due_date'  // Has any due date set
  | 'no_due_date'   // No due date set
  | 'custom';       // Custom date range

/**
 * Due date preset info for UI
 */
export interface DueDatePresetInfo {
  value: DueDatePreset;
  label: string;
}

/**
 * All due date presets
 */
export const DUE_DATE_PRESETS: DueDatePresetInfo[] = [
  { value: 'all', label: "All" },
  { value: 'overdue', label: "Overdue" },
  { value: 'today', label: "Today" },
  { value: 'this_week', label: "This Week" },
  { value: 'next_week', label: "Next Week" },
  { value: 'has_due_date', label: "Has Due Date" },
  { value: 'no_due_date', label: "No Due Date" },
  { value: 'custom', label: "Custom Range" },
];

// ============================================================================
// PHOTOS FILTER TYPES
// ============================================================================

/**
 * Photos filter state
 * null = show all, true = only with photos, false = only without photos
 */
export type PhotosFilter = boolean | null;

// ============================================================================
// RATING FILTER TYPES
// ============================================================================

/**
 * Rating filter operator
 */
export type RatingOperator = '>=' | '<=' | '=';

/**
 * Rating operator option for UI
 */
export interface RatingOperatorOption {
  value: RatingOperator;
  label: string;
}

/**
 * All rating operators
 */
export const RATING_OPERATORS: RatingOperatorOption[] = [
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: '=', label: '=' },
];

// ============================================================================
// STREAM VIEW PREFERENCES
// ============================================================================

/**
 * View preferences for a single stream (sort + display + filter)
 */
export interface StreamSortPreference {
  sortMode: EntrySortMode;
  sortOrder: EntrySortOrder;
  showPinnedFirst: boolean;
  displayMode: EntryDisplayMode;
  filter?: StreamViewFilter; // Optional UI-level filter (defaults applied if missing)
}

/**
 * UI-level filter preferences for entry lists (client-side filtering)
 * Note: This is separate from EntryFilter in EntryTypes.ts which is for API queries
 */
export interface StreamViewFilter {
  // Existing filters
  showArchived: boolean;      // Show archived entries (default: false)
  statuses: string[];         // Empty = show all statuses
  showPrivateNotes: boolean;  // Show private notes (default: true)

  // New filters
  priorities: PriorityLevel[];     // Empty = show all priorities
  types: string[];                 // Empty = show all types (stream-specific)
  ratingOperator: RatingOperator | null;  // Rating comparison operator (null = no filter)
  ratingValue: number | null;      // Rating value to compare (null = no filter)
  hasPhotos: PhotosFilter;         // null = all, true = with photos, false = without
  dueDatePreset: DueDatePreset;    // Due date filter preset
  dueDateStart: string | null;     // Custom due date range start (ISO string)
  dueDateEnd: string | null;       // Custom due date range end (ISO string)
  entryDateStart: string | null;   // Entry date range start (ISO string)
  entryDateEnd: string | null;     // Entry date range end (ISO string)
}

/**
 * Default filter settings
 */
export const DEFAULT_STREAM_VIEW_FILTER: StreamViewFilter = {
  showArchived: false,
  statuses: [],
  showPrivateNotes: true,
  priorities: [],
  types: [],
  ratingOperator: null,
  ratingValue: null,
  hasPhotos: null,
  dueDatePreset: 'all',
  dueDateStart: null,
  dueDateEnd: null,
  entryDateStart: null,
  entryDateEnd: null,
};

// ============================================================================
// THEME SETTINGS
// ============================================================================

/**
 * Theme setting - references a theme by ID
 * Available themes are defined in apps/mobile/src/shared/theme/themes/
 * To add new themes, create a file in that directory and register it.
 */
export type ThemeSetting = string;

/**
 * Default theme ID
 */
export const DEFAULT_THEME = 'light';

// ============================================================================
// FONT SETTINGS
// ============================================================================

/**
 * Font setting - references a font by ID
 * Available fonts are defined in apps/mobile/src/shared/theme/fonts/
 */
export type FontSetting = string;

/**
 * Default font ID
 */
export const DEFAULT_FONT = 'inter';

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

  // Theme preference (theme ID, e.g., 'light', 'dark', 'sepia')
  theme: ThemeSetting;

  // Font preference (font ID, e.g., 'inter', 'lora', 'jetbrains')
  font: FontSetting;

  // Location preferences
  captureGpsLocation: boolean;

  // Photo preferences
  imageQuality: ImageQuality;

  // Per-stream sort preferences (streamId -> preferences)
  streamSortPreferences: Record<string, StreamSortPreference>;
}

/**
 * Default settings for new users
 */
export const DEFAULT_SETTINGS: UserSettings = {
  units: 'metric',
  theme: DEFAULT_THEME,
  font: DEFAULT_FONT,
  captureGpsLocation: true,
  imageQuality: 'standard',
  streamSortPreferences: {},
};

/**
 * Storage key for persisting settings
 */
export const SETTINGS_STORAGE_KEY = 'user_settings';
