import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Alert, Modal, ScrollView } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import * as Location from "expo-location";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { useStreams } from "../modules/streams/mobileStreamHooks";
import { TopBar } from "../components/layout/TopBar";
import { localDB } from "../shared/db/localDB";
import { theme } from "../shared/theme/theme";
import Svg, { Path, Circle } from "react-native-svg";
import { formatRelativeTime, type Entry, type Stream } from "@trace/core";

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
          <Text style={styles.clusterText}>{cluster.count}</Text>
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
  const { navigate } = useNavigation();
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();
  const { streams } = useStreams();

  const [allEntries, setAllEntries] = useState<Entry[]>([]); // All entries with GPS
  const [locationNames, setLocationNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Stream filter state
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>("all"); // "all" = show all
  const [showStreamPicker, setShowStreamPicker] = useState(false);
  const [region, setRegion] = useState<Region>({
    latitude: 39.0997,
    longitude: -94.5786,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  });
  const [visibleEntries, setVisibleEntries] = useState<Entry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const mapRef = useRef<MapView>(null);
  const listRef = useRef<FlatList<Entry>>(null);
  const regionRef = useRef<Region>(region); // Track region without causing re-renders

  // Load entries with GPS coordinates
  useEffect(() => {
    const loadEntries = async () => {
      try {
        setIsLoading(true);
        const fetchedEntries = await localDB.getAllEntries();
        // Filter entries that have GPS coordinates
        const entriesWithGPS = fetchedEntries.filter(
          (entry) => entry.entry_latitude && entry.entry_longitude
        );
        setAllEntries(entriesWithGPS);

        // Fetch location names for entries with location_id
        const locationIds = [...new Set(
          entriesWithGPS
            .filter(e => e.location_id)
            .map(e => e.location_id!)
        )];

        if (locationIds.length > 0) {
          const locations = await localDB.getAllLocations();
          const nameMap: Record<string, string> = {};
          locations.forEach(loc => {
            nameMap[loc.location_id] = loc.name;
          });
          setLocationNames(nameMap);
        }

        // If we have entries, center on them
        if (entriesWithGPS.length > 0) {
          const bounds = calculateBounds(entriesWithGPS);
          regionRef.current = bounds;
          setRegion(bounds);
        }
      } catch (error) {
        console.error("Error loading entries for map:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEntries();
  }, []);

  // Filter entries by selected stream (flat - no hierarchy)
  const entries = useMemo(() => {
    if (selectedStreamId === "all") {
      return allEntries;
    }
    if (selectedStreamId === "no-stream") {
      return allEntries.filter(entry => !entry.stream_id);
    }
    // Filter by selected stream
    return allEntries.filter(entry => entry.stream_id === selectedStreamId);
  }, [allEntries, selectedStreamId]);

  // Get selected stream name for display
  const selectedStreamName = useMemo(() => {
    if (selectedStreamId === "all") return "All Streams";
    if (selectedStreamId === "no-stream") return "Unassigned";
    const stream = streams.find(s => s.stream_id === selectedStreamId);
    return stream?.name || "All Streams";
  }, [selectedStreamId, streams]);

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

  // Recalculate visible entries when entries change (e.g., category filter changed)
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
        style={[styles.entryItem, isSelected && styles.entryItemSelected]}
        onPress={() => handleEntryPress(item)}
        onLongPress={() => navigate("capture", { entryId: item.entry_id })}
        activeOpacity={0.7}
      >
        <View style={styles.entryContent}>
          {item.title ? (
            <Text style={styles.entryTitle} numberOfLines={1}>{item.title}</Text>
          ) : (
            <Text style={styles.entryPreview} numberOfLines={2}>
              {item.content?.replace(/<[^>]*>/g, '') || "No content"}
            </Text>
          )}
          <View style={styles.entryMeta}>
            <Text style={styles.entryDate}>{dateStr}</Text>
            <Text style={styles.entryLocation} numberOfLines={1}>{locationName}</Text>
          </View>
        </View>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={isSelected ? "#ef4444" : "#9ca3af"} strokeWidth={2}>
          <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <TopBar
          title="Map"
          menuItems={menuItems}
          userEmail={userEmail}
          onProfilePress={onProfilePress}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.text.tertiary} />
          <Text style={styles.loadingText}>Loading entries...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar
        title="Map"
        badge={entries.length}
        menuItems={menuItems}
        userEmail={userEmail}
        onProfilePress={onProfilePress}
      />

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={region}
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
        <TouchableOpacity style={styles.locationButton} onPress={goToCurrentLocation}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={2}>
            <Circle cx="12" cy="12" r="10" />
            <Path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </Svg>
        </TouchableOpacity>

        {/* Fit All Button */}
        {entries.length > 0 && (
          <TouchableOpacity
            style={styles.fitButton}
            onPress={() => {
              const bounds = calculateBounds(entries);
              mapRef.current?.animateToRegion(bounds, 500);
            }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={2}>
              <Path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        )}
      </View>

      {/* Entry count and stream filter */}
      <View style={styles.countBar}>
        <Text style={styles.countText}>
          {visibleEntries.length} {visibleEntries.length === 1 ? "entry" : "entries"} in view
        </Text>
        <TouchableOpacity
          style={styles.streamFilterButton}
          onPress={() => setShowStreamPicker(true)}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.secondary} strokeWidth={2}>
            <Path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.streamFilterText} numberOfLines={1}>
            {selectedStreamName}
          </Text>
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
            <Path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Entry List */}
      {entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Svg width={64} height={64} viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth={1.5}>
            <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.emptyText}>No entries with locations</Text>
          <Text style={styles.emptySubtext}>Add GPS coordinates to your entries to see them on the map</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={visibleEntries}
          renderItem={renderEntryItem}
          keyExtractor={item => item.entry_id}
          style={styles.entryList}
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
              <Text style={styles.emptyListText}>No entries in this area</Text>
              <Text style={styles.emptyListSubtext}>Pan or zoom the map to see entries</Text>
            </View>
          }
        />
      )}

      {/* Stream Picker Modal */}
      <Modal
        visible={showStreamPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStreamPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStreamPicker(false)}
        >
          <View style={styles.streamPickerContainer}>
            <View style={styles.streamPickerHeader}>
              <Text style={styles.streamPickerTitle}>Filter by Stream</Text>
              <TouchableOpacity onPress={() => setShowStreamPicker(false)}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth={2}>
                  <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.streamPickerList}>
              {/* All Streams option */}
              <TouchableOpacity
                style={[
                  styles.streamPickerItem,
                  selectedStreamId === "all" && styles.streamPickerItemSelected
                ]}
                onPress={() => {
                  setSelectedStreamId("all");
                  setShowStreamPicker(false);
                }}
              >
                <Text style={[
                  styles.streamPickerItemText,
                  selectedStreamId === "all" && styles.streamPickerItemTextSelected
                ]}>
                  All Streams
                </Text>
                {selectedStreamId === "all" && (
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2}>
                    <Path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                )}
              </TouchableOpacity>

              {/* Unassigned option */}
              <TouchableOpacity
                style={[
                  styles.streamPickerItem,
                  selectedStreamId === "no-stream" && styles.streamPickerItemSelected
                ]}
                onPress={() => {
                  setSelectedStreamId("no-stream");
                  setShowStreamPicker(false);
                }}
              >
                <Text style={[
                  styles.streamPickerItemText,
                  selectedStreamId === "no-stream" && styles.streamPickerItemTextSelected
                ]}>
                  Unassigned
                </Text>
                {selectedStreamId === "no-stream" && (
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2}>
                    <Path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                )}
              </TouchableOpacity>

              {/* Separator */}
              <View style={styles.streamPickerSeparator} />

              {/* Stream list */}
              {streams.map(stream => (
                <TouchableOpacity
                  key={stream.stream_id}
                  style={[
                    styles.streamPickerItem,
                    selectedStreamId === stream.stream_id && styles.streamPickerItemSelected
                  ]}
                  onPress={() => {
                    setSelectedStreamId(stream.stream_id);
                    setShowStreamPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.streamPickerItemText,
                      selectedStreamId === stream.stream_id && styles.streamPickerItemTextSelected
                    ]}
                    numberOfLines={1}
                  >
                    {stream.name}
                  </Text>
                  {selectedStreamId === stream.stream_id && (
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2}>
                      <Path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.colors.text.tertiary,
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
    backgroundColor: "#fff",
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
    backgroundColor: "#fff",
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
    fontWeight: "bold",
  },
  singleMarker: {
    // Container for single marker pin
  },
  countBar: {
    backgroundColor: theme.colors.background.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  countText: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
    fontWeight: "500",
  },
  streamFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: theme.colors.background.secondary,
  },
  streamFilterText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    fontWeight: "500",
    maxWidth: 120,
  },
  entryList: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
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
    borderBottomColor: theme.colors.border.light,
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
    fontWeight: "600",
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  entryPreview: {
    fontSize: 14,
    color: theme.colors.text.secondary,
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
    color: theme.colors.text.tertiary,
  },
  entryLocation: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
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
    fontWeight: "600",
    color: "#9ca3af",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
  emptyListContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyListText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#9ca3af",
    marginBottom: 4,
  },
  emptyListSubtext: {
    fontSize: 14,
    color: "#9ca3af",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  streamPickerContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "100%",
    maxWidth: 400,
    maxHeight: "70%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  streamPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  streamPickerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.colors.text.primary,
  },
  streamPickerList: {
    maxHeight: 400,
  },
  streamPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  streamPickerItemSelected: {
    backgroundColor: "#f0f9ff",
  },
  streamPickerItemText: {
    fontSize: 15,
    color: theme.colors.text.primary,
    flex: 1,
  },
  streamPickerItemTextSelected: {
    color: "#3b82f6",
    fontWeight: "500",
  },
  streamPickerSeparator: {
    height: 8,
    backgroundColor: theme.colors.background.secondary,
  },
});
