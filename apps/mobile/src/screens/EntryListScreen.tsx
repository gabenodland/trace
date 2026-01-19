import { useState, useEffect, useMemo, useRef } from "react";
import { View, StyleSheet, Alert, PanResponder, Dimensions, Animated, Text } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import * as Location from "expo-location";
import type { EntryDisplayMode, EntrySortMode, EntrySortOrder, EntrySection } from "@trace/core";
import {
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
import { parseStreamIdToFilter } from "../modules/entries/mobileEntryApi";
import { useLocations } from "../modules/locations/mobileLocationHooks";
import { useStreams } from "../modules/streams/mobileStreamHooks";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useDrawer } from "../shared/contexts/DrawerContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { useSettings } from "../shared/contexts/SettingsContext";
import { useAuth } from "../shared/contexts/AuthContext";
import { TopBar } from "../components/layout/TopBar";
import type { BreadcrumbSegment } from "../components/layout/Breadcrumb";
import { SubBar, SubBarSelector } from "../components/layout/SubBar";
import { SearchBar } from "../components/layout/SearchBar";
import { EntryList } from "../modules/entries/components/EntryList";
import { FloatingActionButton } from "../components/buttons/FloatingActionButton";
import { DisplayModeSelector } from "../modules/entries/components/DisplayModeSelector";
import { SortModeSelector } from "../modules/entries/components/SortModeSelector";
import { StreamPicker } from "../modules/streams/components/StreamPicker";
import { useTheme } from "../shared/contexts/ThemeContext";

export function EntryListScreen() {
  const { navigate } = useNavigation();
  const theme = useTheme();
  const { streams } = useStreams();
  const { user } = useAuth();
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

  // Screen width for swipe threshold calculation
  const screenWidth = Dimensions.get("window").width;
  const DRAWER_SWIPE_THRESHOLD = screenWidth / 3;
  const MODE_SWIPE_THRESHOLD = screenWidth / 4;

  // Ref to hold current drawerControl - needed because PanResponder callbacks
  // capture values at creation time, so we need a ref to access current value
  const drawerControlRef = useRef(drawerControl);
  useEffect(() => {
    drawerControlRef.current = drawerControl;
  }, [drawerControl]);

  // Mode change panel animation state (always rendered, opacity controls visibility)
  // With right: 0 positioning, translateX goes from PANEL_WIDTH (hidden) to 0 (visible)
  const PANEL_WIDTH = 130;
  const modePanelTranslateX = useRef(new Animated.Value(PANEL_WIDTH)).current;
  const modePanelOpacity = useRef(new Animated.Value(0)).current;

  // Track swipe direction for current gesture
  const swipeDirectionRef = useRef<"left" | "right" | null>(null);

  // Track highlighted mode index during swipe (for cycling through non-current modes)
  // Index 0 = current mode (at top), indices 1-3 = other modes that cycle
  const [highlightedModeIndex, setHighlightedModeIndex] = useState(1);
  const highlightedModeIndexRef = useRef(1);

  // Refs for values used inside PanResponder (to avoid stale closures)
  const displayModeRef = useRef<EntryDisplayMode>("smashed");
  const setDisplayModeRef = useRef<(mode: EntryDisplayMode) => void>(() => {});
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

  // Keep refs in sync with current values (for PanResponder callbacks)
  // Assign directly during render instead of useEffect to avoid re-runs on function reference changes
  displayModeRef.current = displayMode;
  setDisplayModeRef.current = setDisplayMode;

  // Reordered modes: current mode first, then the others in order
  // This is for JSX rendering (uses state)
  const reorderedModes = useMemo(() => {
    const currentIdx = ENTRY_DISPLAY_MODES.findIndex((m) => m.value === displayMode);
    const current = ENTRY_DISPLAY_MODES[currentIdx];
    const others = ENTRY_DISPLAY_MODES.filter((_, i) => i !== currentIdx);
    return [current, ...others];
  }, [displayMode]);

  // Get reordered modes for PanResponder (uses ref)
  const getReorderedModes = () => {
    const currentIdx = ENTRY_DISPLAY_MODES.findIndex((m) => m.value === displayModeRef.current);
    const current = ENTRY_DISPLAY_MODES[currentIdx];
    const others = ENTRY_DISPLAY_MODES.filter((_, i) => i !== currentIdx);
    return [current, ...others];
  };

  // Reset mode panel to hidden position
  // Highlight starts at 1 (first non-current mode) when panel reopens
  const resetModePanel = () => {
    Animated.parallel([
      Animated.timing(modePanelTranslateX, {
        toValue: PANEL_WIDTH,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(modePanelOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setHighlightedModeIndex(1);
      highlightedModeIndexRef.current = 1;
    });
  };

  // Combined swipe gesture handler:
  // - Swipe RIGHT: opens drawer
  // - Swipe LEFT: cycles display mode with panel showing all modes
  const combinedPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      // Capture horizontal swipes before FlatList
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        const isSwipingRight = gestureState.dx > 20;
        const isSwipingLeft = gestureState.dx < -20;
        const notInBackZone = evt.nativeEvent.pageX > 25;

        if (isHorizontalSwipe && isSwipingRight && notInBackZone) {
          swipeDirectionRef.current = "right";
          return true;
        }
        if (isHorizontalSwipe && isSwipingLeft) {
          swipeDirectionRef.current = "left";
          return true;
        }
        return false;
      },
      onMoveShouldSetPanResponder: () => false,
      onPanResponderGrant: () => {
        // No setup needed - panel is always rendered, animation values control visibility
      },
      onPanResponderMove: (_, gestureState) => {
        if (swipeDirectionRef.current === "right") {
          // Drawer swipe
          const control = drawerControlRef.current;
          if (control && gestureState.dx > 0) {
            control.setPosition(gestureState.dx);
          }
        } else if (swipeDirectionRef.current === "left") {
          // Mode change swipe - panel slides in, cycling through non-current modes
          const absDx = Math.abs(gestureState.dx);
          const numOtherModes = ENTRY_DISPLAY_MODES.length - 1; // Exclude current

          // Panel slides in quickly (first 40px)
          const panelOpenDistance = 40;
          const slideProgress = Math.min(1, absDx / panelOpenDistance);
          const newX = PANEL_WIDTH * (1 - slideProgress);
          modePanelTranslateX.setValue(newX);
          modePanelOpacity.setValue(Math.min(1, slideProgress * 2));

          // Mode selection starts AFTER panel is open + small buffer
          // Sequence: Open(40px) → buffer(25px) → first(45px) → second(45px) → third(45px)
          const modeStartOffset = 65;  // Panel open + buffer before first mode
          const modeSegment = 45;      // Each mode gets 45px of swipe distance

          const adjustedDx = Math.max(0, absDx - modeStartOffset);
          const rawIndex = Math.floor(adjustedDx / modeSegment);
          // Cycle through 1, 2, 3, 1, 2, 3... (never 0)
          const newHighlightIndex = (rawIndex % numOtherModes) + 1;

          if (newHighlightIndex !== highlightedModeIndexRef.current) {
            highlightedModeIndexRef.current = newHighlightIndex;
            setHighlightedModeIndex(newHighlightIndex);
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (swipeDirectionRef.current === "right") {
          // Drawer release
          const control = drawerControlRef.current;
          if (!control) return;
          const shouldOpen = gestureState.dx > DRAWER_SWIPE_THRESHOLD || gestureState.vx > 0.5;
          if (shouldOpen) {
            control.animateOpen();
          } else {
            control.animateClose();
          }
        } else if (swipeDirectionRef.current === "left") {
          // Mode change release - switch to highlighted mode if swiped far enough
          const absDx = Math.abs(gestureState.dx);
          // Must swipe past the buffer zone (65px) to commit a change
          const shouldChange = absDx > 65;

          if (shouldChange) {
            // Get the highlighted mode from reordered list
            // Index 0 = current, indices 1-3 = other modes
            const modes = getReorderedModes();
            const selectedMode = modes[highlightedModeIndexRef.current];

            // Highlighted is always a non-current mode (index 1, 2, or 3), so always change
            Animated.sequence([
              Animated.parallel([
                Animated.timing(modePanelTranslateX, {
                  toValue: 0,
                  duration: 100,
                  useNativeDriver: true,
                }),
                Animated.timing(modePanelOpacity, {
                  toValue: 1,
                  duration: 100,
                  useNativeDriver: true,
                }),
              ]),
              Animated.delay(100),
            ]).start(() => {
              setDisplayModeRef.current(selectedMode.value);
              resetModePanel();
            });
          } else {
            // Didn't swipe far enough - just dismiss, stay on current mode
            resetModePanel();
          }
        }
        swipeDirectionRef.current = null;
      },
      onPanResponderTerminate: () => {
        if (swipeDirectionRef.current === "right") {
          const control = drawerControlRef.current;
          if (control) control.animateClose();
        } else if (swipeDirectionRef.current === "left") {
          resetModePanel();
        }
        swipeDirectionRef.current = null;
      },
    })
  ).current;

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
    if (selectedStreamId && typeof selectedStreamId === 'string' && !selectedStreamId.startsWith("tag:") && !selectedStreamId.startsWith("mention:") && !selectedStreamId.startsWith("location:") && !selectedStreamId.startsWith("geo:") && selectedStreamId !== "all") {
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
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
              <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={12} cy={10} r={3} />
            </Svg>
          )
        }
      ];
    } else if (typeof selectedStreamId === 'string' && selectedStreamId.startsWith("geo:")) {
      // Geo hierarchy filter (country, region, city, place, none)
      return [
        {
          id: selectedStreamId,
          label: selectedStreamName || "Location",
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
              <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={12} cy={10} r={3} />
            </Svg>
          )
        }
      ];
    }

    return [{ id: "all", label: "All Entries" }];
  }, [selectedStreamId, selectedStreamName, streams]);

  // Parse selection into filter using shared helper
  const streamFilter = useMemo(() => parseStreamIdToFilter(selectedStreamId), [selectedStreamId]);

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
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]} {...combinedPanResponder.panHandlers}>
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
      <StreamPicker
        visible={showMoveStreamPicker}
        onClose={() => {
          setShowMoveStreamPicker(false);
          setEntryToMove(null);
        }}
        onSelect={handleMoveStreamSelect}
        selectedStreamId={entryToMoveStreamId}
      />

      <FloatingActionButton onPress={handleAddEntry} />

      {/* Mode change panel - current at top, other modes cycle below */}
      <Animated.View
        style={[
          styles.modePanel,
          {
            transform: [{ translateX: modePanelTranslateX }],
            opacity: modePanelOpacity,
            backgroundColor: theme.colors.surface.elevated,
          },
        ]}
        pointerEvents="none"
      >
        {reorderedModes.map((mode, index) => {
          const isCurrent = index === 0; // First item is always current
          const isHighlighted = index === highlightedModeIndex;
          return (
            <View
              key={mode.value}
              style={[
                styles.modePanelItem,
                isCurrent && styles.modePanelItemCurrent,
                isHighlighted && { backgroundColor: theme.colors.functional.accent },
              ]}
            >
              <Text
                style={[
                  styles.modePanelText,
                  { color: isHighlighted ? "#fff" : theme.colors.text.primary },
                  isCurrent && { color: theme.colors.text.tertiary },
                ]}
              >
                {isCurrent ? `${mode.label} ✓` : mode.label}
              </Text>
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modePanel: {
    position: "absolute",
    top: "20%",
    right: 0,
    width: 130,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    paddingVertical: 6,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 12,
  },
  modePanelItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    marginHorizontal: 4,
    marginVertical: 2,
  },
  modePanelItemCurrent: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.2)",
    marginBottom: 4,
    borderRadius: 0,
  },
  modePanelText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
