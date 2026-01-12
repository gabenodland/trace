import { useState, useEffect, useMemo, useRef } from "react";
import { View, StyleSheet, Alert, PanResponder, Dimensions } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import * as Location from "expo-location";
import type { EntryDisplayMode, EntrySortMode, EntrySortOrder, EntrySection } from "@trace/core";
import {
  useAuthState,
  ENTRY_DISPLAY_MODES,
  ENTRY_SORT_MODES,
  sortEntries,
  groupEntriesByStatus,
  groupEntriesByType,
  groupEntriesByStream,
  groupEntriesByPriority,
  groupEntriesByRating,
  groupEntriesByDueDate,
} from "@trace/core";
import { useEntries, MobileEntryFilter } from "../modules/entries/mobileEntryHooks";
import { useLocations } from "../modules/locations/mobileLocationHooks";
import { useStreams } from "../modules/streams/mobileStreamHooks";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useDrawer } from "../shared/contexts/DrawerContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { useSettings } from "../shared/contexts/SettingsContext";
import { TopBar } from "../components/layout/TopBar";
import type { BreadcrumbSegment } from "../components/layout/Breadcrumb";
import { TopBarDropdownContainer } from "../components/layout/TopBarDropdownContainer";
import { SubBar, SubBarSelector } from "../components/layout/SubBar";
import { SearchBar } from "../components/layout/SearchBar";
import { EntryList } from "../modules/entries/components/EntryList";
import { FloatingActionButton } from "../components/buttons/FloatingActionButton";
import { DisplayModeSelector } from "../modules/entries/components/DisplayModeSelector";
import { SortModeSelector } from "../modules/entries/components/SortModeSelector";
import { StreamPicker } from "../modules/streams/components/StreamPicker";
import { theme } from "../shared/theme/theme";

export function EntryListScreen() {
  const { navigate } = useNavigation();
  const { streams } = useStreams();
  const { user } = useAuthState();
  const { menuItems, userEmail, displayName, avatarUrl, onProfilePress } = useNavigationMenu();
  const {
    registerStreamHandler,
    selectedStreamId,
    selectedStreamName,
    setSelectedStreamId,
    setSelectedStreamName,
    openDrawer,
    drawerControl,
  } = useDrawer();

  // Screen width for swipe threshold calculation (1/3 of screen)
  const screenWidth = Dimensions.get("window").width;
  const SWIPE_THRESHOLD = screenWidth / 3;

  // Ref to hold current drawerControl - needed because PanResponder callbacks
  // capture values at creation time, so we need a ref to access current value
  const drawerControlRef = useRef(drawerControl);
  useEffect(() => {
    drawerControlRef.current = drawerControl;
  }, [drawerControl]);

  // Swipe-right gesture for opening drawer - uses capture phase to intercept before FlatList
  const drawerPanResponder = useRef(
    PanResponder.create({
      // Don't capture initial touch - allows taps and scroll to start
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      // Capture horizontal right swipes before FlatList gets them
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        // Only capture if clearly horizontal and moving right
        // Require significant horizontal movement to avoid interfering with scroll
        const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        const isSwipingRight = gestureState.dx > 20;
        // Don't capture from the very left edge (Android back gesture zone)
        const notInBackZone = evt.nativeEvent.pageX > 25;
        return isHorizontalSwipe && isSwipingRight && notInBackZone;
      },
      onMoveShouldSetPanResponder: () => false,
      onPanResponderGrant: () => {
        // Gesture captured
      },
      onPanResponderMove: (_, gestureState) => {
        // Update drawer position as finger moves (use ref for current value)
        const control = drawerControlRef.current;
        if (control && gestureState.dx > 0) {
          control.setPosition(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const control = drawerControlRef.current;
        if (!control) return;

        // Decide whether to open or close based on position and velocity
        const shouldOpen =
          gestureState.dx > SWIPE_THRESHOLD || // Past 1/3 of screen
          gestureState.vx > 0.5; // Fast swipe right

        if (shouldOpen) {
          control.animateOpen();
        } else {
          control.animateClose();
        }
      },
      onPanResponderTerminate: () => {
        // Gesture was interrupted - close drawer
        const control = drawerControlRef.current;
        if (control) {
          control.animateClose();
        }
      },
    })
  ).current;
  const [showDisplayModeSelector, setShowDisplayModeSelector] = useState(false);
  const [showSortModeSelector, setShowSortModeSelector] = useState(false);
  const [showMoveStreamPicker, setShowMoveStreamPicker] = useState(false);
  const [entryToMove, setEntryToMove] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Per-stream view preferences from settings (sort + display mode)
  const { getStreamSortPreference, setStreamSortPreference } = useSettings();

  // Get the key for the current stream's view preference
  // Use the selectedStreamId as-is for special values ("all", "events", etc.)
  // For null (unassigned), the helper uses "_global"
  const viewPrefKey = typeof selectedStreamId === 'string' ? selectedStreamId : null;
  const streamViewPref = getStreamSortPreference(viewPrefKey);

  const sortMode = streamViewPref.sortMode;
  const orderMode = streamViewPref.sortOrder;
  const showPinnedFirst = streamViewPref.showPinnedFirst;
  const displayMode = streamViewPref.displayMode;

  const setSortMode = (mode: EntrySortMode) => setStreamSortPreference(viewPrefKey, { sortMode: mode });
  const setOrderMode = (order: EntrySortOrder) => setStreamSortPreference(viewPrefKey, { sortOrder: order });
  const setShowPinnedFirst = (show: boolean) => setStreamSortPreference(viewPrefKey, { showPinnedFirst: show });
  const setDisplayMode = (mode: EntryDisplayMode) => setStreamSortPreference(viewPrefKey, { displayMode: mode });

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

  // Build breadcrumbs from selected stream (flat - no hierarchy)
  const breadcrumbs = useMemo((): BreadcrumbSegment[] => {
    // If a stream is selected - show only stream name (no Home >)
    if (selectedStreamId && typeof selectedStreamId === 'string' && !selectedStreamId.startsWith("tag:") && !selectedStreamId.startsWith("mention:") && !selectedStreamId.startsWith("location:") && selectedStreamId !== "all") {
      const stream = streams.find(s => s.stream_id === selectedStreamId);
      if (stream) {
        return [{ id: stream.stream_id, label: stream.name }];
      }
    }

    if (selectedStreamId === "all") {
      return [{ id: "all", label: "All Entries" }];
    } else if (selectedStreamId === null) {
      return [{ id: null, label: "Unassigned" }];
    } else if (typeof selectedStreamId === 'string' && selectedStreamId.startsWith("tag:")) {
      const tag = selectedStreamId.substring(4);
      return [{ id: selectedStreamId, label: `#${tag}` }];
    } else if (typeof selectedStreamId === 'string' && selectedStreamId.startsWith("mention:")) {
      const mention = selectedStreamId.substring(8);
      return [{ id: selectedStreamId, label: `@${mention}` }];
    } else if (typeof selectedStreamId === 'string' && selectedStreamId.startsWith("location:")) {
      return [
        {
          id: selectedStreamId,
          label: selectedStreamName || "Location",
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth={2}>
              <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={12} cy={10} r={3} />
            </Svg>
          )
        }
      ];
    }

    return [{ id: "all", label: "All Entries" }];
  }, [selectedStreamId, selectedStreamName, streams]);

  // Determine filter based on selected stream
  let streamFilter: MobileEntryFilter = {};

  if (selectedStreamId === "all") {
    // "All" / "Home" - fetch all entries
    // streamFilter stays empty
  } else if (selectedStreamId === null) {
    // No Stream - show only entries without a stream
    streamFilter = { stream_id: null };
  } else if (selectedStreamId === "streams") {
    // Just a nav item, treat like "all"
  } else if (selectedStreamId === "events") {
    // TODO: Filter by events when implemented
  } else if (selectedStreamId === "tags" || selectedStreamId === "people") {
    // Just nav items, noop
  } else if (typeof selectedStreamId === 'string' && selectedStreamId.startsWith('tag:')) {
    const tag = selectedStreamId.substring(4);
    streamFilter = { tag };
  } else if (typeof selectedStreamId === 'string' && selectedStreamId.startsWith('mention:')) {
    const mention = selectedStreamId.substring(8);
    streamFilter = { mention };
  } else if (typeof selectedStreamId === 'string' && selectedStreamId.startsWith('location:')) {
    const locationId = selectedStreamId.substring(9);
    streamFilter = { location_id: locationId };
  } else if (selectedStreamId !== null) {
    // Specific stream ID (flat - no children)
    streamFilter = { stream_id: selectedStreamId };
  } else {
    streamFilter = { stream_id: null };
  }

  const { entries, isLoading, entryMutations } = useEntries(streamFilter);

  // Create stream map for sorting
  const streamMap = useMemo(() => {
    return streams.reduce((map, s) => {
      map[s.stream_id] = s.name;
      return map;
    }, {} as Record<string, string>);
  }, [streams]);

  // Create stream by ID map for attribute visibility
  const streamById = useMemo(() => {
    return streams.reduce((map, stream) => {
      map[stream.stream_id] = stream;
      return map;
    }, {} as Record<string, typeof streams[0]>);
  }, [streams]);

  const sortedEntries = useMemo(() => {
    return sortEntries(entries, sortMode, streamMap, orderMode, showPinnedFirst);
  }, [entries, sortMode, streamMap, orderMode, showPinnedFirst]);

  // Compute sections when sorting by status, type, stream, priority, rating, or due date
  const entrySections = useMemo((): EntrySection[] | undefined => {
    if (sortMode === 'status') {
      return groupEntriesByStatus(entries, orderMode, showPinnedFirst);
    }
    if (sortMode === 'type') {
      return groupEntriesByType(entries, orderMode, showPinnedFirst);
    }
    if (sortMode === 'stream') {
      return groupEntriesByStream(entries, streamMap, orderMode, showPinnedFirst);
    }
    if (sortMode === 'priority') {
      return groupEntriesByPriority(entries, orderMode, showPinnedFirst);
    }
    if (sortMode === 'rating') {
      return groupEntriesByRating(entries, orderMode, showPinnedFirst, streamById);
    }
    if (sortMode === 'due_date') {
      return groupEntriesByDueDate(entries, orderMode, showPinnedFirst);
    }
    return undefined;
  }, [entries, sortMode, streamMap, streamById, orderMode, showPinnedFirst]);

  // Filter entries by search query (searches title and content)
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) {
      return sortedEntries;
    }
    const query = searchQuery.toLowerCase().trim();
    return sortedEntries.filter(entry => {
      // Search in title
      if (entry.title?.toLowerCase().includes(query)) {
        return true;
      }
      // Search in content (strip HTML tags for plain text search)
      const plainContent = entry.content.replace(/<[^>]*>/g, '').toLowerCase();
      if (plainContent.includes(query)) {
        return true;
      }
      return false;
    });
  }, [sortedEntries, searchQuery]);

  // Filter sections when there's a search query
  const filteredSections = useMemo((): EntrySection[] | undefined => {
    if (!entrySections) return undefined;
    if (!searchQuery.trim()) return entrySections;

    const query = searchQuery.toLowerCase().trim();
    return entrySections
      .map(section => ({
        ...section,
        data: section.data.filter(entry => {
          if (entry.title?.toLowerCase().includes(query)) return true;
          const plainContent = entry.content.replace(/<[^>]*>/g, '').toLowerCase();
          return plainContent.includes(query);
        }),
        count: 0, // Will be recalculated below
      }))
      .map(section => ({ ...section, count: section.data.length }))
      .filter(section => section.data.length > 0);
  }, [entrySections, searchQuery]);

  // Get display labels
  const displayModeLabel = ENTRY_DISPLAY_MODES.find(m => m.value === displayMode)?.label || 'Smashed';
  const baseSortLabel = ENTRY_SORT_MODES.find(m => m.value === sortMode)?.label || 'Entry Date';
  const sortModeLabel = orderMode === 'desc' ? `${baseSortLabel} (desc)` : baseSortLabel;

  const handleEntryPress = (entryId: string) => {
    navigate("capture", { entryId });
  };

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

  const handleMoveEntry = (entryId: string) => {
    setEntryToMove(entryId);
    setShowMoveStreamPicker(true);
  };

  const handleMoveStreamSelect = async (streamId: string | null, streamName: string | null) => {
    if (!entryToMove) return;

    try {
      await entryMutations.updateEntry(entryToMove, {
        stream_id: streamId,
      });

      setShowMoveStreamPicker(false);
      setEntryToMove(null);
    } catch (error) {
      console.error("Failed to move entry:", error);
      Alert.alert("Error", "Failed to move entry");
    }
  };

  const handleDeleteEntry = (entryId: string) => {
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await entryMutations.deleteEntry(entryId);
            } catch (error) {
              console.error("Failed to delete entry:", error);
              Alert.alert("Error", "Failed to delete entry");
            }
          },
        },
      ]
    );
  };

  const handlePinEntry = async (entryId: string, currentPinned: boolean) => {
    try {
      await entryMutations.updateEntry(entryId, {
        is_pinned: !currentPinned,
      });
    } catch (error) {
      console.error("Failed to pin/unpin entry:", error);
      Alert.alert("Error", "Failed to pin/unpin entry");
    }
  };

  const handleCopyEntry = async (entryId: string) => {
    try {
      let gpsCoords: { latitude: number; longitude: number; accuracy?: number } | undefined;

      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          let location = await Location.getLastKnownPositionAsync();
          if (!location) {
            location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Low,
            });
          }
          if (location) {
            gpsCoords = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy ?? undefined,
            };
          }
        }
      } catch (locError) {
        console.warn("Could not get location for copy:", locError);
      }

      const copiedEntryData = await entryMutations.copyEntry(entryId, gpsCoords);

      navigate("capture", { copiedEntryData });
    } catch (error) {
      console.error("Failed to copy entry:", error);
      Alert.alert("Error", "Failed to copy entry");
    }
  };

  // Get current stream of entry being moved
  const entryToMoveData = entryToMove ? entries.find(e => e.entry_id === entryToMove) : null;
  const entryToMoveStreamId = entryToMoveData?.stream_id || null;

  return (
    <View style={styles.container} {...drawerPanResponder.panHandlers}>
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

      <SubBar>
        <SubBarSelector
          label="View"
          value={displayModeLabel}
          onPress={() => setShowDisplayModeSelector(true)}
        />
        <SubBarSelector
          label="Sort"
          value={sortModeLabel}
          onPress={() => setShowSortModeSelector(true)}
        />
      </SubBar>

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
        streams={streams}
        locations={locations}
        displayMode={displayMode}
        fullStreams={streams}
      />

      {/* Display Mode Selector */}
      <DisplayModeSelector
        visible={showDisplayModeSelector}
        selectedMode={displayMode}
        onSelect={setDisplayMode}
        onClose={() => setShowDisplayModeSelector(false)}
      />

      {/* Sort Mode Selector */}
      <SortModeSelector
        visible={showSortModeSelector}
        selectedMode={sortMode}
        onSelect={setSortMode}
        onClose={() => setShowSortModeSelector(false)}
        sortOrder={orderMode}
        onSortOrderChange={setOrderMode}
        showPinnedFirst={showPinnedFirst}
        onShowPinnedFirstChange={setShowPinnedFirst}
      />

      {/* Move Stream Picker */}
      <TopBarDropdownContainer
        visible={showMoveStreamPicker}
        onClose={() => {
          setShowMoveStreamPicker(false);
          setEntryToMove(null);
        }}
      >
        <StreamPicker
          visible={showMoveStreamPicker}
          onClose={() => {
            setShowMoveStreamPicker(false);
            setEntryToMove(null);
          }}
          onSelect={handleMoveStreamSelect}
          selectedStreamId={entryToMoveStreamId}
        />
      </TopBarDropdownContainer>

      <FloatingActionButton onPress={handleAddEntry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
  },
});
