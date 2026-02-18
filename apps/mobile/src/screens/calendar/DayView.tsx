import { useState, useRef, useMemo, useEffect, useCallback, memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, InteractionManager } from "react-native";
import type { EntryDisplayMode, EntrySortMode, EntrySortOrder, Stream } from "@trace/core";
import type { EntryWithRelations } from "../../modules/entries/EntryWithRelationsTypes";
import { EntryListItemRow } from "../../modules/entries/components/EntryListItemRow";
import { EntryListHeader, StickyEntryListHeader } from "../../modules/entries/components/EntryListHeader";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { useCalendarEntries } from "./useCalendarEntries";
import { formatDateKey, getEntryDate, type CalendarDateField } from "./calendarHelpers";
import { sharedStyles } from "./calendarStyles";

type ListItem =
  | { type: 'entry'; entry: EntryWithRelations; key: string }
  | { type: 'sectionHeader'; title: string; count: number; key: string };

interface DayViewProps {
  entries: EntryWithRelations[];
  selectedDate: string;
  dateField: CalendarDateField;
  viewingMonth: number;
  viewingYear: number;
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
  onSelectDate: (dateKey: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  /** Precomputed entry counts per date key (from CalendarScreen single-pass) */
  entryCounts: Record<string, number>;
}

export const DayView = memo(function DayView({
  entries,
  selectedDate,
  dateField,
  viewingMonth,
  viewingYear,
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
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onToday,
  entryCounts,
}: DayViewProps) {
  const theme = useTheme();
  const flatListRef = useRef<FlatList<ListItem>>(null);
  const [scrollY, setScrollY] = useState(0);
  const [headerStartY, setHeaderStartY] = useState(500);
  const [entriesReady, setEntriesReady] = useState(false);
  const [openMenuEntryId, setOpenMenuEntryId] = useState<string | null>(null);

  // Two-phase render: highlight cell instantly, show entries after paint
  useEffect(() => {
    setEntriesReady(false);
    const handle = InteractionManager.runAfterInteractions(() => {
      setEntriesReady(true);
    });
    return () => handle.cancel();
  }, [selectedDate]);

  const showStickyHeader = entriesReady && scrollY > headerStartY;

  // Calendar grid generation (memoized on viewing month/year)
  const today = useMemo(() => new Date(), []);
  const { calendar, monthName } = useMemo(() => {
    const firstDay = new Date(viewingYear, viewingMonth, 1);
    const lastDay = new Date(viewingYear, viewingMonth + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const name = firstDay.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const cells: Array<{ day: number; isCurrentMonth: boolean; date: Date }> = [];
    const prevMonthLastDay = new Date(viewingYear, viewingMonth, 0);
    const prevMonthDays = prevMonthLastDay.getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const date = new Date(viewingYear, viewingMonth - 1, day);
      cells.push({ day, isCurrentMonth: false, date });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(viewingYear, viewingMonth, day);
      cells.push({ day, isCurrentMonth: true, date });
    }
    const weeksNeeded = Math.ceil(cells.length / 7);
    const totalCells = weeksNeeded * 7;
    const remainingCells = totalCells - cells.length;
    for (let day = 1; day <= remainingCells; day++) {
      const date = new Date(viewingYear, viewingMonth + 1, day);
      cells.push({ day, isCurrentMonth: false, date });
    }
    return { calendar: cells, monthName: name };
  }, [viewingMonth, viewingYear]);

  // Filtered entries for selected date
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const date = getEntryDate(entry, dateField);
      if (!date) return false;
      return formatDateKey(date) === selectedDate;
    });
  }, [entries, selectedDate, dateField]);

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

  const [selYear, selMonth, selDay] = selectedDate.split('-').map(Number);
  const selectedDateObj = new Date(selYear, selMonth - 1, selDay);
  const formattedSelectedDate = selectedDateObj.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const renderDay = (dayInfo: { day: number; isCurrentMonth: boolean; date: Date }) => {
    const { day, isCurrentMonth, date } = dayInfo;
    const dateKey = formatDateKey(date);
    const count = entryCounts[dateKey] || 0;
    const isSelected = dateKey === selectedDate;
    const isToday = dateKey === formatDateKey(today);

    return (
      <TouchableOpacity
        key={dateKey}
        style={[
          styles.dayCell,
          isSelected && { backgroundColor: theme.colors.functional.accent },
          isToday && !isSelected && { backgroundColor: theme.colors.functional.accentLight },
        ]}
        onPress={() => onSelectDate(dateKey)}
      >
        <Text style={[
          styles.dayText,
          { color: theme.colors.text.primary },
          !isCurrentMonth && { color: theme.colors.text.disabled },
          isSelected && { color: "#ffffff", fontWeight: "600" },
          isToday && !isSelected && { color: theme.colors.functional.accent, fontWeight: "600" },
        ]}>
          {day}
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
  };

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
        data={entriesReady ? listData : []}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            {/* Calendar Grid */}
            <View style={[sharedStyles.calendarContainer, { backgroundColor: theme.colors.background.primary }]}>
              <View style={styles.monthHeader}>
                <TouchableOpacity onPress={onPrevMonth} style={[sharedStyles.navButton, { backgroundColor: theme.colors.background.tertiary }]}>
                  <Text style={[sharedStyles.navButtonText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>‹</Text>
                </TouchableOpacity>
                <Text style={[styles.monthTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]}>{monthName}</Text>
                <TouchableOpacity onPress={onNextMonth} style={[sharedStyles.navButton, { backgroundColor: theme.colors.background.tertiary }]}>
                  <Text style={[sharedStyles.navButtonText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>›</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={onToday} style={[styles.todayButton, { backgroundColor: theme.colors.functional.accent }]}>
                <Text style={[styles.todayButtonText, { fontFamily: theme.typography.fontFamily.semibold }]}>Today</Text>
              </TouchableOpacity>

              <View style={styles.weekRow}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                  <View key={index} style={styles.dayHeaderCell}>
                    <Text style={[styles.dayHeaderText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.semibold }]}>{day}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {Array.from({ length: Math.ceil(calendar.length / 7) }).map((_, weekIndex) => (
                  <View key={weekIndex} style={styles.weekRow}>
                    {calendar.slice(weekIndex * 7, weekIndex * 7 + 7).map(renderDay)}
                  </View>
                ))}
              </View>
            </View>

            {/* Entry List Header */}
            {entriesReady && (
              <EntryListHeader
                title={formattedSelectedDate}
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
        ListEmptyComponent={entriesReady ? (
          <View style={[sharedStyles.emptyContainer, { backgroundColor: theme.colors.background.secondary }]}>
            <Text style={[sharedStyles.emptyText, { color: theme.colors.text.secondary }]}>No entries for this date</Text>
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
          title={formattedSelectedDate}
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
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  monthTitle: {
    fontSize: 20,
    flex: 1,
    textAlign: "center",
  },
  todayButton: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 16,
  },
  todayButtonText: {
    fontSize: 14,
    color: "#ffffff",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontSize: 12,
  },
  calendarGrid: {
    marginTop: 8,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    margin: 2,
    borderRadius: 8,
    maxHeight: 50,
    paddingTop: 4,
  },
  dayText: {
    fontSize: 14,
  },
});
