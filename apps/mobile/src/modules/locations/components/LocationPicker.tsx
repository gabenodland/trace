/**
 * LocationPicker Component
 *
 * Full-screen modal with single view: Map on top, switchable content below
 * - Default: Shows POI list (Map Location + nearby POIs)
 * - After selection: Shows Location Info panel with OK button
 * - Tap map to return to POI list view
 *
 * REFACTORED: Uses unified state architecture with LocationSelection, LocationPickerUI, and MapState
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Modal, SafeAreaView } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import * as Location from 'expo-location';
import { useReverseGeocode, useNearbyPOIs, useLocationAutocomplete, type POIItem, type Location as LocationType, calculateDistance, formatDistance } from '@trace/core';
import { theme } from '../../../shared/theme/theme';
import Svg, { Path, Circle } from 'react-native-svg';
import {
  type LocationSelection,
  type LocationPickerUI,
  type MapState,
  type PrivacyLevel,
  type PrivacyLevelCoords,
  createEmptySelection,
  createSelectionFromLocation,
  createSelectionFromPOI,
  createSelectionFromMapTap,
  extractPrivacyLevelCoords,
} from '../types/LocationPickerTypes';

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: LocationType | null) => void;
  initialLocation?: LocationType | null;
}

export function LocationPicker({ visible, onClose, onSelect, initialLocation }: LocationPickerProps) {
  // UNIFIED STATE ARCHITECTURE
  // 1. Selection state - SINGLE SOURCE OF TRUTH for what user has chosen
  const [selection, setSelection] = useState<LocationSelection>(createEmptySelection());

  // 2. UI state - View mode and input fields
  const [ui, setUI] = useState<LocationPickerUI>({
    showingDetails: !!initialLocation, // Start in details mode if initialLocation provided
    searchQuery: '',
    editableNameInput: '',
  });

  // 3. Map state - Separate from selection (map can pan independently)
  const [mapState, setMapState] = useState<MapState>({
    region: initialLocation ? {
      latitude: initialLocation.latitude,
      longitude: initialLocation.longitude,
      latitudeDelta: 0.005,  // Street level zoom (~0.25 miles)
      longitudeDelta: 0.005,
    } : undefined,
    markerPosition: initialLocation ? {
      latitude: initialLocation.latitude,
      longitude: initialLocation.longitude,
    } : undefined,
  });

  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // State for triggering reverse geocoding
  const [reverseGeocodeRequest, setReverseGeocodeRequest] = useState<{ latitude: number; longitude: number } | null>(null);

  // Ref to MapView for programmatic control
  const mapRef = useRef<MapView>(null);

  // Initialize when picker opens
  useEffect(() => {
    if (visible) {
      console.log('[LocationPicker] 📍 Picker opened');
      console.log('[LocationPicker] Initial location:', initialLocation);

      // Reset to clean state
      if (initialLocation) {
        // If entry has GPS but no location name, show POI list to let user select
        const hasLocationName = !!initialLocation.name;

        console.log('[LocationPicker] Initial location:', {
          hasName: hasLocationName,
          name: initialLocation.name,
          coords: `${initialLocation.latitude}, ${initialLocation.longitude}`
        });

        const newSelection = createSelectionFromLocation(initialLocation);
        setSelection(newSelection);

        setUI(prev => ({
          ...prev,
          showingDetails: hasLocationName, // Only show details if location has a name
          editableNameInput: initialLocation.name || '',
        }));

        // Set map to GPS coordinates
        setMapState({
          region: {
            latitude: initialLocation.originalLatitude || initialLocation.latitude,
            longitude: initialLocation.originalLongitude || initialLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          markerPosition: {
            latitude: initialLocation.originalLatitude || initialLocation.latitude,
            longitude: initialLocation.originalLongitude || initialLocation.longitude,
          },
        });

        // Always trigger reverse geocoding to fetch Mapbox data for privacy levels
        console.log('[LocationPicker] Triggering reverse geocoding for GPS coordinates');
        setReverseGeocodeRequest({
          latitude: initialLocation.originalLatitude || initialLocation.latitude,
          longitude: initialLocation.originalLongitude || initialLocation.longitude,
        });
        setSelection(prev => ({ ...prev, isLoadingDetails: true }));
      } else {
        // Start fresh
        setSelection(createEmptySelection());
        setUI({
          showingDetails: false,
          searchQuery: '',
          editableNameInput: '',
        });
        // Reset map state to trigger GPS fetch
        setMapState({
          region: undefined,
          markerPosition: undefined,
        });
      }
    }
  }, [visible]);

  // Sync editable name input with selection location name
  useEffect(() => {
    if (selection.location?.name && ui.editableNameInput !== selection.location.name) {
      setUI(prev => ({
        ...prev,
        editableNameInput: selection.location!.name || '',
      }));
    }
  }, [selection.location?.name]);

  // Fetch current GPS location when picker opens
  useEffect(() => {
    console.log('[LocationPicker] 🔍 GPS Fetch Check:', {
      visible,
      hasInitialLocation: !!initialLocation,
      hasMapRegion: !!mapState.region,
      shouldFetchGPS: visible && !initialLocation && !mapState.region
    });

    if (visible && !initialLocation && !mapState.region) {
      console.log('[LocationPicker] 📍 Starting GPS fetch...');
      setIsLoadingLocation(true);

      const fetchCurrentLocation = async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            // Try to get last known position first (instant)
            let location = await Location.getLastKnownPositionAsync();

            // If no cached location, get current position with low accuracy (faster)
            if (!location) {
              location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Low,
              });
            }

            if (location) {
              const coords = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              };
              setMapState({
                region: {
                  ...coords,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                },
                markerPosition: coords,
              });
            }
          }
        } catch (error) {
          console.error('Error fetching location:', error);
        } finally {
          setIsLoadingLocation(false);
        }
      };

      fetchCurrentLocation();
    }
  }, [visible, initialLocation, mapState.region]);

  // Calculate dynamic search radius based on map width
  const calculateSearchRadius = (region: MapState['region']): number => {
    if (!region) return 500; // Default fallback

    // Calculate approximate width of visible map in meters
    // 1 degree of longitude ≈ 111,320 meters * cos(latitude)
    const latitude = region.latitude;
    const longitudeDelta = region.longitudeDelta;

    // Width in meters (approximate)
    const metersPerDegreeLon = 111320 * Math.cos(latitude * Math.PI / 180);
    const mapWidthMeters = longitudeDelta * metersPerDegreeLon;

    // Use half the map width as search radius (so we search the entire visible area)
    const radius = Math.round(mapWidthMeters / 2);

    // Clamp between 100m and 5000m for reasonable results
    return Math.max(100, Math.min(5000, radius));
  };

  // Fetch nearby POIs for list view (only when NOT searching and NOT showing details)
  const nearbyRequest = useMemo(() => {
    if (ui.showingDetails || !mapState.markerPosition || ui.searchQuery.length > 0) {
      return null;
    }

    const radius = calculateSearchRadius(mapState.region);
    console.log('[LocationPicker] 📏 Dynamic search radius calculated:', radius, 'meters');

    return {
      latitude: mapState.markerPosition.latitude,
      longitude: mapState.markerPosition.longitude,
      radius,
      limit: 20
    };
  }, [ui.showingDetails, mapState.markerPosition?.latitude, mapState.markerPosition?.longitude, mapState.region?.longitudeDelta, mapState.region?.latitude, ui.searchQuery.length]);

  const { data: nearbyPOIs, isLoading: nearbyLoading } = useNearbyPOIs(nearbyRequest);

  // Fetch autocomplete results for list view (when searching)
  const searchRequest = useMemo(() => {
    return !ui.showingDetails && ui.searchQuery.length >= 2 && mapState.region
      ? { query: ui.searchQuery, latitude: mapState.region.latitude, longitude: mapState.region.longitude }
      : null;
  }, [ui.showingDetails, ui.searchQuery, mapState.region?.latitude, mapState.region?.longitude]);

  const { data: searchResults, isLoading: searchLoading } = useLocationAutocomplete(searchRequest);

  // Fetch reverse geocode data when coordinates change
  const { data: mapboxData, isLoading: mapboxLoading } = useReverseGeocode(reverseGeocodeRequest);

  // Extract privacy level coordinates from Mapbox response
  const privacyLevelCoords = useMemo(() => {
    if (!selection.location) return new Map<PrivacyLevel, PrivacyLevelCoords>();

    const mapboxJson = (selection.location as any).mapboxJson;
    console.log('[LocationPicker] 🔍 Extracting privacy level coords from mapboxJson:', !!mapboxJson);
    console.log('[LocationPicker] 🔍 mapboxJson features count:', mapboxJson?.features?.length);

    return extractPrivacyLevelCoords(
      mapboxJson,
      { latitude: selection.location.latitude, longitude: selection.location.longitude }
    );
  }, [(selection.location as any)?.mapboxJson, selection.location?.latitude, selection.location?.longitude]);

  // Parse Mapbox response to extract location hierarchy
  const parseMapboxResponse = (response: any) => {
    const parsed: any = {};

    if (!response || !response.features || response.features.length === 0) {
      return parsed;
    }

    const feature = response.features[0];
    const context = feature.context || [];

    // Extract address from main feature
    if (feature.address && feature.text) {
      parsed.street_address = `${feature.address} ${feature.text}`;
    } else if (feature.place_name) {
      parsed.street_address = feature.place_name.split(',')[0];
    }

    // Parse context array for hierarchy
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

  // SINGLE SOURCE OF TRUTH: Update selection with Mapbox data when it arrives
  useEffect(() => {
    // Only process if we're waiting for Mapbox data and it has arrived
    if (selection.isLoadingDetails && mapboxData && !mapboxLoading && selection.location) {
      console.log('[LocationPicker] ✅ Enriching selection with Mapbox data');
      console.log('[LocationPicker] 🔍 Raw Mapbox response:', JSON.stringify(mapboxData, null, 2));

      const parsed = parseMapboxResponse(mapboxData);
      console.log('[LocationPicker] 🔍 Parsed Mapbox data:', parsed);

      // Merge current location with Mapbox hierarchy data
      const enrichedLocation: LocationType = {
        ...selection.location,
        address: parsed.street_address || selection.location.address || null,
        city: parsed.city || selection.location.city || null,
        region: parsed.region || selection.location.region || null,
        country: parsed.country || selection.location.country || null,
        postalCode: parsed.postal_code || selection.location.postalCode || null,
        neighborhood: parsed.neighborhood || selection.location.neighborhood || null,
        subdivision: parsed.subdivision || selection.location.subdivision || null,
      };

      // Store mapboxJson for privacy level selection (temporary, not saved to entry)
      (enrichedLocation as any).mapboxJson = mapboxData;

      // For map tap, update name if it's still null
      if (selection.type === 'map_tap' && !enrichedLocation.name) {
        enrichedLocation.name = parsed.street_address || 'Unknown location';
      }

      console.log('[LocationPicker] 📍 Enriched location:', {
        name: enrichedLocation.name,
        city: enrichedLocation.city,
        region: enrichedLocation.region,
        country: enrichedLocation.country,
      });

      // Update selection with enriched data
      setSelection(prev => ({
        ...prev,
        location: enrichedLocation,
        isLoadingDetails: false,
      }));

      // Update editableNameInput to match the enriched location name
      // This ensures the UI stays in sync with the selection
      if (enrichedLocation.name && !ui.editableNameInput) {
        setUI(prev => ({ ...prev, editableNameInput: enrichedLocation.name || '' }));
      }

      // Note: Navigation to details tab is handled explicitly by user clicking list items
      // Map taps should NOT auto-navigate - they just add to the list
    }
  }, [selection.isLoadingDetails, mapboxData, mapboxLoading, selection.type, ui.editableNameInput]);

  // Handler: POI selected from list
  const handlePOISelect = (poi: POIItem) => {
    console.log('[LocationPicker] POI selected from list:', poi.name);

    const coords = {
      latitude: poi.latitude,
      longitude: poi.longitude,
    };

    // Update map state to center on the selected POI
    setMapState(prev => ({
      region: {
        ...coords,
        latitudeDelta: prev.region?.latitudeDelta || 0.005, // Street level zoom
        longitudeDelta: prev.region?.longitudeDelta || 0.005,
      },
      markerPosition: coords,
    }));

    // Animate map to center on the POI
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        ...coords,
        latitudeDelta: mapState.region?.latitudeDelta || 0.005,
        longitudeDelta: mapState.region?.longitudeDelta || 0.005,
      }, 300);
    }

    const newSelection = createSelectionFromPOI(poi);
    setSelection(newSelection);

    // Show details panel
    setUI(prev => ({
      ...prev,
      showingDetails: true,
      editableNameInput: poi.name,
    }));

    // Trigger reverse geocoding for complete hierarchy
    setReverseGeocodeRequest({ latitude: poi.latitude, longitude: poi.longitude });
  };

  // Handler: Google POI clicked on map
  const handleGooglePOIClick = (event: any) => {
    const { name, placeId, coordinate } = event.nativeEvent;
    console.log('[LocationPicker] Google POI clicked:', name, 'at', coordinate);

    // Update marker position on map
    setMapState(prev => ({
      ...prev,
      markerPosition: {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      },
    }));

    const googlePOI: POIItem = {
      id: placeId,
      source: 'google',
      name: name,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    };

    const newSelection = createSelectionFromPOI(googlePOI);
    setSelection(newSelection);

    // If currently showing details, switch back to nearby/search view
    // to show the new selection in the list
    if (ui.showingDetails) {
      console.log('[LocationPicker] Google POI clicked - returning to list view');
      setUI(prev => ({
        ...prev,
        showingDetails: false,
        editableNameInput: name, // Set the name for when they click to view details again
      }));
    }

    // Trigger reverse geocoding
    setReverseGeocodeRequest({ latitude: coordinate.latitude, longitude: coordinate.longitude });
  };

  // Handler: Map region changed (zoom/pan)
  const handleRegionChangeComplete = (region: any) => {
    // Only update if region changed significantly (to prevent infinite loops)
    const hasSignificantChange = !mapState.region ||
      Math.abs(region.latitudeDelta - mapState.region.latitudeDelta) > 0.0001 ||
      Math.abs(region.longitude - mapState.region.longitude) > 0.001 ||
      Math.abs(region.latitude - mapState.region.latitude) > 0.001;

    if (!hasSignificantChange) {
      return; // Ignore tiny changes
    }

    console.log('[LocationPicker] Map region changed:', {
      lat: region.latitude.toFixed(6),
      lon: region.longitude.toFixed(6),
      zoom: region.latitudeDelta.toFixed(6),
    });

    // Update region state (this will trigger new POI search with updated radius)
    // IMPORTANT: Don't move the marker - keep it at the user's selected point
    setMapState(prev => ({
      ...prev,
      region: {
        latitude: region.latitude,
        longitude: region.longitude,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      },
      // Keep marker at its current position (don't move it with map pan/zoom)
    }));
  };

  // Handler: Map tapped (user selecting coordinates)
  const handleMapPress = (event: any) => {
    const { coordinate } = event.nativeEvent;
    console.log('[LocationPicker] Map tapped at:', coordinate);

    // Check if user has actually edited the name (different from original selection name)
    const hasCustomName = ui.editableNameInput &&
      selection.location &&
      ui.editableNameInput !== selection.location.name;

    // If showing details with custom name, update coordinates but preserve the custom name
    if (ui.showingDetails && hasCustomName) {
      console.log('[LocationPicker] Updating coordinates while preserving custom name:', ui.editableNameInput);

      const coords = {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      };

      // Update map state (move marker)
      setMapState(prev => ({
        region: {
          ...coords,
          latitudeDelta: prev.region?.latitudeDelta || 0.01,
          longitudeDelta: prev.region?.longitudeDelta || 0.01,
        },
        markerPosition: coords,
      }));

      // Update selection with new coordinates but preserve custom name
      setSelection(prev => ({
        ...prev,
        location: prev.location ? {
          ...prev.location,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
        } : null,
        tempCoordinates: { latitude: coordinate.latitude, longitude: coordinate.longitude },
        isLoadingDetails: true,
      }));

      // Trigger reverse geocoding to get updated hierarchy data
      setReverseGeocodeRequest({ latitude: coordinate.latitude, longitude: coordinate.longitude });
      return;
    }

    // If showing details without custom name, return to list view
    if (ui.showingDetails) {
      console.log('[LocationPicker] Map tapped - returning to list view');
      setUI(prev => ({ ...prev, showingDetails: false }));
      return;
    }

    // Otherwise, handle as new location selection
    const coords = {
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    };

    // Update map state (move marker)
    setMapState(prev => ({
      region: {
        ...coords,
        latitudeDelta: prev.region?.latitudeDelta || 0.01,
        longitudeDelta: prev.region?.longitudeDelta || 0.01,
      },
      markerPosition: coords,
    }));

    // Create selection from map tap
    const newSelection = createSelectionFromMapTap(coordinate.latitude, coordinate.longitude);
    setSelection(newSelection);

    // Trigger reverse geocoding
    setReverseGeocodeRequest({ latitude: coordinate.latitude, longitude: coordinate.longitude });
  };

  // Handler: Privacy level selection
  const handlePrivacyLevelChange = (level: PrivacyLevel) => {
    console.log('[LocationPicker] Privacy level changed to:', level);

    setSelection(prev => ({
      ...prev,
      privacyLevel: level,
    }));

    // Get coordinates for this privacy level
    const coords = privacyLevelCoords.get(level);
    if (coords && mapRef.current) {
      // Determine appropriate zoom level based on privacy level
      // latitudeDelta/longitudeDelta control zoom (smaller = more zoomed in)
      let latitudeDelta: number;
      let longitudeDelta: number;

      switch (level) {
        case 'exact':
          latitudeDelta = 0.005; // Very zoomed in
          longitudeDelta = 0.005;
          break;
        case 'address':
          latitudeDelta = 0.01; // Zoomed in to street level
          longitudeDelta = 0.01;
          break;
        case 'postal_code':
          latitudeDelta = 0.02; // Postal code area
          longitudeDelta = 0.02;
          break;
        case 'neighborhood':
          latitudeDelta = 0.05; // Neighborhood area
          longitudeDelta = 0.05;
          break;
        case 'city':
          latitudeDelta = 0.15; // City-wide view
          longitudeDelta = 0.15;
          break;
        case 'subdivision':
          latitudeDelta = 0.5; // County/subdivision view
          longitudeDelta = 0.5;
          break;
        case 'region':
          latitudeDelta = 1.5; // State/province view
          longitudeDelta = 1.5;
          break;
        case 'country':
          latitudeDelta = 10; // Country-wide view
          longitudeDelta = 10;
          break;
        default:
          latitudeDelta = 0.01;
          longitudeDelta = 0.01;
      }

      // Update map to show the selected privacy level's coordinates with appropriate zoom
      mapRef.current.animateToRegion({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta,
        longitudeDelta,
      }, 300);

      // Update marker position
      setMapState(prev => ({
        ...prev,
        markerPosition: {
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
        region: {
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta,
          longitudeDelta,
        },
      }));

      // Update the editable name to the privacy level's label (e.g., "Kansas City")
      if (level !== 'exact') {
        setUI(prev => ({ ...prev, editableNameInput: coords.label }));
      }
    }
  };

  // Handler: OK button in Details tab
  const handleOKPress = () => {
    if (selection.location) {
      console.log('[LocationPicker] 🚀 OK pressed, selecting location:', selection.location.name);
      console.log('[LocationPicker] Privacy level:', selection.privacyLevel);

      // If user selected "None", clear all location data
      if (selection.privacyLevel === 'none') {
        console.log('[LocationPicker] Privacy level is "none" - clearing all location data');
        onSelect(null);
        onClose();
        return;
      }

      // Get the exact GPS coordinates (for entry_latitude/entry_longitude)
      const exactCoords = privacyLevelCoords.get('exact');

      // Get the coordinates for the selected privacy level (for location_latitude/location_longitude)
      const coords = privacyLevelCoords.get(selection.privacyLevel);
      const latitude = coords?.latitude ?? selection.location.latitude;
      const longitude = coords?.longitude ?? selection.location.longitude;

      // Build location object with only data up to selected privacy level
      // More specific levels than selected should NOT be saved
      // Privacy level hierarchy (from most specific to least):
      // exact -> address -> postal_code -> neighborhood -> city -> subdivision -> region -> country

      // Define hierarchy order (0 = most specific, 8 = least specific)
      const hierarchyOrder: Record<PrivacyLevel, number> = {
        none: 8,
        exact: 0,
        address: 1,
        postal_code: 2,
        neighborhood: 3,
        city: 4,
        subdivision: 5,
        region: 6,
        country: 7,
      };

      const selectedLevel = hierarchyOrder[selection.privacyLevel];

      const finalLocation: LocationType = {
        // Privacy-respecting coordinates (for public display)
        latitude,
        longitude,
        // Original exact GPS coordinates (for entry_latitude/entry_longitude)
        originalLatitude: exactCoords?.latitude ?? selection.location.latitude,
        originalLongitude: exactCoords?.longitude ?? selection.location.longitude,
        name: ui.editableNameInput || selection.location.name || null,
        source: selection.location.source,
        // Save the selected privacy level
        privacyLevel: selection.privacyLevel,
        // Only include data for selected level and LESS specific levels (higher numbers)
        address: selectedLevel <= hierarchyOrder.address ? selection.location.address : null,
        postalCode: selectedLevel <= hierarchyOrder.postal_code ? selection.location.postalCode : null,
        neighborhood: selectedLevel <= hierarchyOrder.neighborhood ? selection.location.neighborhood : null,
        city: selectedLevel <= hierarchyOrder.city ? selection.location.city : null,
        subdivision: selectedLevel <= hierarchyOrder.subdivision ? selection.location.subdivision : null,
        region: selectedLevel <= hierarchyOrder.region ? selection.location.region : null,
        country: selectedLevel <= hierarchyOrder.country ? selection.location.country : null,
        category: selection.location.category,
        distance: selection.location.distance,
      };

      console.log('[LocationPicker] Final location with privacy level applied:', finalLocation);
      console.log('[LocationPicker] 📍 Original GPS:', exactCoords?.latitude, exactCoords?.longitude);
      console.log('[LocationPicker] 🔒 Privacy coords:', latitude, longitude);

      onSelect(finalLocation);
      onClose();
    }
  };

  // Determine which POIs to show in map tab
  const displayedPOIs = ui.searchQuery.length >= 2 ? searchResults : nearbyPOIs;
  const displayedLoading = ui.searchQuery.length >= 2 ? searchLoading : nearbyLoading;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Location</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
              <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        </View>

      {/* Main Content - No Tabs */}
      <View style={styles.content}>
        {/* Map - Always visible */}
        {mapState.region && (
          <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={mapState.region}
              onPress={handleMapPress}
              onRegionChangeComplete={handleRegionChangeComplete}
              showsUserLocation
              showsMyLocationButton
              onPoiClick={handleGooglePOIClick}
            >
              {/* Selected Location Marker - only show for exact and address levels */}
              {mapState.markerPosition &&
               (selection.privacyLevel === 'exact' || selection.privacyLevel === 'address') && (
                <Marker
                  coordinate={mapState.markerPosition}
                  pinColor="blue"
                  title="Selected Location"
                />
              )}

              {/* Bounding Box Polygon - show for postal_code through country levels */}
              {mapState.markerPosition &&
               selection.privacyLevel !== 'exact' &&
               selection.privacyLevel !== 'address' &&
               (selection.location as any)?.mapboxJson && (
                (() => {
                  // Extract bounding box from Mapbox response
                  const mapboxResponse = (selection.location as any).mapboxJson;
                  if (!mapboxResponse?.features?.[0]?.bbox) return null;

                  const bbox = mapboxResponse.features[0].bbox;
                  // bbox format: [minLon, minLat, maxLon, maxLat]
                  const coordinates = [
                    { latitude: bbox[1], longitude: bbox[0] }, // SW
                    { latitude: bbox[1], longitude: bbox[2] }, // SE
                    { latitude: bbox[3], longitude: bbox[2] }, // NE
                    { latitude: bbox[3], longitude: bbox[0] }, // NW
                  ];

                  return (
                    <Polygon
                      coordinates={coordinates}
                      strokeColor="rgba(66, 133, 244, 0.8)"
                      fillColor="rgba(66, 133, 244, 0.2)"
                      strokeWidth={2}
                    />
                  );
                })()
              )}
            </MapView>
        )}

        {/* Switchable Content Below Map */}
        {!ui.showingDetails ? (
          /* POI List View */
          <View style={styles.listContainer}>
            {/* Search Input */}
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a place..."
              value={ui.searchQuery}
              onChangeText={(text) => setUI(prev => ({ ...prev, searchQuery: text }))}
              clearButtonMode="while-editing"
            />

            {/* Results List - shows nearby by default, search results when typing */}
            <ScrollView style={styles.poiList} contentContainerStyle={styles.poiListContent}>
              <Text style={styles.listTitle}>
                {ui.searchQuery.length >= 2 ? 'Search Results' : 'Nearby Places'}
              </Text>
              {displayedLoading && <ActivityIndicator style={styles.loader} />}

              {/* Map Location - Always at top, shows current selection */}
              {(selection.location || mapState.markerPosition) && (() => {
                // Check if map has moved away from Map Location
                const mapLocationCoords = selection.location
                  ? { latitude: selection.location.latitude, longitude: selection.location.longitude }
                  : mapState.markerPosition;

                const isMapOffCenter = mapState.region && mapLocationCoords && (
                  Math.abs(mapState.region.latitude - mapLocationCoords.latitude) > 0.0001 ||
                  Math.abs(mapState.region.longitude - mapLocationCoords.longitude) > 0.0001
                );

                const handleShowOnMap = () => {
                  if (mapLocationCoords && mapState.region && mapRef.current) {
                    const newRegion = {
                      latitude: mapLocationCoords.latitude,
                      longitude: mapLocationCoords.longitude,
                      latitudeDelta: mapState.region.latitudeDelta,
                      longitudeDelta: mapState.region.longitudeDelta,
                    };

                    // Animate the map to the new region
                    mapRef.current.animateToRegion(newRegion, 300);

                    // Update state to keep in sync
                    setMapState(prev => ({
                      ...prev,
                      region: newRegion,
                    }));
                  }
                };

                const handleMapLocationPress = () => {
                  // Center map on the Map Location
                  if (mapLocationCoords && mapRef.current) {
                    mapRef.current.animateToRegion({
                      latitude: mapLocationCoords.latitude,
                      longitude: mapLocationCoords.longitude,
                      latitudeDelta: mapState.region?.latitudeDelta || 0.005,
                      longitudeDelta: mapState.region?.longitudeDelta || 0.005,
                    }, 300);

                    // Update state to keep in sync
                    setMapState(prev => ({
                      ...prev,
                      region: {
                        latitude: mapLocationCoords.latitude,
                        longitude: mapLocationCoords.longitude,
                        latitudeDelta: prev.region?.latitudeDelta || 0.005,
                        longitudeDelta: prev.region?.longitudeDelta || 0.005,
                      },
                    }));
                  }

                  // Show details panel
                  setUI(prev => ({ ...prev, showingDetails: true }));
                };

                return (
                  <TouchableOpacity
                    style={[styles.poiItem, styles.mapLocationItem]}
                    onPress={handleMapLocationPress}
                  >
                    <View style={styles.poiInfo}>
                      <Text style={styles.poiName}>
                        {selection.location?.name || 'Map Location'}
                      </Text>
                      <Text style={styles.poiCategory}>
                        {selection.isLoadingDetails ? 'Loading address...' :
                         selection.location?.address || 'Tap to set name'}
                      </Text>
                    </View>
                    {isMapOffCenter ? (
                      <TouchableOpacity onPress={handleShowOnMap} style={styles.showOnMapButton}>
                        <Text style={styles.showOnMapText}>Show on map</Text>
                      </TouchableOpacity>
                    ) : (
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
                        <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                        <Circle cx={12} cy={10} r={3} fill={theme.colors.text.primary} />
                      </Svg>
                    )}
                  </TouchableOpacity>
                );
              })()}

              {/* POI List */}
              {displayedPOIs && displayedPOIs.length > 0 && !displayedLoading ? (
                (() => {
                  // Calculate distance for each POI if searching
                  const poisWithDistance = ui.searchQuery.length >= 2 && mapState.region
                    ? displayedPOIs.map(poi => {
                        const distance = calculateDistance(
                          { latitude: mapState.region!.latitude, longitude: mapState.region!.longitude },
                          { latitude: poi.latitude, longitude: poi.longitude }
                        );
                        return { ...poi, distanceMeters: distance.meters };
                      }).sort((a, b) => a.distanceMeters - b.distanceMeters)
                    : displayedPOIs;

                  return (
                    <>
                      {poisWithDistance.map((poi, index) => (
                        <TouchableOpacity
                          key={poi.id}
                          style={styles.poiItem}
                          onPress={() => handlePOISelect(poi)}
                        >
                          <View style={styles.poiInfo}>
                            <Text style={styles.poiName}>
                              {ui.searchQuery.length < 2 && `${index + 1}. `}{poi.name}
                            </Text>
                            {poi.category && typeof poi.category === 'string' && (
                              <View style={styles.poiCategoryContainer}>
                                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                                  <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                                  <Circle cx={12} cy={10} r={3} fill={theme.colors.text.tertiary} />
                                </Svg>
                                <Text style={styles.poiCategory}>{poi.category}</Text>
                              </View>
                            )}
                            {poi.address && typeof poi.address === 'string' && (
                              <Text style={styles.poiAddress}>{poi.address}</Text>
                            )}
                          </View>
                          {typeof poi.distance === 'number' && !isNaN(poi.distance) ? (
                            <Text style={styles.poiDistance}>
                              {poi.distance < 1000
                                ? `${Math.round(poi.distance)}m`
                                : `${(poi.distance / 1000).toFixed(1)}km`}
                            </Text>
                          ) : 'distanceMeters' in poi ? (
                            <Text style={styles.poiDistance}>
                              {formatDistance((poi as any).distanceMeters)}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      ))}
                    </>
                  );
                })()
              ) : !displayedLoading && (!displayedPOIs || displayedPOIs.length === 0) && !selection.location ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    {ui.searchQuery.length >= 2 ? 'No results found' : 'No nearby places found'}
                  </Text>
                  <Text style={styles.emptyStateSubtext}>
                    {ui.searchQuery.length >= 2
                      ? 'Try a different search term'
                      : 'Try moving the map or tap a location on the map'}
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        ) : (
          /* Location Details View */
          <View style={styles.detailsTabContent}>
            <Text style={styles.detailsTitle}>Selected Location</Text>

            {selection.isLoadingDetails && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>Loading location details...</Text>
              </View>
            )}

            {selection.location ? (
              <>
                {/* Editable Place Name - Fixed at top */}
                <View style={styles.placeNameContainer}>
                  <TextInput
                    style={styles.placeNameInput}
                    value={ui.editableNameInput}
                    onChangeText={(text) => setUI(prev => ({ ...prev, editableNameInput: text }))}
                    placeholder="Enter location name..."
                    placeholderTextColor={theme.colors.text.tertiary}
                  />
                  <TouchableOpacity
                    style={styles.checkButton}
                    onPress={handleOKPress}
                  >
                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3}>
                      <Path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </TouchableOpacity>
                </View>

                {/* Privacy Level Selection - Scrollable */}
                <ScrollView style={styles.privacyLevelScrollView} contentContainerStyle={styles.privacyLevelScrollContent}>
                  <View style={styles.privacyLevelSection}>
                  <Text style={styles.privacyLevelTitle}>Privacy Level</Text>
                  <Text style={styles.privacyLevelSubtitle}>Choose how precise you want your location to be</Text>

                  {/* Exact Location - Always available */}
                  <TouchableOpacity
                    style={styles.privacyLevelOption}
                    onPress={() => handlePrivacyLevelChange('exact')}
                  >
                    <View style={styles.radioButton}>
                      {selection.privacyLevel === 'exact' && <View style={styles.radioButtonInner} />}
                    </View>
                    <View style={styles.privacyLevelInfo}>
                      <Text style={styles.privacyLevelLabel}>Exact Location</Text>
                      <Text style={styles.privacyLevelValue}>
                        {selection.location.latitude.toFixed(6)}, {selection.location.longitude.toFixed(6)}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Address - if available */}
                  {privacyLevelCoords.has('address') && (
                    <TouchableOpacity
                      style={styles.privacyLevelOption}
                      onPress={() => handlePrivacyLevelChange('address')}
                    >
                      <View style={styles.radioButton}>
                        {selection.privacyLevel === 'address' && <View style={styles.radioButtonInner} />}
                      </View>
                      <View style={styles.privacyLevelInfo}>
                        <Text style={styles.privacyLevelLabel}>Address</Text>
                        <Text style={styles.privacyLevelValue}>
                          {privacyLevelCoords.get('address')?.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Postal Code - if available */}
                  {privacyLevelCoords.has('postal_code') && (
                    <TouchableOpacity
                      style={styles.privacyLevelOption}
                      onPress={() => handlePrivacyLevelChange('postal_code')}
                    >
                      <View style={styles.radioButton}>
                        {selection.privacyLevel === 'postal_code' && <View style={styles.radioButtonInner} />}
                      </View>
                      <View style={styles.privacyLevelInfo}>
                        <Text style={styles.privacyLevelLabel}>Postal Code</Text>
                        <Text style={styles.privacyLevelValue}>
                          {privacyLevelCoords.get('postal_code')?.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Neighborhood - if available */}
                  {privacyLevelCoords.has('neighborhood') && (
                    <TouchableOpacity
                      style={styles.privacyLevelOption}
                      onPress={() => handlePrivacyLevelChange('neighborhood')}
                    >
                      <View style={styles.radioButton}>
                        {selection.privacyLevel === 'neighborhood' && <View style={styles.radioButtonInner} />}
                      </View>
                      <View style={styles.privacyLevelInfo}>
                        <Text style={styles.privacyLevelLabel}>Neighborhood</Text>
                        <Text style={styles.privacyLevelValue}>
                          {privacyLevelCoords.get('neighborhood')?.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* City - if available */}
                  {privacyLevelCoords.has('city') && (
                    <TouchableOpacity
                      style={styles.privacyLevelOption}
                      onPress={() => handlePrivacyLevelChange('city')}
                    >
                      <View style={styles.radioButton}>
                        {selection.privacyLevel === 'city' && <View style={styles.radioButtonInner} />}
                      </View>
                      <View style={styles.privacyLevelInfo}>
                        <Text style={styles.privacyLevelLabel}>City</Text>
                        <Text style={styles.privacyLevelValue}>
                          {privacyLevelCoords.get('city')?.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Subdivision - if available */}
                  {privacyLevelCoords.has('subdivision') && (
                    <TouchableOpacity
                      style={styles.privacyLevelOption}
                      onPress={() => handlePrivacyLevelChange('subdivision')}
                    >
                      <View style={styles.radioButton}>
                        {selection.privacyLevel === 'subdivision' && <View style={styles.radioButtonInner} />}
                      </View>
                      <View style={styles.privacyLevelInfo}>
                        <Text style={styles.privacyLevelLabel}>Subdivision</Text>
                        <Text style={styles.privacyLevelValue}>
                          {privacyLevelCoords.get('subdivision')?.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Region - if available */}
                  {privacyLevelCoords.has('region') && (
                    <TouchableOpacity
                      style={styles.privacyLevelOption}
                      onPress={() => handlePrivacyLevelChange('region')}
                    >
                      <View style={styles.radioButton}>
                        {selection.privacyLevel === 'region' && <View style={styles.radioButtonInner} />}
                      </View>
                      <View style={styles.privacyLevelInfo}>
                        <Text style={styles.privacyLevelLabel}>Region/State</Text>
                        <Text style={styles.privacyLevelValue}>
                          {privacyLevelCoords.get('region')?.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Country - if available */}
                  {privacyLevelCoords.has('country') && (
                    <TouchableOpacity
                      style={styles.privacyLevelOption}
                      onPress={() => handlePrivacyLevelChange('country')}
                    >
                      <View style={styles.radioButton}>
                        {selection.privacyLevel === 'country' && <View style={styles.radioButtonInner} />}
                      </View>
                      <View style={styles.privacyLevelInfo}>
                        <Text style={styles.privacyLevelLabel}>Country</Text>
                        <Text style={styles.privacyLevelValue}>
                          {privacyLevelCoords.get('country')?.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* None - Always available */}
                  <TouchableOpacity
                    style={styles.privacyLevelOption}
                    onPress={() => handlePrivacyLevelChange('none')}
                  >
                    <View style={styles.radioButton}>
                      {selection.privacyLevel === 'none' && <View style={styles.radioButtonInner} />}
                    </View>
                    <View style={styles.privacyLevelInfo}>
                      <Text style={styles.privacyLevelLabel}>None</Text>
                      <Text style={styles.privacyLevelValue}>
                        No location information saved
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
                </ScrollView>
              </>
            ) : (
              <View style={styles.emptyDetailsState}>
                <Text style={styles.emptyDetailsText}>No location selected</Text>
                <Text style={styles.emptyDetailsSubtext}>
                  Select a location from the Map or tap a POI to view details
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    padding: 8,
  },
  content: {
    flex: 1,
  },
  // Map - Always visible
  map: {
    height: 250, // Map takes fixed height at top
  },
  // List Container (POI list below map)
  listContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  poiList: {
    flex: 1,
    height: 0, // Critical: Forces ScrollView to respect flex boundaries
    padding: 16,
  },
  poiListContent: {
    paddingBottom: 100, // Extra padding at bottom to ensure last items are visible
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: theme.colors.text.primary,
  },
  // Search Input (used in Map tab)
  searchInput: {
    padding: 16,
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  // POI Items
  poiItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectedPOI: {
    backgroundColor: '#e0f2fe',
    borderBottomColor: '#0ea5e9',
    borderBottomWidth: 2,
  },
  poiInfo: {
    flex: 1,
  },
  poiName: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  poiCategoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  poiCategory: {
    fontSize: 13,
    color: '#6b7280',
  },
  poiAddress: {
    fontSize: 12,
    color: '#9ca3af',
  },
  poiDistance: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3b82f6',
    marginLeft: 8,
  },
  mapLocationItem: {
    backgroundColor: '#f0f9ff', // Light blue background for map location
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  showOnMapButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  showOnMapText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
  // Details Tab
  detailsTabContent: {
    flex: 1,
    padding: 16,
  },
  detailsContentContainer: {
    paddingBottom: 100,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    color: theme.colors.text.primary,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    width: 120,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  detailInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  // New Place Name Container Styles
  placeNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.medium,
  },
  placeNameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.colors.border.medium,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  checkButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  // Privacy Level Scroll Styles
  privacyLevelScrollView: {
    flex: 1,
  },
  privacyLevelScrollContent: {
    paddingBottom: 24,
  },
  // Privacy Level Selection Styles
  privacyLevelSection: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  privacyLevelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  privacyLevelSubtitle: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
    marginBottom: 16,
  },
  privacyLevelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
    backgroundColor: theme.colors.background.primary,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.text.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.text.primary,
  },
  privacyLevelInfo: {
    flex: 1,
  },
  privacyLevelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  privacyLevelValue: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  okButton: {
    backgroundColor: theme.colors.text.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  okButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyDetailsState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyDetailsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
  },
  emptyDetailsSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  // Empty States
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  // Utility
  loader: {
    marginVertical: 20,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
  },
});
