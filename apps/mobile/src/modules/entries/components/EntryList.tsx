import { View, Text, FlatList, SectionList, StyleSheet, ActivityIndicator } from "react-native";
import { useState } from "react";
import type { Entry, Stream as FullStream, EntrySection, EntryDisplayMode } from "@trace/core";
import { getStreamAttributeVisibility } from "@trace/core";
import { EntryListItem } from "./EntryListItem";
import { theme } from "../../../shared/theme/theme";

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
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  streams?: Stream[]; // Optional streams for displaying stream names
  locations?: Location[]; // Optional locations for displaying location names
  displayMode?: EntryDisplayMode; // Display mode for entry items
  /** Full stream objects for attribute visibility determination */
  fullStreams?: FullStream[];
}

export function EntryList({ entries, sections, isLoading, onEntryPress, onTagPress, onMentionPress, onStreamPress, onMove, onCopy, onDelete, onPin, ListHeaderComponent, streams, locations, displayMode, fullStreams }: EntryListProps) {
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
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.sectionCount}>
          <Text style={styles.sectionCountText}>{section.count}</Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
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
            <Text style={styles.emptyTitle}>No entries</Text>
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
            <Text style={styles.emptyTitle}>No entries for this date</Text>
          </View>
        }
        removeClippedSubviews={false}
      />
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No entries yet</Text>
        <Text style={styles.emptySubtitle}>
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
    color: "#6b7280",
    fontWeight: "500",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
    textAlign: "center",
  },
  listContent: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  sectionCount: {
    backgroundColor: theme.colors.background.tertiary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  sectionCountText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
  },
});
