import { View, Text, StyleSheet } from "react-native";
import { useState } from "react";
import type { Stream, EntrySection, EntryDisplayMode } from "@trace/core";
import type { EntryWithRelations } from "../EntryWithRelationsTypes";
import { EntryListItemRow } from "./EntryListItemRow";
import { useTheme } from "../../../shared/contexts/ThemeContext";

interface EntryListContentProps {
  entries: EntryWithRelations[];
  sections?: EntrySection<EntryWithRelations>[] | null;
  emptyMessage?: string;
  displayMode?: EntryDisplayMode;
  streamMap?: Record<string, string> | null;
  locationMap?: Record<string, string> | null;
  /** Map of stream_id to Stream object for attribute visibility */
  streamById?: Record<string, Stream> | null;
  /** ID of the stream being viewed (to hide redundant stream badge) */
  currentStreamId?: string | null;
  onEntryPress: (entryId: string) => void;
  onTagPress?: (tag: string) => void;
  onMentionPress?: (mention: string) => void;
  onStreamPress?: (streamId: string | null, streamName: string) => void;
  onMove?: (entryId: string) => void;
  onCopy?: (entryId: string) => void;
  onDelete?: (entryId: string) => void;
  onPin?: (entryId: string, currentPinned: boolean) => void;
  onArchive?: (entryId: string, currentArchived: boolean) => void;
  onSelectOnMap?: (entryId: string) => void;
  selectedEntryId?: string | null;
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
  currentStreamId,
  onEntryPress,
  onTagPress,
  onMentionPress,
  onStreamPress,
  onMove,
  onCopy,
  onDelete,
  onPin,
  onArchive,
  onSelectOnMap,
  selectedEntryId,
}: EntryListContentProps) {
  const theme = useTheme();
  const [openMenuEntryId, setOpenMenuEntryId] = useState<string | null>(null);

  const renderEntry = (entry: EntryWithRelations) => (
    <View key={entry.entry_id} style={styles.entryItemWrapper}>
      <EntryListItemRow
        entry={entry}
        onEntryPress={onEntryPress}
        onTagPress={onTagPress}
        onMentionPress={onMentionPress}
        onStreamPress={onStreamPress}
        onMove={onMove}
        onCopy={onCopy}
        onDelete={onDelete}
        onPin={onPin}
        onArchive={onArchive}
        onSelectOnMap={onSelectOnMap}
        selectedEntryId={selectedEntryId}
        streamMap={streamMap}
        locationMap={locationMap}
        streamById={streamById}
        currentStreamId={currentStreamId}
        displayMode={displayMode}
        showMenu={openMenuEntryId === entry.entry_id}
        onMenuToggle={() => setOpenMenuEntryId(openMenuEntryId === entry.entry_id ? null : entry.entry_id)}
      />
    </View>
  );

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
