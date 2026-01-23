import { useState, useEffect, useMemo } from "react";
import { View, StyleSheet, BackHandler } from "react-native";
import { ENTRY_DISPLAY_MODES, ENTRY_SORT_MODES, ALL_STATUSES } from "@trace/core";
import { useEntries } from "../modules/entries/mobileEntryHooks";
import { parseStreamIdToFilter } from "../modules/entries/mobileEntryApi";
import { useLocations } from "../modules/locations/mobileLocationHooks";
import { useStreams } from "../modules/streams/mobileStreamHooks";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useDrawer } from "../shared/contexts/DrawerContext";
import { useAuth } from "../shared/contexts/AuthContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { useSettings } from "../shared/contexts/SettingsContext";
import { TopBar } from "../components/layout/TopBar";
import type { BreadcrumbSegment } from "../components/layout/Breadcrumb";
import { SubBarSettings } from "../components/layout/SubBar";
import { SearchBar } from "../components/layout/SearchBar";
import { EntryList } from "../modules/entries/components/EntryList";
import { FloatingActionButton } from "../components/buttons/FloatingActionButton";
import { StreamPicker } from "../modules/streams/components/StreamPicker";
import { useTheme } from "../shared/contexts/ThemeContext";
import { useSettingsDrawer } from "../shared/contexts/SettingsDrawerContext";
import { useDrawerGestures, useFilteredEntries, useEntryActions, useBreadcrumbs } from "./hooks";

export function EntryListScreen() {
  const { navigate } = useNavigation();
  const theme = useTheme();
  const { isOffline } = useAuth();
  const { streams } = useStreams();
  const { menuItems, userEmail, displayName, avatarUrl, onProfilePress } = useNavigationMenu();
  const {
    registerStreamHandler,
    selectedStreamId,
    selectedStreamName,
    setSelectedStreamId,
    setSelectedStreamName,
    openDrawer,
    closeDrawer,
    isOpen: isDrawerOpen,
    drawerControl,
  } = useDrawer();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Per-stream view preferences from settings (sort + display mode + filter)
  const { getStreamSortPreference, getStreamFilter } = useSettings();
  const { drawerControl: settingsDrawerControl, isOpen: isSettingsDrawerOpen, closeDrawer: closeSettingsDrawer } = useSettingsDrawer();

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
    settingsDrawerControl,
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

  // Handle Android back button - close drawers if open, otherwise let app exit normally
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Close settings drawer if open
      if (isSettingsDrawerOpen) {
        closeSettingsDrawer();
        return true;
      }
      // Close stream drawer if open
      if (isDrawerOpen) {
        closeDrawer();
        return true;
      }
      return false; // Let Android handle back normally (exit app)
    });
    return () => backHandler.remove();
  }, [isDrawerOpen, closeDrawer, isSettingsDrawerOpen, closeSettingsDrawer]);

  // Build breadcrumbs from selected stream (handles streams, @mentions, #tags, locations)
  const breadcrumbs = useBreadcrumbs({
    selectedStreamId,
    selectedStreamName,
    streams,
    iconColor: theme.colors.text.primary,
  });

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
  } = useEntryActions({ entryMutations, navigate, entries });

  // Use extracted filtering hook
  const { sortedEntries, filteredEntries, filteredSections } = useFilteredEntries({
    entries,
    streams,
    sortMode,
    orderMode,
    showPinnedFirst,
    streamFilter,
    searchQuery,
  });

  // Get display labels
  const displayModeLabel = ENTRY_DISPLAY_MODES.find(m => m.value === displayMode)?.label || 'Smashed';
  const baseSortLabel = ENTRY_SORT_MODES.find(m => m.value === sortMode)?.label || 'Entry Date';
  const sortModeLabel = orderMode === 'desc' ? `${baseSortLabel} \u2193` : `${baseSortLabel} \u2191`;

  // Compute filter label (shows when filters are active)
  const getFilterLabel = () => {
    const parts: string[] = [];
    if (streamFilter.showArchived) parts.push("Archived");

    // Status filter - only show if actually filtering (not when all selected)
    if (streamFilter.statuses.length > 0) {
      // Get allowed statuses for current stream (or all if viewing "All Entries")
      const currentStream = typeof selectedStreamId === 'string' && !selectedStreamId.includes(':')
        ? streams.find(s => s.stream_id === selectedStreamId)
        : undefined;
      const allowedStatuses = (currentStream?.entry_statuses ?? ALL_STATUSES.map(s => s.value)) as string[];
      const validSelected = streamFilter.statuses.filter(s => allowedStatuses.includes(s));
      const allSelected = validSelected.length === allowedStatuses.length;

      // Only show label if not all statuses are selected
      if (!allSelected) {
        parts.push(`${validSelected.length} status`);
      }
    }

    // Note: Private stream entries are auto-excluded in "All Entries" view (see mobileEntryHooks)
    // No need to show label since it's automatic and not user-controllable
    return parts.length > 0 ? parts.join(", ") : undefined;
  };
  const filterLabel = getFilterLabel();

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

  const handleBreadcrumbPress = (segment: BreadcrumbSegment) => {
    if (segment.id === "all") {
      setSelectedStreamId("all");
      setSelectedStreamName("Home");
    } else if (segment.id === null) {
      setSelectedStreamId(null);
      setSelectedStreamName("Unassigned");
    } else if (typeof segment.id === 'string') {
      setSelectedStreamId(segment.id);
      setSelectedStreamName(segment.label);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]} {...panHandlers}>
      <TopBar
        onLeftMenuPress={openDrawer}
        breadcrumbs={breadcrumbs}
        onBreadcrumbPress={handleBreadcrumbPress}
        badge={filteredEntries.length}
        menuItems={menuItems}
        userEmail={userEmail}
        displayName={displayName}
        avatarUrl={avatarUrl}
        onProfilePress={onProfilePress}
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

      <SubBarSettings
        viewLabel={displayModeLabel}
        sortLabel={sortModeLabel}
        filterLabel={filterLabel}
        entryCount={filteredEntries.length}
        totalCount={sortedEntries.length}
        isOffline={isOffline}
      />

      <EntryList
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
        displayMode={displayMode}
        fullStreams={streams}
      />

      {/* Move Stream Picker */}
      <StreamPicker
        visible={showMoveStreamPicker}
        onClose={handleCloseMoveStreamPicker}
        onSelect={handleMoveStreamSelect}
        selectedStreamId={entryToMoveStreamId}
      />

      <FloatingActionButton onPress={handleAddEntry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
