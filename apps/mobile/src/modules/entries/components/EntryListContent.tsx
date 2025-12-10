import { View, Text, StyleSheet } from "react-native";
import { useState } from "react";
import type { Entry } from "@trace/core";
import { EntryListItem } from "./EntryListItem";
import type { EntrySection } from "../helpers/entrySortHelpers";
import type { EntryDisplayMode } from "../types/EntryDisplayMode";
import { theme } from "../../../shared/theme/theme";

interface EntryListContentProps {
  entries: Entry[];
  sections?: EntrySection[] | null;
  emptyMessage?: string;
  displayMode?: EntryDisplayMode;
  streamMap?: Record<string, string> | null;
  locationMap?: Record<string, string> | null;
  onEntryPress: (entryId: string) => void;
  onTagPress?: (tag: string) => void;
  onMentionPress?: (mention: string) => void;
  onStreamPress?: (streamId: string | null, streamName: string) => void;
  onMove?: (entryId: string) => void;
  onCopy?: (entryId: string) => void;
  onDelete?: (entryId: string) => void;
  onPin?: (entryId: string, currentPinned: boolean) => void;
  onResolveConflict?: (entryId: string) => void;
}

/**
 * EntryListContent renders entries without a scrolling container.
 * Use this inside your own ScrollView or FlatList.
 * For a complete scrolling list, use EntryList instead.
 */
export function EntryListContent({
  entries,
  sections,
  emptyMessage = "No entries",
  displayMode,
  streamMap,
  locationMap,
  onEntryPress,
  onTagPress,
  onMentionPress,
  onStreamPress,
  onMove,
  onCopy,
  onDelete,
  onPin,
  onResolveConflict,
}: EntryListContentProps) {
  const [openMenuEntryId, setOpenMenuEntryId] = useState<string | null>(null);

  const renderEntry = (entry: Entry) => (
    <View key={entry.entry_id} style={styles.entryItemWrapper}>
      <EntryListItem
        entry={entry}
        onPress={() => onEntryPress(entry.entry_id)}
        onTagPress={onTagPress}
        onMentionPress={onMentionPress}
        onStreamPress={onStreamPress}
        onMove={onMove}
        onCopy={onCopy}
        onDelete={onDelete}
        onPin={onPin}
        onResolveConflict={onResolveConflict}
        streamName={entry.stream_id && streamMap ? streamMap[entry.stream_id] : null}
        locationName={entry.location_id && locationMap ? locationMap[entry.location_id] : null}
        displayMode={displayMode}
        showMenu={openMenuEntryId === entry.entry_id}
        onMenuToggle={() => setOpenMenuEntryId(openMenuEntryId === entry.entry_id ? null : entry.entry_id)}
      />
    </View>
  );

  // Empty state
  if (entries.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  // Render with section headers
  if (sections && sections.length > 0) {
    return (
      <>
        {sections.map((section) => (
          <View key={section.title}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionCount}>({section.data.length})</Text>
            </View>
            {section.data.map(renderEntry)}
          </View>
        ))}
      </>
    );
  }

  // Render flat list
  return <>{entries.map(renderEntry)}</>;
}

const styles = StyleSheet.create({
  entryItemWrapper: {
    marginBottom: 8,
  },
  emptyContainer: {
    padding: 24,
    backgroundColor: "#ffffff",
    borderRadius: 8,
  },
  emptyText: {
    fontSize: 16,
    color: "#6b7280",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6b7280",
  },
});
