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
  type EntryDisplayMode,
  type EntrySortMode,
  type EntrySortOrder,
} from "@trace/core";
import { useStream } from "../../modules/streams/mobileStreamHooks";
import { DisplayModeSelector } from "../../modules/entries/components/DisplayModeSelector";
import { SortModeSelector } from "../../modules/entries/components/SortModeSelector";
import { StatusFilterSelector } from "../../modules/entries/components/StatusFilterSelector";

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

  // Get stream data for status filtering
  const { stream } = useStream(selectedStreamId ?? null);
  // When viewing a specific stream, only show its allowed statuses
  // When viewing "All Entries", show all statuses (undefined = all)
  const allowedStatuses = selectedStreamId && stream?.entry_statuses
    ? stream.entry_statuses
    : undefined;

  // Modal visibility state
  const [displayModalVisible, setDisplayModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);

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
            // Only highlight if filtering (not when all selected or none selected)
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
});
