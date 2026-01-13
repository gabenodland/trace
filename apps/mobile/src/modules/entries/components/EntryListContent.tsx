import { View, Text, StyleSheet } from "react-native";
import { useState } from "react";
import type { Entry, Stream, EntrySection, EntryDisplayMode } from "@trace/core";
import { getStreamAttributeVisibility } from "@trace/core";
import { EntryListItem } from "./EntryListItem";
import { useTheme } from "../../../shared/contexts/ThemeContext";

interface EntryListContentProps {
  entries: Entry[];
  sections?: EntrySection[] | null;
  emptyMessage?: string;
  displayMode?: EntryDisplayMode;
  streamMap?: Record<string, string> | null;
  locationMap?: Record<string, string> | null;
  /** Map of stream_id to Stream object for attribute visibility */
  streamById?: Record<string, Stream> | null;
  onEntryPress: (entryId: string) => void;
  onTagPress?: (tag: string) => void;
  onMentionPress?: (mention: string) => void;
  onStreamPress?: (streamId: string | null, streamName: string) => void;
  onMove?: (entryId: string) => void;
  onCopy?: (entryId: string) => void;
  onDelete?: (entryId: string) => void;
  onPin?: (entryId: string, currentPinned: boolean) => void;
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
  streamById,
  onEntryPress,
  onTagPress,
  onMentionPress,
  onStreamPress,
  onMove,
  onCopy,
  onDelete,
  onPin,
}: EntryListContentProps) {
  const theme = useTheme();
  const [openMenuEntryId, setOpenMenuEntryId] = useState<string | null>(null);

  const renderEntry = (entry: Entry) => {
    // Get attribute visibility for this entry's stream
    const stream = entry.stream_id && streamById ? streamById[entry.stream_id] : null;
    const attributeVisibility = getStreamAttributeVisibility(stream);

    return (
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
          streamName={entry.stream_id && streamMap ? streamMap[entry.stream_id] : null}
          locationName={entry.location_id && locationMap ? locationMap[entry.location_id] : null}
          displayMode={displayMode}
          showMenu={openMenuEntryId === entry.entry_id}
          onMenuToggle={() => setOpenMenuEntryId(openMenuEntryId === entry.entry_id ? null : entry.entry_id)}
          attributeVisibility={attributeVisibility}
        />
      </View>
    );
  };

  // Empty state
  if (entries.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.colors.background.secondary }]}>
        <Text style={[styles.emptyText, { color: theme.colors.text.secondary }]}>{emptyMessage}</Text>
      </View>
    );
  }

  // Render with section headers
  if (sections && sections.length > 0) {
    return (
      <>
        {sections.map((section, index) => (
          <View key={section.title || `section-${index}`}>
            {/* Only show section header if title is not empty */}
            {section.title !== '' && (
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>{section.title}</Text>
                <Text style={[styles.sectionCount, { color: theme.colors.text.secondary }]}>({section.data.length})</Text>
              </View>
            )}
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
    borderRadius: 8,
  },
  emptyText: {
    fontSize: 16,
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
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: "500",
  },
});
