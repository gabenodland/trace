import { useState, useMemo, useEffect, useRef, useCallback, memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, PanResponder, Dimensions } from "react-native";
import { Icon } from "../shared/components/Icon";
import type { Entry, EntryDisplayMode, EntrySortMode, EntrySortOrder, EntrySection } from "@trace/core";
import {
  ENTRY_DISPLAY_MODES,
  DEFAULT_DISPLAY_MODE,
  ENTRY_SORT_MODES,
  DEFAULT_SORT_MODE,
  DEFAULT_SORT_ORDER,
  sortEntries,
  groupEntriesByStatus,
  groupEntriesByType,
  groupEntriesByStream,
  groupEntriesByPriority,
  groupEntriesByRating,
  groupEntriesByDueDate,
} from "@trace/core";
import { useEntries } from "../modules/entries/mobileEntryHooks";
import { parseStreamIdToFilter } from "../modules/entries/mobileEntryApi";
import { useStreams } from "../modules/streams/mobileStreamHooks";
import { useNavigate } from "../shared/navigation";
import { useDrawer, type ViewMode } from "../shared/contexts/DrawerContext";
import { useAuth } from "../shared/contexts/AuthContext";
import { useMobileProfile } from "../shared/hooks/useMobileProfile";
import { usePersistedState } from "../shared/hooks/usePersistedState";
import { TopBar } from "../components/layout/TopBar";
import { EntryListContent } from "../modules/entries/components/EntryListContent";
import { EntryListHeader, StickyEntryListHeader } from "../modules/entries/components/EntryListHeader";
import { BottomNavBar } from "../components/layout/BottomNavBar";
import { DisplayModeSelector } from "../modules/entries/components/DisplayModeSelector";
import { SortModeSelector } from "../modules/entries/components/SortModeSelector";
import { useTheme } from "../shared/contexts/ThemeContext";

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

type ZoomLevel = "day" | "month" | "year";

export const CalendarScreen = memo(function CalendarScreen() {
  console.log('[CalendarScreen] 🔄 RENDER');
  const theme = useTheme();
  const navigate = useNavigate();
  const {
    registerStreamHandler,
    selectedStreamId,
    selectedStreamName,
    setSelectedStreamId,
    setSelectedStreamName,
    openDrawer,
    calendarDate,
    setCalendarDate,
    calendarZoom,
    setCalendarZoom,
    drawerControl,
    viewMode,
    setViewMode,
  } = useDrawer();
  const { user } = useAuth();
  const { profile } = useMobileProfile(user?.id);

  // Avatar data for TopBar
  const displayName = profile?.name || (profile?.username ? `@${profile.username}` : null) || user?.email || null;
  const avatarUrl = profile?.avatar_url || null;

  // Screen width for swipe threshold calculation (1/3 of screen)
  const screenWidth = Dimensions.get("window").width;
  const SWIPE_THRESHOLD = screenWidth / 3;

  // Ref to hold current drawerControl - needed because PanResponder callbacks
  // capture values at creation time, so we need a ref to access current value
  const drawerControlRef = useRef(drawerControl);
  useEffect(() => {
    drawerControlRef.current = drawerControl;
  }, [drawerControl]);

  // Swipe-right gesture for opening drawer - uses capture phase to intercept before ScrollView
  const drawerPanResponder = useRef(
    PanResponder.create({
      // Don't capture initial touch - allows taps and scroll to start
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      // Capture horizontal right swipes before ScrollView gets them
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        // Only capture if clearly horizontal and moving right
        const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        const isSwipingRight = gestureState.dx > 20;
        // Don't capture from the very left edge (Android back gesture zone)
        const notInBackZone = evt.nativeEvent.pageX > 25;
        return isHorizontalSwipe && isSwipingRight && notInBackZone;
      },
      onMoveShouldSetPanResponder: () => false,
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, gestureState) => {
        const control = drawerControlRef.current;
        if (control && gestureState.dx > 0) {
          control.setPosition(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const control = drawerControlRef.current;
        if (!control) return;
        const shouldOpen = gestureState.dx > SWIPE_THRESHOLD || gestureState.vx > 0.5;
        if (shouldOpen) {
          control.animateOpen();
        } else {
          control.animateClose();
        }
      },
      onPanResponderTerminate: () => {
        const control = drawerControlRef.current;
        if (control) {
          control.animateClose();
        }
      },
    })
  ).current;

  // Use DrawerContext for state (persisted across navigations)
  const zoomLevel = calendarZoom as ZoomLevel;
  const selectedDate = calendarDate;

  // Wrap setters to update context
  const setZoomLevel = (level: ZoomLevel) => setCalendarZoom(level);
  const setSelectedDate = (date: string) => setCalendarDate(date);

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

  // Sync viewing month/year with selected date from context
  useEffect(() => {
    if (selectedDate) {
      const date = new Date(selectedDate);
      setViewingMonth(date.getMonth());
      setViewingYear(date.getFullYear());
      setMonthViewYear(date.getFullYear());
    }
  }, []); // Only on mount - subsequent changes happen via user interaction

  // Register stream handler for drawer selection
  useEffect(() => {
    registerStreamHandler((streamId, streamName) => {
      setSelectedStreamId(streamId);
      setSelectedStreamName(streamName);
    });
  }, [registerStreamHandler, setSelectedStreamId, setSelectedStreamName]);

  // Parse selection into filter using shared helper
  const entryFilter = useMemo(() => parseStreamIdToFilter(selectedStreamId), [selectedStreamId]);

  // Title for TopBar
  const title = selectedStreamName;

  // Data hooks
  const { entries } = useEntries(entryFilter);
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

  // Stream map (for names)
  const streamMap = useMemo(() => {
    return streams?.reduce((map, stream) => {
      map[stream.stream_id] = stream.name;
      return map;
    }, {} as Record<string, string>) || {};
  }, [streams]);

  // Stream by ID map (for attribute visibility)
  const streamById = useMemo(() => {
    return streams?.reduce((map, stream) => {
      map[stream.stream_id] = stream;
      return map;
    }, {} as Record<string, typeof streams[0]>) || {};
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
      return groupEntriesByRating(filteredEntries, orderMode, showPinnedFirst, streamById);
    }
    if (sortMode === 'due_date') {
      return groupEntriesByDueDate(filteredEntries, orderMode, showPinnedFirst);
    }
    return undefined;
  }, [filteredEntries, sortMode, streamMap, streamById, orderMode, showPinnedFirst]);

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
      return groupEntriesByRating(filteredEntriesForMonth, orderMode, showPinnedFirst, streamById);
    }
    if (sortMode === 'due_date') {
      return groupEntriesByDueDate(filteredEntriesForMonth, orderMode, showPinnedFirst);
    }
    return undefined;
  }, [filteredEntriesForMonth, sortMode, streamMap, streamById, orderMode, showPinnedFirst]);

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
      return groupEntriesByRating(filteredEntriesForYear, orderMode, showPinnedFirst, streamById);
    }
    if (sortMode === 'due_date') {
      return groupEntriesByDueDate(filteredEntriesForYear, orderMode, showPinnedFirst);
    }
    return undefined;
  }, [filteredEntriesForYear, sortMode, streamMap, streamById, orderMode, showPinnedFirst]);

  // Navigation handlers
  const handleEntryPress = (entryId: string) => {
    // EntryScreen fetches entry data itself (usually from React Query cache)
    navigate("capture", { entryId });
  };

  const handleTagPress = (tag: string) => {
    // Update stream selection in DrawerContext and switch to list view
    setSelectedStreamId(`tag:${tag}`);
    setSelectedStreamName(`#${tag}`);
    navigate("inbox");
  };

  const handleMentionPress = (mention: string) => {
    // Update stream selection in DrawerContext and switch to list view
    setSelectedStreamId(`mention:${mention}`);
    setSelectedStreamName(`@${mention}`);
    navigate("inbox");
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
    navigate("capture", { initialDate: dateToUse });
  };

  // Handle view mode changes from bottom nav bar
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "list") {
      navigate("inbox");
    } else if (mode === "map") {
      navigate("map");
    }
    // "calendar" mode - already here, no navigation needed
  }, [setViewMode, navigate]);

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
          isSelected && { backgroundColor: theme.colors.functional.accent },
          isToday && !isSelected && { backgroundColor: theme.colors.functional.accentLight },
        ]}
        onPress={() => setSelectedDate(dateKey)}
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
          <View style={[styles.countBadge, { backgroundColor: theme.colors.functional.accent }, isSelected && { backgroundColor: "#ffffff" }]}>
            <Text style={[styles.countText, isSelected && { color: theme.colors.functional.accent }]}>
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
          <View style={[styles.calendarContainer, { backgroundColor: theme.colors.background.primary }]}>
            <View style={styles.monthHeader}>
              <TouchableOpacity onPress={handlePrevMonth} style={[styles.navButton, { backgroundColor: theme.colors.background.tertiary }]}>
                <Text style={[styles.navButtonText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>‹</Text>
              </TouchableOpacity>
              <Text style={[styles.monthTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]}>{monthName}</Text>
              <TouchableOpacity onPress={handleNextMonth} style={[styles.navButton, { backgroundColor: theme.colors.background.tertiary }]}>
                <Text style={[styles.navButtonText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>›</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleToday} style={[styles.todayButton, { backgroundColor: theme.colors.functional.accent }]}>
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
            streamById={streamById}
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
          <View style={[styles.calendarContainer, { backgroundColor: theme.colors.background.primary }]}>
            <View style={styles.monthViewHeader}>
              <TouchableOpacity onPress={() => { setMonthViewYear(monthViewYear - 1); setSelectedMonth(null); }} style={[styles.navButton, { backgroundColor: theme.colors.background.tertiary }]}>
                <Text style={[styles.navButtonText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>‹</Text>
              </TouchableOpacity>
              <Text style={[styles.yearTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]}>{monthViewYear}</Text>
              <TouchableOpacity onPress={() => { setMonthViewYear(monthViewYear + 1); setSelectedMonth(null); }} style={[styles.navButton, { backgroundColor: theme.colors.background.tertiary }]}>
                <Text style={[styles.navButtonText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>›</Text>
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
                    style={[styles.monthCell, isSelected && { backgroundColor: theme.colors.functional.accent }]}
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
                    <Text style={[styles.monthCellText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }, isSelected && { color: "#ffffff" }]}>
                      {name.substring(0, 3)}
                    </Text>
                    {count > 0 && (
                      <View style={[styles.countBadge, { backgroundColor: theme.colors.functional.accent }, isSelected && { backgroundColor: "#ffffff" }]}>
                        <Text style={[styles.countText, isSelected && { color: theme.colors.functional.accent }]}>
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
                streamById={streamById}
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
          <View style={[styles.calendarContainer, { backgroundColor: theme.colors.background.primary }]}>
            <View style={styles.yearViewHeader}>
              <TouchableOpacity onPress={() => { setViewingDecade(viewingDecade - 10); setSelectedYear(null); }} style={[styles.navButton, { backgroundColor: theme.colors.background.tertiary }]}>
                <Text style={[styles.navButtonText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>‹</Text>
              </TouchableOpacity>
              <Text style={[styles.decadeTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]}>{decadeStart}-{decadeEnd}</Text>
              <TouchableOpacity onPress={() => { setViewingDecade(viewingDecade + 10); setSelectedYear(null); }} style={[styles.navButton, { backgroundColor: theme.colors.background.tertiary }]}>
                <Text style={[styles.navButtonText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>›</Text>
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
                        setMonthViewYear(year);
                        setSelectedMonth(null);
                        setZoomLevel("month");
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
                      <View style={[styles.countBadge, { backgroundColor: theme.colors.functional.accent }, isSelected && { backgroundColor: "#ffffff" }]}>
                        <Text style={[styles.countText, isSelected && { color: theme.colors.functional.accent }]}>
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
                streamById={streamById}
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
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]} {...drawerPanResponder.panHandlers}>
      <TopBar
        title={title}
        badge={entries.length}
        onTitlePress={openDrawer}
        showDropdownArrow
      />

      {/* SubBar with date field selector */}
      <View style={[styles.subBar, { backgroundColor: theme.colors.background.primary, borderBottomColor: theme.colors.border.light }]}>
        <TouchableOpacity
          style={styles.dateFieldSelector}
          onPress={() => setShowDateFieldSelector(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.dateFieldLabel, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>Show by:</Text>
          <Text style={[styles.dateFieldText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>{dateFieldLabel}</Text>
          <Icon name="ChevronDown" size={16} color={theme.colors.text.tertiary} />
        </TouchableOpacity>
      </View>

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
          <View style={[styles.dateFieldModal, { backgroundColor: theme.colors.background.primary }]}>
            <View style={[styles.dateFieldModalHeader, { borderBottomColor: theme.colors.border.light }]}>
              <Text style={[styles.dateFieldModalTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>Show Entries By</Text>
            </View>
            {CALENDAR_DATE_FIELDS.map((field) => {
              const isSelected = field.value === dateField;
              return (
                <TouchableOpacity
                  key={field.value}
                  style={[
                    styles.dateFieldOption,
                    { borderBottomColor: theme.colors.border.light },
                    isSelected && { backgroundColor: theme.colors.background.tertiary },
                  ]}
                  onPress={() => {
                    setDateField(field.value);
                    setShowDateFieldSelector(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.dateFieldOptionText,
                    { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium },
                    isSelected && { fontFamily: theme.typography.fontFamily.semibold },
                  ]}>
                    {field.label}
                  </Text>
                  {isSelected && (
                    <Icon name="Check" size={20} color={theme.colors.functional.accent} />
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
      <View style={[styles.tabContainer, { backgroundColor: theme.colors.background.primary, borderBottomColor: theme.colors.border.light }]}>
        <TouchableOpacity
          style={[styles.tab, zoomLevel === "day" && { borderBottomColor: theme.colors.functional.accent }]}
          onPress={() => setZoomLevel("day")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }, zoomLevel === "day" && { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.semibold }]}>Day</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, zoomLevel === "month" && { borderBottomColor: theme.colors.functional.accent }]}
          onPress={() => setZoomLevel("month")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }, zoomLevel === "month" && { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.semibold }]}>Month</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, zoomLevel === "year" && { borderBottomColor: theme.colors.functional.accent }]}
          onPress={() => setZoomLevel("year")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }, zoomLevel === "year" && { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.semibold }]}>Year</Text>
        </TouchableOpacity>
      </View>

      {/* Views */}
      {zoomLevel === "day" && renderDayView()}
      {zoomLevel === "month" && renderMonthView()}
      {zoomLevel === "year" && renderYearView()}

      <BottomNavBar
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onAddPress={handleAddEntry}
        onAccountPress={() => navigate("account")}
        avatarUrl={avatarUrl}
        displayName={displayName}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    // Note: fontWeight removed - use fontFamily with weight variant instead
    flex: 1,
    textAlign: "center",
  },
  navButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  navButtonText: {
    fontSize: 28,
    // Note: fontWeight removed - use fontFamily with weight variant instead
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
    // Note: fontWeight removed - use fontFamily with weight variant instead
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
    // Note: fontWeight removed - use fontFamily with weight variant instead
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
    // Note: fontWeight removed - use fontFamily with weight variant instead
  },
  countBadge: {
    position: "absolute",
    bottom: 2,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  countText: {
    fontSize: 10,
    // Note: fontWeight removed - use fontFamily with weight variant instead
    color: "#ffffff",
  },
  // Tab styles
  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 14,
    // Note: fontWeight removed - use fontFamily with weight variant instead
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
    // Note: fontWeight removed - use fontFamily with weight variant instead
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
    // Note: fontWeight removed - use fontFamily with weight variant instead
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
    // Note: fontWeight removed - use fontFamily with weight variant instead
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
    // Note: fontWeight removed - use fontFamily with weight variant instead
  },
  // SubBar styles
  subBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  dateFieldSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateFieldLabel: {
    fontSize: 14,
    // Note: fontWeight removed - use fontFamily with weight variant instead
  },
  dateFieldText: {
    fontSize: 14,
    // Note: fontWeight removed - use fontFamily with weight variant instead
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
  },
  dateFieldModalTitle: {
    fontSize: 18,
    // Note: fontWeight removed - use fontFamily with weight variant instead
  },
  dateFieldOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  dateFieldOptionText: {
    fontSize: 16,
    // Note: fontWeight removed - use fontFamily with weight variant instead
  },
  // Note: dateFieldOptionTextSelected removed - font weight now applied via inline fontFamily
});
