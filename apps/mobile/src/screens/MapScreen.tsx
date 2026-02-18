import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, PanResponder, Dimensions } from "react-native";
import { createScopedLogger, LogScopes } from "../shared/utils/logger";

const log = createScopedLogger(LogScopes.Map);
import MapView, { Marker, Region } from "react-native-maps";
import * as Location from "expo-location";
import { useNavigate } from "../shared/navigation";
import { useDrawer, type ViewMode } from "../shared/contexts/DrawerContext";
import { useMapState } from "../shared/contexts/MapStateContext";
import { useAuth } from "../shared/contexts/AuthContext";
import { useMobileProfile } from "../shared/hooks/useMobileProfile";
import { useSettings } from "../shared/contexts/SettingsContext";
import { useStreams } from "../modules/streams/mobileStreamHooks";
import { useEntries } from "../modules/entries/mobileEntryHooks";
import { parseStreamIdToFilter } from "../modules/entries/mobileEntryApi";
import { useLocations } from "../modules/locations/mobileLocationHooks";
import { TopBar } from "../components/layout/TopBar";
import { SubBar, SubBarSelector } from "../components/layout/SubBar";
import { EntryList } from "../modules/entries/components/EntryList";
import { DisplayModeSelector } from "../modules/entries/components/DisplayModeSelector";
import { SortModeSelector } from "../modules/entries/components/SortModeSelector";
import { StreamPicker } from "../modules/streams/components/StreamPicker";
import { BottomNavBar } from "../components/layout/BottomNavBar";
import { useTheme } from "../shared/contexts/ThemeContext";
import { Icon } from "../shared/components/Icon";
import { SELECTED_COLOR } from "../modules/entries/components/EntryListItem";
import { Snackbar, useSnackbar } from "../shared/components";
import type { EntryDisplayMode, EntrySortMode, EntrySortOrder } from "@trace/core";
import type { EntryWithRelations } from "../modules/entries/EntryWithRelationsTypes";
import { ENTRY_DISPLAY_MODES, ENTRY_SORT_MODES, sortEntries } from "@trace/core";
import { useEntryActions } from "./hooks/useEntryActions";

// Cluster entries that are close together
interface EntryCluster {
  id: string;
  latitude: number;
  longitude: number;
  entries: EntryWithRelations[];
  count: number;
}

// Custom marker component with tracksViewChanges timeout to prevent flickering
interface ClusterMarkerProps {
  cluster: EntryCluster;
  onPress: () => void;
  isSelected?: boolean;
}

function ClusterMarker({ cluster, onPress, isSelected = false }: ClusterMarkerProps) {
  const [shouldTrack, setShouldTrack] = useState(true);
  const prevCountRef = useRef(cluster.count);
  const prevSelectedRef = useRef(isSelected);

  useEffect(() => {
    // Re-enable tracking when count or selection changes so marker updates
    if (cluster.count !== prevCountRef.current || isSelected !== prevSelectedRef.current) {
      prevCountRef.current = cluster.count;
      prevSelectedRef.current = isSelected;
      setShouldTrack(true);
    }

    // Disable tracking after render to prevent flickering
    const timeout = setTimeout(() => {
      setShouldTrack(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [cluster.count, isSelected]);

  // Color based on selection state
  const markerColor = isSelected ? SELECTED_COLOR : "#3b82f6";

  // Calculate marker size based on digit count to prevent clipping
  // Android clips to square bounding box, so width and height must match
  const digitCount = cluster.count.toString().length;
  const markerSize = digitCount === 1 ? 36 : digitCount === 2 ? 44 : digitCount === 3 ? 52 : 64;

  return (
    <Marker
      coordinate={{
        latitude: cluster.latitude,
        longitude: cluster.longitude,
      }}
      onPress={onPress}
      tracksViewChanges={shouldTrack}
      anchor={cluster.count > 1 ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 1.0 }}
    >
      {cluster.count > 1 ? (
        <View style={[
          styles.clusterMarker,
          isSelected && styles.clusterMarkerSelected,
          { width: markerSize, height: markerSize, borderRadius: markerSize / 2 }
        ]}>
          <Text style={[styles.clusterText, { fontFamily: "Inter_700Bold" }]}>{cluster.count}</Text>
        </View>
      ) : (
        <View style={styles.singleMarker}>
          <Icon name="MapPinSolid" size={32} color={markerColor} />
        </View>
      )}
    </Marker>
  );
}

interface MapScreenProps {
  isVisible?: boolean;
}

export const MapScreen = memo(function MapScreen({ isVisible = true }: MapScreenProps) {

  // Minimal hooks that must always run (React rules)
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
    mapRegion: persistedRegion,
    setMapRegion: persistRegion,
  } = useMapState();
  const authState = useAuth();
  const { user } = authState;
  const { profile } = useMobileProfile(user?.id);
  const { streams } = useStreams();

  // Change detection will happen after ALL hooks are called (see below)

  // Avatar data for TopBar
  const displayName = profile?.name || (profile?.username ? `@${profile.username}` : null) || user?.email || null;
  const avatarUrl = profile?.avatar_url || null;

  // Display/sort mode state
  const [showDisplayModeSelector, setShowDisplayModeSelector] = useState(false);
  const [showSortModeSelector, setShowSortModeSelector] = useState(false);

  // Per-stream view preferences from settings (sort + display mode)
  const { getStreamSortPreference, setStreamSortPreference } = useSettings();

  // Use "map:" prefix for map-specific preferences
  const viewPrefKey = selectedStreamId ? `map:${selectedStreamId}` : "map:all";
  const streamViewPref = getStreamSortPreference(viewPrefKey);

  const sortMode = streamViewPref.sortMode;
  const orderMode = streamViewPref.sortOrder;
  const showPinnedFirst = streamViewPref.showPinnedFirst;
  const displayMode = streamViewPref.displayMode;

  const setSortMode = (mode: EntrySortMode) => setStreamSortPreference(viewPrefKey, { sortMode: mode });
  const setOrderMode = (order: EntrySortOrder) => setStreamSortPreference(viewPrefKey, { sortOrder: order });
  const setShowPinnedFirst = (show: boolean) => setStreamSortPreference(viewPrefKey, { showPinnedFirst: show });
  const setDisplayMode = (mode: EntryDisplayMode) => setStreamSortPreference(viewPrefKey, { displayMode: mode });

  // Screen width for swipe threshold calculation (1/3 of screen)
  const screenWidth = Dimensions.get("window").width;
  const SWIPE_THRESHOLD = screenWidth / 3;

  // Ref to hold current drawerControl - needed because PanResponder callbacks
  // capture values at creation time, so we need a ref to access current value
  const drawerControlRef = useRef(drawerControl);
  useEffect(() => {
    drawerControlRef.current = drawerControl;
  }, [drawerControl]);

  // Swipe-right gesture for opening drawer - only on lower portion (not map)
  const drawerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        const isSwipingRight = gestureState.dx > 20;
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

  // Parse selection into filter using shared helper
  const entryFilter = useMemo(() => parseStreamIdToFilter(selectedStreamId), [selectedStreamId]);

  const { entries: allEntriesFromHook, isLoading, isFetching, entryMutations } = useEntries(entryFilter);

  // Title for TopBar
  const title = selectedStreamName;
  const { data: locationsData } = useLocations();

  // Filter entries to only those with GPS coordinates, exclude archived
  const entries = useMemo(() => {
    return allEntriesFromHook.filter(
      (entry) => entry.entry_latitude && entry.entry_longitude && !entry.is_archived
    );
  }, [allEntriesFromHook]);

  // Locations array for EntryList component
  const locations = useMemo(() => {
    return locationsData?.map(loc => ({
      location_id: loc.location_id,
      name: loc.name,
    })) || [];
  }, [locationsData]);

  // Default region (Kansas City) - used if no persisted region
  const defaultRegion: Region = {
    latitude: 39.0997,
    longitude: -94.5786,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  };

  const [region, setRegion] = useState<Region>(persistedRegion || defaultRegion);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedClusterEntryIds, setSelectedClusterEntryIds] = useState<string[] | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(true); // true = full height (300), false = half height (150)
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region>(persistedRegion || defaultRegion); // Track region without causing re-renders
  const [isMapReady, setIsMapReady] = useState(false);
  const previousStreamIdRef = useRef<string | null | undefined>(undefined); // Start undefined to detect first load
  const pendingFitRef = useRef(false); // Track if we need to fit when data settles
  const fitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Debounce fit operations
  const lastEntriesKeyRef = useRef<string>(""); // Track entries by stable key to avoid unnecessary refits
  const entriesRef = useRef<EntryWithRelations[]>([]); // Ref to access current entries without dependency
  const markerPressRef = useRef(false); // Prevent MapView.onPress from clearing selection on marker tap

  // Entry action handlers (shared with EntryListScreen and CalendarScreen)
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

  // Create stream lookup map for sorting
  const streamMap = useMemo(() => {
    return streams?.reduce((map, s) => {
      map[s.stream_id] = s.name;
      return map;
    }, {} as Record<string, string>) || {};
  }, [streams]);

  // Derive visible entries from entries + region (reactive to cache updates)
  const visibleEntries = useMemo(() => {
    return entries.filter(entry => {
      const lat = entry.entry_latitude!;
      const lng = entry.entry_longitude!;
      const latDelta = region.latitudeDelta / 2;
      const lngDelta = region.longitudeDelta / 2;
      return (
        lat >= region.latitude - latDelta &&
        lat <= region.latitude + latDelta &&
        lng >= region.longitude - lngDelta &&
        lng <= region.longitude + lngDelta
      );
    });
  }, [entries, region]);

  // Sort visible entries based on user preference
  const sortedVisibleEntries = useMemo(() => {
    return sortEntries(visibleEntries, sortMode, streamMap, orderMode, showPinnedFirst);
  }, [visibleEntries, sortMode, streamMap, orderMode, showPinnedFirst]);

  // Displayed entries: filter to selection if active, otherwise show all visible
  // Derives from live `entries` array so data stays fresh after refetches
  const selectedClusterIdSet = useMemo(
    () => selectedClusterEntryIds ? new Set(selectedClusterEntryIds) : null,
    [selectedClusterEntryIds]
  );
  const displayedEntries = useMemo(() => {
    if (selectedClusterIdSet) {
      const filtered = entries.filter(e => selectedClusterIdSet.has(e.entry_id));
      return sortEntries(filtered, sortMode, streamMap, orderMode, showPinnedFirst);
    }
    if (selectedEntryId) {
      const entry = entries.find(e => e.entry_id === selectedEntryId);
      return entry ? [entry] : [];
    }
    return sortedVisibleEntries;
  }, [selectedClusterIdSet, selectedEntryId, entries, sortedVisibleEntries, sortMode, streamMap, orderMode, showPinnedFirst]);

  // Auto-clear selection if selected entry disappears (deleted/archived)
  useEffect(() => {
    if (selectedEntryId && !entries.some(e => e.entry_id === selectedEntryId)) {
      setSelectedEntryId(null);
    }
    if (selectedClusterEntryIds && !selectedClusterEntryIds.some(id => entries.some(e => e.entry_id === id))) {
      setSelectedClusterEntryIds(null);
    }
  }, [entries, selectedEntryId, selectedClusterEntryIds]);

  // Display mode and sort mode labels for SubBar
  const displayModeLabel = ENTRY_DISPLAY_MODES.find(m => m.value === displayMode)?.label || 'Smashed';
  const baseSortLabel = ENTRY_SORT_MODES.find(m => m.value === sortMode)?.label || 'Entry Date';
  const sortModeLabel = orderMode === 'desc' ? `${baseSortLabel} ↓` : `${baseSortLabel} ↑`;

  // Register stream selection handler for drawer
  useEffect(() => {
    registerStreamHandler((streamId, streamName) => {
      setSelectedStreamId(streamId);
      setSelectedStreamName(streamName);
    });
    // Cleanup on unmount
    return () => registerStreamHandler(null);
  }, [registerStreamHandler, setSelectedStreamId, setSelectedStreamName]);

  // Clear map selection when stream filter changes
  useEffect(() => {
    setSelectedEntryId(null);
    setSelectedClusterEntryIds(null);
  }, [selectedStreamId]);

  // Create a stable key for entries to avoid unnecessary effect re-runs
  // Only changes when the actual entry IDs change, not on every array reference change
  const entriesKey = useMemo(() => {
    if (entries.length === 0) return "";
    return entries.map(e => e.entry_id).sort().join(",");
  }, [entries]);

  // Keep entries ref in sync for use inside effects without causing re-runs
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // Fit map to show all entries when stream selection changes or on first load
  // Only runs when screen is visible to avoid unnecessary work when hidden
  useEffect(() => {
    // Skip if screen is not visible
    if (!isVisible) return;

    // Detect when selectedStreamId changes (or on first render when undefined)
    if (previousStreamIdRef.current !== selectedStreamId) {
      previousStreamIdRef.current = selectedStreamId;
      pendingFitRef.current = true; // Mark that we need to fit when data settles

      // Clear any pending timeout from previous fit attempt
      if (fitTimeoutRef.current) {
        clearTimeout(fitTimeoutRef.current);
        fitTimeoutRef.current = null;
      }
    }

    // Also trigger fit if entries actually changed (different IDs, not just reference)
    if (entriesKey !== lastEntriesKeyRef.current && entriesKey !== "") {
      lastEntriesKeyRef.current = entriesKey;
      pendingFitRef.current = true;
    }

    // Execute pending fit when: map is ready, data settled (!isFetching), and have entries
    // Using !isFetching ensures we wait for background refetch to complete with correct data
    const currentEntries = entriesRef.current;
    if (pendingFitRef.current && isMapReady && !isFetching && currentEntries.length > 0 && mapRef.current) {
      pendingFitRef.current = false; // Clear pending flag before fit

      // Small delay to let React settle
      fitTimeoutRef.current = setTimeout(() => {
        const bounds = calculateBounds(currentEntries);
        mapRef.current?.animateToRegion(bounds, 500);
      }, 100);
    }

    return () => {
      if (fitTimeoutRef.current) {
        clearTimeout(fitTimeoutRef.current);
      }
    };
  }, [selectedStreamId, entriesKey, isFetching, isMapReady, isVisible]);

  // Calculate map bounds to fit all entries
  const calculateBounds = useCallback((boundsEntries: EntryWithRelations[]): Region => {
    if (boundsEntries.length === 0) {
      return regionRef.current;
    }

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

    boundsEntries.forEach(entry => {
      const lat = entry.entry_latitude!;
      const lng = entry.entry_longitude!;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latDelta = Math.max(0.01, (maxLat - minLat) * 1.5);
    const lngDelta = Math.max(0.01, (maxLng - minLng) * 1.5);

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, []);

  // Cluster entries based on zoom level
  const clusters = useMemo(() => {
    if (entries.length === 0) return [];

    // Adjust cluster distance based on zoom level
    const clusterDistance = region.latitudeDelta * 0.1;
    const clustered: EntryCluster[] = [];
    const processed = new Set<string>();

    entries.forEach(entry => {
      if (processed.has(entry.entry_id)) return;

      const lat = entry.entry_latitude!;
      const lng = entry.entry_longitude!;

      // Find nearby entries to cluster
      const nearby = entries.filter(e => {
        if (processed.has(e.entry_id)) return false;
        const eLat = e.entry_latitude!;
        const eLng = e.entry_longitude!;
        const distance = Math.sqrt(
          Math.pow(lat - eLat, 2) + Math.pow(lng - eLng, 2)
        );
        return distance < clusterDistance;
      });

      // Mark all as processed
      nearby.forEach(e => processed.add(e.entry_id));

      // Calculate cluster center
      const avgLat = nearby.reduce((sum, e) => sum + e.entry_latitude!, 0) / nearby.length;
      const avgLng = nearby.reduce((sum, e) => sum + e.entry_longitude!, 0) / nearby.length;

      clustered.push({
        id: `cluster-${entry.entry_id}`,
        latitude: avgLat,
        longitude: avgLng,
        entries: nearby,
        count: nearby.length,
      });
    });

    return clustered;
  }, [entries, region.latitudeDelta]);

  // Update region state when map pans/zooms (visibleEntries derived via useMemo)
  const handleRegionChange = useCallback((newRegion: Region) => {
    // Skip expensive work when not visible
    if (!isVisible) return;

    const prevRegion = regionRef.current;

    // Only update region state if it changed significantly (avoid micro-updates)
    const latChanged = Math.abs(newRegion.latitude - prevRegion.latitude) > 0.001;
    const lngChanged = Math.abs(newRegion.longitude - prevRegion.longitude) > 0.001;
    const deltaChanged = Math.abs(newRegion.latitudeDelta - prevRegion.latitudeDelta) > 0.001;

    if (latChanged || lngChanged || deltaChanged) {
      regionRef.current = newRegion;
      setRegion(newRegion);
      persistRegion(newRegion);
    }
  }, [isVisible, persistRegion]);

  // Go to user's current location
  const goToCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to show your current position on the map."
        );
        return;
      }

      // Try to get last known position first (faster)
      let location = await Location.getLastKnownPositionAsync({});

      // If no cached location, get current position
      if (!location) {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      if (location) {
        const newRegion = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };

        mapRef.current?.animateToRegion(newRegion, 500);
      } else {
        Alert.alert("Location Error", "Unable to determine your current location.");
      }
    } catch (error) {
      log.error("Failed to get current location", error);
      Alert.alert("Location Error", "Failed to get your current location. Please try again.");
    }
  };

  // Handle cluster/marker press
  const handleClusterPress = (cluster: EntryCluster) => {
    // react-native-maps Android bug: Marker.onPress and MapView.onPress both fire
    // for the same tap. We set a flag here that handleMapPress checks to avoid
    // immediately clearing the selection we just set. On Android, handleMapPress
    // runs synchronously after this and consumes the flag. On iOS, MapView.onPress
    // doesn't fire for marker taps, so we clear the stale flag on the next frame
    // via requestAnimationFrame (the lightest possible cleanup — not a delay hack).
    markerPressRef.current = true;
    requestAnimationFrame(() => { markerPressRef.current = false; });

    if (cluster.count === 1) {
      // Single entry - show only this entry in the list
      setSelectedEntryId(cluster.entries[0].entry_id);
      setSelectedClusterEntryIds(null);
    } else {
      // Multiple entries - show cluster entries in the list
      setSelectedEntryId(null);
      setSelectedClusterEntryIds(cluster.entries.map(e => e.entry_id));
    }
  };

  // Handle "Select on Map" - highlight entry on map and zoom (via context menu)
  const handleSelectOnMap = (entryId: string) => {
    const entry = entries.find(e => e.entry_id === entryId);
    if (!entry?.entry_latitude || !entry?.entry_longitude) {
      // Entry not found or lost its location — clear any stale selection
      setSelectedEntryId(null);
      setSelectedClusterEntryIds(null);
      return;
    }

    // Show only this entry in the list and highlight its pin
    setSelectedEntryId(entryId);
    setSelectedClusterEntryIds(null);

    // Zoom to the entry location
    mapRef.current?.animateToRegion({
      latitude: entry.entry_latitude,
      longitude: entry.entry_longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 500);
  };

  // Handle map background press - deselect all
  // react-native-maps platform differences:
  //   iOS: nativeEvent.action === 'marker-press' when a marker is tapped
  //   Android: no marker-press action, both Marker.onPress and MapView.onPress fire
  const handleMapPress = useCallback((e: any) => {
    if (e.nativeEvent.action === 'marker-press') return;
    if (markerPressRef.current) {
      markerPressRef.current = false;
      return;
    }
    setSelectedEntryId(null);
    setSelectedClusterEntryIds(null);
  }, []);

  // Handle tag press - filter by tag
  const handleTagPress = (tag: string) => {
    setSelectedStreamId(`tag:${tag}`);
    setSelectedStreamName(`#${tag}`);
  };

  // Handle mention press - filter by mention
  const handleMentionPress = (mention: string) => {
    setSelectedStreamId(`mention:${mention}`);
    setSelectedStreamName(`@${mention}`);
  };

  // Handle stream press - filter by stream
  const handleStreamPress = (streamId: string | null, streamName: string) => {
    setSelectedStreamId(streamId);
    setSelectedStreamName(streamName);
  };

  // Handle view mode changes from bottom nav bar
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "list") {
      navigate("inbox");
    } else if (mode === "calendar") {
      navigate("calendar");
    }
    // "map" mode - already here, no navigation needed
  }, [setViewMode, navigate]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        <TopBar
          title={title}
          badge={0}
          onTitlePress={openDrawer}
          showDropdownArrow
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.text.tertiary} />
          <Text style={[styles.loadingText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>Loading entries...</Text>
        </View>
        <BottomNavBar
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onAddPress={() => navigate("capture")}
          onAccountPress={() => navigate("account")}
          avatarUrl={avatarUrl}
          displayName={displayName}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <TopBar
        title={title}
        badge={entries.length}
        onTitlePress={openDrawer}
        showDropdownArrow
      />

      {/* Map */}
      <View style={[styles.mapContainer, { height: isMapExpanded ? 300 : 150 }]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={region}
          onMapReady={() => setIsMapReady(true)}
          onRegionChangeComplete={handleRegionChange}
          mapType="standard"
          userInterfaceStyle="light"
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          showsScale={false}
          showsTraffic={false}
          showsBuildings={false}
          showsIndoors={false}
          toolbarEnabled={false}
          onPress={handleMapPress}
        >
          {clusters.map(cluster => {
            // Check if this cluster is selected (single entry or whole cluster)
            const isClusterSelected = selectedEntryId
              ? cluster.entries.some(e => e.entry_id === selectedEntryId)
              : selectedClusterIdSet
                ? cluster.entries.some(e => selectedClusterIdSet.has(e.entry_id))
                : false;

            return (
              <ClusterMarker
                key={`${cluster.id}${isClusterSelected ? '-s' : ''}`}
                cluster={cluster}
                onPress={() => handleClusterPress(cluster)}
                isSelected={isClusterSelected}
              />
            );
          })}
        </MapView>

        {/* My Location Button */}
        <TouchableOpacity style={[styles.locationButton, { backgroundColor: theme.colors.background.primary }]} onPress={goToCurrentLocation}>
          <Icon name="Crosshair" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>

        {/* Fit All Button */}
        {entries.length > 0 && (
          <TouchableOpacity
            style={[styles.fitButton, { backgroundColor: theme.colors.background.primary }]}
            onPress={() => {
              const bounds = calculateBounds(entries);
              mapRef.current?.animateToRegion(bounds, 500);
            }}
          >
            <Icon name="Maximize" size={20} color={theme.colors.text.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Lower portion with swipe gesture for drawer */}
      <View style={styles.lowerSection} {...drawerPanResponder.panHandlers}>
        {/* Entry count and map height toggle */}
        <View style={[styles.countBar, { backgroundColor: theme.colors.background.primary, borderBottomColor: theme.colors.border.light }]}>
          <Text style={[styles.countBarText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
            {visibleEntries.length} {visibleEntries.length === 1 ? "entry" : "entries"} in view
          </Text>
          <TouchableOpacity
            style={styles.mapToggleButton}
            onPress={() => setIsMapExpanded(!isMapExpanded)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name={isMapExpanded ? "ChevronUp" : "ChevronDown"} size={16} color={theme.colors.text.tertiary} />
          </TouchableOpacity>
        </View>

        {/* Display/Sort mode selectors */}
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

        {/* Entry List */}
        {entries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="MapPin" size={64} color={theme.colors.text.disabled} />
            <Text style={[styles.emptyText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.semibold }]}>No entries with locations</Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>Add GPS coordinates to your entries to see them on the map</Text>
          </View>
        ) : (
          <View style={[styles.entryList, { backgroundColor: theme.colors.background.primary }]}>
            <EntryList
              entries={displayedEntries}
              isLoading={false}
              onEntryPress={handleEntryPress}
              onSelectOnMap={handleSelectOnMap}
              selectedEntryId={selectedEntryId}
              onMove={handleMoveEntry}
              onCopy={handleCopyEntry}
              onDelete={handleDeleteEntry}
              onPin={handlePinEntry}
              onArchive={handleArchiveEntry}
              onTagPress={handleTagPress}
              onMentionPress={handleMentionPress}
              onStreamPress={handleStreamPress}
              streams={streams}
              locations={locations}
              displayMode={displayMode}
              fullStreams={streams}
              entryCount={displayedEntries.length}
              totalCount={(selectedEntryId || selectedClusterEntryIds) ? undefined : sortedVisibleEntries.length}
              selectionActive={!!(selectedEntryId || selectedClusterEntryIds)}
            />
          </View>
        )}
      </View>

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

      <BottomNavBar
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onAddPress={() => navigate("capture")}
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
  lowerSection: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  mapContainer: {
    position: "relative",
    // Height is set dynamically via inline style based on isMapExpanded
  },
  map: {
    flex: 1,
  },
  locationButton: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fitButton: {
    position: "absolute",
    right: 16,
    bottom: 68,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  clusterMarker: {
    backgroundColor: "#3b82f6",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    // Width is set dynamically based on digit count to prevent clipping
  },
  clusterMarkerSelected: {
    backgroundColor: SELECTED_COLOR,
  },
  clusterText: {
    color: "#fff",
    fontSize: 14,
  },
  singleMarker: {
    // Container for single marker pin
  },
  countBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  countBarText: {
    fontSize: 13,
  },
  mapToggleButton: {
    padding: 4,
  },
  entryList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
});
