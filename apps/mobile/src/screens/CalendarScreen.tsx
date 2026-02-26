import { useState, useMemo, useEffect, useCallback, memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Switch } from "react-native";
import { Icon } from "../shared/components/Icon";
import type { EntryDisplayMode, EntrySortMode, EntrySortOrder } from "@trace/core";
import {
  ENTRY_DISPLAY_MODES,
  DEFAULT_DISPLAY_MODE,
  ENTRY_SORT_MODES,
  DEFAULT_SORT_MODE,
  DEFAULT_SORT_ORDER,
} from "@trace/core";
import { useEntries } from "../modules/entries/mobileEntryHooks";
import { parseStreamIdToFilter } from "../modules/entries/mobileEntryApi";
import { useStreams } from "../modules/streams/mobileStreamHooks";
import { useNavigate } from "../shared/navigation";
import { useDrawer, type ViewMode } from "../shared/contexts/DrawerContext";
import { useCalendarState } from "../shared/contexts/CalendarStateContext";
import { useAuth } from "../shared/contexts/AuthContext";
import { useMobileProfile } from "../shared/hooks/useMobileProfile";
import { usePersistedState } from "../shared/hooks/usePersistedState";
import { TopBar } from "../components/layout/TopBar";
import { BottomNavBar } from "../components/layout/BottomNavBar";
import { DisplayModeSelector } from "../modules/entries/components/DisplayModeSelector";
import { SortModeSelector } from "../modules/entries/components/SortModeSelector";
import { StreamPicker } from "../modules/streams/components/StreamPicker";
import { useEntryActions } from "./hooks/useEntryActions";
import { useDrawerGestures } from "./hooks/useDrawerGestures";
import { HtmlRenderProvider } from "../modules/entries/components/HtmlRenderProvider";
import { Snackbar, useSnackbar } from "../shared/components";
import { useTheme } from "../shared/contexts/ThemeContext";
import { DayView } from "./calendar/DayView";
import { MonthView } from "./calendar/MonthView";
import { YearView } from "./calendar/YearView";
import { formatDateKey, getEntryDate, CALENDAR_DATE_FIELDS, type CalendarDateField } from "./calendar/calendarHelpers";
import type { CalendarZoom } from "../shared/contexts/CalendarStateContext";

export const CalendarScreen = memo(function CalendarScreen() {
  const { message: snackbarMessage, opacity: snackbarOpacity, showSnackbar } = useSnackbar();
  const theme = useTheme();
  const navigate = useNavigate();
  const {
    registerStreamHandler,
    selectedStreamId,
    selectedStreamName,
    setSelectedStreamId,
    setSelectedStreamName,
    openDrawer,
    drawerControl,
    viewMode,
    setViewMode,
  } = useDrawer();
  const {
    calendarDate,
    setCalendarDate,
    calendarZoom,
    setCalendarZoom,
  } = useCalendarState();
  const { user } = useAuth();
  const { profile } = useMobileProfile(user?.id);

  // Avatar data for TopBar
  const displayName = profile?.name || (profile?.username ? `@${profile.username}` : null) || user?.email || null;
  const avatarUrl = profile?.avatar_url || null;

  // Shared drawer swipe gesture (bubble phase — lets child ScrollViews scroll first)
  const { panHandlers: drawerPanHandlers } = useDrawerGestures({ drawerControl });

  // Context-backed state
  const zoomLevel = calendarZoom;
  const selectedDate = calendarDate;
  const setSelectedDate = (date: string) => setCalendarDate(date);

  // Date field selector state (persisted)
  const [dateField, setDateField] = usePersistedState<CalendarDateField>('@calendarDateField', 'entry_date');
  const [showDateFieldSelector, setShowDateFieldSelector] = useState(false);
  const dateFieldLabel = CALENDAR_DATE_FIELDS.find(f => f.value === dateField)?.label || 'Entry Date';

  // State for day view navigation (viewing month/year)
  const [viewingMonth, setViewingMonth] = useState(() => new Date().getMonth());
  const [viewingYear, setViewingYear] = useState(() => new Date().getFullYear());
  // Year passed from year view drill-down → month view
  const [monthViewInitialYear, setMonthViewInitialYear] = useState<number | undefined>(undefined);

  // Display and sort mode state (persisted)
  const [displayMode, setDisplayMode] = usePersistedState<EntryDisplayMode>('@calendarDisplayMode', DEFAULT_DISPLAY_MODE);
  const [sortMode, setSortMode] = usePersistedState<EntrySortMode>('@calendarSortMode', DEFAULT_SORT_MODE);
  const [orderMode, setOrderMode] = usePersistedState<EntrySortOrder>('@calendarOrderMode', DEFAULT_SORT_ORDER);
  const [showPinnedFirst, setShowPinnedFirst] = usePersistedState<boolean>('@calendarShowPinnedFirst', false);
  const [showDisplayModeSelector, setShowDisplayModeSelector] = useState(false);
  const [showSortModeSelector, setShowSortModeSelector] = useState(false);

  const displayModeLabel = ENTRY_DISPLAY_MODES.find(m => m.value === displayMode)?.label || 'Cards';
  const sortModeLabel = ENTRY_SORT_MODES.find(m => m.value === sortMode)?.label || 'Date';

  // Sync viewing month/year with selected date from context on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: sync from persisted context only on mount
  useEffect(() => {
    if (selectedDate) {
      const date = new Date(selectedDate);
      setViewingMonth(date.getMonth());
      setViewingYear(date.getFullYear());
    }
  }, []);

  // Register stream handler for drawer selection
  useEffect(() => {
    registerStreamHandler((streamId, streamName) => {
      setSelectedStreamId(streamId);
      setSelectedStreamName(streamName);
    });
  }, [registerStreamHandler, setSelectedStreamId, setSelectedStreamName]);

  // Title icon for TopBar
  const titleIcon = useMemo(() => {
    if (typeof selectedStreamId === 'string' &&
        (selectedStreamId.startsWith("location:") || selectedStreamId.startsWith("geo:"))) {
      return <Icon name="MapPin" size={20} color={theme.colors.text.primary} />;
    }
    return null;
  }, [selectedStreamId, theme.colors.text.primary]);

  // Parse selection into filter
  const entryFilter = useMemo(() => parseStreamIdToFilter(selectedStreamId), [selectedStreamId]);

  // Data hooks
  const { entries: allEntries, entryMutations } = useEntries(entryFilter);
  const { streams } = useStreams();

  // Show archived toggle
  const [showArchived, setShowArchived] = usePersistedState<boolean>('calendar-show-archived', false);

  // Filter archived entries unless toggle is on
  const entries = useMemo(() => {
    if (showArchived) return allEntries;
    return allEntries.filter(e => !e.is_archived);
  }, [allEntries, showArchived]);

  // Precompute entry counts for all views in a single pass.
  // Views mount instantly because counts are already computed — no per-entry iteration on tab switch.
  const { dayCounts, monthCounts, yearCounts } = useMemo(() => {
    const day: Record<string, number> = {};
    const month: Record<string, number> = {};
    const year: Record<number, number> = {};
    for (const entry of entries) {
      const date = getEntryDate(entry, dateField);
      if (!date) continue;
      const dateKey = formatDateKey(date);
      day[dateKey] = (day[dateKey] || 0) + 1;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      month[monthKey] = (month[monthKey] || 0) + 1;
      const y = date.getFullYear();
      year[y] = (year[y] || 0) + 1;
    }
    return { dayCounts: day, monthCounts: month, yearCounts: year };
  }, [entries, dateField]);

  // Entry action handlers
  const {
    showMoveStreamPicker,
    entryToMoveStreamId,
    handleEntryPress,
    handleMoveEntry,
    handleMoveStreamSelect,
    handleCloseMoveStreamPicker,
    handleDeleteEntry,
    handlePinEntry,
    handleArchiveEntry,
    handleCopyEntry,
  } = useEntryActions({ entryMutations, navigate, entries, showSnackbar });

  // Stream maps
  const streamMap = useMemo(() => {
    return streams?.reduce((map, stream) => {
      map[stream.stream_id] = stream.name;
      return map;
    }, {} as Record<string, string>) || {};
  }, [streams]);

  const streamById = useMemo(() => {
    return streams?.reduce((map, stream) => {
      map[stream.stream_id] = stream;
      return map;
    }, {} as Record<string, typeof streams[0]>) || {};
  }, [streams]);

  // Navigation handlers
  const handleTagPress = useCallback((tag: string) => {
    setSelectedStreamId(`tag:${tag}`);
    setSelectedStreamName(`#${tag}`);
    navigate("inbox");
  }, [setSelectedStreamId, setSelectedStreamName, navigate]);

  const handleMentionPress = useCallback((mention: string) => {
    setSelectedStreamId(`mention:${mention}`);
    setSelectedStreamName(`@${mention}`);
    navigate("inbox");
  }, [setSelectedStreamId, setSelectedStreamName, navigate]);

  const handleAddEntry = useCallback(() => {
    // In day view, use the selected date. In month/year, use today (no sub-selection context).
    navigate("capture", { initialDate: zoomLevel === "day" ? selectedDate : formatDateKey(new Date()) });
  }, [navigate, selectedDate, zoomLevel]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "list") {
      navigate("inbox");
    } else if (mode === "map") {
      navigate("map");
    }
  }, [setViewMode, navigate]);

  // Day view navigation
  const handlePrevMonth = useCallback(() => {
    setViewingMonth(prev => {
      if (prev === 0) {
        setViewingYear(y => y - 1);
        return 11;
      }
      return prev - 1;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewingMonth(prev => {
      if (prev === 11) {
        setViewingYear(y => y + 1);
        return 0;
      }
      return prev + 1;
    });
  }, []);

  const handleToday = useCallback(() => {
    const today = new Date();
    setViewingMonth(today.getMonth());
    setViewingYear(today.getFullYear());
    setSelectedDate(formatDateKey(today));
  }, [setSelectedDate]);

  // Drill-down handlers
  const handleMonthDrillDown = useCallback((month: number, year: number) => {
    setViewingMonth(month);
    setViewingYear(year);
    setCalendarZoom("day");
  }, [setCalendarZoom]);

  const handleYearDrillDown = useCallback((year: number) => {
    setMonthViewInitialYear(year);
    setCalendarZoom("month");
  }, [setCalendarZoom]);

  const handleDisplayModePress = useCallback(() => setShowDisplayModeSelector(true), []);
  const handleSortModePress = useCallback(() => setShowSortModeSelector(true), []);

  // Shared props for all views
  const entryActionProps = {
    onEntryPress: handleEntryPress,
    onTagPress: handleTagPress,
    onMentionPress: handleMentionPress,
    onMoveEntry: handleMoveEntry,
    onCopyEntry: handleCopyEntry,
    onDeleteEntry: handleDeleteEntry,
    onPinEntry: handlePinEntry,
    onArchiveEntry: handleArchiveEntry,
  };

  const displayProps = {
    displayMode,
    displayModeLabel,
    sortMode,
    sortModeLabel,
    orderMode,
    showPinnedFirst,
    streamMap,
    streamById,
    onDisplayModePress: handleDisplayModePress,
    onSortModePress: handleSortModePress,
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]} {...drawerPanHandlers}>
      <TopBar
        title={selectedStreamName}
        titleIcon={titleIcon}
        badge={entries.length}
        onMenuPress={openDrawer}
        onTitlePress={openDrawer}
      />

      {/* SubBar with date field selector and archived toggle */}
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
        <View style={styles.archivedToggle}>
          <Text style={[styles.archivedToggleLabel, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>Archived</Text>
          <Switch
            value={showArchived}
            onValueChange={setShowArchived}
            trackColor={{ false: theme.colors.border.dark, true: theme.colors.functional.accent }}
            thumbColor="#fff"
            style={styles.archivedSwitch}
          />
        </View>
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
        onSelect={(mode) => setSortMode(mode)}
        onSortOrderChange={(order) => setOrderMode(order)}
        onShowPinnedFirstChange={(value) => setShowPinnedFirst(value)}
        onClose={() => setShowSortModeSelector(false)}
      />

      {/* Move Stream Picker */}
      <StreamPicker
        visible={showMoveStreamPicker}
        onClose={handleCloseMoveStreamPicker}
        onSelect={handleMoveStreamSelect}
        selectedStreamId={entryToMoveStreamId}
      />

      {/* Zoom Level Tabs */}
      <View style={[styles.tabContainer, { backgroundColor: theme.colors.background.primary, borderBottomColor: theme.colors.border.light }]}>
        {(["day", "month", "year"] as const).map((level) => (
          <TouchableOpacity
            key={level}
            style={[styles.tab, zoomLevel === level && { borderBottomColor: theme.colors.functional.accent }]}
            onPress={() => setCalendarZoom(level)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.tabText,
              { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium },
              zoomLevel === level && { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.semibold },
            ]}>
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Views — conditional rendering, but counts are precomputed for instant mount */}
      <HtmlRenderProvider>
        {zoomLevel === "day" && (
          <DayView
            entries={entries}
            selectedDate={selectedDate}
            dateField={dateField}
            viewingMonth={viewingMonth}
            viewingYear={viewingYear}
            entryCounts={dayCounts}
            onSelectDate={setSelectedDate}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onToday={handleToday}
            {...displayProps}
            {...entryActionProps}
          />
        )}
        {zoomLevel === "month" && (
          <MonthView
            entries={entries}
            dateField={dateField}
            monthCounts={monthCounts}
            initialYear={monthViewInitialYear}
            onDrillDown={handleMonthDrillDown}
            {...displayProps}
            {...entryActionProps}
          />
        )}
        {zoomLevel === "year" && (
          <YearView
            entries={entries}
            dateField={dateField}
            yearCounts={yearCounts}
            onDrillDown={handleYearDrillDown}
            {...displayProps}
            {...entryActionProps}
          />
        )}
      </HtmlRenderProvider>

      <BottomNavBar
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onAddPress={handleAddEntry}
        onAccountPress={() => navigate("account")}
        avatarUrl={avatarUrl}
        displayName={displayName}
      />
      <Snackbar message={snackbarMessage} opacity={snackbarOpacity} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  subBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  },
  dateFieldText: {
    fontSize: 14,
  },
  archivedToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  archivedToggleLabel: {
    fontSize: 13,
  },
  archivedSwitch: {
    transform: [{ scale: 0.8 }],
  },
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
  },
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
  },
});
