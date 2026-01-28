/**
 * SettingsDrawerContent
 *
 * Content for the settings drawer (right side).
 * Contains View, Sort, and Filter controls as compact rows that open modals.
 */

import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { useSettings } from "../../shared/contexts/SettingsContext";
import { useSettingsDrawer } from "../../shared/contexts/SettingsDrawerContext";
import { useDrawer } from "../../shared/contexts/DrawerContext";
import { themeBase } from "../../shared/theme/themeBase";
import {
  ENTRY_DISPLAY_MODES,
  ENTRY_SORT_MODES,
  ALL_STATUSES,
  ALL_PRIORITIES,
  DUE_DATE_PRESETS,
  getPriorityLabel,
  type EntryDisplayMode,
  type EntrySortMode,
  type EntrySortOrder,
  type PriorityLevel,
  type DueDatePreset,
  type PhotosFilter,
} from "@trace/core";
import { useStream } from "../../modules/streams/mobileStreamHooks";
import { DisplayModeSelector } from "../../modules/entries/components/DisplayModeSelector";
import { SortModeSelector } from "../../modules/entries/components/SortModeSelector";
import { StatusFilterSelector } from "../../modules/entries/components/StatusFilterSelector";
import { PriorityFilterSelector } from "../../modules/entries/components/PriorityFilterSelector";
import { TypeFilterSelector } from "../../modules/entries/components/TypeFilterSelector";
import { RatingFilterSelector } from "../../modules/entries/components/RatingFilterSelector";
import { DueDateFilterSelector } from "../../modules/entries/components/DueDateFilterSelector";
import { EntryDateRangeSelector } from "../../modules/entries/components/EntryDateRangeSelector";

export function SettingsDrawerContent() {
  const theme = useTheme();
  const { closeDrawer } = useSettingsDrawer();

  // Drawer-specific text colors (with fallbacks to regular text colors)
  // Must match StreamDrawerContent for consistent theming across drawers
  const drawerTextPrimary = theme.colors.surface.drawerText || theme.colors.text.primary;
  const drawerTextSecondary = theme.colors.surface.drawerTextSecondary || theme.colors.text.secondary;
  const drawerTextTertiary = theme.colors.surface.drawerTextTertiary || theme.colors.text.tertiary;
  const { selectedStreamId } = useDrawer();
  const { getStreamSortPreference, setStreamSortPreference, getStreamFilter, setStreamFilter } = useSettings();

  const currentPref = getStreamSortPreference(selectedStreamId);
  const currentFilter = getStreamFilter(selectedStreamId);

  // Get stream data for filter visibility
  const { stream } = useStream(selectedStreamId ?? null);
  const isAllEntriesView = !selectedStreamId;

  // When viewing a specific stream, only show its allowed statuses
  // When viewing "All Entries", show all statuses (undefined = all)
  const allowedStatuses = selectedStreamId && stream?.entry_statuses
    ? stream.entry_statuses
    : undefined;

  // Determine which filters to show based on stream settings
  // In "All Entries" view, show all filters except Type
  const showStatusFilter = isAllEntriesView || stream?.entry_use_status !== false;
  const showPriorityFilter = isAllEntriesView || stream?.entry_use_priority === true;
  const showTypeFilter = !isAllEntriesView && stream?.entry_use_type === true && (stream?.entry_types?.length ?? 0) > 0;
  const showRatingFilter = isAllEntriesView || stream?.entry_use_rating === true;
  const showPhotosFilter = isAllEntriesView || stream?.entry_use_photos !== false;
  const showDueDateFilter = isAllEntriesView || stream?.entry_use_duedates === true;
  const showEntryDateFilter = true; // Always show

  // Get rating type for display
  const ratingType = stream?.entry_rating_type || 'decimal_whole';

  // Modal visibility state
  const [displayModalVisible, setDisplayModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [priorityModalVisible, setPriorityModalVisible] = useState(false);
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [dueDateModalVisible, setDueDateModalVisible] = useState(false);
  const [entryDateModalVisible, setEntryDateModalVisible] = useState(false);

  // Update display mode
  const handleDisplayModeChange = (mode: EntryDisplayMode) => {
    setStreamSortPreference(selectedStreamId, { displayMode: mode });
  };

  // Update sort mode
  const handleSortModeChange = (mode: EntrySortMode) => {
    setStreamSortPreference(selectedStreamId, { sortMode: mode });
  };

  // Update sort order
  const handleSortOrderChange = (order: EntrySortOrder) => {
    setStreamSortPreference(selectedStreamId, { sortOrder: order });
  };

  // Toggle pinned first
  const handlePinnedFirstChange = (value: boolean) => {
    setStreamSortPreference(selectedStreamId, { showPinnedFirst: value });
  };

  // Toggle show archived
  const handleShowArchivedChange = (value: boolean) => {
    setStreamFilter(selectedStreamId, { showArchived: value });
  };

  // Update status filter
  const handleStatusFilterChange = (statuses: string[]) => {
    setStreamFilter(selectedStreamId, { statuses });
  };

  // Update priority filter
  const handlePriorityFilterChange = (priorities: PriorityLevel[]) => {
    setStreamFilter(selectedStreamId, { priorities });
  };

  // Update type filter
  const handleTypeFilterChange = (types: string[]) => {
    setStreamFilter(selectedStreamId, { types });
  };

  // Update rating filter
  const handleRatingFilterChange = (ratingMin: number | null, ratingMax: number | null) => {
    setStreamFilter(selectedStreamId, { ratingMin, ratingMax });
  };

  // Update photos filter (three-state toggle)
  const handlePhotosFilterChange = (hasPhotos: PhotosFilter) => {
    setStreamFilter(selectedStreamId, { hasPhotos });
  };

  // Update due date filter
  const handleDueDateFilterChange = (dueDatePreset: DueDatePreset, dueDateStart: string | null, dueDateEnd: string | null) => {
    setStreamFilter(selectedStreamId, { dueDatePreset, dueDateStart, dueDateEnd });
  };

  // Update entry date filter
  const handleEntryDateFilterChange = (entryDateStart: string | null, entryDateEnd: string | null) => {
    setStreamFilter(selectedStreamId, { entryDateStart, entryDateEnd });
  };

  // Get display values for selectors
  const displayModeLabel = ENTRY_DISPLAY_MODES.find(m => m.value === currentPref.displayMode)?.label || "Title Only";
  const sortModeLabel = ENTRY_SORT_MODES.find(m => m.value === currentPref.sortMode)?.label || "Date";

  // Status filter label - treat "all selected" same as "none selected"
  // Filter out any stale selections that aren't in the current allowed statuses
  const availableStatusValues = (allowedStatuses ?? ALL_STATUSES.map(s => s.value)) as string[];
  const validSelectedStatuses = currentFilter.statuses.filter(s => availableStatusValues.includes(s));
  const totalAvailableStatuses = availableStatusValues.length;
  const allStatusesSelected = validSelectedStatuses.length === totalAvailableStatuses;
  const statusFilterLabel = validSelectedStatuses.length === 0 || allStatusesSelected
    ? "All statuses"
    : `${validSelectedStatuses.length} selected`;

  // Priority filter label
  const allPrioritiesSelected = currentFilter.priorities.length === ALL_PRIORITIES.length;
  const priorityFilterLabel = currentFilter.priorities.length === 0 || allPrioritiesSelected
    ? "All priorities"
    : currentFilter.priorities.length === 1
      ? getPriorityLabel(currentFilter.priorities[0])
      : `${currentFilter.priorities.length} selected`;
  const isPriorityFiltering = currentFilter.priorities.length > 0 && !allPrioritiesSelected;

  // Type filter label
  const availableTypes = stream?.entry_types ?? [];
  const validSelectedTypes = currentFilter.types.filter(t => availableTypes.includes(t));
  const allTypesSelected = validSelectedTypes.length === availableTypes.length;
  const typeFilterLabel = validSelectedTypes.length === 0 || allTypesSelected
    ? "All types"
    : validSelectedTypes.length === 1
      ? validSelectedTypes[0]
      : `${validSelectedTypes.length} selected`;
  const isTypeFiltering = validSelectedTypes.length > 0 && !allTypesSelected;

  // Rating filter label
  const getRatingLabel = (): string => {
    const { ratingMin, ratingMax } = currentFilter;
    if (ratingMin === null && ratingMax === null) return "All ratings";
    if (ratingType === 'stars') {
      const minStars = ratingMin !== null ? ratingMin / 2 : null;
      const maxStars = ratingMax !== null ? ratingMax / 2 : null;
      if (minStars !== null && maxStars !== null) return `${'★'.repeat(minStars)} - ${'★'.repeat(maxStars)}`;
      if (minStars !== null) return `≥ ${'★'.repeat(minStars)}`;
      if (maxStars !== null) return `≤ ${'★'.repeat(maxStars)}`;
    }
    if (ratingMin !== null && ratingMax !== null) return `${ratingMin} - ${ratingMax}`;
    if (ratingMin !== null) return `≥ ${ratingMin}`;
    if (ratingMax !== null) return `≤ ${ratingMax}`;
    return "All ratings";
  };
  const ratingFilterLabel = getRatingLabel();
  const isRatingFiltering = currentFilter.ratingMin !== null || currentFilter.ratingMax !== null;

  // Photos filter label
  const getPhotosLabel = (): string => {
    if (currentFilter.hasPhotos === null) return "All";
    return currentFilter.hasPhotos ? "With photos" : "Without photos";
  };
  const photosFilterLabel = getPhotosLabel();
  const isPhotosFiltering = currentFilter.hasPhotos !== null;

  // Due date filter label
  const dueDatePresetInfo = DUE_DATE_PRESETS.find(p => p.value === currentFilter.dueDatePreset);
  const dueDateFilterLabel = dueDatePresetInfo?.label || "All";
  const isDueDateFiltering = currentFilter.dueDatePreset !== 'all';

  // Entry date filter label
  const getEntryDateLabel = (): string => {
    const { entryDateStart, entryDateEnd } = currentFilter;
    if (!entryDateStart && !entryDateEnd) return "All dates";
    const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (entryDateStart && entryDateEnd) return `${formatDate(entryDateStart)} - ${formatDate(entryDateEnd)}`;
    if (entryDateStart) return `After ${formatDate(entryDateStart)}`;
    if (entryDateEnd) return `Before ${formatDate(entryDateEnd)}`;
    return "All dates";
  };
  const entryDateFilterLabel = getEntryDateLabel();
  const isEntryDateFiltering = currentFilter.entryDateStart !== null || currentFilter.entryDateEnd !== null;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: drawerTextPrimary, fontFamily: theme.typography.fontFamily.semibold }]}>
          Settings
        </Text>
        <TouchableOpacity onPress={closeDrawer} style={styles.closeButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M18 6L6 18M6 6l12 12"
              stroke={drawerTextSecondary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* View Row */}
      <TouchableOpacity
        style={styles.settingRow}
        onPress={() => setDisplayModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.settingLabel, { color: drawerTextPrimary, fontFamily: theme.typography.fontFamily.medium }]}>
          View
        </Text>
        <View style={styles.settingValueContainer}>
          <Text style={[styles.settingValue, { color: drawerTextSecondary, fontFamily: theme.typography.fontFamily.regular }]}>
            {displayModeLabel}
          </Text>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={styles.chevron}>
            <Path
              d="M6 9l6 6 6-6"
              stroke={drawerTextTertiary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </TouchableOpacity>

      {/* Sort Row */}
      <TouchableOpacity
        style={styles.settingRow}
        onPress={() => setSortModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.settingLabel, { color: drawerTextPrimary, fontFamily: theme.typography.fontFamily.medium }]}>
          Sort by
        </Text>
        <View style={styles.settingValueContainer}>
          <Text style={[styles.settingValue, { color: drawerTextSecondary, fontFamily: theme.typography.fontFamily.regular }]}>
            {sortModeLabel}
          </Text>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={styles.chevron}>
            <Path
              d="M6 9l6 6 6-6"
              stroke={drawerTextTertiary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </TouchableOpacity>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: theme.colors.border.light }]} />

      {/* FILTERS Section */}
      <Text style={[styles.sectionTitle, { color: drawerTextTertiary, fontFamily: theme.typography.fontFamily.semibold }]}>
        FILTERS
      </Text>

      {/* Show Archived Toggle */}
      <View style={styles.toggleRow}>
        <Text style={[styles.toggleLabel, { color: drawerTextPrimary, fontFamily: theme.typography.fontFamily.medium }]}>
          Show Archived
        </Text>
        <Switch
          value={currentFilter.showArchived}
          onValueChange={handleShowArchivedChange}
          trackColor={{ false: theme.colors.background.tertiary, true: theme.colors.functional.accentLight }}
          thumbColor={currentFilter.showArchived ? theme.colors.interactive.primary : theme.colors.text.tertiary}
        />
      </View>

      {/* Status Filter Row */}
      {showStatusFilter && (
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setStatusModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.settingLabel, { color: drawerTextPrimary, fontFamily: theme.typography.fontFamily.medium }]}>
            Status
          </Text>
          <View style={styles.settingValueContainer}>
            <Text style={[
              styles.settingValue,
              { color: validSelectedStatuses.length > 0 && !allStatusesSelected ? theme.colors.interactive.primary : drawerTextSecondary },
              { fontFamily: theme.typography.fontFamily.regular }
            ]}>
              {statusFilterLabel}
            </Text>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={styles.chevron}>
              <Path
                d="M6 9l6 6 6-6"
                stroke={drawerTextTertiary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>
      )}

      {/* Priority Filter Row */}
      {showPriorityFilter && (
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setPriorityModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.settingLabel, { color: drawerTextPrimary, fontFamily: theme.typography.fontFamily.medium }]}>
            Priority
          </Text>
          <View style={styles.settingValueContainer}>
            <Text style={[
              styles.settingValue,
              { color: isPriorityFiltering ? theme.colors.interactive.primary : drawerTextSecondary },
              { fontFamily: theme.typography.fontFamily.regular }
            ]}>
              {priorityFilterLabel}
            </Text>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={styles.chevron}>
              <Path
                d="M6 9l6 6 6-6"
                stroke={drawerTextTertiary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>
      )}

      {/* Type Filter Row */}
      {showTypeFilter && (
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setTypeModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.settingLabel, { color: drawerTextPrimary, fontFamily: theme.typography.fontFamily.medium }]}>
            Type
          </Text>
          <View style={styles.settingValueContainer}>
            <Text style={[
              styles.settingValue,
              { color: isTypeFiltering ? theme.colors.interactive.primary : drawerTextSecondary },
              { fontFamily: theme.typography.fontFamily.regular }
            ]}>
              {typeFilterLabel}
            </Text>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={styles.chevron}>
              <Path
                d="M6 9l6 6 6-6"
                stroke={drawerTextTertiary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>
      )}

      {/* Rating Filter Row */}
      {showRatingFilter && (
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setRatingModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.settingLabel, { color: drawerTextPrimary, fontFamily: theme.typography.fontFamily.medium }]}>
            Rating
          </Text>
          <View style={styles.settingValueContainer}>
            <Text style={[
              styles.settingValue,
              { color: isRatingFiltering ? theme.colors.interactive.primary : drawerTextSecondary },
              { fontFamily: theme.typography.fontFamily.regular }
            ]}>
              {ratingFilterLabel}
            </Text>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={styles.chevron}>
              <Path
                d="M6 9l6 6 6-6"
                stroke={drawerTextTertiary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>
      )}

      {/* Photos Filter Row - Three state toggle */}
      {showPhotosFilter && (
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: drawerTextPrimary, fontFamily: theme.typography.fontFamily.medium }]}>
            Photos
          </Text>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                { backgroundColor: theme.colors.background.secondary },
                currentFilter.hasPhotos === null && { backgroundColor: theme.colors.interactive.primary },
              ]}
              onPress={() => handlePhotosFilterChange(null)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.segmentText,
                { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular },
                currentFilter.hasPhotos === null && { color: theme.colors.background.primary, fontFamily: theme.typography.fontFamily.semibold },
              ]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                { backgroundColor: theme.colors.background.secondary },
                currentFilter.hasPhotos === true && { backgroundColor: theme.colors.interactive.primary },
              ]}
              onPress={() => handlePhotosFilterChange(true)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.segmentText,
                { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular },
                currentFilter.hasPhotos === true && { color: theme.colors.background.primary, fontFamily: theme.typography.fontFamily.semibold },
              ]}>
                With
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                { backgroundColor: theme.colors.background.secondary },
                currentFilter.hasPhotos === false && { backgroundColor: theme.colors.interactive.primary },
              ]}
              onPress={() => handlePhotosFilterChange(false)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.segmentText,
                { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular },
                currentFilter.hasPhotos === false && { color: theme.colors.background.primary, fontFamily: theme.typography.fontFamily.semibold },
              ]}>
                Without
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Due Date Filter Row */}
      {showDueDateFilter && (
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setDueDateModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.settingLabel, { color: drawerTextPrimary, fontFamily: theme.typography.fontFamily.medium }]}>
            Due Date
          </Text>
          <View style={styles.settingValueContainer}>
            <Text style={[
              styles.settingValue,
              { color: isDueDateFiltering ? theme.colors.interactive.primary : drawerTextSecondary },
              { fontFamily: theme.typography.fontFamily.regular }
            ]}>
              {dueDateFilterLabel}
            </Text>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={styles.chevron}>
              <Path
                d="M6 9l6 6 6-6"
                stroke={drawerTextTertiary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>
      )}

      {/* Entry Date Filter Row */}
      {showEntryDateFilter && (
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setEntryDateModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.settingLabel, { color: drawerTextPrimary, fontFamily: theme.typography.fontFamily.medium }]}>
            Entry Date
          </Text>
          <View style={styles.settingValueContainer}>
            <Text style={[
              styles.settingValue,
              { color: isEntryDateFiltering ? theme.colors.interactive.primary : drawerTextSecondary },
              { fontFamily: theme.typography.fontFamily.regular }
            ]}>
              {entryDateFilterLabel}
            </Text>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={styles.chevron}>
              <Path
                d="M6 9l6 6 6-6"
                stroke={drawerTextTertiary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>
      )}

      {/* Bottom padding */}
      <View style={{ height: 40 }} />

      {/* Modals */}
      <DisplayModeSelector
        visible={displayModalVisible}
        selectedMode={currentPref.displayMode}
        onSelect={handleDisplayModeChange}
        onClose={() => setDisplayModalVisible(false)}
      />

      <SortModeSelector
        visible={sortModalVisible}
        selectedMode={currentPref.sortMode}
        onSelect={handleSortModeChange}
        onClose={() => setSortModalVisible(false)}
        sortOrder={currentPref.sortOrder}
        onSortOrderChange={handleSortOrderChange}
        showPinnedFirst={currentPref.showPinnedFirst}
        onShowPinnedFirstChange={handlePinnedFirstChange}
      />

      <StatusFilterSelector
        visible={statusModalVisible}
        selectedStatuses={currentFilter.statuses}
        onSelect={handleStatusFilterChange}
        onClose={() => setStatusModalVisible(false)}
        allowedStatuses={allowedStatuses}
      />

      <PriorityFilterSelector
        visible={priorityModalVisible}
        selectedPriorities={currentFilter.priorities}
        onSelect={handlePriorityFilterChange}
        onClose={() => setPriorityModalVisible(false)}
      />

      <TypeFilterSelector
        visible={typeModalVisible}
        selectedTypes={currentFilter.types}
        availableTypes={availableTypes}
        onSelect={handleTypeFilterChange}
        onClose={() => setTypeModalVisible(false)}
      />

      <RatingFilterSelector
        visible={ratingModalVisible}
        ratingMin={currentFilter.ratingMin}
        ratingMax={currentFilter.ratingMax}
        ratingType={ratingType}
        onSelect={handleRatingFilterChange}
        onClose={() => setRatingModalVisible(false)}
      />

      <DueDateFilterSelector
        visible={dueDateModalVisible}
        preset={currentFilter.dueDatePreset}
        customStart={currentFilter.dueDateStart}
        customEnd={currentFilter.dueDateEnd}
        onSelect={handleDueDateFilterChange}
        onClose={() => setDueDateModalVisible(false)}
      />

      <EntryDateRangeSelector
        visible={entryDateModalVisible}
        startDate={currentFilter.entryDateStart}
        endDate={currentFilter.entryDateEnd}
        onSelect={handleEntryDateFilterChange}
        onClose={() => setEntryDateModalVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: themeBase.spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: themeBase.spacing.md,
    marginBottom: themeBase.spacing.sm,
  },
  headerTitle: {
    fontSize: themeBase.typography.fontSize.xl,
  },
  closeButton: {
    padding: themeBase.spacing.xs,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: themeBase.spacing.md,
  },
  settingLabel: {
    fontSize: themeBase.typography.fontSize.base,
  },
  settingValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.xs,
  },
  settingValue: {
    fontSize: themeBase.typography.fontSize.base,
  },
  chevron: {
    marginLeft: 2,
  },
  divider: {
    height: 1,
    marginVertical: themeBase.spacing.md,
  },
  sectionTitle: {
    fontSize: themeBase.typography.fontSize.xs,
    letterSpacing: 1,
    marginBottom: themeBase.spacing.md,
    marginTop: themeBase.spacing.sm,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: themeBase.spacing.sm,
  },
  toggleLabel: {
    fontSize: themeBase.typography.fontSize.base,
  },
  segmentedControl: {
    flexDirection: "row",
    gap: 4,
  },
  segmentButton: {
    paddingVertical: themeBase.spacing.xs,
    paddingHorizontal: themeBase.spacing.sm,
    borderRadius: themeBase.borderRadius.sm,
  },
  segmentText: {
    fontSize: themeBase.typography.fontSize.xs,
  },
});
