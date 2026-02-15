import { View, Text, FlatList, SectionList, StyleSheet, ActivityIndicator } from "react-native";
import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import type { Stream as FullStream, EntrySection, EntryDisplayMode } from "@trace/core";
import { getStreamAttributeVisibility } from "@trace/core";
import type { EntryWithRelations } from "../EntryWithRelationsTypes";
import { EntryListItem } from "./EntryListItem";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { themeBase } from "../../../shared/theme/themeBase";
import { FAB_CLEARANCE } from "../../../components/layout/BottomNavBar";
import { createScopedLogger, LogScopes } from "../../../shared/utils/logger";

const log = createScopedLogger(LogScopes.EntryNav);

interface Stream {
  stream_id: string;
  name: string;
}

interface Location {
  location_id: string;
  name: string;
}

interface EntryListProps {
  entries: EntryWithRelations[];
  sections?: EntrySection<EntryWithRelations>[]; // Optional sections for grouped display
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
  /** ID of the stream being viewed (to hide redundant stream badge) */
  currentStreamId?: string | null;
  displayMode?: EntryDisplayMode; // Display mode for entry items
  /** Full stream objects for attribute visibility determination */
  fullStreams?: FullStream[];
  /** Entry count for header display (filtered count) */
  entryCount?: number;
  /** Total count for header display (unfiltered count) */
  totalCount?: number;
}

/** Methods exposed via ref */
export interface EntryListRef {
  scrollToTop: () => void;
}

export const EntryList = forwardRef<EntryListRef, EntryListProps>(function EntryList({ entries, sections, isLoading, onEntryPress, onTagPress, onMentionPress, onStreamPress, onMove, onCopy, onDelete, onPin, onSelectOnMap, onArchive, ListHeaderComponent, streams, locations, currentStreamId, displayMode, fullStreams, entryCount, totalCount }, ref) {
  const theme = useTheme();
  const [openMenuEntryId, setOpenMenuEntryId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<EntryWithRelations>>(null);
  const sectionListRef = useRef<SectionList<EntryWithRelations, EntrySection<EntryWithRelations>>>(null);

  // Expose scrollToTop method via ref
  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      sectionListRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true });
    },
  }), []);

  // Build count header that scrolls with list
  const isFiltering = totalCount !== undefined && entryCount !== undefined && entryCount !== totalCount;
  const countLabel = isFiltering
    ? `${entryCount} of ${totalCount} entries`
    : entryCount !== undefined
      ? `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`
      : undefined;

  const CountHeader = countLabel ? (
    <View style={styles.countHeader}>
      <Text style={[
        styles.countHeaderText,
        { color: isFiltering ? theme.colors.interactive.primary : theme.colors.text.secondary },
        { fontFamily: theme.typography.fontFamily.medium }
      ]}>
        {countLabel}
      </Text>
    </View>
  ) : null;

  // Combine external ListHeaderComponent with count header
  const CombinedHeader = ListHeaderComponent || CountHeader ? (
    <>
      {ListHeaderComponent}
      {CountHeader}
    </>
  ) : null;

  // Determine the appropriate empty message based on filter state
  const getEmptyMessage = (): { title: string; subtitle?: string } => {
    // If we have both counts, determine if it's empty stream or filtered out
    if (totalCount !== undefined && entryCount !== undefined) {
      if (totalCount === 0) {
        return {
          title: "No entries in this stream yet",
          subtitle: "Capture your first thought, idea, or task!",
        };
      }
      if (entryCount === 0 && totalCount > 0) {
        return {
          title: "No entries match your filters",
          subtitle: "Try adjusting your filter settings",
        };
      }
    }

    // Default fallback
    return {
      title: "No entries yet",
      subtitle: "Capture your first thought, idea, or task!",
    };
  };

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
  const renderEntryItem = (item: EntryWithRelations) => {
    // Get attribute visibility for this entry's stream
    const stream = item.stream_id && fullStreamMap ? fullStreamMap[item.stream_id] : null;
    const attributeVisibility = getStreamAttributeVisibility(stream);

    return (
      <EntryListItem
        entry={item}
        onPress={() => {
          log.info('------- ENTRY CLICKED -------', { entryId: item.entry_id });
          onEntryPress(item.entry_id);
        }}
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
        currentStreamId={currentStreamId}
        displayMode={displayMode}
        showMenu={openMenuEntryId === item.entry_id}
        onMenuToggle={() => setOpenMenuEntryId(openMenuEntryId === item.entry_id ? null : item.entry_id)}
        attributeVisibility={attributeVisibility}
      />
    );
  };

  // Render section header (only if title is not empty)
  const renderSectionHeader = ({ section }: { section: EntrySection<EntryWithRelations> }) => {
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
    const emptyMessage = getEmptyMessage();
    return (
      <SectionList<EntryWithRelations, EntrySection<EntryWithRelations>>
        ref={sectionListRef}
        sections={sections}
        keyExtractor={(item) => item.entry_id}
        renderItem={({ item }) => renderEntryItem(item)}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={CombinedHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text.secondary }]}>{emptyMessage.title}</Text>
            {emptyMessage.subtitle && (
              <Text style={[styles.emptySubtitle, { color: theme.colors.text.tertiary }]}>
                {emptyMessage.subtitle}
              </Text>
            )}
          </View>
        }
        stickySectionHeadersEnabled={false}
        removeClippedSubviews={false}
      />
    );
  }

  // If we have a header component, always render FlatList (even with no entries)
  if (CombinedHeader) {
    const emptyMessage = getEmptyMessage();
    return (
      <FlatList<EntryWithRelations>
        ref={flatListRef}
        data={entries}
        keyExtractor={(item) => item.entry_id}
        renderItem={({ item }) => renderEntryItem(item)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={CombinedHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text.secondary }]}>{emptyMessage.title}</Text>
            {emptyMessage.subtitle && (
              <Text style={[styles.emptySubtitle, { color: theme.colors.text.tertiary }]}>
                {emptyMessage.subtitle}
              </Text>
            )}
          </View>
        }
        removeClippedSubviews={false}
      />
    );
  }

  if (entries.length === 0) {
    const emptyMessage = getEmptyMessage();
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.emptyTitle, { color: theme.colors.text.secondary }]}>{emptyMessage.title}</Text>
        {emptyMessage.subtitle && (
          <Text style={[styles.emptySubtitle, { color: theme.colors.text.tertiary }]}>
            {emptyMessage.subtitle}
          </Text>
        )}
      </View>
    );
  }

  return (
    <FlatList<EntryWithRelations>
      ref={flatListRef}
      data={entries}
      keyExtractor={(item) => item.entry_id}
      renderItem={({ item }) => renderEntryItem(item)}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={CombinedHeader}
      removeClippedSubviews={false}
    />
  );
});

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
  countHeader: {
    paddingBottom: themeBase.spacing.sm,
  },
  countHeaderText: {
    fontSize: themeBase.typography.fontSize.sm,
  },
});
