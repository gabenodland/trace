import { View, Text, FlatList, SectionList, StyleSheet, ActivityIndicator } from "react-native";
import { useState } from "react";
import type { Entry, Stream as FullStream, EntrySection, EntryDisplayMode } from "@trace/core";
import { getStreamAttributeVisibility } from "@trace/core";
import { EntryListItem } from "./EntryListItem";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { themeBase } from "../../../shared/theme/themeBase";
import { FAB_CLEARANCE } from "../../../components/layout/BottomNavBar";

interface Stream {
  stream_id: string;
  name: string;
}

interface Location {
  location_id: string;
  name: string;
}

interface EntryListProps {
  entries: Entry[];
  sections?: EntrySection[]; // Optional sections for grouped display
  isLoading: boolean;
  onEntryPress: (entryId: string) => void;
  onTagPress?: (tag: string) => void;
  onMentionPress?: (mention: string) => void;
  onStreamPress?: (streamId: string | null, streamName: string) => void;
  onMove?: (entryId: string) => void;
  onCopy?: (entryId: string) => void;
  onDelete?: (entryId: string) => void;
  onPin?: (entryId: string, currentPinned: boolean) => void;
  onSelectOnMap?: (entryId: string) => void; // Select entry on map (MapScreen only)
  onArchive?: (entryId: string, currentArchived: boolean) => void; // Archive/unarchive entry
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  streams?: Stream[]; // Optional streams for displaying stream names
  locations?: Location[]; // Optional locations for displaying location names
  displayMode?: EntryDisplayMode; // Display mode for entry items
  /** Full stream objects for attribute visibility determination */
  fullStreams?: FullStream[];
}

export function EntryList({ entries, sections, isLoading, onEntryPress, onTagPress, onMentionPress, onStreamPress, onMove, onCopy, onDelete, onPin, onSelectOnMap, onArchive, ListHeaderComponent, streams, locations, displayMode, fullStreams }: EntryListProps) {
  const theme = useTheme();
  const [openMenuEntryId, setOpenMenuEntryId] = useState<string | null>(null);

  // Create a lookup map for streams
  const streamMap = streams?.reduce((map, s) => {
    map[s.stream_id] = s.name;
    return map;
  }, {} as Record<string, string>);

  // Create a lookup map for locations
  const locationMap = locations?.reduce((map, loc) => {
    map[loc.location_id] = loc.name;
    return map;
  }, {} as Record<string, string>);

  // Create a lookup map for full streams (for attribute visibility)
  const fullStreamMap = fullStreams?.reduce((map, s) => {
    map[s.stream_id] = s;
    return map;
  }, {} as Record<string, FullStream>);

  // Render a single entry item
  const renderEntryItem = (item: Entry) => {
    // Get attribute visibility for this entry's stream
    const stream = item.stream_id && fullStreamMap ? fullStreamMap[item.stream_id] : null;
    const attributeVisibility = getStreamAttributeVisibility(stream);

    return (
      <EntryListItem
        entry={item}
        onPress={() => onEntryPress(item.entry_id)}
        onTagPress={onTagPress}
        onMentionPress={onMentionPress}
        onStreamPress={onStreamPress}
        onMove={onMove}
        onCopy={onCopy}
        onDelete={onDelete}
        onPin={onPin}
        onSelectOnMap={onSelectOnMap}
        onArchive={onArchive}
        streamName={item.stream_id && streamMap ? streamMap[item.stream_id] : null}
        locationName={item.location_id && locationMap ? locationMap[item.location_id] : null}
        displayMode={displayMode}
        showMenu={openMenuEntryId === item.entry_id}
        onMenuToggle={() => setOpenMenuEntryId(openMenuEntryId === item.entry_id ? null : item.entry_id)}
        attributeVisibility={attributeVisibility}
      />
    );
  };

  // Render section header (only if title is not empty)
  const renderSectionHeader = ({ section }: { section: EntrySection }) => {
    // Don't render header for empty titles (e.g., priority entries without label)
    if (section.title === '') {
      return null;
    }
    return (
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>{section.title}</Text>
        <View style={[styles.sectionCount, { backgroundColor: theme.colors.background.tertiary }]}>
          <Text style={[styles.sectionCountText, { color: theme.colors.text.secondary }]}>{section.count}</Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.interactive.primary} />
      </View>
    );
  }

  // If sections are provided, use SectionList
  if (sections && sections.length > 0) {
    return (
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.entry_id}
        renderItem={({ item }) => renderEntryItem(item)}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text.secondary }]}>No entries</Text>
          </View>
        }
        stickySectionHeadersEnabled={false}
        removeClippedSubviews={false}
      />
    );
  }

  // If we have a header component, always render FlatList (even with no entries)
  if (ListHeaderComponent) {
    return (
      <FlatList
        data={entries}
        keyExtractor={(item) => item.entry_id}
        renderItem={({ item }) => renderEntryItem(item)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text.secondary }]}>No entries for this date</Text>
          </View>
        }
        removeClippedSubviews={false}
      />
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.emptyTitle, { color: theme.colors.text.secondary }]}>No entries yet</Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.text.tertiary }]}>
          Capture your first thought, idea, or task!
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.entry_id}
      renderItem={({ item }) => renderEntryItem(item)}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={ListHeaderComponent}
      removeClippedSubviews={false}
    />
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyContainer: {
    alignItems: "center",
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "500",
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  listContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16 + FAB_CLEARANCE,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: themeBase.spacing.sm,
    paddingHorizontal: themeBase.spacing.xs,
    marginTop: themeBase.spacing.md,
    marginBottom: themeBase.spacing.xs,
    gap: themeBase.spacing.sm,
  },
  sectionTitle: {
    fontSize: themeBase.typography.fontSize.base,
    fontWeight: themeBase.typography.fontWeight.semibold,
  },
  sectionCount: {
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: 2,
    borderRadius: themeBase.borderRadius.full,
  },
  sectionCountText: {
    fontSize: themeBase.typography.fontSize.xs,
    fontWeight: themeBase.typography.fontWeight.medium,
  },
});
