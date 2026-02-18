import { useState, useRef, useMemo, useEffect, useCallback, memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, InteractionManager } from "react-native";
import type { EntryDisplayMode, EntrySortMode, EntrySortOrder, Stream } from "@trace/core";
import type { EntryWithRelations } from "../../modules/entries/EntryWithRelationsTypes";
import { EntryListItemRow } from "../../modules/entries/components/EntryListItemRow";
import { EntryListHeader, StickyEntryListHeader } from "../../modules/entries/components/EntryListHeader";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { useCalendarEntries } from "./useCalendarEntries";
import { getEntryDate, type CalendarDateField } from "./calendarHelpers";
import { sharedStyles } from "./calendarStyles";

type ListItem =
  | { type: 'entry'; entry: EntryWithRelations; key: string }
  | { type: 'sectionHeader'; title: string; count: number; key: string };

interface YearViewProps {
  entries: EntryWithRelations[];
  dateField: CalendarDateField;
  displayMode: EntryDisplayMode;
  displayModeLabel: string;
  sortMode: EntrySortMode;
  sortModeLabel: string;
  orderMode: EntrySortOrder;
  showPinnedFirst: boolean;
  streamMap: Record<string, string>;
  streamById: Record<string, Stream>;
  onDisplayModePress: () => void;
  onSortModePress: () => void;
  onEntryPress: (entryId: string) => void;
  onTagPress: (tag: string) => void;
  onMentionPress: (mention: string) => void;
  onMoveEntry: (entryId: string) => void;
  onCopyEntry: (entryId: string) => void;
  onDeleteEntry: (entryId: string) => void;
  onPinEntry: (entryId: string, currentPinned: boolean) => void;
  onArchiveEntry: (entryId: string, currentArchived: boolean) => void;
  onDrillDown: (year: number) => void;
  /** Precomputed entry counts per year (from CalendarScreen single-pass) */
  yearCounts: Record<number, number>;
}

export const YearView = memo(function YearView({
  entries,
  dateField,
  displayMode,
  displayModeLabel,
  sortMode,
  sortModeLabel,
  orderMode,
  showPinnedFirst,
  streamMap,
  streamById,
  onDisplayModePress,
  onSortModePress,
  onEntryPress,
  onTagPress,
  onMentionPress,
  onMoveEntry,
  onCopyEntry,
  onDeleteEntry,
  onPinEntry,
  onArchiveEntry,
  onDrillDown,
  yearCounts,
}: YearViewProps) {
  const theme = useTheme();
  const flatListRef = useRef<FlatList<ListItem>>(null);
  const [scrollY, setScrollY] = useState(0);
  const [headerStartY, setHeaderStartY] = useState(400);
  const [viewingDecade, setViewingDecade] = useState(() => {
    const currentYear = new Date().getFullYear();
    return Math.floor(currentYear / 10) * 10;
  });
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [entriesReady, setEntriesReady] = useState(false);
  const [openMenuEntryId, setOpenMenuEntryId] = useState<string | null>(null);

  // Two-phase render: highlight cell instantly, show entries after paint
  useEffect(() => {
    if (selectedYear === null) {
      setEntriesReady(false);
      return;
    }
    setEntriesReady(false);
    const handle = InteractionManager.runAfterInteractions(() => {
      setEntriesReady(true);
    });
    return () => handle.cancel();
  }, [selectedYear]);

  const decadeStart = viewingDecade;
  const decadeEnd = viewingDecade + 9;
  const years = Array.from({ length: 10 }, (_, i) => decadeStart + i);
  const showStickyHeader = selectedYear !== null && entriesReady && scrollY > headerStartY;

  // Filtered entries for selected year
  const filteredEntries = useMemo(() => {
    if (selectedYear === null) return [];
    return entries.filter(entry => {
      const date = getEntryDate(entry, dateField);
      if (!date) return false;
      return date.getFullYear() === selectedYear;
    });
  }, [entries, selectedYear, dateField]);

  // Sort + group via shared hook
  const { sortedEntries, entrySections } = useCalendarEntries(filteredEntries, sortMode, streamMap, streamById, orderMode, showPinnedFirst);

  // Build flat list data with interleaved section headers (#10: index in key to prevent collision)
  const listData = useMemo((): ListItem[] => {
    if (entrySections && entrySections.length > 0) {
      const items: ListItem[] = [];
      for (let i = 0; i < entrySections.length; i++) {
        const section = entrySections[i];
        if (section.title !== '') {
          items.push({ type: 'sectionHeader', title: section.title, count: section.data.length, key: `section-${i}-${section.title}` });
        }
        for (const entry of section.data) {
          items.push({ type: 'entry', entry, key: entry.entry_id });
        }
      }
      return items;
    }
    return sortedEntries.map(entry => ({ type: 'entry' as const, entry, key: entry.entry_id }));
  }, [sortedEntries, entrySections]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'sectionHeader') {
      return (
        <View style={sharedStyles.sectionHeader}>
          <Text style={[sharedStyles.sectionTitle, { color: theme.colors.text.primary }]}>{item.title}</Text>
          <Text style={[sharedStyles.sectionCount, { color: theme.colors.text.secondary }]}>({item.count})</Text>
        </View>
      );
    }
    return (
      <View style={sharedStyles.entryItemWrapper}>
        <EntryListItemRow
          entry={item.entry}
          onEntryPress={onEntryPress}
          onTagPress={onTagPress}
          onMentionPress={onMentionPress}
          onMove={onMoveEntry}
          onCopy={onCopyEntry}
          onDelete={onDeleteEntry}
          onPin={onPinEntry}
          onArchive={onArchiveEntry}
          streamMap={streamMap}
          streamById={streamById}
          displayMode={displayMode}
          showMenu={openMenuEntryId === item.entry.entry_id}
          onMenuToggle={() => setOpenMenuEntryId(prev => prev === item.entry.entry_id ? null : item.entry.entry_id)}
        />
      </View>
    );
  }, [theme, onEntryPress, onTagPress, onMentionPress, onMoveEntry, onCopyEntry, onDeleteEntry, onPinEntry, onArchiveEntry, streamMap, streamById, displayMode, openMenuEntryId]);

  const handleScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    setScrollY(e.nativeEvent.contentOffset.y);
  }, []);

  return (
    <View style={sharedStyles.content}>
      <FlatList<ListItem>
        ref={flatListRef}
        data={selectedYear !== null && entriesReady ? listData : []}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            {/* Year Grid */}
            <View style={[sharedStyles.calendarContainer, { backgroundColor: theme.colors.background.primary }]}>
              <View style={styles.yearViewHeader}>
                <TouchableOpacity onPress={() => { setViewingDecade(viewingDecade - 10); setSelectedYear(null); }} style={[sharedStyles.navButton, { backgroundColor: theme.colors.background.tertiary }]}>
                  <Text style={[sharedStyles.navButtonText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>‹</Text>
                </TouchableOpacity>
                <Text style={[styles.decadeTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]}>{decadeStart}-{decadeEnd}</Text>
                <TouchableOpacity onPress={() => { setViewingDecade(viewingDecade + 10); setSelectedYear(null); }} style={[sharedStyles.navButton, { backgroundColor: theme.colors.background.tertiary }]}>
                  <Text style={[sharedStyles.navButtonText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>›</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.yearsGrid}>
                {years.map(year => {
                  const count = yearCounts[year] || 0;
                  const isSelected = year === selectedYear;

                  return (
                    <TouchableOpacity
                      key={year}
                      style={[styles.yearCell, isSelected && { backgroundColor: theme.colors.functional.accent }]}
                      onPress={() => {
                        if (isSelected) {
                          onDrillDown(year);
                        } else {
                          setSelectedYear(year);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.yearCellText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }, isSelected && { color: "#ffffff" }]}>
                        {year}
                      </Text>
                      {count > 0 && (
                        <View style={[sharedStyles.countBadge, { backgroundColor: theme.colors.functional.accent }, isSelected && { backgroundColor: "#ffffff" }]}>
                          <Text style={[sharedStyles.countText, isSelected && { color: theme.colors.functional.accent }]}>
                            {count}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Entry List Header */}
            {selectedYear !== null && entriesReady && (
              <EntryListHeader
                title={String(selectedYear)}
                entryCount={sortedEntries.length}
                displayModeLabel={displayModeLabel}
                sortModeLabel={sortModeLabel}
                onDisplayModePress={onDisplayModePress}
                onSortModePress={onSortModePress}
                onLayout={(e) => setHeaderStartY(e.nativeEvent.layout.y)}
              />
            )}
          </>
        }
        ListEmptyComponent={selectedYear !== null && entriesReady ? (
          <View style={[sharedStyles.emptyContainer, { backgroundColor: theme.colors.background.secondary }]}>
            <Text style={[sharedStyles.emptyText, { color: theme.colors.text.secondary }]}>No entries for this year</Text>
          </View>
        ) : null}
        contentContainerStyle={sharedStyles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={false}
      />

      {/* Sticky Header */}
      {showStickyHeader && (
        <StickyEntryListHeader
          title={String(selectedYear)}
          entryCount={sortedEntries.length}
          displayModeLabel={displayModeLabel}
          sortModeLabel={sortModeLabel}
          onDisplayModePress={onDisplayModePress}
          onSortModePress={onSortModePress}
          onScrollToTop={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  yearViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  decadeTitle: {
    fontSize: 24,
    flex: 1,
    textAlign: "center",
  },
  yearsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  yearCell: {
    width: "30%",
    minHeight: 48,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
  },
  yearCellText: {
    fontSize: 16,
  },
});
