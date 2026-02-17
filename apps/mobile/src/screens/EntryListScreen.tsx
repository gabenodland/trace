import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { View, StyleSheet, BackHandler } from "react-native";
import { ENTRY_DISPLAY_MODES, ENTRY_SORT_MODES, ALL_STATUSES, getActiveFilterInfo } from "@trace/core";
import { Icon, Snackbar, useSnackbar } from "../shared/components";
import { useEntries } from "../modules/entries/mobileEntryHooks";
import { subscribeToToast } from "../shared/services/toastService";
import { parseStreamIdToFilter } from "../modules/entries/mobileEntryApi";
import { useLocations } from "../modules/locations/mobileLocationHooks";
import { useStreams } from "../modules/streams/mobileStreamHooks";
import { useNavigate } from "../shared/navigation";
import { useDrawer, type ViewMode } from "../shared/contexts/DrawerContext";
import { useAuth } from "../shared/contexts/AuthContext";
import { useMobileProfile } from "../shared/hooks/useMobileProfile";
import { useSettings } from "../shared/contexts/SettingsContext";
import { TopBar } from "../components/layout/TopBar";
import { SubBarFilters } from "../components/layout/SubBar";
import { SearchBar } from "../components/layout/SearchBar";
import { FilterBottomSheet } from "../components/sheets";
import { DisplayModeSelector } from "../modules/entries/components/DisplayModeSelector";
import { SortModeSelector } from "../modules/entries/components/SortModeSelector";
import type { EntryDisplayMode, EntrySortMode, EntrySortOrder } from "@trace/core";
import { EntryList, type EntryListRef } from "../modules/entries/components/EntryList";
import { BottomNavBar } from "../components/layout/BottomNavBar";
import { StreamPicker } from "../modules/streams/components/StreamPicker";
import { useTheme } from "../shared/contexts/ThemeContext";
import { useDrawerGestures, useFilteredEntries, useEntryActions } from "./hooks";

interface EntryListScreenProps {
  scrollRestoreKey?: number;
}

export const EntryListScreen = memo(function EntryListScreen({ scrollRestoreKey = 0 }: EntryListScreenProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const { user, isOffline } = useAuth();
  const { streams } = useStreams();
  const { profile } = useMobileProfile(user?.id);

  // Avatar data for TopBar
  const displayName = profile?.name || (profile?.username ? `@${profile.username}` : null) || user?.email || null;
  const avatarUrl = profile?.avatar_url || null;
  const {
    registerStreamHandler,
    registerStreamLongPressHandler,
    selectedStreamId,
    selectedStreamName,
    setSelectedStreamId,
    setSelectedStreamName,
    openDrawer,
    closeDrawer,
    isOpen: isDrawerOpen,
    drawerControl,
    viewMode,
    setViewMode,
  } = useDrawer();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal visibility state for view/sort/filter
  const [showDisplayModeSelector, setShowDisplayModeSelector] = useState(false);
  const [showSortModeSelector, setShowSortModeSelector] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  // Ref for scrolling list to top after filter apply
  const entryListRef = useRef<EntryListRef>(null);

  // Restore scroll position when navigating back to this screen
  // Android's native ScrollView loses its offset when a parent Animated.View
  // transform changes (translateX for swipe-back gesture)
  useEffect(() => {
    if (scrollRestoreKey > 0) {
      entryListRef.current?.restoreScrollPosition();
    }
  }, [scrollRestoreKey]);

  // Snackbar for showing toast messages (e.g., from entry screen)
  const { message: snackbarMessage, opacity: snackbarOpacity, showSnackbar } = useSnackbar();

  // Subscribe to toast events (from other screens like EntryManagementScreen)
  useEffect(() => {
    const unsubscribe = subscribeToToast((message) => {
      showSnackbar(message);
    });
    return unsubscribe;
  }, [showSnackbar]);

  // Per-stream view preferences from settings (sort + display mode + filter)
  const { getStreamSortPreference, setStreamSortPreference, getStreamFilter, resetStreamFilter } = useSettings();

  // Get the key for the current stream's view preference
  const viewPrefKey = typeof selectedStreamId === 'string' ? selectedStreamId : null;
  const streamViewPref = getStreamSortPreference(viewPrefKey);
  const streamFilter = getStreamFilter(viewPrefKey);

  const sortMode = streamViewPref.sortMode;
  const orderMode = streamViewPref.sortOrder;
  const showPinnedFirst = streamViewPref.showPinnedFirst;
  const displayMode = streamViewPref.displayMode;

  // Drawer gesture handling
  const { panHandlers } = useDrawerGestures({
    drawerControl,
  });

  // Use hook for locations instead of direct localDB call
  const { data: locationsData } = useLocations();
  const locations = locationsData || [];

  // Register stream selection handler for drawer
  useEffect(() => {
    registerStreamHandler((streamId, streamName) => {
      setSelectedStreamId(streamId);
      setSelectedStreamName(streamName);
    });
    // Cleanup on unmount
    return () => registerStreamHandler(null);
  }, [registerStreamHandler, setSelectedStreamId, setSelectedStreamName]);

  // Handler for long-press on stream in drawer (navigate to stream settings)
  const handleStreamLongPress = useCallback((streamId: string) => {
    navigate("stream-properties", { streamId, returnTo: "inbox" });
  }, [navigate]);

  // Register long-press handler for drawer
  useEffect(() => {
    registerStreamLongPressHandler(handleStreamLongPress);
    return () => registerStreamLongPressHandler(null);
  }, [registerStreamLongPressHandler, handleStreamLongPress]);

  // Handle Android back button - close drawer if open, otherwise let app exit normally
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Close stream drawer if open
      if (isDrawerOpen) {
        closeDrawer();
        return true;
      }
      return false; // Let Android handle back normally (exit app)
    });
    return () => backHandler.remove();
  }, [isDrawerOpen, closeDrawer]);

  // Compute title and icon for TopBar based on current selection
  const { title, titleIcon } = useMemo(() => {
    // Location filter - show pin icon
    if (typeof selectedStreamId === 'string' &&
        (selectedStreamId.startsWith("location:") || selectedStreamId.startsWith("geo:"))) {
      return {
        title: selectedStreamName || "Location",
        titleIcon: (
          <Icon name="MapPin" size={22} color={theme.colors.text.primary} />
        ),
      };
    }

    // For streams, tags, mentions, all entries, unassigned - just use the name
    return {
      title: selectedStreamName,
      titleIcon: null,
    };
  }, [selectedStreamId, selectedStreamName, theme.colors.text.primary]);

  // Parse selection into filter using shared helper (for API query)
  const apiFilter = useMemo(() => parseStreamIdToFilter(selectedStreamId), [selectedStreamId]);

  const { entries, isLoading, entryMutations } = useEntries(apiFilter);

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

  // Get current stream for filter context
  const currentStream = useMemo(() => {
    if (typeof selectedStreamId === 'string' && !selectedStreamId.includes(':')) {
      return streams?.find(s => s.stream_id === selectedStreamId);
    }
    return undefined;
  }, [selectedStreamId, streams]);

  // Use extracted filtering hook
  const { sortedEntries, filteredEntries, filteredSections } = useFilteredEntries({
    entries,
    streams,
    sortMode,
    orderMode,
    showPinnedFirst,
    streamFilter,
    searchQuery,
    currentStream,
  });

  // Get display labels
  const displayModeLabel = ENTRY_DISPLAY_MODES.find(m => m.value === displayMode)?.label || 'Smashed';
  const baseSortLabel = ENTRY_SORT_MODES.find(m => m.value === sortMode)?.label || 'Entry Date';
  const sortModeLabel = orderMode === 'desc' ? `${baseSortLabel} \u2193` : `${baseSortLabel} \u2191`;


  // Check if any filters are active and count them (for filter button indicator)
  const { hasActiveFilters, activeFilterCount } = useMemo(() => {
    const filterInfo = getActiveFilterInfo(streamFilter, {
      availableStatuses: (currentStream?.entry_statuses ?? ALL_STATUSES.map(s => s.value)) as string[],
      availableTypes: currentStream?.entry_types ?? [],
      ratingType: currentStream?.entry_rating_type ?? 'decimal_whole',
    });

    return {
      hasActiveFilters: filterInfo.hasActiveFilters,
      activeFilterCount: filterInfo.activeCount,
    };
  }, [streamFilter, currentStream]);

  // Handlers for display mode and sort mode changes
  const handleDisplayModeChange = useCallback((mode: EntryDisplayMode) => {
    setStreamSortPreference(viewPrefKey, { displayMode: mode });
  }, [setStreamSortPreference, viewPrefKey]);

  const handleSortModeChange = useCallback((mode: EntrySortMode) => {
    setStreamSortPreference(viewPrefKey, { sortMode: mode });
  }, [setStreamSortPreference, viewPrefKey]);

  const handleSortOrderChange = useCallback((order: EntrySortOrder) => {
    setStreamSortPreference(viewPrefKey, { sortOrder: order });
  }, [setStreamSortPreference, viewPrefKey]);

  const handleShowPinnedFirstChange = useCallback((value: boolean) => {
    setStreamSortPreference(viewPrefKey, { showPinnedFirst: value });
  }, [setStreamSortPreference, viewPrefKey]);

  const handleAddEntry = () => {
    let initialContent = "";

    if (typeof selectedStreamId === 'string') {
      if (selectedStreamId.startsWith('tag:')) {
        const tag = selectedStreamId.substring(4);
        initialContent = `#${tag} `;
      } else if (selectedStreamId.startsWith('mention:')) {
        const mention = selectedStreamId.substring(8);
        initialContent = `@${mention} `;
      }
      // Note: location: filter no longer pre-fills location
      // GPS is auto-captured (if setting enabled), Location must be explicitly added
    }

    navigate("capture", {
      initialStreamId: selectedStreamId,
      initialStreamName: selectedStreamName,
      initialContent,
    });
  };

  const handleTagPress = (tag: string) => {
    const tagId = `tag:${tag}`;
    const tagName = `#${tag}`;
    setSelectedStreamId(tagId);
    setSelectedStreamName(tagName);
  };

  const handleMentionPress = (mention: string) => {
    const mentionId = `mention:${mention}`;
    const mentionName = `@${mention}`;
    setSelectedStreamId(mentionId);
    setSelectedStreamName(mentionName);
  };

  const handleStreamPress = (streamId: string | null, streamName: string) => {
    setSelectedStreamId(streamId);
    setSelectedStreamName(streamName);
  };

  // Handle view mode changes from bottom nav bar
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "map") {
      navigate("map");
    } else if (mode === "calendar") {
      navigate("calendar");
    }
    // "list" mode - already here, no navigation needed
  }, [setViewMode, navigate]);

  // Handle filter apply - scroll list to top
  const handleFilterApply = useCallback(() => {
    entryListRef.current?.scrollToTop();
  }, []);


  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]} {...panHandlers}>
      <TopBar
        title={title}
        titleIcon={titleIcon}
        onTitlePress={openDrawer}
        showDropdownArrow
        onSearchPress={() => setIsSearchOpen(!isSearchOpen)}
        isSearchActive={isSearchOpen}
      />

      {/* Search Bar */}
      {isSearchOpen && (
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClose={() => {
            setIsSearchOpen(false);
            setSearchQuery("");
          }}
          placeholder="Search title or content..."
        />
      )}

      <SubBarFilters
        viewLabel={displayModeLabel}
        sortLabel={sortModeLabel}
        onViewPress={() => setShowDisplayModeSelector(true)}
        onSortPress={() => setShowSortModeSelector(true)}
        onFilterPress={() => setShowFilterSheet(true)}
        isFiltering={hasActiveFilters}
        filterCount={activeFilterCount}
        isOffline={isOffline}
      />

      <EntryList
        ref={entryListRef}
        entries={filteredEntries}
        sections={filteredSections}
        isLoading={isLoading}
        onEntryPress={handleEntryPress}
        onTagPress={handleTagPress}
        onMentionPress={handleMentionPress}
        onStreamPress={handleStreamPress}
        onMove={handleMoveEntry}
        onCopy={handleCopyEntry}
        onDelete={handleDeleteEntry}
        onPin={handlePinEntry}
        onArchive={handleArchiveEntry}
        streams={streams}
        locations={locations}
        currentStreamId={typeof selectedStreamId === 'string' && !selectedStreamId.includes(':') ? selectedStreamId : null}
        displayMode={displayMode}
        fullStreams={streams}
        entryCount={filteredEntries.length}
        totalCount={sortedEntries.length}
      />

      {/* Move Stream Picker */}
      <StreamPicker
        visible={showMoveStreamPicker}
        onClose={handleCloseMoveStreamPicker}
        onSelect={handleMoveStreamSelect}
        selectedStreamId={entryToMoveStreamId}
      />

      {/* Display Mode Selector */}
      <DisplayModeSelector
        visible={showDisplayModeSelector}
        selectedMode={displayMode}
        onSelect={handleDisplayModeChange}
        onClose={() => setShowDisplayModeSelector(false)}
      />

      {/* Sort Mode Selector */}
      <SortModeSelector
        visible={showSortModeSelector}
        selectedMode={sortMode}
        onSelect={handleSortModeChange}
        onClose={() => setShowSortModeSelector(false)}
        sortOrder={orderMode}
        onSortOrderChange={handleSortOrderChange}
        showPinnedFirst={showPinnedFirst}
        onShowPinnedFirstChange={handleShowPinnedFirstChange}
      />

      {/* Filter Bottom Sheet */}
      <FilterBottomSheet
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        onApply={handleFilterApply}
        entries={sortedEntries}
      />

      <BottomNavBar
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onAddPress={handleAddEntry}
        onAccountPress={() => navigate("account")}
        avatarUrl={avatarUrl}
        displayName={displayName}
      />

      {/* Toast messages from other screens */}
      <Snackbar message={snackbarMessage} opacity={snackbarOpacity} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
