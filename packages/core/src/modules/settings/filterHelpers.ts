/**
 * Filter Helpers - Shared logic for determining active filter state
 *
 * Used by both EntryListScreen (filter count badge) and FilterBottomSheet (section badges)
 */

import type { StreamViewFilter, PriorityLevel, DueDatePreset } from './SettingsTypes';
import { ALL_PRIORITIES, DUE_DATE_PRESETS, getPriorityLabel } from './SettingsTypes';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Stream context for filter calculations
 * Provides the available options for status and type filters
 */
export interface FilterStreamContext {
  /** Available status values for this stream (defaults to ALL_STATUSES if not provided) */
  availableStatuses: string[];
  /** Available entry types for this stream (stream.entry_types) */
  availableTypes: string[];
}

/**
 * Info about a single filter category's active state
 */
export interface FilterCategoryInfo {
  /** Whether this filter is actively filtering (not showing all) */
  isActive: boolean;
  /** Badge label for UI display (undefined if not active) */
  badge: string | undefined;
}

/**
 * Complete filter state info for all categories
 */
export interface ActiveFilterInfo {
  status: FilterCategoryInfo;
  type: FilterCategoryInfo;
  priority: FilterCategoryInfo;
  archived: FilterCategoryInfo;
  rating: FilterCategoryInfo;
  photos: FilterCategoryInfo;
  dueDate: FilterCategoryInfo;
  entryDate: FilterCategoryInfo;
  /** Total number of active filter categories */
  activeCount: number;
  /** Whether any filter is active */
  hasActiveFilters: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if status filter is active
 */
function getStatusFilterInfo(
  selectedStatuses: string[] | undefined,
  availableStatuses: string[] | undefined
): FilterCategoryInfo {
  const statuses = selectedStatuses ?? [];
  const available = availableStatuses ?? [];
  const validSelected = statuses.filter(s => available.includes(s));
  const allSelected = available.length > 0 && validSelected.length === available.length;
  const isActive = validSelected.length > 0 && !allSelected;

  return {
    isActive,
    badge: isActive ? `${validSelected.length} selected` : undefined,
  };
}

/**
 * Check if type filter is active
 */
function getTypeFilterInfo(
  selectedTypes: string[] | undefined,
  availableTypes: string[] | undefined
): FilterCategoryInfo {
  const types = selectedTypes ?? [];
  const available = availableTypes ?? [];
  const validSelected = types.filter(t => available.includes(t));
  const allSelected = available.length > 0 && validSelected.length === available.length;
  const isActive = validSelected.length > 0 && !allSelected;

  let badge: string | undefined;
  if (isActive) {
    badge = validSelected.length === 1 ? validSelected[0] : `${validSelected.length} selected`;
  }

  return { isActive, badge };
}

/**
 * Check if priority filter is active
 */
function getPriorityFilterInfo(selectedPriorities: PriorityLevel[] | undefined): FilterCategoryInfo {
  const priorities = selectedPriorities ?? [];
  const allSelected = priorities.length === ALL_PRIORITIES.length;
  const isActive = priorities.length > 0 && !allSelected;

  let badge: string | undefined;
  if (isActive) {
    badge = priorities.length === 1
      ? getPriorityLabel(priorities[0])
      : `${priorities.length} selected`;
  }

  return { isActive, badge };
}

/**
 * Check if archived filter is active
 */
function getArchivedFilterInfo(showArchived: boolean): FilterCategoryInfo {
  return {
    isActive: showArchived,
    badge: showArchived ? 'Showing' : undefined,
  };
}

/**
 * Check if rating filter is active
 */
function getRatingFilterInfo(
  ratingMin: number | null,
  ratingMax: number | null
): FilterCategoryInfo {
  const isActive = ratingMin !== null || ratingMax !== null;

  let badge: string | undefined;
  if (isActive) {
    if (ratingMin !== null && ratingMax !== null) {
      badge = ratingMin === ratingMax ? `${ratingMin}★` : `${ratingMin}-${ratingMax}★`;
    } else if (ratingMin !== null) {
      badge = `${ratingMin}+★`;
    } else if (ratingMax !== null) {
      badge = `≤${ratingMax}★`;
    }
  }

  return { isActive, badge };
}

/**
 * Check if photos filter is active
 */
function getPhotosFilterInfo(hasPhotos: boolean | null): FilterCategoryInfo {
  const isActive = hasPhotos !== null;
  return {
    isActive,
    badge: hasPhotos === true ? 'With photos' : hasPhotos === false ? 'Without photos' : undefined,
  };
}

/**
 * Check if due date filter is active
 */
function getDueDateFilterInfo(dueDatePreset: DueDatePreset | undefined): FilterCategoryInfo {
  const preset = dueDatePreset ?? 'all';
  const isActive = preset !== 'all';
  const presetInfo = DUE_DATE_PRESETS.find(p => p.value === preset);
  return {
    isActive,
    badge: isActive ? presetInfo?.label : undefined,
  };
}

/**
 * Check if entry date filter is active
 */
function getEntryDateFilterInfo(
  entryDateStart: string | null,
  entryDateEnd: string | null
): FilterCategoryInfo {
  const isActive = entryDateStart !== null || entryDateEnd !== null;

  let badge: string | undefined;
  if (isActive) {
    const formatDate = (iso: string) =>
      new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    if (entryDateStart && entryDateEnd) {
      badge = `${formatDate(entryDateStart)} - ${formatDate(entryDateEnd)}`;
    } else if (entryDateStart) {
      badge = `After ${formatDate(entryDateStart)}`;
    } else if (entryDateEnd) {
      badge = `Before ${formatDate(entryDateEnd)}`;
    }
  }

  return { isActive, badge };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Get complete active filter info for a StreamViewFilter
 *
 * @param filter - The filter settings to analyze
 * @param context - Stream context with available statuses and types
 * @returns Complete info about which filters are active with badge labels
 *
 * @example
 * ```ts
 * const filterInfo = getActiveFilterInfo(streamFilter, {
 *   availableStatuses: stream?.entry_statuses ?? ALL_STATUSES.map(s => s.value),
 *   availableTypes: stream?.entry_types ?? [],
 * });
 *
 * // Use in EntryListScreen for badge count
 * const { hasActiveFilters, activeCount } = filterInfo;
 *
 * // Use in FilterBottomSheet for section badges
 * const statusBadge = filterInfo.status.badge;
 * ```
 */
export function getActiveFilterInfo(
  filter: StreamViewFilter,
  context: FilterStreamContext
): ActiveFilterInfo {
  const status = getStatusFilterInfo(filter.statuses, context.availableStatuses);
  const type = getTypeFilterInfo(filter.types, context.availableTypes);
  const priority = getPriorityFilterInfo(filter.priorities);
  const archived = getArchivedFilterInfo(filter.showArchived);
  const rating = getRatingFilterInfo(filter.ratingMin, filter.ratingMax);
  const photos = getPhotosFilterInfo(filter.hasPhotos);
  const dueDate = getDueDateFilterInfo(filter.dueDatePreset);
  const entryDate = getEntryDateFilterInfo(filter.entryDateStart, filter.entryDateEnd);

  const categories = [status, type, priority, archived, rating, photos, dueDate, entryDate];
  const activeCount = categories.filter(c => c.isActive).length;

  return {
    status,
    type,
    priority,
    archived,
    rating,
    photos,
    dueDate,
    entryDate,
    activeCount,
    hasActiveFilters: activeCount > 0,
  };
}
