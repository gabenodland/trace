/**
 * StreamDrawerContent
 *
 * Content for the drawer - view mode selector, streams list, locations.
 * Collapsible sections: STREAMS (expanded by default), LOCATIONS (collapsed by default).
 * Clean, minimal design with generous spacing.
 */

import { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import { useDrawer, type ViewMode } from "../../shared/contexts/DrawerContext";
import { useStreams } from "../../modules/streams/mobileStreamHooks";
import { useEntryCounts, useTags, useMentions } from "../../modules/entries/mobileEntryHooks";
import { useLocationsWithCounts } from "../../modules/locations/mobileLocationHooks";
import { StreamDrawerItem, QuickFilterItem } from "./StreamDrawerItem";
import { theme } from "../../shared/theme/theme";
import type { Stream } from "@trace/core";

/** View mode option for the selector */
interface ViewModeOption {
  mode: ViewMode;
  label: string;
  icon: (color: string) => React.ReactNode;
}

const VIEW_MODES: ViewModeOption[] = [
  {
    mode: "list",
    label: "List",
    icon: (color: string) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
        <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    mode: "map",
    label: "Map",
    icon: (color: string) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
        <Path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zM8 2v16M16 6v16" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    mode: "calendar",
    label: "Calendar",
    icon: (color: string) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
        <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} />
        <Path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
];

export function StreamDrawerContent() {
  const {
    closeDrawer,
    onStreamSelect,
    selectedStreamId,
    setSelectedStreamId,
    setSelectedStreamName,
    viewMode,
    setViewMode,
    onViewModeChange,
  } = useDrawer();
  const { streams } = useStreams();
  const { data: entryCounts } = useEntryCounts();

  // Collapsible section state
  const [streamsExpanded, setStreamsExpanded] = useState(true);
  const [locationsExpanded, setLocationsExpanded] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [mentionsExpanded, setMentionsExpanded] = useState(false);

  // Only load locations/tags when expanded (data is cached by React Query)
  const { data: locationsData } = useLocationsWithCounts();
  const { tags } = useTags();
  const { mentions } = useMentions();

  const allEntriesCount = entryCounts?.total || 0;
  const noStreamCount = entryCounts?.noStream || 0;

  // Transform and sort locations by entry count
  const locations = useMemo(() => {
    if (!locationsData) return [];
    const items = locationsData.map(loc => ({
      name: loc.name,
      entryCount: loc.entry_count,
      locationId: loc.location_id,
    }));
    // Sort by entry count descending, then by name
    items.sort((a, b) => {
      if (b.entryCount !== a.entryCount) return b.entryCount - a.entryCount;
      return a.name.localeCompare(b.name);
    });
    return items;
  }, [locationsData]);

  // Sort tags alphabetically (add # prefix for display)
  const sortedTags = useMemo(() => {
    return [...tags]
      .sort((a, b) => a.tag.toLowerCase().localeCompare(b.tag.toLowerCase()))
      .map(t => ({
        label: `#${t.tag}`,
        value: t.tag,
        count: t.count,
      }));
  }, [tags]);

  // Sort mentions alphabetically (add @ prefix for display)
  const sortedMentions = useMemo(() => {
    return [...mentions]
      .sort((a, b) => a.mention.toLowerCase().localeCompare(b.mention.toLowerCase()))
      .map(m => ({
        label: `@${m.mention}`,
        value: m.mention,
        count: m.count,
      }));
  }, [mentions]);

  // Handle view mode change
  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      if (onViewModeChange) {
        onViewModeChange(mode);
      }
      closeDrawer();
    },
    [setViewMode, onViewModeChange, closeDrawer]
  );

  // Handle stream selection
  const handleStreamSelect = useCallback(
    (streamId: string | null, streamName: string) => {
      setSelectedStreamId(streamId);
      setSelectedStreamName(streamName);
      if (onStreamSelect) {
        onStreamSelect(streamId, streamName);
      }
      closeDrawer();
    },
    [onStreamSelect, closeDrawer, setSelectedStreamId, setSelectedStreamName]
  );

  // Handle location selection
  const handleLocationSelect = useCallback(
    (locationId: string, locationName: string) => {
      const filterId = `location:${locationId}`;
      setSelectedStreamId(filterId);
      setSelectedStreamName(locationName);
      if (onStreamSelect) {
        onStreamSelect(filterId, locationName);
      }
      closeDrawer();
    },
    [onStreamSelect, closeDrawer, setSelectedStreamId, setSelectedStreamName]
  );

  // Handle tag/mention selection
  const handleTagSelect = useCallback(
    (type: "tag" | "mention", value: string, label: string) => {
      const filterId = `${type}:${value}`;
      setSelectedStreamId(filterId);
      setSelectedStreamName(label);
      if (onStreamSelect) {
        onStreamSelect(filterId, label);
      }
      closeDrawer();
    },
    [onStreamSelect, closeDrawer, setSelectedStreamId, setSelectedStreamName]
  );

  return (
    <View style={styles.container}>
      {/* View Mode Section - Fixed with shadow */}
      <View style={styles.viewSectionWrapper}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>VIEW</Text>
          <View style={styles.viewModeList}>
            {VIEW_MODES.map((option) => (
              <TouchableOpacity
                key={option.mode}
                style={[
                  styles.viewModeItem,
                  viewMode === option.mode && styles.viewModeItemSelected,
                ]}
                onPress={() => handleViewModeChange(option.mode)}
                activeOpacity={0.6}
                delayPressIn={0}
              >
                {option.icon(
                  viewMode === option.mode
                    ? theme.colors.text.primary
                    : theme.colors.text.tertiary
                )}
                <Text style={[
                  styles.viewModeLabel,
                  viewMode === option.mode && styles.viewModeLabelSelected,
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* STREAMS Section Header - Collapsible */}
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setStreamsExpanded(!streamsExpanded)}
          activeOpacity={0.6}
          delayPressIn={0}
        >
          <Svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.colors.text.tertiary}
            strokeWidth={2}
            style={[styles.chevron, streamsExpanded && styles.chevronExpanded]}
          >
            <Path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.sectionTitle}>STREAMS</Text>
        </TouchableOpacity>

        {/* Streams Content - Collapsible */}
        {streamsExpanded && (
          <>
            {/* Quick Filters */}
            <View style={styles.quickFilters}>
              <QuickFilterItem
                label="All Entries"
                count={allEntriesCount}
                isSelected={selectedStreamId === "all"}
                onPress={() => handleStreamSelect("all", "All Entries")}
              />
              <QuickFilterItem
                label="Unassigned"
                count={noStreamCount}
                isSelected={selectedStreamId === null}
                onPress={() => handleStreamSelect(null, "Unassigned")}
              />
            </View>

            {/* Stream List */}
            {streams.map((stream) => (
              <StreamDrawerItem
                key={stream.stream_id}
                stream={stream}
                isSelected={selectedStreamId === stream.stream_id}
                onPress={() => handleStreamSelect(stream.stream_id, stream.name)}
              />
            ))}
          </>
        )}

        {/* LOCATIONS Section Header - Collapsible */}
        <TouchableOpacity
          style={[styles.sectionHeader, styles.sectionHeaderWithMargin]}
          onPress={() => setLocationsExpanded(!locationsExpanded)}
          activeOpacity={0.6}
          delayPressIn={0}
        >
          <Svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.colors.text.tertiary}
            strokeWidth={2}
            style={[styles.chevron, locationsExpanded && styles.chevronExpanded]}
          >
            <Path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.sectionTitle}>LOCATIONS</Text>
        </TouchableOpacity>

        {/* Locations Content - Collapsible */}
        {locationsExpanded && (
          <>
            {locations.length > 0 ? (
              locations.map((location) => {
                const isSelected = selectedStreamId === `location:${location.locationId}`;
                return (
                  <TouchableOpacity
                    key={location.locationId}
                    style={[styles.locationItem, isSelected && styles.locationItemSelected]}
                    onPress={() => handleLocationSelect(location.locationId, location.name)}
                    activeOpacity={0.6}
                    delayPressIn={0}
                  >
                    <Text
                      style={[styles.locationName, isSelected && styles.locationNameSelected]}
                      numberOfLines={1}
                    >
                      {location.name}
                    </Text>
                    {location.entryCount > 0 && (
                      <Text style={[styles.locationCount, isSelected && styles.locationCountSelected]}>
                        {location.entryCount}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyLocations}>
                <Text style={styles.emptyText}>No locations yet</Text>
              </View>
            )}
          </>
        )}

        {/* TAGS Section Header - Collapsible */}
        <TouchableOpacity
          style={[styles.sectionHeader, styles.sectionHeaderWithMargin]}
          onPress={() => setTagsExpanded(!tagsExpanded)}
          activeOpacity={0.6}
          delayPressIn={0}
        >
          <Svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.colors.text.tertiary}
            strokeWidth={2}
            style={[styles.chevron, tagsExpanded && styles.chevronExpanded]}
          >
            <Path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.sectionTitle}>TAGS</Text>
        </TouchableOpacity>

        {/* Tags Content - Collapsible */}
        {tagsExpanded && (
          <>
            {sortedTags.length > 0 ? (
              sortedTags.map((item) => {
                const isSelected = selectedStreamId === `tag:${item.value}`;
                return (
                  <TouchableOpacity
                    key={`tag:${item.value}`}
                    style={[styles.locationItem, isSelected && styles.locationItemSelected]}
                    onPress={() => handleTagSelect("tag", item.value, item.label)}
                    activeOpacity={0.6}
                    delayPressIn={0}
                  >
                    <Text
                      style={[styles.locationName, isSelected && styles.locationNameSelected]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    {item.count > 0 && (
                      <Text style={[styles.locationCount, isSelected && styles.locationCountSelected]}>
                        {item.count}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyLocations}>
                <Text style={styles.emptyText}>No tags yet</Text>
              </View>
            )}
          </>
        )}

        {/* MENTIONS Section Header - Collapsible */}
        <TouchableOpacity
          style={[styles.sectionHeader, styles.sectionHeaderWithMargin]}
          onPress={() => setMentionsExpanded(!mentionsExpanded)}
          activeOpacity={0.6}
          delayPressIn={0}
        >
          <Svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.colors.text.tertiary}
            strokeWidth={2}
            style={[styles.chevron, mentionsExpanded && styles.chevronExpanded]}
          >
            <Path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.sectionTitle}>MENTIONS</Text>
        </TouchableOpacity>

        {/* Mentions Content - Collapsible */}
        {mentionsExpanded && (
          <>
            {sortedMentions.length > 0 ? (
              sortedMentions.map((item) => {
                const isSelected = selectedStreamId === `mention:${item.value}`;
                return (
                  <TouchableOpacity
                    key={`mention:${item.value}`}
                    style={[styles.locationItem, isSelected && styles.locationItemSelected]}
                    onPress={() => handleTagSelect("mention", item.value, item.label)}
                    activeOpacity={0.6}
                    delayPressIn={0}
                  >
                    <Text
                      style={[styles.locationName, isSelected && styles.locationNameSelected]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    {item.count > 0 && (
                      <Text style={[styles.locationCount, isSelected && styles.locationCountSelected]}>
                        {item.count}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyLocations}>
                <Text style={styles.emptyText}>No mentions yet</Text>
              </View>
            )}
          </>
        )}

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  viewSectionWrapper: {
    backgroundColor: theme.colors.background.primary,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.06)",
    zIndex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 6,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 6,
  },
  sectionHeaderWithMargin: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.light,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.text.tertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  chevron: {
    transform: [{ rotate: "0deg" }],
  },
  chevronExpanded: {
    transform: [{ rotate: "90deg" }],
  },
  viewModeList: {
    flexDirection: "row",
    gap: 6,
  },
  viewModeItem: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#f9fafb",
  },
  viewModeItemSelected: {
    backgroundColor: "#f3f4f6",
  },
  viewModeLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.text.tertiary,
  },
  viewModeLabelSelected: {
    fontWeight: "600",
    color: theme.colors.text.primary,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 0,
  },
  quickFilters: {
    paddingBottom: 4,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    borderRadius: 8,
  },
  locationItemSelected: {
    backgroundColor: "#f3f4f6",
  },
  locationName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "400",
    color: theme.colors.text.primary,
    letterSpacing: -0.2,
  },
  locationNameSelected: {
    fontWeight: "600",
    color: theme.colors.text.primary,
  },
  locationCount: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.text.tertiary,
    marginLeft: 12,
  },
  locationCountSelected: {
    color: theme.colors.text.secondary,
  },
  emptyLocations: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
  },
  bottomPadding: {
    height: 32,
  },
});
