import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Alert, PanResponder, Dimensions } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import * as Location from "expo-location";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useDrawer } from "../shared/contexts/DrawerContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { useStreams } from "../modules/streams/mobileStreamHooks";
import { useEntries } from "../modules/entries/mobileEntryHooks";
import { parseStreamIdToFilter } from "../modules/entries/mobileEntryApi";
import { useLocations } from "../modules/locations/mobileLocationHooks";
import { TopBar } from "../components/layout/TopBar";
import type { BreadcrumbSegment } from "../components/layout/Breadcrumb";
import { useTheme } from "../shared/contexts/ThemeContext";
import Svg, { Path, Circle } from "react-native-svg";
import { formatRelativeTime, type Entry } from "@trace/core";

// Cluster entries that are close together
interface EntryCluster {
  id: string;
  latitude: number;
  longitude: number;
  entries: Entry[];
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
  const markerColor = isSelected ? "#ef4444" : "#3b82f6";

  return (
    <Marker
      coordinate={{
        latitude: cluster.latitude,
        longitude: cluster.longitude,
      }}
      onPress={onPress}
      tracksViewChanges={shouldTrack}
    >
      {cluster.count > 1 ? (
        <View style={[styles.clusterMarker, isSelected && styles.clusterMarkerSelected]}>
          <Text style={[styles.clusterText, { fontFamily: "Inter_700Bold" }]}>{cluster.count}</Text>
        </View>
      ) : (
        <View style={styles.singleMarker}>
          <Svg width={32} height={32} viewBox="0 0 24 24" fill={markerColor}>
            <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <Circle cx="12" cy="10" r="3" fill="#ffffff" />
          </Svg>
        </View>
      )}
    </Marker>
  );
}

export function MapScreen() {
  const theme = useTheme();
  const { navigate } = useNavigation();
  const {
    registerStreamHandler,
    selectedStreamId,
    selectedStreamName,
    setSelectedStreamId,
    setSelectedStreamName,
    openDrawer,
    mapRegion: persistedRegion,
    setMapRegion: persistRegion,
    drawerControl,
  } = useDrawer();
  const { menuItems, userEmail, displayName, avatarUrl, onProfilePress } = useNavigationMenu();
  const { streams } = useStreams();

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

  const { entries: allEntriesFromHook, isLoading, isFetching } = useEntries(entryFilter);

  // Build breadcrumbs for header (matches EntryListScreen style)
  const breadcrumbs = useMemo((): BreadcrumbSegment[] => {
    return [{ id: selectedStreamId || "all", label: selectedStreamName }];
  }, [selectedStreamId, selectedStreamName]);
  const { data: locationsData } = useLocations();

  // Filter entries to only those with GPS coordinates
  const allEntries = useMemo(() => {
    return allEntriesFromHook.filter(
      (entry) => entry.entry_latitude && entry.entry_longitude
    );
  }, [allEntriesFromHook]);

  // Build location name map from locations hook data
  const locationNames = useMemo(() => {
    const nameMap: Record<string, string> = {};
    if (locationsData) {
      locationsData.forEach(loc => {
        nameMap[loc.location_id] = loc.name;
      });
    }
    return nameMap;
  }, [locationsData]);

  // Default region (Kansas City) - used if no persisted region
  const defaultRegion: Region = {
    latitude: 39.0997,
    longitude: -94.5786,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  };

  const [region, setRegion] = useState<Region>(persistedRegion || defaultRegion);
  const [visibleEntries, setVisibleEntries] = useState<Entry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const mapRef = useRef<MapView>(null);
  const listRef = useRef<FlatList<Entry>>(null);
  const regionRef = useRef<Region>(persistedRegion || defaultRegion); // Track region without causing re-renders
  const [isMapReady, setIsMapReady] = useState(false);
  const previousStreamIdRef = useRef<string | null | undefined>(undefined); // Start undefined to detect first load
  const pendingFitRef = useRef(false); // Track if we need to fit when data settles
  const fitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Debounce fit operations

  // entries is now the same as allEntries (filtering already done by hook)
  const entries = allEntries;

  // Register stream selection handler for drawer
  useEffect(() => {
    registerStreamHandler((streamId, streamName) => {
      setSelectedStreamId(streamId);
      setSelectedStreamName(streamName);
    });
    // Cleanup on unmount
    return () => registerStreamHandler(null);
  }, [registerStreamHandler, setSelectedStreamId, setSelectedStreamName]);

  // Fit map to show all entries when stream selection changes or on first load
  useEffect(() => {
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

    // Execute pending fit when: map is ready, data settled (!isFetching), and have entries
    // Using !isFetching ensures we wait for background refetch to complete with correct data
    if (pendingFitRef.current && isMapReady && !isFetching && entries.length > 0 && mapRef.current) {
      pendingFitRef.current = false; // Clear pending flag before fit

      // Small delay to let React settle
      fitTimeoutRef.current = setTimeout(() => {
        const bounds = calculateBounds(entries);
        mapRef.current?.animateToRegion(bounds, 500);
      }, 100);
    }

    return () => {
      if (fitTimeoutRef.current) {
        clearTimeout(fitTimeoutRef.current);
      }
    };
  }, [selectedStreamId, entries, isFetching, isMapReady]);

  // Calculate map bounds to fit all entries
  const calculateBounds = (entries: Entry[]): Region => {
    if (entries.length === 0) {
      return region;
    }

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

    entries.forEach(entry => {
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
  };

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

  // Update visible entries when region changes
  const handleRegionChange = useCallback((newRegion: Region) => {
    // Use ref for comparison to avoid callback recreation
    const prevRegion = regionRef.current;

    // Only update region state if it changed significantly (avoid micro-updates)
    // Use larger threshold to reduce flickering
    const latChanged = Math.abs(newRegion.latitude - prevRegion.latitude) > 0.001;
    const lngChanged = Math.abs(newRegion.longitude - prevRegion.longitude) > 0.001;
    const deltaChanged = Math.abs(newRegion.latitudeDelta - prevRegion.latitudeDelta) > 0.001;

    if (latChanged || lngChanged || deltaChanged) {
      regionRef.current = newRegion;
      setRegion(newRegion);
      // Persist to context so it survives navigation to sub-screens
      persistRegion(newRegion);
    }

    // Filter entries within the visible region
    const visible = entries.filter(entry => {
      const lat = entry.entry_latitude!;
      const lng = entry.entry_longitude!;
      const latDelta = newRegion.latitudeDelta / 2;
      const lngDelta = newRegion.longitudeDelta / 2;

      return (
        lat >= newRegion.latitude - latDelta &&
        lat <= newRegion.latitude + latDelta &&
        lng >= newRegion.longitude - lngDelta &&
        lng <= newRegion.longitude + lngDelta
      );
    });

    // Sort by date (newest first)
    visible.sort((a, b) => {
      const dateA = new Date(a.entry_date || a.created_at).getTime();
      const dateB = new Date(b.entry_date || b.created_at).getTime();
      return dateB - dateA;
    });

    setVisibleEntries(visible);
  }, [entries]); // Remove region from dependencies

  // Recalculate visible entries when entries change (e.g., stream filter changed)
  useEffect(() => {
    const currentRegion = regionRef.current;

    // Filter entries within the visible region
    const visible = entries.filter(entry => {
      const lat = entry.entry_latitude!;
      const lng = entry.entry_longitude!;
      const latDelta = currentRegion.latitudeDelta / 2;
      const lngDelta = currentRegion.longitudeDelta / 2;

      return (
        lat >= currentRegion.latitude - latDelta &&
        lat <= currentRegion.latitude + latDelta &&
        lng >= currentRegion.longitude - lngDelta &&
        lng <= currentRegion.longitude + lngDelta
      );
    });

    // Sort by date (newest first)
    visible.sort((a, b) => {
      const dateA = new Date(a.entry_date || a.created_at).getTime();
      const dateB = new Date(b.entry_date || b.created_at).getTime();
      return dateB - dateA;
    });

    setVisibleEntries(visible);
  }, [entries]);

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
      console.error("Error getting location:", error);
      Alert.alert("Location Error", "Failed to get your current location. Please try again.");
    }
  };

  // Handle cluster/marker press
  const handleClusterPress = (cluster: EntryCluster) => {
    if (cluster.count === 1) {
      // Single entry - select it and scroll to it in the list
      const entry = cluster.entries[0];
      setSelectedEntry(entry);

      // Scroll to entry in list
      const entryIndex = visibleEntries.findIndex(e => e.entry_id === entry.entry_id);
      if (entryIndex >= 0 && listRef.current) {
        listRef.current.scrollToIndex({ index: entryIndex, animated: true, viewPosition: 0.5 });
      }
    } else {
      // Multiple entries - zoom to fit all entries in the cluster
      const bounds = calculateBounds(cluster.entries);

      // Add padding so entries aren't at the edge
      // Use larger deltas to ensure all entries stay visible and don't re-cluster immediately
      const paddingFactor = 1.5;

      // Ensure minimum delta so we don't zoom too far
      const minDelta = 0.01;
      const newLatDelta = Math.max(minDelta, bounds.latitudeDelta * paddingFactor);
      const newLngDelta = Math.max(minDelta, bounds.longitudeDelta * paddingFactor);

      mapRef.current?.animateToRegion({
        latitude: bounds.latitude,
        longitude: bounds.longitude,
        latitudeDelta: newLatDelta,
        longitudeDelta: newLngDelta,
      }, 500);
    }
  };

  // Handle entry item press - show preview on map
  const handleEntryPress = (entry: Entry) => {
    if (!entry.entry_latitude || !entry.entry_longitude) return;

    // Set as selected entry to show red marker
    setSelectedEntry(entry);

    // Zoom to the entry location
    mapRef.current?.animateToRegion({
      latitude: entry.entry_latitude,
      longitude: entry.entry_longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 500);
  };

  // Render entry item in list
  const renderEntryItem = ({ item }: { item: Entry }) => {
    const dateStr = formatRelativeTime(item.entry_date || item.created_at);
    // Get location name from map, or show coordinates if no saved location
    const locationName = item.location_id && locationNames[item.location_id]
      ? locationNames[item.location_id]
      : `${item.entry_latitude?.toFixed(4)}, ${item.entry_longitude?.toFixed(4)}`;
    const isSelected = selectedEntry?.entry_id === item.entry_id;

    return (
      <TouchableOpacity
        style={[
          styles.entryItem,
          { borderBottomColor: theme.colors.border.light },
          isSelected && styles.entryItemSelected,
        ]}
        onPress={() => handleEntryPress(item)}
        onLongPress={() => navigate("capture", { entryId: item.entry_id })}
        activeOpacity={0.7}
      >
        <View style={styles.entryContent}>
          {item.title ? (
            <Text style={[styles.entryTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]} numberOfLines={1}>{item.title}</Text>
          ) : (
            <Text style={[styles.entryPreview, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]} numberOfLines={2}>
              {item.content?.replace(/<[^>]*>/g, '') || "No content"}
            </Text>
          )}
          <View style={styles.entryMeta}>
            <Text style={[styles.entryDate, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>{dateStr}</Text>
            <Text style={[styles.entryLocation, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]} numberOfLines={1}>{locationName}</Text>
          </View>
        </View>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={isSelected ? "#ef4444" : theme.colors.text.tertiary} strokeWidth={2}>
          <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        <TopBar
          onLeftMenuPress={openDrawer}
          breadcrumbs={breadcrumbs}
          onBreadcrumbPress={() => {}}
          badge={0}
          menuItems={menuItems}
          userEmail={userEmail}
          displayName={displayName}
          avatarUrl={avatarUrl}
          onProfilePress={onProfilePress}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.text.tertiary} />
          <Text style={[styles.loadingText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>Loading entries...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <TopBar
        onLeftMenuPress={openDrawer}
        breadcrumbs={breadcrumbs}
        onBreadcrumbPress={() => {}}
        badge={entries.length}
        menuItems={menuItems}
        userEmail={userEmail}
        displayName={displayName}
        avatarUrl={avatarUrl}
        onProfilePress={onProfilePress}
      />

      {/* Map */}
      <View style={styles.mapContainer}>
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
        >
          {clusters.map(cluster => {
            // Check if selected entry is in this cluster
            const isClusterSelected = selectedEntry
              ? cluster.entries.some(e => e.entry_id === selectedEntry.entry_id)
              : false;

            return (
              <ClusterMarker
                key={cluster.id}
                cluster={cluster}
                onPress={() => handleClusterPress(cluster)}
                isSelected={isClusterSelected}
              />
            );
          })}
        </MapView>

        {/* My Location Button */}
        <TouchableOpacity style={[styles.locationButton, { backgroundColor: theme.colors.background.primary }]} onPress={goToCurrentLocation}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
            <Circle cx="12" cy="12" r="10" />
            <Path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </Svg>
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
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
              <Path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        )}
      </View>

      {/* Lower portion with swipe gesture for drawer */}
      <View style={styles.lowerSection} {...drawerPanResponder.panHandlers}>
        {/* Entry count bar */}
        <View style={[styles.countBar, { backgroundColor: theme.colors.background.primary, borderBottomColor: theme.colors.border.light }]}>
          <Text style={[styles.countBarText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
            {visibleEntries.length} {visibleEntries.length === 1 ? "entry" : "entries"} in view
          </Text>
        </View>

        {/* Entry List */}
        {entries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Svg width={64} height={64} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.disabled} strokeWidth={1.5}>
              <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={[styles.emptyText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.semibold }]}>No entries with locations</Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>Add GPS coordinates to your entries to see them on the map</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={visibleEntries}
            renderItem={renderEntryItem}
            keyExtractor={item => item.entry_id}
            style={[styles.entryList, { backgroundColor: theme.colors.background.primary }]}
            contentContainerStyle={styles.entryListContent}
            onScrollToIndexFailed={(info) => {
              // Handle scroll failure gracefully
              setTimeout(() => {
                if (listRef.current && visibleEntries.length > info.index) {
                  listRef.current.scrollToIndex({ index: info.index, animated: true });
                }
              }, 100);
            }}
            ListEmptyComponent={
              <View style={styles.emptyListContainer}>
                <Text style={[styles.emptyListText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>No entries in this area</Text>
                <Text style={[styles.emptyListSubtext, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>Pan or zoom the map to see entries</Text>
              </View>
            }
          />
        )}
      </View>

    </View>
  );
}

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
    height: 300,
    position: "relative",
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
    minWidth: 36,
    height: 36,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  clusterMarkerSelected: {
    backgroundColor: "#ef4444",
  },
  clusterText: {
    color: "#fff",
    fontSize: 14,
    // Note: fontWeight removed - use fontFamily with weight variant instead
  },
  singleMarker: {
    // Container for single marker pin
  },
  countBar: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  countBarText: {
    fontSize: 13,
    // Note: fontWeight removed - use fontFamily with weight variant instead
  },
  entryList: {
    flex: 1,
  },
  entryListContent: {
    paddingBottom: 20,
  },
  entryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  entryItemSelected: {
    backgroundColor: "#fef2f2",
    borderLeftWidth: 3,
    borderLeftColor: "#ef4444",
  },
  entryContent: {
    flex: 1,
    marginRight: 8,
  },
  entryTitle: {
    fontSize: 15,
    // Note: fontWeight removed - use fontFamily with weight variant instead
    marginBottom: 4,
  },
  entryPreview: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20,
  },
  entryMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  entryDate: {
    fontSize: 12,
  },
  entryLocation: {
    fontSize: 12,
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
    // Note: fontWeight removed - use fontFamily with weight variant instead
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  emptyListContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyListText: {
    fontSize: 16,
    // Note: fontWeight removed - use fontFamily with weight variant instead
    marginBottom: 4,
  },
  emptyListSubtext: {
    fontSize: 14,
  },
});
