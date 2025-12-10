import { useState, useMemo, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { Entry } from "@trace/core";
import { useEntries } from "../modules/entries/mobileEntryHooks";
import { useStreams } from "../modules/streams/mobileStreamHooks";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { usePersistedState } from "../shared/hooks/usePersistedState";
import { TopBar } from "../components/layout/TopBar";
import { EntryListContent } from "../modules/entries/components/EntryListContent";
import { EntryListHeader, StickyEntryListHeader } from "../modules/entries/components/EntryListHeader";
import { FloatingActionButton } from "../components/buttons/FloatingActionButton";
import { DisplayModeSelector } from "../modules/entries/components/DisplayModeSelector";
import { SortModeSelector } from "../modules/entries/components/SortModeSelector";
import type { EntryDisplayMode } from "../modules/entries/types/EntryDisplayMode";
import { DEFAULT_DISPLAY_MODE, ENTRY_DISPLAY_MODES } from "../modules/entries/types/EntryDisplayMode";
import type { EntrySortMode } from "../modules/entries/types/EntrySortMode";
import { DEFAULT_SORT_MODE, ENTRY_SORT_MODES } from "../modules/entries/types/EntrySortMode";
import type { EntrySortOrder } from "../modules/entries/types/EntrySortOrder";
import { DEFAULT_SORT_ORDER } from "../modules/entries/types/EntrySortOrder";
import { sortEntries, groupEntriesByStatus, groupEntriesByType, groupEntriesByStream, groupEntriesByPriority, groupEntriesByRating, groupEntriesByDueDate, type EntrySection } from "../modules/entries/helpers/entrySortHelpers";
import { theme } from "../shared/theme/theme";

// Calendar date field type - which date to use for calendar display
type CalendarDateField = 'entry_date' | 'updated_at' | 'due_date';

interface CalendarDateFieldOption {
  value: CalendarDateField;
  label: string;
}

const CALENDAR_DATE_FIELDS: CalendarDateFieldOption[] = [
  { value: 'entry_date', label: 'Entry Date' },
  { value: 'updated_at', label: 'Last Updated' },
  { value: 'due_date', label: 'Due Date' },
];

// Helper to get date from entry based on selected field
function getEntryDate(entry: Entry, field: CalendarDateField): Date | null {
  switch (field) {
    case 'entry_date':
      return new Date(entry.entry_date || entry.created_at);
    case 'updated_at':
      return new Date(entry.updated_at);
    case 'due_date':
      return entry.due_date ? new Date(entry.due_date) : null;
    default:
      return new Date(entry.entry_date || entry.created_at);
  }
}

// Helper function to format date in YYYY-MM-DD format in local timezone
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface CalendarScreenProps {
  returnDate?: string;
  returnZoomLevel?: ZoomLevel;
}

type ZoomLevel = "day" | "month" | "year";

export function CalendarScreen({ returnDate, returnZoomLevel }: CalendarScreenProps = {}) {
  const { navigate } = useNavigation();
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("day");
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return formatDateKey(today);
  });

  // Date field selector state (persisted)
  const [dateField, setDateField] = usePersistedState<CalendarDateField>('@calendarDateField', 'entry_date');
  const [showDateFieldSelector, setShowDateFieldSelector] = useState(false);
  const dateFieldLabel = CALENDAR_DATE_FIELDS.find(f => f.value === dateField)?.label || 'Entry Date';

  // State for viewing month/year
  const [viewingMonth, setViewingMonth] = useState(() => new Date().getMonth());
  const [viewingYear, setViewingYear] = useState(() => new Date().getFullYear());

  // State for month view
  const [monthViewYear, setMonthViewYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // State for year view
  const [viewingDecade, setViewingDecade] = useState(() => {
    const currentYear = new Date().getFullYear();
    return Math.floor(currentYear / 10) * 10;
  });
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Scroll refs and content heights for each view
  const dayScrollRef = useRef<ScrollView>(null);
  const monthScrollRef = useRef<ScrollView>(null);
  const yearScrollRef = useRef<ScrollView>(null);
  // Track the Y position where the header box starts (when it reaches top, show sticky)
  const [dayHeaderStartY, setDayHeaderStartY] = useState(500);
  const [monthHeaderStartY, setMonthHeaderStartY] = useState(400);
  const [yearHeaderStartY, setYearHeaderStartY] = useState(400);

  // Scroll position tracking
  const [dayScrollY, setDayScrollY] = useState(0);
  const [monthScrollY, setMonthScrollY] = useState(0);
  const [yearScrollY, setYearScrollY] = useState(0);

  // Display and sort mode state (persisted)
  const [displayMode, setDisplayMode] = usePersistedState<EntryDisplayMode>('@calendarDisplayMode', DEFAULT_DISPLAY_MODE);
  const [sortMode, setSortMode] = usePersistedState<EntrySortMode>('@calendarSortMode', DEFAULT_SORT_MODE);
  const [orderMode, setOrderMode] = usePersistedState<EntrySortOrder>('@calendarOrderMode', DEFAULT_SORT_ORDER);
  const [showPinnedFirst, setShowPinnedFirst] = usePersistedState<boolean>('@calendarShowPinnedFirst', false);
  const [showDisplayModeSelector, setShowDisplayModeSelector] = useState(false);
  const [showSortModeSelector, setShowSortModeSelector] = useState(false);

  // Get display/sort mode labels
  const displayModeLabel = ENTRY_DISPLAY_MODES.find(m => m.value === displayMode)?.label || 'Cards';
  const sortModeLabel = ENTRY_SORT_MODES.find(m => m.value === sortMode)?.label || 'Date';

  // Return date handling
  useEffect(() => {
    if (returnDate) {
      const date = new Date(returnDate);
      const dateKey = formatDateKey(date);
      setSelectedDate(dateKey);
      setViewingMonth(date.getMonth());
      setViewingYear(date.getFullYear());
      setMonthViewYear(date.getFullYear());
      if (returnZoomLevel) {
        setZoomLevel(returnZoomLevel);
      }
    }
  }, [returnDate, returnZoomLevel]);

  // Data hooks
  const { entries } = useEntries({});
  const { streams } = useStreams();

  // Entry counts - based on selected date field
  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach(entry => {
      const date = getEntryDate(entry, dateField);
      if (date) {
        const dateKey = formatDateKey(date);
        counts[dateKey] = (counts[dateKey] || 0) + 1;
      }
    });
    return counts;
  }, [entries, dateField]);

  const monthCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach(entry => {
      const date = getEntryDate(entry, dateField);
      if (date) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        counts[monthKey] = (counts[monthKey] || 0) + 1;
      }
    });
    return counts;
  }, [entries, dateField]);

  const yearCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    entries.forEach(entry => {
      const date = getEntryDate(entry, dateField);
      if (date) {
        const year = date.getFullYear();
        counts[year] = (counts[year] || 0) + 1;
      }
    });
    return counts;
  }, [entries, dateField]);

  // Filtered entries - based on selected date field
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const date = getEntryDate(entry, dateField);
      if (!date) return false;
      const dateKey = formatDateKey(date);
      return dateKey === selectedDate;
    });
  }, [entries, selectedDate, dateField]);

  const filteredEntriesForYear = useMemo(() => {
    if (selectedYear === null) return [];
    return entries.filter(entry => {
      const date = getEntryDate(entry, dateField);
      if (!date) return false;
      return date.getFullYear() === selectedYear;
    });
  }, [entries, selectedYear, dateField]);

  const filteredEntriesForMonth = useMemo(() => {
    if (selectedMonth === null) return [];
    return entries.filter(entry => {
      const date = getEntryDate(entry, dateField);
      if (!date) return false;
      return date.getFullYear() === monthViewYear && date.getMonth() === selectedMonth;
    });
  }, [entries, monthViewYear, selectedMonth, dateField]);

  // Stream map
  const streamMap = useMemo(() => {
    return streams?.reduce((map, stream) => {
      map[stream.stream_id] = stream.name;
      return map;
    }, {} as Record<string, string>) || {};
  }, [streams]);

  // Sorted entries for day view
  const sortedEntries = useMemo(() => {
    return sortEntries(filteredEntries, sortMode, streamMap, orderMode, showPinnedFirst);
  }, [filteredEntries, sortMode, streamMap, orderMode, showPinnedFirst]);

  // Sorted entries for month view
  const sortedEntriesForMonth = useMemo(() => {
    return sortEntries(filteredEntriesForMonth, sortMode, streamMap, orderMode, showPinnedFirst);
  }, [filteredEntriesForMonth, sortMode, streamMap, orderMode, showPinnedFirst]);

  // Sorted entries for year view
  const sortedEntriesForYear = useMemo(() => {
    return sortEntries(filteredEntriesForYear, sortMode, streamMap, orderMode, showPinnedFirst);
  }, [filteredEntriesForYear, sortMode, streamMap, orderMode, showPinnedFirst]);

  // Compute sections for day view when sorting by status, type, stream, etc.
  const entrySections = useMemo((): EntrySection[] | undefined => {
    if (sortMode === 'status') {
      return groupEntriesByStatus(filteredEntries, orderMode, showPinnedFirst);
    }
    if (sortMode === 'type') {
      return groupEntriesByType(filteredEntries, orderMode, showPinnedFirst);
    }
    if (sortMode === 'stream') {
      return groupEntriesByStream(filteredEntries, streamMap, orderMode, showPinnedFirst);
    }
    if (sortMode === 'priority') {
      return groupEntriesByPriority(filteredEntries, orderMode, showPinnedFirst);
    }
    if (sortMode === 'rating') {
      return groupEntriesByRating(filteredEntries, orderMode, showPinnedFirst);
    }
    if (sortMode === 'due_date') {
      return groupEntriesByDueDate(filteredEntries, orderMode, showPinnedFirst);
    }
    return undefined;
  }, [filteredEntries, sortMode, streamMap, orderMode, showPinnedFirst]);

  // Compute sections for month view
  const entrySectionsForMonth = useMemo((): EntrySection[] | undefined => {
    if (sortMode === 'status') {
      return groupEntriesByStatus(filteredEntriesForMonth, orderMode, showPinnedFirst);
    }
    if (sortMode === 'type') {
      return groupEntriesByType(filteredEntriesForMonth, orderMode, showPinnedFirst);
    }
    if (sortMode === 'stream') {
      return groupEntriesByStream(filteredEntriesForMonth, streamMap, orderMode, showPinnedFirst);
    }
    if (sortMode === 'priority') {
      return groupEntriesByPriority(filteredEntriesForMonth, orderMode, showPinnedFirst);
    }
    if (sortMode === 'rating') {
      return groupEntriesByRating(filteredEntriesForMonth, orderMode, showPinnedFirst);
    }
    if (sortMode === 'due_date') {
      return groupEntriesByDueDate(filteredEntriesForMonth, orderMode, showPinnedFirst);
    }
    return undefined;
  }, [filteredEntriesForMonth, sortMode, streamMap, orderMode, showPinnedFirst]);

  // Compute sections for year view
  const entrySectionsForYear = useMemo((): EntrySection[] | undefined => {
    if (sortMode === 'status') {
      return groupEntriesByStatus(filteredEntriesForYear, orderMode, showPinnedFirst);
    }
    if (sortMode === 'type') {
      return groupEntriesByType(filteredEntriesForYear, orderMode, showPinnedFirst);
    }
    if (sortMode === 'stream') {
      return groupEntriesByStream(filteredEntriesForYear, streamMap, orderMode, showPinnedFirst);
    }
    if (sortMode === 'priority') {
      return groupEntriesByPriority(filteredEntriesForYear, orderMode, showPinnedFirst);
    }
    if (sortMode === 'rating') {
      return groupEntriesByRating(filteredEntriesForYear, orderMode, showPinnedFirst);
    }
    if (sortMode === 'due_date') {
      return groupEntriesByDueDate(filteredEntriesForYear, orderMode, showPinnedFirst);
    }
    return undefined;
  }, [filteredEntriesForYear, sortMode, streamMap, orderMode, showPinnedFirst]);

  // Navigation handlers
  const handleEntryPress = (entryId: string) => {
    navigate("capture", {
      entryId,
      returnContext: { screen: "calendar", selectedDate, zoomLevel }
    });
  };

  const handleTagPress = (tag: string) => {
    navigate("inbox", { returnStreamId: `tag:${tag}`, returnStreamName: `#${tag}` });
  };

  const handleMentionPress = (mention: string) => {
    navigate("inbox", { returnStreamId: `mention:${mention}`, returnStreamName: `@${mention}` });
  };

  const handleAddEntry = () => {
    let dateToUse = selectedDate;
    if (zoomLevel === "month" && selectedMonth !== null) {
      const firstDay = new Date(monthViewYear, selectedMonth, 1);
      dateToUse = formatDateKey(firstDay);
    }
    if (zoomLevel === "year" && selectedYear !== null) {
      const firstDay = new Date(selectedYear, 0, 1);
      dateToUse = formatDateKey(firstDay);
    }
    navigate("capture", {
      initialDate: dateToUse,
      returnContext: { screen: "calendar", selectedDate: dateToUse, zoomLevel }
    });
  };

  // Calendar generation
  const today = new Date();
  const currentMonth = viewingMonth;
  const currentYear = viewingYear;
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const monthName = firstDay.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const calendar: Array<{ day: number; isCurrentMonth: boolean; date: Date }> = [];
  const prevMonthLastDay = new Date(currentYear, currentMonth, 0);
  const prevMonthDays = prevMonthLastDay.getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const date = new Date(currentYear, currentMonth - 1, day);
    calendar.push({ day, isCurrentMonth: false, date });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonth, day);
    calendar.push({ day, isCurrentMonth: true, date });
  }
  // Calculate how many weeks are needed (round up to complete the last week)
  const weeksNeeded = Math.ceil(calendar.length / 7);
  const totalCells = weeksNeeded * 7;
  const remainingCells = totalCells - calendar.length;
  for (let day = 1; day <= remainingCells; day++) {
    const date = new Date(currentYear, currentMonth + 1, day);
    calendar.push({ day, isCurrentMonth: false, date });
  }

  const [selYear, selMonth, selDay] = selectedDate.split('-').map(Number);
  const selectedDateObj = new Date(selYear, selMonth - 1, selDay);
  const formattedSelectedDate = selectedDateObj.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  // Day view navigation
  const handlePrevMonth = () => {
    if (viewingMonth === 0) {
      setViewingMonth(11);
      setViewingYear(viewingYear - 1);
    } else {
      setViewingMonth(viewingMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewingMonth === 11) {
      setViewingMonth(0);
      setViewingYear(viewingYear + 1);
    } else {
      setViewingMonth(viewingMonth + 1);
    }
  };

  const handleToday = () => {
    const today = new Date();
    setViewingMonth(today.getMonth());
    setViewingYear(today.getFullYear());
    setSelectedDate(formatDateKey(today));
  };

  // Render day cell
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
          isSelected && styles.dayCellSelected,
          isToday && !isSelected && styles.dayCellToday,
        ]}
        onPress={() => setSelectedDate(dateKey)}
      >
        <Text style={[
          styles.dayText,
          !isCurrentMonth && styles.dayTextOtherMonth,
          isSelected && styles.dayTextSelected,
          isToday && !isSelected && styles.dayTextToday,
        ]}>
          {day}
        </Text>
        {count > 0 && (
          <View style={[styles.countBadge, isSelected && styles.countBadgeSelected]}>
            <Text style={[styles.countText, isSelected && styles.countTextSelected]}>
              {count}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Render Day View
  const renderDayView = () => {
    // Show sticky header when the entry list header box reaches the top of the scroll view
    const showStickyHeader = dayScrollY > dayHeaderStartY;

    return (
      <View style={styles.content}>
        <ScrollView
          ref={dayScrollRef}
          onScroll={(e) => setDayScrollY(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Calendar Grid */}
          <View style={styles.calendarContainer}>
            <View style={styles.monthHeader}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
                <Text style={styles.navButtonText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthTitle}>{monthName}</Text>
              <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
                <Text style={styles.navButtonText}>›</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleToday} style={styles.todayButton}>
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>

            <View style={styles.weekRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <View key={index} style={styles.dayHeaderCell}>
                  <Text style={styles.dayHeaderText}>{day}</Text>
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
          <EntryListHeader
            title={formattedSelectedDate}
            entryCount={sortedEntries.length}
            displayModeLabel={displayModeLabel}
            sortModeLabel={sortModeLabel}
            onDisplayModePress={() => setShowDisplayModeSelector(true)}
            onSortModePress={() => setShowSortModeSelector(true)}
            onLayout={(e) => setDayHeaderStartY(e.nativeEvent.layout.y)}
          />

          {/* Entries */}
          <EntryListContent
            entries={sortedEntries}
            sections={entrySections}
            emptyMessage="No entries for this date"
            displayMode={displayMode}
            streamMap={streamMap}
            onEntryPress={handleEntryPress}
            onTagPress={handleTagPress}
            onMentionPress={handleMentionPress}
          />
        </ScrollView>

        {/* Sticky Header - shown when original header scrolls out of view */}
        {showStickyHeader && (
          <StickyEntryListHeader
            title={formattedSelectedDate}
            entryCount={sortedEntries.length}
            displayModeLabel={displayModeLabel}
            sortModeLabel={sortModeLabel}
            onDisplayModePress={() => setShowDisplayModeSelector(true)}
            onSortModePress={() => setShowSortModeSelector(true)}
            onScrollToTop={() => dayScrollRef.current?.scrollTo({ y: 0, animated: true })}
          />
        )}
      </View>
    );
  };

  // Render Month View
  const renderMonthView = () => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const selectedMonthName = selectedMonth !== null ? monthNames[selectedMonth] : '';
    // Show sticky header when the entry list header box reaches the top of the scroll view
    const showStickyHeader = selectedMonth !== null && monthScrollY > monthHeaderStartY;

    return (
      <View style={styles.content}>
        <ScrollView
          ref={monthScrollRef}
          onScroll={(e) => setMonthScrollY(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Month Grid */}
          <View style={styles.calendarContainer}>
            <View style={styles.monthViewHeader}>
              <TouchableOpacity onPress={() => { setMonthViewYear(monthViewYear - 1); setSelectedMonth(null); }} style={styles.navButton}>
                <Text style={styles.navButtonText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.yearTitle}>{monthViewYear}</Text>
              <TouchableOpacity onPress={() => { setMonthViewYear(monthViewYear + 1); setSelectedMonth(null); }} style={styles.navButton}>
                <Text style={styles.navButtonText}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.monthsGrid}>
              {monthNames.map((name, monthIndex) => {
                const monthKey = `${monthViewYear}-${String(monthIndex + 1).padStart(2, '0')}`;
                const count = monthCounts[monthKey] || 0;
                const isSelected = monthIndex === selectedMonth;

                return (
                  <TouchableOpacity
                    key={monthIndex}
                    style={[styles.monthCell, isSelected && styles.monthCellSelected]}
                    onPress={() => {
                      if (isSelected) {
                        setViewingMonth(monthIndex);
                        setViewingYear(monthViewYear);
                        setZoomLevel("day");
                      } else {
                        setSelectedMonth(monthIndex);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.monthCellText, isSelected && styles.monthCellTextSelected]}>
                      {name.substring(0, 3)}
                    </Text>
                    {count > 0 && (
                      <View style={[styles.countBadge, isSelected && styles.countBadgeSelected]}>
                        <Text style={[styles.countText, isSelected && styles.countTextSelected]}>
                          {count}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Entry section - only show when month is selected */}
          {selectedMonth !== null && (
            <>
              {/* Entry List Header */}
              <EntryListHeader
                title={`${selectedMonthName} ${monthViewYear}`}
                entryCount={sortedEntriesForMonth.length}
                displayModeLabel={displayModeLabel}
                sortModeLabel={sortModeLabel}
                onDisplayModePress={() => setShowDisplayModeSelector(true)}
                onSortModePress={() => setShowSortModeSelector(true)}
                onLayout={(e) => setMonthHeaderStartY(e.nativeEvent.layout.y)}
              />

              {/* Entries */}
              <EntryListContent
                entries={sortedEntriesForMonth}
                sections={entrySectionsForMonth}
                emptyMessage="No entries for this month"
                displayMode={displayMode}
                streamMap={streamMap}
                onEntryPress={handleEntryPress}
                onTagPress={handleTagPress}
                onMentionPress={handleMentionPress}
              />
            </>
          )}
        </ScrollView>

        {/* Sticky Header - shown when original header scrolls out of view */}
        {showStickyHeader && (
          <StickyEntryListHeader
            title={`${selectedMonthName} ${monthViewYear}`}
            entryCount={sortedEntriesForMonth.length}
            displayModeLabel={displayModeLabel}
            sortModeLabel={sortModeLabel}
            onDisplayModePress={() => setShowDisplayModeSelector(true)}
            onSortModePress={() => setShowSortModeSelector(true)}
            onScrollToTop={() => monthScrollRef.current?.scrollTo({ y: 0, animated: true })}
          />
        )}
      </View>
    );
  };

  // Render Year View
  const renderYearView = () => {
    const decadeStart = viewingDecade;
    const decadeEnd = viewingDecade + 9;
    const years = Array.from({ length: 10 }, (_, i) => decadeStart + i);
    // Show sticky header when the entry list header box reaches the top of the scroll view
    const showStickyHeader = selectedYear !== null && yearScrollY > yearHeaderStartY;

    return (
      <View style={styles.content}>
        <ScrollView
          ref={yearScrollRef}
          onScroll={(e) => setYearScrollY(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Year Grid */}
          <View style={styles.calendarContainer}>
            <View style={styles.yearViewHeader}>
              <TouchableOpacity onPress={() => { setViewingDecade(viewingDecade - 10); setSelectedYear(null); }} style={styles.navButton}>
                <Text style={styles.navButtonText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.decadeTitle}>{decadeStart}-{decadeEnd}</Text>
              <TouchableOpacity onPress={() => { setViewingDecade(viewingDecade + 10); setSelectedYear(null); }} style={styles.navButton}>
                <Text style={styles.navButtonText}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.yearsGrid}>
              {years.map(year => {
                const count = yearCounts[year] || 0;
                const isSelected = year === selectedYear;

                return (
                  <TouchableOpacity
                    key={year}
                    style={[styles.yearCell, isSelected && styles.yearCellSelected]}
                    onPress={() => {
                      if (isSelected) {
                        setMonthViewYear(year);
                        setSelectedMonth(null);
                        setZoomLevel("month");
                      } else {
                        setSelectedYear(year);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.yearCellText, isSelected && styles.yearCellTextSelected]}>
                      {year}
                    </Text>
                    {count > 0 && (
                      <View style={[styles.countBadge, isSelected && styles.countBadgeSelected]}>
                        <Text style={[styles.countText, isSelected && styles.countTextSelected]}>
                          {count}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Entry section - only show when year is selected */}
          {selectedYear !== null && (
            <>
              {/* Entry List Header */}
              <EntryListHeader
                title={String(selectedYear)}
                entryCount={sortedEntriesForYear.length}
                displayModeLabel={displayModeLabel}
                sortModeLabel={sortModeLabel}
                onDisplayModePress={() => setShowDisplayModeSelector(true)}
                onSortModePress={() => setShowSortModeSelector(true)}
                onLayout={(e) => setYearHeaderStartY(e.nativeEvent.layout.y)}
              />

              {/* Entries */}
              <EntryListContent
                entries={sortedEntriesForYear}
                sections={entrySectionsForYear}
                emptyMessage="No entries for this year"
                displayMode={displayMode}
                streamMap={streamMap}
                onEntryPress={handleEntryPress}
                onTagPress={handleTagPress}
                onMentionPress={handleMentionPress}
              />
            </>
          )}
        </ScrollView>

        {/* Sticky Header - shown when original header scrolls out of view */}
        {showStickyHeader && (
          <StickyEntryListHeader
            title={String(selectedYear)}
            entryCount={sortedEntriesForYear.length}
            displayModeLabel={displayModeLabel}
            sortModeLabel={sortModeLabel}
            onDisplayModePress={() => setShowDisplayModeSelector(true)}
            onSortModePress={() => setShowSortModeSelector(true)}
            onScrollToTop={() => yearScrollRef.current?.scrollTo({ y: 0, animated: true })}
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TopBar
        menuItems={menuItems}
        userEmail={userEmail}
        onProfilePress={onProfilePress}
      >
        {/* Custom title with date field dropdown */}
        <View style={styles.titleRow}>
          <Text style={styles.titleText}>Calendar</Text>
          <TouchableOpacity
            style={styles.dateFieldSelector}
            onPress={() => setShowDateFieldSelector(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.dateFieldText}>{dateFieldLabel}</Text>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        </View>
      </TopBar>

      {/* Date Field Selector Modal */}
      <Modal
        visible={showDateFieldSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateFieldSelector(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDateFieldSelector(false)}
        >
          <View style={styles.dateFieldModal}>
            <View style={styles.dateFieldModalHeader}>
              <Text style={styles.dateFieldModalTitle}>Show Entries By</Text>
            </View>
            {CALENDAR_DATE_FIELDS.map((field) => {
              const isSelected = field.value === dateField;
              return (
                <TouchableOpacity
                  key={field.value}
                  style={[styles.dateFieldOption, isSelected && styles.dateFieldOptionSelected]}
                  onPress={() => {
                    setDateField(field.value);
                    setShowDateFieldSelector(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dateFieldOptionText, isSelected && styles.dateFieldOptionTextSelected]}>
                    {field.label}
                  </Text>
                  {isSelected && (
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M5 13l4 4L19 7"
                        stroke={theme.colors.text.primary}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Display Mode Selector Modal */}
      <DisplayModeSelector
        visible={showDisplayModeSelector}
        selectedMode={displayMode}
        onSelect={(mode) => {
          setDisplayMode(mode);
          setShowDisplayModeSelector(false);
        }}
        onClose={() => setShowDisplayModeSelector(false)}
      />

      {/* Sort Mode Selector Modal */}
      <SortModeSelector
        visible={showSortModeSelector}
        selectedMode={sortMode}
        sortOrder={orderMode}
        showPinnedFirst={showPinnedFirst}
        onSelect={(mode) => {
          setSortMode(mode);
        }}
        onSortOrderChange={(order) => {
          setOrderMode(order);
        }}
        onShowPinnedFirstChange={(value) => {
          setShowPinnedFirst(value);
        }}
        onClose={() => setShowSortModeSelector(false)}
      />

      {/* Zoom Level Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, zoomLevel === "day" && styles.tabActive]}
          onPress={() => setZoomLevel("day")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, zoomLevel === "day" && styles.tabTextActive]}>Day</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, zoomLevel === "month" && styles.tabActive]}
          onPress={() => setZoomLevel("month")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, zoomLevel === "month" && styles.tabTextActive]}>Month</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, zoomLevel === "year" && styles.tabActive]}
          onPress={() => setZoomLevel("year")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, zoomLevel === "year" && styles.tabTextActive]}>Year</Text>
        </TouchableOpacity>
      </View>

      {/* Views */}
      {zoomLevel === "day" && renderDayView()}
      {zoomLevel === "month" && renderMonthView()}
      {zoomLevel === "year" && renderYearView()}

      <FloatingActionButton onPress={handleAddEntry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  // Calendar container
  calendarContainer: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    textAlign: "center",
  },
  navButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  navButtonText: {
    fontSize: 28,
    color: "#374151",
    fontWeight: "600",
  },
  todayButton: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "#2563eb",
    borderRadius: 6,
    marginBottom: 16,
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: "600",
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
    fontWeight: "600",
    color: "#6b7280",
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
  dayCellToday: {
    backgroundColor: "#dbeafe",
  },
  dayCellSelected: {
    backgroundColor: "#2563eb",
  },
  dayText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  dayTextOtherMonth: {
    color: "#d1d5db",
  },
  dayTextToday: {
    color: "#2563eb",
    fontWeight: "600",
  },
  dayTextSelected: {
    color: "#ffffff",
    fontWeight: "600",
  },
  countBadge: {
    position: "absolute",
    bottom: 2,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  countBadgeSelected: {
    backgroundColor: "#ffffff",
  },
  countText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#ffffff",
  },
  countTextSelected: {
    color: "#2563eb",
  },
  // Tab styles
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#3b82f6",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  tabTextActive: {
    color: "#3b82f6",
    fontWeight: "600",
  },
  // Month view styles
  monthViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  yearTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
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
  monthCellSelected: {
    backgroundColor: "#2563eb",
  },
  monthCellText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  monthCellTextSelected: {
    color: "#ffffff",
  },
  // Year view styles
  yearViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  decadeTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
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
  yearCellSelected: {
    backgroundColor: "#2563eb",
  },
  yearCellText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  yearCellTextSelected: {
    color: "#ffffff",
  },
  // Title row styles
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 32,
  },
  titleText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },
  dateFieldSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateFieldText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6b7280",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dateFieldModal: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    width: "100%",
    maxWidth: 320,
    paddingBottom: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  dateFieldModalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  dateFieldModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  dateFieldOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  dateFieldOptionSelected: {
    backgroundColor: "#f3f4f6",
  },
  dateFieldOptionText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
  },
  dateFieldOptionTextSelected: {
    fontWeight: "600",
  },
});
