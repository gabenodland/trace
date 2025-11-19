import { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, TextInput, Keyboard } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import * as Location from "expo-location";
import { useNavigationMenu } from "../../../shared/hooks/useNavigationMenu";
import { TopBar } from "../../../components/layout/TopBar";

// API Keys
const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoibWluZGppZyIsImEiOiJjbWkxMHJhY2QwdGtpMmpweTdkcWU1ZG04In0.egb86fALSKpCYfJIovVAWQ";
const FOURSQUARE_API_KEY = "NSK55D1ZKSEGATIT0Q3RJBJ4BQL4QVT5AHUWL1IFPPY0MJSI";

type TabType = 'lookup' | 'poi' | 'search';

interface MapboxFeature {
  place_name: string;
  place_type: string[];
  text: string;
  properties?: {
    category?: string;
  };
  center?: [number, number];
  context?: Array<{
    id: string;
    text: string;
    short_code?: string;
  }>;
}

interface LocationData {
  latitude: number;
  longitude: number;
  mapboxResponse?: any;
  parsedData?: {
    country?: string;
    region?: string;
    subdivision?: string;
    city?: string;
    district?: string;
    neighborhood?: string;
    street_address?: string;
    postal_code?: string;
  };
}

interface POI {
  name: string;
  category: string;
  address: string;
  distance?: number;
  latitude: number;
  longitude: number;
}

export function LocationBuilderScreen() {
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();
  const [activeTab, setActiveTab] = useState<TabType>('lookup');
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [poiData, setPoiData] = useState<POI[]>([]);
  const [foursquareResponse, setFoursquareResponse] = useState<any>(null);
  const [clickedPoi, setClickedPoi] = useState<any>(null);
  const [poiLoading, setPoiLoading] = useState(false);
  const [region, setRegion] = useState<Region>({
    latitude: 39.0997,
    longitude: -94.5786,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Search tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [autocompleteResults, setAutocompleteResults] = useState<any[]>([]);
  const [autocompleteResponse, setAutocompleteResponse] = useState<any>(null);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard visibility
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Keyboard listeners
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Get user's current location on mount
  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required to show your position");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      setRegion(newRegion);

      // Also reverse geocode current location and fetch POI
      await reverseGeocode(location.coords.latitude, location.coords.longitude);
      await fetchNearbyPOI(location.coords.latitude, location.coords.longitude);
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  // Call Mapbox Geocoding API (reverse geocode)
  const reverseGeocode = async (latitude: number, longitude: number) => {
    setLoading(true);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=country,region,postcode,district,place,locality,neighborhood,address`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const feature = data.features[0] as MapboxFeature;

        // Parse the response into our schema
        const parsed = parseMapboxResponse(data);

        setLocationData({
          latitude,
          longitude,
          mapboxResponse: data,
          parsedData: parsed,
        });
      } else {
        Alert.alert("No Results", "No location data found for these coordinates");
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      Alert.alert("Error", "Failed to fetch location data");
    } finally {
      setLoading(false);
    }
  };

  // Parse Mapbox response to our schema
  const parseMapboxResponse = (response: any) => {
    const parsed: any = {};

    if (!response.features || response.features.length === 0) {
      return parsed;
    }

    const feature = response.features[0];
    const context = feature.context || [];

    // Extract address from main feature
    if (feature.address && feature.text) {
      parsed.street_address = `${feature.address} ${feature.text}`;
    }

    // Parse context array
    context.forEach((item: any) => {
      const type = item.id.split('.')[0];

      switch (type) {
        case 'country':
          parsed.country = item.text;
          break;
        case 'region':
          parsed.region = item.text;
          break;
        case 'district':
          parsed.subdivision = item.text;
          break;
        case 'place':
          parsed.city = item.text;
          break;
        case 'locality':
          parsed.district = item.text;
          break;
        case 'neighborhood':
          parsed.neighborhood = item.text;
          break;
        case 'postcode':
          parsed.postal_code = item.text;
          break;
      }
    });

    return parsed;
  };

  // Fetch nearby POI using Foursquare Places API
  const fetchNearbyPOI = async (latitude: number, longitude: number) => {
    console.log("[POI] Starting Foursquare POI fetch for coordinates:", latitude, longitude);
    setPoiLoading(true);
    try {
      // Foursquare Places API - New endpoint at places-api.foursquare.com
      // sort=DISTANCE ensures closest places come first
      // radius=500 searches within 500 meters (about 1,640 feet)
      const url = `https://places-api.foursquare.com/places/search?ll=${latitude},${longitude}&sort=DISTANCE&radius=500&limit=50`;

      console.log("[POI] Fetching from Foursquare:", url);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${FOURSQUARE_API_KEY}`,
          'X-Places-Api-Version': '2025-06-17',
        },
      });

      const data = await response.json();

      console.log("[POI] Foursquare response status:", response.status);
      console.log("[POI] Foursquare results count:", data.results?.length || 0);

      // Save the full response for debugging
      setFoursquareResponse(data);

      if (data.results && data.results.length > 0) {
        console.log("[POI] First result:", JSON.stringify(data.results[0], null, 2));

        const poiResults: POI[] = data.results.map((place: any) => {
          // Extract category names
          const categoryNames = place.categories?.map((cat: any) => cat.name).join(', ') || 'Unknown';

          // Build address from location data
          const address = place.location?.formatted_address ||
                         `${place.location?.address || ''} ${place.location?.locality || ''}`.trim() ||
                         'Address not available';

          const poi: POI = {
            name: place.name,
            category: categoryNames,
            address: address,
            latitude: place.latitude || 0,
            longitude: place.longitude || 0,
          };

          // Calculate distance from selected location
          if (poi.latitude && poi.longitude) {
            const distance = calculateDistance(latitude, longitude, poi.latitude, poi.longitude);
            poi.distance = distance;
            console.log(`[POI] Added ${poi.name} (${poi.category}) at distance ${distance.toFixed(2)}km`);
          }

          return poi;
        });

        console.log("[POI] Total POI results:", poiResults.length);

        // Sort by distance and take top 25
        const sortedPOI = poiResults
          .sort((a, b) => (a.distance || 0) - (b.distance || 0))
          .slice(0, 25);

        console.log("[POI] Final sorted POI count:", sortedPOI.length);

        setPoiData(sortedPOI);
      } else {
        console.log("[POI] No results from Foursquare");
        setPoiData([]);
      }
    } catch (error) {
      console.error("[POI] POI fetch error:", error);
      Alert.alert("Error", "Failed to fetch nearby POI from Foursquare");
    } finally {
      setPoiLoading(false);
      console.log("[POI] POI fetch completed");
    }
  };

  // Fetch autocomplete results from Foursquare
  const fetchAutocomplete = async (query: string) => {
    if (!query || query.length < 2) {
      console.log("[Autocomplete] Query too short, clearing results");
      setAutocompleteResults([]);
      return;
    }

    console.log("[Autocomplete] ========================================");
    console.log("[Autocomplete] Searching for:", query);

    // Use selected pin location if available, otherwise use map center
    const searchLat = locationData?.latitude ?? region.latitude;
    const searchLon = locationData?.longitude ?? region.longitude;
    console.log("[Autocomplete] Search center:", searchLat, searchLon);
    console.log("[Autocomplete] Using:", locationData ? "selected pin location" : "map center");

    setAutocompleteLoading(true);
    try {
      // Use selected location or region center for location bias
      const url = `https://places-api.foursquare.com/autocomplete?query=${encodeURIComponent(query)}&ll=${searchLat},${searchLon}&radius=50000&limit=10`;

      console.log("[Autocomplete] Full URL:", url);
      console.log("[Autocomplete] Making request...");

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${FOURSQUARE_API_KEY}`,
          'X-Places-Api-Version': '2025-06-17',
        },
      });

      console.log("[Autocomplete] Response status:", response.status);
      console.log("[Autocomplete] Response ok:", response.ok);

      const data = await response.json();

      console.log("[Autocomplete] Full response:", JSON.stringify(data, null, 2));
      console.log("[Autocomplete] Results count:", data.results?.length || 0);

      // Save the full response for debugging
      setAutocompleteResponse(data);

      if (data.results && data.results.length > 0) {
        console.log("[Autocomplete] First result:", JSON.stringify(data.results[0], null, 2));
        setAutocompleteResults(data.results);
      } else {
        console.log("[Autocomplete] No results or empty results array");
        setAutocompleteResults([]);
      }
    } catch (error) {
      console.error("[Autocomplete] Error:", error);
      console.error("[Autocomplete] Error details:", JSON.stringify(error, null, 2));
      Alert.alert("Error", "Failed to fetch autocomplete results");
    } finally {
      setAutocompleteLoading(false);
      console.log("[Autocomplete] ========================================");
    }
  };

  // Handle search input change with debouncing
  const handleSearchChange = (text: string) => {
    console.log("[Search] Text changed:", text);
    setSearchQuery(text);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      console.log("[Search] Clearing existing timeout");
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for autocomplete (300ms delay)
    console.log("[Search] Setting new timeout for autocomplete");
    searchTimeoutRef.current = setTimeout(() => {
      console.log("[Search] Timeout fired, calling fetchAutocomplete");
      fetchAutocomplete(text);
    }, 300);
  };

  // Calculate distance between two coordinates (in km)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Handle map press
  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    console.log("Map pressed at:", latitude, longitude);
    await reverseGeocode(latitude, longitude);
    await fetchNearbyPOI(latitude, longitude);
  };

  // Handle POI marker click (built-in Google Maps POI)
  const handlePoiClick = async (event: any) => {
    const { name, placeId, coordinate } = event.nativeEvent;

    console.log("[POI Click] Clicked on POI:", name);
    console.log("[POI Click] Place ID:", placeId);
    console.log("[POI Click] Coordinate:", coordinate);

    // Save the clicked POI info
    setClickedPoi({
      name,
      placeId,
      coordinate,
      timestamp: new Date().toISOString(),
    });

    // Also fetch location data and nearby POI for this coordinate
    await reverseGeocode(coordinate.latitude, coordinate.longitude);
    await fetchNearbyPOI(coordinate.latitude, coordinate.longitude);
  };

  return (
    <View style={styles.container}>
      <TopBar
        title="Location Builder"
        menuItems={menuItems}
        userEmail={userEmail}
        onProfilePress={onProfilePress}
      />

      {/* Map */}
      <View style={[styles.mapContainer, keyboardVisible && styles.mapContainerSmall]}>
        <MapView
          style={styles.map}
          region={region}
          onPress={handleMapPress}
          onPoiClick={handlePoiClick}
        >
          {/* Show pin for selected location */}
          {locationData && (
            <Marker
              coordinate={{
                latitude: locationData.latitude,
                longitude: locationData.longitude,
              }}
              pinColor="blue"
            />
          )}
        </MapView>

        {/* Get My Location Button */}
        <TouchableOpacity style={styles.locationButton} onPress={requestLocationPermission}>
          <Text style={styles.locationButtonText}>📍</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Menu */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'lookup' && styles.tabActive]}
          onPress={() => setActiveTab('lookup')}
        >
          <Text style={[styles.tabText, activeTab === 'lookup' && styles.tabTextActive]}>
            Lookup
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'poi' && styles.tabActive]}
          onPress={() => setActiveTab('poi')}
        >
          <Text style={[styles.tabText, activeTab === 'poi' && styles.tabTextActive]}>
            Nearby
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'search' && styles.tabActive]}
          onPress={() => setActiveTab('search')}
        >
          <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>
            Search
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      <ScrollView
        style={styles.resultsContainer}
        contentContainerStyle={keyboardVisible ? styles.resultsContainerWithKeyboard : undefined}
      >
        {/* LOCATION LOOKUP TAB */}
        {activeTab === 'lookup' && (
          <>
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Fetching location data...</Text>
              </View>
            )}

            {locationData && !loading && (
              <>
                {/* Coordinates */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Coordinates</Text>
                  <Text style={styles.cardText}>Latitude: {locationData.latitude.toFixed(6)}</Text>
                  <Text style={styles.cardText}>Longitude: {locationData.longitude.toFixed(6)}</Text>
                </View>

                {/* Parsed Data (Our Schema) */}
                {locationData.parsedData && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Parsed Location Data (Our Schema)</Text>
                    {Object.entries(locationData.parsedData).map(([key, value]) => (
                      <View key={key} style={styles.dataRow}>
                        <Text style={styles.dataLabel}>{key}:</Text>
                        <Text style={styles.dataValue}>{value || "(null)"}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Raw Mapbox Response */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Raw Mapbox Response</Text>
                  <ScrollView horizontal>
                    <Text style={styles.jsonText}>
                      {JSON.stringify(locationData.mapboxResponse, null, 2)}
                    </Text>
                  </ScrollView>
                </View>
              </>
            )}

            {!locationData && !loading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>👆 Tap the map to explore location data</Text>
                <Text style={styles.emptyStateSubtext}>Or press 📍 to use your current location</Text>
              </View>
            )}
          </>
        )}

        {/* NEARBY POI TAB */}
        {activeTab === 'poi' && (
          <>
            {/* Clicked POI Info */}
            {clickedPoi && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📍 Clicked POI from Map</Text>
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Name:</Text>
                  <Text style={styles.dataValue}>{clickedPoi.name}</Text>
                </View>
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Place ID:</Text>
                  <Text style={styles.dataValue}>{clickedPoi.placeId}</Text>
                </View>
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Coordinates:</Text>
                  <Text style={styles.dataValue}>
                    {clickedPoi.coordinate.latitude.toFixed(6)}, {clickedPoi.coordinate.longitude.toFixed(6)}
                  </Text>
                </View>
              </View>
            )}

            {poiLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Searching for nearby POI...</Text>
              </View>
            )}

            {poiData.length > 0 && !poiLoading && (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Top {poiData.length} Nearby Places</Text>
                  {poiData.map((poi, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.poiItem}
                      onPress={() => {
                        // Center map on this POI and switch to Lookup tab
                        if (poi.latitude && poi.longitude) {
                          setRegion({
                            latitude: poi.latitude,
                            longitude: poi.longitude,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                          });
                          reverseGeocode(poi.latitude, poi.longitude);
                          setActiveTab('lookup');
                        }
                      }}
                    >
                      <View style={styles.poiHeader}>
                        <Text style={styles.poiName}>
                          {index + 1}. {poi.name}
                        </Text>
                        {poi.distance !== undefined && (
                          <Text style={styles.poiDistance}>
                            {poi.distance < 1
                              ? `${(poi.distance * 1000).toFixed(0)}m`
                              : `${poi.distance.toFixed(2)}km`}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.poiCategory}>📍 {poi.category}</Text>
                      <Text style={styles.poiAddress} numberOfLines={2}>{poi.address}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Foursquare Attribution */}
                <View style={styles.attribution}>
                  <Text style={styles.attributionText}>Powered by Foursquare</Text>
                </View>

                {/* Raw Foursquare Response */}
                {foursquareResponse && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Raw Foursquare Response</Text>
                    <ScrollView horizontal>
                      <Text style={styles.jsonText}>
                        {JSON.stringify(foursquareResponse, null, 2)}
                      </Text>
                    </ScrollView>
                  </View>
                )}
              </>
            )}

            {poiData.length === 0 && !poiLoading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>👆 Tap the map to find nearby POI</Text>
                <Text style={styles.emptyStateSubtext}>Or press 📍 to search around your location</Text>
              </View>
            )}
          </>
        )}

        {/* SEARCH TAB */}
        {activeTab === 'search' && (
          <>
            {/* Search Input */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🔍 Search Places</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Type business name..."
                value={searchQuery}
                onChangeText={handleSearchChange}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              <Text style={styles.searchHint}>
                Start typing to see autocomplete suggestions
              </Text>
            </View>

            {/* Loading */}
            {autocompleteLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            )}

            {/* Autocomplete Results */}
            {autocompleteResults.length > 0 && !autocompleteLoading && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Search Results ({autocompleteResults.filter((r: any) => r.type === 'place').length})</Text>
                {autocompleteResults
                  .filter((result: any) => result.type === 'place') // Only show actual places, not search/geo suggestions
                  .map((result, index) => {
                  // Autocomplete API wraps data in a 'place' object
                  const place = result.place || result;
                  const categoryNames = place.categories?.map((cat: any) => cat.name).join(', ') || 'Unknown';
                  const address = place.location?.formatted_address ||
                                 `${place.location?.address || ''} ${place.location?.locality || ''}`.trim() ||
                                 'Address not available';

                  // Calculate distance from current region center
                  let distance: number | undefined;
                  if (place.latitude && place.longitude) {
                    distance = calculateDistance(region.latitude, region.longitude, place.latitude, place.longitude);
                  }

                  return (
                    <TouchableOpacity
                      key={place.fsq_place_id || index}
                      style={styles.autocompleteItem}
                      onPress={() => {
                        // Show this location on map and fetch nearby POI
                        if (place.latitude && place.longitude) {
                          setRegion({
                            latitude: place.latitude,
                            longitude: place.longitude,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                          });
                          reverseGeocode(place.latitude, place.longitude);
                          fetchNearbyPOI(place.latitude, place.longitude);
                          setActiveTab('poi');
                        }
                      }}
                    >
                      <View style={styles.poiHeader}>
                        <Text style={styles.poiName}>{place.name}</Text>
                        {distance !== undefined && (
                          <Text style={styles.poiDistance}>
                            {distance < 1
                              ? `${(distance * 1000).toFixed(0)}m`
                              : `${distance.toFixed(2)}km`}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.poiCategory}>📍 {categoryNames}</Text>
                      <Text style={styles.poiAddress} numberOfLines={2}>{address}</Text>
                    </TouchableOpacity>
                  );
                })}

                {/* Foursquare Attribution */}
                <View style={styles.attribution}>
                  <Text style={styles.attributionText}>Powered by Foursquare</Text>
                </View>
              </View>
            )}

            {/* Raw Autocomplete Response */}
            {autocompleteResponse && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Raw Foursquare Autocomplete Response</Text>
                <ScrollView horizontal>
                  <Text style={styles.jsonText}>
                    {JSON.stringify(autocompleteResponse, null, 2)}
                  </Text>
                </ScrollView>
              </View>
            )}

            {/* Empty State */}
            {searchQuery.length === 0 && !autocompleteLoading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>🔍 Search for a place</Text>
                <Text style={styles.emptyStateSubtext}>Type the name of a business or location</Text>
              </View>
            )}

            {searchQuery.length > 0 && autocompleteResults.length === 0 && !autocompleteLoading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No results found</Text>
                <Text style={styles.emptyStateSubtext}>Try a different search term</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
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
  mapContainer: {
    height: 300,
    position: "relative",
  },
  mapContainerSmall: {
    height: 150,
  },
  map: {
    flex: 1,
  },
  locationButton: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  locationButtonText: {
    fontSize: 24,
  },
  resultsContainer: {
    flex: 1,
    padding: 16,
  },
  resultsContainerWithKeyboard: {
    paddingBottom: 300,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  dataRow: {
    flexDirection: "row",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    width: 140,
  },
  dataValue: {
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  jsonText: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#333",
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#ccc",
    textAlign: "center",
  },
  poiItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  poiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  poiName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  poiDistance: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3b82f6",
    marginLeft: 8,
  },
  poiCategory: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 4,
  },
  poiAddress: {
    fontSize: 12,
    color: "#9ca3af",
    lineHeight: 16,
  },
  attribution: {
    paddingVertical: 16,
    alignItems: "center",
  },
  attributionText: {
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  searchHint: {
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  autocompleteItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
});
