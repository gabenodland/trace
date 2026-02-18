/**
 * StreamDrawerContent
 *
 * Content for the drawer - streams list, locations, tags, mentions.
 * Collapsible sections: STREAMS (expanded by default), LOCATIONS (collapsed by default).
 * View mode switching has moved to the BottomNavBar.
 */

import { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useDrawer } from "../../shared/contexts/DrawerContext";
import { Icon } from "../../shared/components";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { themeBase } from "../../shared/theme/themeBase";
import { useStreams } from "../../modules/streams/mobileStreamHooks";
import { useEntryCounts, useTags, useMentions, useLocationHierarchy } from "../../modules/entries/mobileEntryHooks";
import { StreamDrawerItem, QuickFilterItem } from "./StreamDrawerItem";
import type { Stream } from "@trace/core";
import type { LocationTreeNode } from "@trace/core/src/modules/entries/EntryTypes";

/** Indentation per level in the location tree (pixels) */
const LOCATION_INDENT_PER_LEVEL = 16;

/** Props for LocationTreeView component */
interface LocationTreeViewProps {
  nodes: LocationTreeNode[];
  level: number;
  expandedLocations: Set<string>;
  selectedStreamId: string | null;
  onSelect: (node: LocationTreeNode) => void;
  onToggleExpand: (nodeKey: string) => void;
  drawerTextPrimary: string;
  drawerTextSecondary: string;
  drawerTextTertiary: string;
  theme: ReturnType<typeof useTheme>;
}

/**
 * Get unique key for a location node
 * For places: use location_id (stable UUID) as unique identifier
 * For hierarchy levels: use geo:type:value:parent chain
 */
function getNodeKey(node: LocationTreeNode): string {
  if (node.type === "no_location") return "geo:none";

  // For places, use location_id if available (stable UUID)
  if (node.type === "place" && node.locationId) {
    return `location:${node.locationId}`;
  }

  // For hierarchy levels (country, region, city), build ancestry chain
  const parts = [node.value || ""];
  if (node.parentCity) parts.push(node.parentCity);
  if (node.parentRegion) parts.push(node.parentRegion);
  if (node.parentCountry) parts.push(node.parentCountry);

  return `geo:${node.type}:${parts.join(":")}`;
}

/**
 * Recursive component to render location tree with indentation
 *
 * Tap behavior:
 * - Nodes with children: left side (chevron + name) expands/collapses
 * - Leaf nodes (no children): left side filters entries
 * - Count badge always filters entries
 */
function LocationTreeView({
  nodes,
  level,
  expandedLocations,
  selectedStreamId,
  onSelect,
  onToggleExpand,
  drawerTextPrimary,
  drawerTextSecondary,
  drawerTextTertiary,
  theme,
}: LocationTreeViewProps) {
  return (
    <>
      {nodes.map((node) => {
        const nodeKey = getNodeKey(node);
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedLocations.has(nodeKey);
        const isSelected = selectedStreamId === nodeKey;
        const indent = level * LOCATION_INDENT_PER_LEVEL;

        return (
          <View key={nodeKey}>
            {/* Node row */}
            <View
              style={[
                styles.locationRow,
                isSelected && { backgroundColor: theme.colors.background.tertiary },
              ]}
            >
              {/* Left area: indent + chevron (expand/collapse) + name (filter) */}
              <View style={[styles.locationMainArea, { paddingLeft: 20 + indent }]}>
                {/* Chevron - tap to expand/collapse (only if has children) */}
                {hasChildren ? (
                  <TouchableOpacity
                    style={styles.locationChevron}
                    onPress={() => onToggleExpand(nodeKey)}
                    activeOpacity={0.6}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }}
                  >
                    <Icon
                      name="ChevronRight"
                      size={12}
                      color={drawerTextTertiary}
                      style={isExpanded ? styles.chevronExpanded : styles.chevron}
                    />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.locationChevronPlaceholder} />
                )}

                {/* Location name - tap to filter entries */}
                <TouchableOpacity
                  style={styles.locationNameTouch}
                  onPress={() => onSelect(node)}
                  activeOpacity={0.6}
                  delayPressIn={0}
                >
                  <Text
                    style={[
                      styles.locationName,
                      { color: drawerTextPrimary },
                      isSelected && { fontWeight: "600" },
                      node.type === "no_location" && { fontStyle: "italic" },
                    ]}
                    numberOfLines={1}
                  >
                    {node.displayName}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Count badge - tapping filters (for nodes with children) */}
              {node.entryCount > 0 && (
                <TouchableOpacity
                  style={styles.locationCountTouch}
                  onPress={() => onSelect(node)}
                  activeOpacity={0.6}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                >
                  <Text
                    style={[
                      styles.locationCount,
                      { color: drawerTextTertiary },
                      isSelected && { color: drawerTextSecondary },
                    ]}
                  >
                    {node.entryCount}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Render children if expanded */}
            {hasChildren && isExpanded && (
              <LocationTreeView
                nodes={node.children}
                level={level + 1}
                expandedLocations={expandedLocations}
                selectedStreamId={selectedStreamId}
                onSelect={onSelect}
                onToggleExpand={onToggleExpand}
                drawerTextPrimary={drawerTextPrimary}
                drawerTextSecondary={drawerTextSecondary}
                drawerTextTertiary={drawerTextTertiary}
                theme={theme}
              />
            )}
          </View>
        );
      })}
    </>
  );
}

export function StreamDrawerContent() {
  const theme = useTheme();

  // Drawer-specific text colors (with fallbacks to regular text colors)
  const drawerTextPrimary = theme.colors.surface.drawerText || theme.colors.text.primary;
  const drawerTextSecondary = theme.colors.surface.drawerTextSecondary || theme.colors.text.secondary;
  const drawerTextTertiary = theme.colors.surface.drawerTextTertiary || theme.colors.text.tertiary;

  const {
    closeDrawer,
    onStreamSelect,
    onStreamLongPress,
    selectedStreamId,
    setSelectedStreamId,
    setSelectedStreamName,
  } = useDrawer();
  const { streams } = useStreams();
  const { data: entryCounts } = useEntryCounts();

  // Collapsible section state
  const [streamsExpanded, setStreamsExpanded] = useState(true);
  const [locationsExpanded, setLocationsExpanded] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [mentionsExpanded, setMentionsExpanded] = useState(false);

  // Expanded state for location tree nodes (key = node type:value)
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());

  // Location hierarchy data
  const { data: locationTree } = useLocationHierarchy();
  const { tags } = useTags();
  const { mentions } = useMentions();

  const allEntriesCount = entryCounts?.total || 0;
  const noStreamCount = entryCounts?.noStream || 0;

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

  // Handle long-press on stream (edit stream)
  const handleStreamLongPress = useCallback(
    (streamId: string) => {
      closeDrawer();
      if (onStreamLongPress) {
        onStreamLongPress(streamId);
      }
    },
    [onStreamLongPress, closeDrawer]
  );

  // Handle geo location selection (hierarchical)
  // Uses full ancestry for disambiguation (e.g., Kansas City in MO vs KS)
  const handleGeoSelect = useCallback(
    (node: LocationTreeNode) => {
      // Use getNodeKey for consistent filter ID generation
      const filterId = getNodeKey(node);
      const displayName = node.displayName;

      setSelectedStreamId(filterId);
      setSelectedStreamName(displayName);
      if (onStreamSelect) {
        onStreamSelect(filterId, displayName);
      }
      closeDrawer();
    },
    [onStreamSelect, closeDrawer, setSelectedStreamId, setSelectedStreamName]
  );

  // Toggle location tree node expansion
  const toggleLocationExpand = useCallback((nodeKey: string) => {
    setExpandedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
      }
      return next;
    });
  }, []);

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
          <Icon
            name="ChevronRight"
            size={12}
            color={drawerTextTertiary}
            style={[styles.chevron, streamsExpanded && styles.chevronExpanded]}
          />
          <Text style={[styles.sectionTitle, { color: drawerTextTertiary, fontFamily: theme.typography.fontFamily.semibold }]}>STREAMS</Text>
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
                textColor={drawerTextPrimary}
                textColorSecondary={drawerTextSecondary}
                textColorTertiary={drawerTextTertiary}
              />
              <QuickFilterItem
                label="Inbox"
                icon="Inbox"
                count={noStreamCount}
                isSelected={selectedStreamId === null}
                onPress={() => handleStreamSelect(null, "Inbox")}
                textColor={drawerTextPrimary}
                textColorSecondary={drawerTextSecondary}
                textColorTertiary={drawerTextTertiary}
              />
            </View>

            {/* Stream List */}
            {streams.map((stream) => (
              <StreamDrawerItem
                key={stream.stream_id}
                stream={stream}
                isSelected={selectedStreamId === stream.stream_id}
                onPress={() => handleStreamSelect(stream.stream_id, stream.name)}
                onLongPress={() => handleStreamLongPress(stream.stream_id)}
                textColor={drawerTextPrimary}
                textColorSecondary={drawerTextSecondary}
                textColorTertiary={drawerTextTertiary}
              />
            ))}
          </>
        )}

        {/* LOCATIONS Section Header - Collapsible */}
        <TouchableOpacity
          style={[styles.sectionHeader, styles.sectionHeaderWithMargin, { borderTopColor: theme.colors.border.light }]}
          onPress={() => setLocationsExpanded(!locationsExpanded)}
          activeOpacity={0.6}
          delayPressIn={0}
        >
          <Icon
            name="ChevronRight"
            size={12}
            color={drawerTextTertiary}
            style={[styles.chevron, locationsExpanded && styles.chevronExpanded]}
          />
          <Text style={[styles.sectionTitle, { color: drawerTextTertiary, fontFamily: theme.typography.fontFamily.semibold }]}>LOCATIONS</Text>
        </TouchableOpacity>

        {/* Locations Content - Collapsible (Hierarchical Tree) */}
        {locationsExpanded && (
          <>
            {locationTree && locationTree.length > 0 ? (
              <LocationTreeView
                nodes={locationTree}
                level={0}
                expandedLocations={expandedLocations}
                selectedStreamId={selectedStreamId}
                onSelect={handleGeoSelect}
                onToggleExpand={toggleLocationExpand}
                drawerTextPrimary={drawerTextPrimary}
                drawerTextSecondary={drawerTextSecondary}
                drawerTextTertiary={drawerTextTertiary}
                theme={theme}
              />
            ) : (
              <View style={styles.emptyLocations}>
                <Text style={[styles.emptyText, { color: drawerTextTertiary }]}>No locations yet</Text>
              </View>
            )}
          </>
        )}

        {/* TAGS Section Header - Collapsible */}
        <TouchableOpacity
          style={[styles.sectionHeader, styles.sectionHeaderWithMargin, { borderTopColor: theme.colors.border.light }]}
          onPress={() => setTagsExpanded(!tagsExpanded)}
          activeOpacity={0.6}
          delayPressIn={0}
        >
          <Icon
            name="ChevronRight"
            size={12}
            color={drawerTextTertiary}
            style={[styles.chevron, tagsExpanded && styles.chevronExpanded]}
          />
          <Text style={[styles.sectionTitle, { color: drawerTextTertiary, fontFamily: theme.typography.fontFamily.semibold }]}>TAGS</Text>
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
                    style={[styles.locationItem, isSelected && { backgroundColor: theme.colors.background.tertiary }]}
                    onPress={() => handleTagSelect("tag", item.value, item.label)}
                    activeOpacity={0.6}
                    delayPressIn={0}
                  >
                    <Text
                      style={[styles.locationName, { color: drawerTextPrimary }, isSelected && { fontWeight: "600" }]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    {item.count > 0 && (
                      <Text style={[styles.locationCount, { color: drawerTextTertiary }, isSelected && { color: drawerTextSecondary }]}>
                        {item.count}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyLocations}>
                <Text style={[styles.emptyText, { color: drawerTextTertiary }]}>No tags yet</Text>
              </View>
            )}
          </>
        )}

        {/* MENTIONS Section Header - Collapsible */}
        <TouchableOpacity
          style={[styles.sectionHeader, styles.sectionHeaderWithMargin, { borderTopColor: theme.colors.border.light }]}
          onPress={() => setMentionsExpanded(!mentionsExpanded)}
          activeOpacity={0.6}
          delayPressIn={0}
        >
          <Icon
            name="ChevronRight"
            size={12}
            color={drawerTextTertiary}
            style={[styles.chevron, mentionsExpanded && styles.chevronExpanded]}
          />
          <Text style={[styles.sectionTitle, { color: drawerTextTertiary, fontFamily: theme.typography.fontFamily.semibold }]}>MENTIONS</Text>
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
                    style={[styles.locationItem, isSelected && { backgroundColor: theme.colors.background.tertiary }]}
                    onPress={() => handleTagSelect("mention", item.value, item.label)}
                    activeOpacity={0.6}
                    delayPressIn={0}
                  >
                    <Text
                      style={[styles.locationName, { color: drawerTextPrimary }, isSelected && { fontWeight: "600" }]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    {item.count > 0 && (
                      <Text style={[styles.locationCount, { color: drawerTextTertiary }, isSelected && { color: drawerTextSecondary }]}>
                        {item.count}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyLocations}>
                <Text style={[styles.emptyText, { color: drawerTextTertiary }]}>No mentions yet</Text>
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
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  chevron: {
    transform: [{ rotate: "0deg" }],
  },
  chevronExpanded: {
    transform: [{ rotate: "90deg" }],
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
  // Location tree styles
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
    paddingVertical: 2,
    borderRadius: 6,
    marginHorizontal: 8,
  },
  locationMainArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  locationChevron: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  locationChevronPlaceholder: {
    width: 24,
    height: 24,
    marginRight: 4,
  },
  locationCountTouch: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  // Legacy location item (kept for tags/mentions)
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    borderRadius: 8,
  },
  locationName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "400",
    letterSpacing: -0.2,
  },
  locationNameTouch: {
    flex: 1,
    paddingVertical: 8,
  },
  locationCount: {
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 12,
  },
  emptyLocations: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 14,
  },
  bottomPadding: {
    height: 32,
  },
});
