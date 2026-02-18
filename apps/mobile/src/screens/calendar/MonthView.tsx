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

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

type ListItem =
  | { type: 'entry'; entry: EntryWithRelations; key: string }
  | { type: 'sectionHeader'; title: string; count: number; key: string };

interface MonthViewProps {
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
  onDrillDown: (month: number, year: number) => void;
  /** Year to show when this view mounts (e.g. from year drill-down) */
  initialYear?: number;
  /** Precomputed entry counts per month key (from CalendarScreen single-pass) */
  monthCounts: Record<string, number>;
}

export const MonthView = memo(function MonthView({
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
  initialYear,
  monthCounts,
}: MonthViewProps) {
  const theme = useTheme();
  const flatListRef = useRef<FlatList<ListItem>>(null);
  const [scrollY, setScrollY] = useState(0);
  const [headerStartY, setHeaderStartY] = useState(400);
  const [monthViewYear, setMonthViewYear] = useState(() => initialYear ?? new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [entriesReady, setEntriesReady] = useState(false);
  const [openMenuEntryId, setOpenMenuEntryId] = useState<string | null>(null);

  // Two-phase render: highlight cell instantly, show entries after paint
  useEffect(() => {
    if (selectedMonth === null) {
      setEntriesReady(false);
      return;
    }
    setEntriesReady(false);
    const handle = InteractionManager.runAfterInteractions(() => {
      setEntriesReady(true);
    });
    return () => handle.cancel();
  }, [selectedMonth]);

  const selectedMonthName = selectedMonth !== null ? MONTH_NAMES[selectedMonth] : '';
  const showStickyHeader = selectedMonth !== null && entriesReady && scrollY > headerStartY;

  // Filtered entries for selected month
  const filteredEntries = useMemo(() => {
    if (selectedMonth === null) return [];
    return entries.filter(entry => {
      const date = getEntryDate(entry, dateField);
      if (!date) return false;
      return date.getFullYear() === monthViewYear && date.getMonth() === selectedMonth;
    });
  }, [entries, monthViewYear, selectedMonth, dateField]);

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
        data={selectedMonth !== null && entriesReady ? listData : []}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            {/* Month Grid */}
            <View style={[sharedStyles.calendarContainer, { backgroundColor: theme.colors.background.primary }]}>
              <View style={styles.monthViewHeader}>
                <TouchableOpacity onPress={() => { setMonthViewYear(monthViewYear - 1); setSelectedMonth(null); }} style={[sharedStyles.navButton, { backgroundColor: theme.colors.background.tertiary }]}>
                  <Text style={[sharedStyles.navButtonText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>‹</Text>
                </TouchableOpacity>
                <Text style={[styles.yearTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]}>{monthViewYear}</Text>
                <TouchableOpacity onPress={() => { setMonthViewYear(monthViewYear + 1); setSelectedMonth(null); }} style={[sharedStyles.navButton, { backgroundColor: theme.colors.background.tertiary }]}>
                  <Text style={[sharedStyles.navButtonText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>›</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.monthsGrid}>
                {MONTH_NAMES.map((name, monthIndex) => {
                  const monthKey = `${monthViewYear}-${String(monthIndex + 1).padStart(2, '0')}`;
                  const count = monthCounts[monthKey] || 0;
                  const isSelected = monthIndex === selectedMonth;

                  return (
                    <TouchableOpacity
                      key={monthIndex}
                      style={[styles.monthCell, isSelected && { backgroundColor: theme.colors.functional.accent }]}
                      onPress={() => {
                        if (isSelected) {
                          onDrillDown(monthIndex, monthViewYear);
                        } else {
                          setSelectedMonth(monthIndex);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.monthCellText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }, isSelected && { color: "#ffffff" }]}>
                        {name.substring(0, 3)}
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
            {selectedMonth !== null && entriesReady && (
              <EntryListHeader
                title={`${selectedMonthName} ${monthViewYear}`}
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
        ListEmptyComponent={selectedMonth !== null && entriesReady ? (
          <View style={[sharedStyles.emptyContainer, { backgroundColor: theme.colors.background.secondary }]}>
            <Text style={[sharedStyles.emptyText, { color: theme.colors.text.secondary }]}>No entries for this month</Text>
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
          title={`${selectedMonthName} ${monthViewYear}`}
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
  monthViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  yearTitle: {
    fontSize: 24,
    flex: 1,
    textAlign: "center",
  },
  monthsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  monthCell: {
    width: "30%",
    minHeight: 56,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  monthCellText: {
    fontSize: 14,
  },
});
