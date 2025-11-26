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
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { useReverseGeocode, useNearbyPOIs, useLocationAutocomplete, type POIItem, type Location as LocationType, type LocationEntity, calculateDistance, formatDistanceWithUnits } from '@trace/core';
import { theme } from '../../../shared/theme/theme';
import Svg, { Path, Circle } from 'react-native-svg';
import { localDB } from '../../../shared/db/localDB';
import { useSettings } from '../../../shared/contexts/SettingsContext';
import {
  type LocationSelection,
  type LocationPickerUI,
  type MapState,
  createEmptySelection,
  createSelectionFromLocation,
  createSelectionFromPOI,
  createSelectionFromMapTap,
} from '../types/LocationPickerTypes';

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: LocationType | null) => void;
  initialLocation?: LocationType | null;
  readOnly?: boolean; // View-only mode for existing locations
}

export function LocationPicker({ visible, onClose, onSelect, initialLocation, readOnly = false }: LocationPickerProps) {
  // Get user settings for unit preferences
  const { settings } = useSettings();

  // UNIFIED STATE ARCHITECTURE
  // 1. Selection state - SINGLE SOURCE OF TRUTH for what user has chosen
  const [selection, setSelection] = useState<LocationSelection>(createEmptySelection());

  // 2. UI state - View mode and input fields
  const [ui, setUI] = useState<LocationPickerUI>({
    showingDetails: !!initialLocation, // Start in details mode if initialLocation provided
    searchQuery: '',
    editableNameInput: '',
  });

  // Tab state for Nearby/Saved
  const [activeListTab, setActiveListTab] = useState<'nearby' | 'saved'>('nearby');

  // Track whether user is editing the name (for POI/saved selections)
  const [isEditingName, setIsEditingName] = useState(false);

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

  // State for saved locations from SQLite (My Places)
  const [savedLocations, setSavedLocations] = useState<Array<LocationEntity & { distance: number }>>([]);
  const [isLoadingSavedLocations, setIsLoadingSavedLocations] = useState(false);

  // State for triggering reverse geocoding
  const [reverseGeocodeRequest, setReverseGeocodeRequest] = useState<{ latitude: number; longitude: number } | null>(null);

  // State for tapped Google Maps POI (shows as first item in Nearby list)
  const [tappedGooglePOI, setTappedGooglePOI] = useState<{
    placeId: string;
    name: string;
    latitude: number;
    longitude: number;
    address?: string | null;
  } | null>(null);

  // State for preview marker (red) - shown when inspecting a list item
  const [previewMarker, setPreviewMarker] = useState<{
    latitude: number;
    longitude: number;
    name: string;
  } | null>(null);

  // State to track selected list item for visual highlighting
  const [selectedListItemId, setSelectedListItemId] = useState<string | null>(null);

  // Ref to MapView for programmatic control
  const mapRef = useRef<MapView>(null);

  // Refs for markers to show callouts programmatically
  const blueMarkerRef = useRef<any>(null);
  const redMarkerRef = useRef<any>(null);

  // Initialize when picker opens
  useEffect(() => {
    if (visible) {
      console.log('[LocationPicker] 📍 Picker opened');
      console.log('[LocationPicker] Initial location:', initialLocation);

      // Reset to clean state
      if (initialLocation) {
        // If entry has GPS but no location name, show POI list to let user select
        const hasLocationName = !!initialLocation.name;
        // GPS-only entries (no name, no address) need to be treated like map taps
        const isGpsOnlyEntry = !hasLocationName && !initialLocation.address;

        console.log('[LocationPicker] Initial location:', {
          hasName: hasLocationName,
          isGpsOnly: isGpsOnlyEntry,
          name: initialLocation.name,
          address: initialLocation.address,
          coords: `${initialLocation.latitude}, ${initialLocation.longitude}`
        });

        // For GPS-only entries, use map_tap type so the Mapbox enrichment works correctly
        const newSelection = isGpsOnlyEntry
          ? createSelectionFromMapTap(
              initialLocation.originalLatitude || initialLocation.latitude,
              initialLocation.originalLongitude || initialLocation.longitude
            )
          : createSelectionFromLocation(initialLocation);
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
        // For non-GPS-only entries, we need to set isLoadingDetails manually
        // (GPS-only entries already have it set via createSelectionFromMapTap)
        if (!isGpsOnlyEntry) {
          setSelection(prev => ({ ...prev, isLoadingDetails: true }));
        }
      } else {
        // Start fresh
        setSelection(createEmptySelection());
        setTappedGooglePOI(null);
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

              // Create a selection from the GPS location
              const newSelection = createSelectionFromMapTap(coords.latitude, coords.longitude);
              setSelection(newSelection);

              // Trigger reverse geocoding to get address data
              console.log('[LocationPicker] Triggering reverse geocoding for GPS location');
              setReverseGeocodeRequest(coords);
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

  // Fetch nearby saved locations from SQLite when marker position changes
  useEffect(() => {
    if (!mapState.markerPosition || ui.showingDetails) {
      return;
    }

    const fetchNearbySavedLocations = async () => {
      setIsLoadingSavedLocations(true);
      try {
        // Get all locations from SQLite
        const allLocations = await localDB.getAllLocations();

        // Calculate distance for each and filter to within 10 miles
        const nearbyRadius = 16093; // 10 miles in meters
        const locationsWithDistance = allLocations
          .map(loc => {
            const distance = calculateDistance(
              { latitude: mapState.markerPosition!.latitude, longitude: mapState.markerPosition!.longitude },
              { latitude: loc.latitude, longitude: loc.longitude }
            );
            return { ...loc, distance: distance.meters };
          })
          .filter(loc => loc.distance <= nearbyRadius)
          .sort((a, b) => a.distance - b.distance);

        setSavedLocations(locationsWithDistance);
        console.log(`[LocationPicker] Found ${locationsWithDistance.length} nearby saved locations`);
      } catch (error) {
        console.error('[LocationPicker] Error fetching saved locations:', error);
        setSavedLocations([]);
      } finally {
        setIsLoadingSavedLocations(false);
      }
    };

    fetchNearbySavedLocations();
  }, [mapState.markerPosition?.latitude, mapState.markerPosition?.longitude, ui.showingDetails]);

  // Auto-show callout when preview marker appears
  useEffect(() => {
    if (previewMarker && redMarkerRef.current) {
      // Delay to ensure marker is rendered
      const timer = setTimeout(() => {
        redMarkerRef.current?.showCallout();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [previewMarker]);

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

    // Clamp between 500m and 10000m for better coverage
    return Math.max(500, Math.min(10000, radius));
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
      limit: 50
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

      // For map_tap, keep name as null so "Create New Location Here" shows as title
      // The address will show in the subtitle via getSubtitleText()
      // Name will only be set when user explicitly enters one in the details panel

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

      // Update tappedGooglePOI with address data from reverse geocoding
      if (tappedGooglePOI) {
        setTappedGooglePOI(prev => prev ? {
          ...prev,
          address: enrichedLocation.address,
        } : null);
      }

      // Update editableNameInput to match the enriched location name
      // This ensures the UI stays in sync with the selection
      // For map_tap, don't auto-fill the name input - let user enter it
      if (enrichedLocation.name && !ui.editableNameInput && selection.type !== 'map_tap') {
        setUI(prev => ({ ...prev, editableNameInput: enrichedLocation.name || '' }));
      }

      // If in quick select mode, auto-complete the selection
      if (ui.quickSelectMode && enrichedLocation.name) {
        console.log('[LocationPicker] 🚀 Quick select mode - auto-completing selection');

        const finalLocation: LocationType = {
          latitude: enrichedLocation.latitude,
          longitude: enrichedLocation.longitude,
          originalLatitude: enrichedLocation.originalLatitude ?? enrichedLocation.latitude,
          originalLongitude: enrichedLocation.originalLongitude ?? enrichedLocation.longitude,
          name: enrichedLocation.name,
          source: enrichedLocation.source,
          address: enrichedLocation.address,
          postalCode: enrichedLocation.postalCode,
          neighborhood: enrichedLocation.neighborhood,
          city: enrichedLocation.city,
          subdivision: enrichedLocation.subdivision,
          region: enrichedLocation.region,
          country: enrichedLocation.country,
          category: enrichedLocation.category,
          distance: enrichedLocation.distance,
        };

        // Reset quick select mode and close
        setUI(prev => ({ ...prev, quickSelectMode: false }));
        onSelect(finalLocation);
        onClose();
        return;
      }

      // Note: Navigation to details tab is handled explicitly by user clicking list items
      // Map taps should NOT auto-navigate - they just add to the list
    }
  }, [selection.isLoadingDetails, mapboxData, mapboxLoading, selection.type, ui.editableNameInput, ui.quickSelectMode, onSelect, onClose]);

  // Handler: Saved location selected from list
  const handleSavedLocationSelect = (location: LocationEntity & { distance: number }) => {
    console.log('[LocationPicker] Saved location selected:', location.name);

    const coords = {
      latitude: location.latitude,
      longitude: location.longitude,
    };

    // Update map state to center on the selected location
    setMapState(prev => ({
      region: {
        ...coords,
        latitudeDelta: prev.region?.latitudeDelta || 0.005,
        longitudeDelta: prev.region?.longitudeDelta || 0.005,
      },
      markerPosition: coords,
    }));

    // Animate map to center on the location
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        ...coords,
        latitudeDelta: mapState.region?.latitudeDelta || 0.005,
        longitudeDelta: mapState.region?.longitudeDelta || 0.005,
      }, 300);
    }

    // Create selection from saved location (includes location_id for reuse)
    const newSelection: LocationSelection = {
      type: 'poi',
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        name: location.name,
        source: (location.source as any) || 'user_custom',
        address: location.address,
        city: location.city,
        region: location.region,
        country: location.country,
        postalCode: location.postal_code,
        neighborhood: location.neighborhood,
        subdivision: location.subdivision,
      },
      tempCoordinates: null,
      isLoadingDetails: false,
      locationId: location.location_id, // Reuse existing location_id
    };
    setSelection(newSelection);

    // Show details panel
    setUI(prev => ({
      ...prev,
      showingDetails: true,
      editableNameInput: location.name,
    }));

    // Trigger reverse geocoding for complete hierarchy
    setReverseGeocodeRequest({ latitude: location.latitude, longitude: location.longitude });
  };

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

    // Clear any preview marker and selected list item when tapping map
    setPreviewMarker(null);
    setSelectedListItemId(null);

    // If showing details, update coordinates but stay on details view
    // This allows user to adjust location while on the verify screen
    if (ui.showingDetails) {
      console.log('[LocationPicker] Updating coordinates while on details view');

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

      // Update selection with new coordinates but preserve existing name if any
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

    // Handle as new location selection (not showing details)
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

    // Clear any previously tapped Google POI (user tapped elsewhere on map)
    setTappedGooglePOI(null);

    // Create selection from map tap
    const newSelection = createSelectionFromMapTap(coordinate.latitude, coordinate.longitude);
    setSelection(newSelection);

    // Trigger reverse geocoding
    setReverseGeocodeRequest({ latitude: coordinate.latitude, longitude: coordinate.longitude });
  };


  // Handler: OK button in Details tab
  const handleOKPress = () => {
    if (selection.location) {
      console.log('[LocationPicker] 🚀 OK pressed, selecting location:', selection.location.name);

      const finalLocation: LocationType = {
        // Database ID (if reusing saved location)
        location_id: selection.location.location_id,
        // Coordinates
        latitude: selection.location.latitude,
        longitude: selection.location.longitude,
        // Original exact GPS coordinates (for entry_latitude/entry_longitude)
        originalLatitude: selection.location.originalLatitude ?? selection.location.latitude,
        originalLongitude: selection.location.originalLongitude ?? selection.location.longitude,
        name: ui.editableNameInput || selection.location.name || null,
        source: selection.location.source,
        // Location hierarchy
        address: selection.location.address,
        postalCode: selection.location.postalCode,
        neighborhood: selection.location.neighborhood,
        city: selection.location.city,
        subdivision: selection.location.subdivision,
        region: selection.location.region,
        country: selection.location.country,
        category: selection.location.category,
        distance: selection.location.distance,
      };

      console.log('[LocationPicker] Final location:', finalLocation);

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
          <Text style={styles.headerTitle}>
            {readOnly ? 'Current Location' : ui.showingDetails ? 'Create Location' : 'Select Location'}
          </Text>
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
          <View style={styles.mapContainer}>
          <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={mapState.region}
              onPress={readOnly ? undefined : handleMapPress}
              onRegionChangeComplete={readOnly ? undefined : handleRegionChangeComplete}
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
              // Handle POI clicks - specific places have placeId, areas don't
              onPoiClick={readOnly ? undefined : (event) => {
                const { coordinate, placeId, name } = event.nativeEvent;
                console.log('[LocationPicker] POI clicked:', { placeId, name, coordinate });

                // Check if this looks like a general area (park, neighborhood, city, etc.)
                // These have placeIds but should be treated as regular map taps
                const isGeneralArea = (poiName: string): boolean => {
                  const lowerName = poiName.toLowerCase();
                  // Common patterns for general areas
                  const areaPatterns = [
                    /\bpark\b/,           // "Central Park", "Hyde Park"
                    /\bneighborhood\b/,   // "Downtown Neighborhood"
                    /\bdistrict\b/,       // "Financial District"
                    /\bquarter\b/,        // "French Quarter"
                    /\bvillage\b/,        // "Greenwich Village"
                    /\bheights\b/,        // "Brooklyn Heights"
                    /\bhills?\b/,         // "Beverly Hills"
                    /\bbeach\b/,          // "South Beach"
                    /\bisland\b/,         // "Roosevelt Island"
                    /\bgardens?\b/,       // "Botanical Gardens" (but not restaurant names)
                    /\bcommons?\b/,       // "Boston Common"
                    /\bgreen\b/,          // "Village Green"
                    /\bsquare\b/,         // "Times Square", "Union Square"
                    /\bplaza\b/,          // "Herald Square Plaza"
                    /\bdowntown\b/,       // "Downtown"
                    /\bmidtown\b/,        // "Midtown"
                    /\buptown\b/,         // "Uptown"
                  ];
                  return areaPatterns.some(pattern => pattern.test(lowerName));
                };

                // If it has a placeId and name, and isn't a general area, it's a specific place
                if (placeId && name && !isGeneralArea(name)) {
                  // Store the tapped POI to show as first item in Nearby list
                  setTappedGooglePOI({
                    placeId,
                    name,
                    latitude: coordinate.latitude,
                    longitude: coordinate.longitude,
                  });

                  // Move marker to POI location
                  setMapState(prev => ({
                    region: {
                      latitude: coordinate.latitude,
                      longitude: coordinate.longitude,
                      latitudeDelta: prev.region?.latitudeDelta || 0.01,
                      longitudeDelta: prev.region?.longitudeDelta || 0.01,
                    },
                    markerPosition: coordinate,
                  }));

                  // Create selection (keep name null so "Create New Location Here" stays as title)
                  setSelection({
                    type: 'map_tap',
                    location: {
                      latitude: coordinate.latitude,
                      longitude: coordinate.longitude,
                      name: null, // Keep null - the Google POI list item shows the name
                      source: 'google_poi',
                    },
                    tempCoordinates: coordinate,
                    isLoadingDetails: true,
                  });

                  // Trigger reverse geocoding for address data
                  setReverseGeocodeRequest(coordinate);
                } else {
                  // No placeId = area (neighborhood, city) - treat as regular map tap
                  handleMapPress({ nativeEvent: { coordinate } } as any);
                }
              }}
            >
              {/* Selected Location Marker (blue) */}
              {mapState.markerPosition && (
                <Marker
                  ref={blueMarkerRef}
                  coordinate={mapState.markerPosition}
                  pinColor="blue"
                >
                  <Callout tooltip>
                    <View style={styles.calloutContainer}>
                      <Text style={styles.calloutText} numberOfLines={2}>
                        {selection.location?.name || "Selected Location"}
                      </Text>
                    </View>
                  </Callout>
                </Marker>
              )}

              {/* Preview Marker (red) - shown when inspecting a list item */}
              {previewMarker && (
                <Marker
                  ref={redMarkerRef}
                  coordinate={{
                    latitude: previewMarker.latitude,
                    longitude: previewMarker.longitude,
                  }}
                  pinColor="red"
                >
                  <Callout tooltip>
                    <View style={styles.calloutContainerRed}>
                      <Text style={styles.calloutText} numberOfLines={2}>
                        {previewMarker.name}
                      </Text>
                    </View>
                  </Callout>
                </Marker>
              )}
            </MapView>

            {/* My Location Button */}
            <TouchableOpacity
              style={styles.mapLocationButton}
              onPress={async () => {
                try {
                  const { status } = await Location.requestForegroundPermissionsAsync();
                  if (status !== 'granted') {
                    return;
                  }
                  let location = await Location.getLastKnownPositionAsync({});
                  if (!location) {
                    location = await Location.getCurrentPositionAsync({
                      accuracy: Location.Accuracy.Balanced,
                    });
                  }
                  if (location && mapRef.current) {
                    const coords = {
                      latitude: location.coords.latitude,
                      longitude: location.coords.longitude,
                    };
                    const newRegion = {
                      ...coords,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    };

                    // Animate map to location
                    mapRef.current.animateToRegion(newRegion, 500);

                    // In read-only mode, only pan the map - don't move marker or change selection
                    if (readOnly) {
                      setMapState(prev => ({
                        ...prev,
                        region: newRegion,
                        // Keep markerPosition unchanged
                      }));
                      return;
                    }

                    // Move marker to current location
                    setMapState(prev => ({
                      ...prev,
                      region: newRegion,
                      markerPosition: coords,
                    }));

                    // Create selection from current location (like map tap)
                    const newSelection = createSelectionFromMapTap(coords.latitude, coords.longitude);
                    setSelection(newSelection);

                    // Trigger reverse geocoding
                    setReverseGeocodeRequest(coords);
                  }
                } catch (error) {
                  console.error('Error getting location:', error);
                }
              }}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={2}>
                <Circle cx="12" cy="12" r="10" />
                <Path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </Svg>
            </TouchableOpacity>
          </View>
        )}

        {/* Switchable Content Below Map */}
        {!ui.showingDetails ? (
          /* POI List View */
          <View style={styles.listContainer}>
            {/* Search Input with Clear Button */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search for a place..."
                value={ui.searchQuery}
                onChangeText={(text) => setUI(prev => ({ ...prev, searchQuery: text }))}
              />
              {ui.searchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.searchClearButton}
                  onPress={() => setUI(prev => ({ ...prev, searchQuery: '' }))}
                >
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2}>
                    <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
              )}
            </View>

            {/* Results List - shows nearby by default, search results when typing */}
            <ScrollView style={styles.poiList} contentContainerStyle={styles.poiListContent}>
              {/* Tabs or Search Results title */}
              {ui.searchQuery.length >= 2 ? (
                <Text style={styles.listTitle}>Search Results</Text>
              ) : (
                <View style={styles.listTabs}>
                  <TouchableOpacity
                    style={[styles.listTab, activeListTab === 'nearby' && styles.listTabActive]}
                    onPress={() => setActiveListTab('nearby')}
                  >
                    <Text style={[styles.listTabText, activeListTab === 'nearby' && styles.listTabTextActive]}>
                      Nearby
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.listTab, activeListTab === 'saved' && styles.listTabActive]}
                    onPress={() => setActiveListTab('saved')}
                  >
                    <Text style={[styles.listTabText, activeListTab === 'saved' && styles.listTabTextActive]}>
                      Saved
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
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
                  // If no selection but we have marker position, create selection from marker
                  if (!selection.location && mapState.markerPosition) {
                    const newSelection = createSelectionFromMapTap(
                      mapState.markerPosition.latitude,
                      mapState.markerPosition.longitude
                    );
                    setSelection(newSelection);
                    setReverseGeocodeRequest({
                      latitude: mapState.markerPosition.latitude,
                      longitude: mapState.markerPosition.longitude,
                    });
                  }

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

                // Determine the subtitle text: address > coordinates > fallback
                const getSubtitleText = () => {
                  if (selection.isLoadingDetails) {
                    return 'Loading address...';
                  }
                  if (selection.location?.address) {
                    return selection.location.address;
                  }
                  // Show GPS coordinates if no address
                  const coords = selection.location
                    ? { lat: selection.location.latitude, lng: selection.location.longitude }
                    : mapState.markerPosition
                      ? { lat: mapState.markerPosition.latitude, lng: mapState.markerPosition.longitude }
                      : null;

                  if (coords) {
                    return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
                  }
                  return 'Tap to set location';
                };

                return (
                  <TouchableOpacity
                    style={[styles.poiItem, styles.mapLocationItem]}
                    onPress={() => {
                      // Click on row = refocus map on blue marker (current selection)
                      if (mapState.markerPosition && mapRef.current) {
                        mapRef.current.animateToRegion({
                          latitude: mapState.markerPosition.latitude,
                          longitude: mapState.markerPosition.longitude,
                          latitudeDelta: 0.005,
                          longitudeDelta: 0.005,
                        }, 300);
                        // Clear any preview marker and selected list item
                        setPreviewMarker(null);
                        setSelectedListItemId(null);
                      }
                    }}
                  >
                    {/* Blue marker icon */}
                    <View style={styles.poiIconContainer}>
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="blue" strokeWidth={2}>
                        <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                        <Circle cx={12} cy={10} r={3} fill="blue" />
                      </Svg>
                    </View>
                    <View style={styles.poiInfo}>
                      <Text style={styles.poiName}>
                        Currently Selected
                      </Text>
                      <Text style={styles.poiCategory}>
                        {getSubtitleText()}
                      </Text>
                    </View>
                    {/* Create New link */}
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        // Go to Create Location view
                        setUI(prev => ({
                          ...prev,
                          showingDetails: true,
                          editableNameInput: selection.location?.name || '',
                        }));
                        // Clear preview marker
                        setPreviewMarker(null);
                      }}
                      style={styles.selectLink}
                    >
                      <Text style={styles.selectLinkText}>Create New</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })()}

              {/* Merged POI and Saved Locations List */}
              {(() => {
                // Build merged list of POIs and saved locations
                type MergedItem = {
                  type: 'poi' | 'saved' | 'google_poi';
                  id: string;
                  name: string;
                  distance: number;
                  address?: string | null;
                  category?: string | null;
                  city?: string | null;
                  poi?: POIItem;
                  savedLocation?: LocationEntity & { distance: number };
                  googlePOI?: typeof tappedGooglePOI;
                };

                const mergedItems: MergedItem[] = [];

                // Determine what to show based on search query and active tab
                const isSearching = ui.searchQuery.length >= 2;
                const showSavedOnly = !isSearching && activeListTab === 'saved';
                const showNearby = isSearching || activeListTab === 'nearby';

                // Track names to deduplicate (Google POI name takes priority)
                const googlePoiName = tappedGooglePOI?.name.toLowerCase().trim();

                // Add tapped Google POI as first item if on Nearby tab and not searching
                if (tappedGooglePOI && showNearby && !isSearching) {
                  mergedItems.push({
                    type: 'google_poi',
                    id: `google-${tappedGooglePOI.placeId}`,
                    name: tappedGooglePOI.name,
                    distance: 0, // It's at the marker position
                    address: tappedGooglePOI.address || `${tappedGooglePOI.latitude.toFixed(6)}, ${tappedGooglePOI.longitude.toFixed(6)}`,
                    googlePOI: tappedGooglePOI,
                  });
                }

                // Add saved locations
                if (savedLocations.length > 0 && (showSavedOnly || showNearby)) {
                  // Show all saved locations within 10 miles (already filtered in fetch)
                  savedLocations.forEach(loc => {
                    // Filter by search query if searching
                    if (isSearching) {
                      const query = ui.searchQuery.toLowerCase().trim();
                      const matchesName = loc.name.toLowerCase().includes(query);
                      const matchesCity = loc.city?.toLowerCase().includes(query);
                      const matchesAddress = loc.address?.toLowerCase().includes(query);
                      if (!matchesName && !matchesCity && !matchesAddress) {
                        return; // Skip if doesn't match search
                      }
                    }

                    mergedItems.push({
                      type: 'saved',
                      id: `saved-${loc.location_id}`,
                      name: loc.name,
                      distance: loc.distance,
                      address: loc.address,
                      city: loc.city,
                      savedLocation: loc,
                    });
                  });
                }

                // Only add POIs for "Nearby" tab or when searching
                if (showNearby && !showSavedOnly) {
                  // Create a map of saved locations for deduplication (by normalized name + address)
                  const savedLocationKeys = new Map<string, LocationEntity & { distance: number }>();
                  savedLocations.forEach(loc => {
                    // Key by name only for basic matching
                    const nameKey = loc.name.toLowerCase().trim();
                    savedLocationKeys.set(nameKey, loc);

                    // Also key by name + address for exact matching
                    if (loc.address) {
                      const fullKey = `${nameKey}|${loc.address.toLowerCase().trim()}`;
                      savedLocationKeys.set(fullKey, loc);
                    }
                  });

                  // Add POIs with calculated distances (filter out duplicates)
                  if (displayedPOIs && displayedPOIs.length > 0) {
                    displayedPOIs.forEach(poi => {
                      // Check if this POI matches a saved location or Google POI
                      const normalizedName = poi.name.toLowerCase().trim();
                      const normalizedAddress = poi.address?.toLowerCase().trim() || '';

                      // Check for duplicates by name + address (more precise)
                      const fullKey = normalizedAddress ? `${normalizedName}|${normalizedAddress}` : '';
                      const isDuplicateByFullKey = fullKey && savedLocationKeys.has(fullKey);

                      // Check for duplicates by name only (fallback)
                      const isDuplicateByName = savedLocationKeys.has(normalizedName);

                      // Determine if this is a duplicate of a saved location
                      // Match by name + address (if both have address) or just name
                      const isDuplicateOfSaved = isDuplicateByFullKey || isDuplicateByName;

                      const isDuplicateOfGoogle = googlePoiName && normalizedName === googlePoiName;

                      // Skip if it's a duplicate of a saved location or Google POI
                      // This applies to both searching and nearby tabs for consistency
                      if (isDuplicateOfSaved || isDuplicateOfGoogle) {
                        return;
                      }

                      const distanceMeters = isSearching && mapState.markerPosition
                        ? calculateDistance(
                            { latitude: mapState.markerPosition.latitude, longitude: mapState.markerPosition.longitude },
                            { latitude: poi.latitude, longitude: poi.longitude }
                          ).meters
                        : (poi.distance || 0);

                      mergedItems.push({
                        type: 'poi',
                        id: `poi-${poi.id}`,
                        name: poi.name,
                        distance: distanceMeters,
                        address: poi.address,
                        category: poi.category,
                        city: poi.city,
                        poi: poi,
                      });
                    });
                  }
                }

                // Sort by distance
                mergedItems.sort((a, b) => a.distance - b.distance);

                const isLoading = displayedLoading || isLoadingSavedLocations;
                const hasItems = mergedItems.length > 0;

                if (hasItems && !isLoading) {
                  return (
                    <>
                      {mergedItems.map((item, index) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.poiItem,
                            item.type === 'saved' && styles.savedLocationItem,
                            selectedListItemId === item.id && styles.poiItemSelected
                          ]}
                          onPress={() => {
                            // Click on row = pan/zoom to location and show red preview marker
                            let coords: { latitude: number; longitude: number } | null = null;
                            let name = item.name;

                            if (item.type === 'saved' && item.savedLocation) {
                              coords = {
                                latitude: item.savedLocation.latitude,
                                longitude: item.savedLocation.longitude,
                              };
                            } else if (item.type === 'poi' && item.poi) {
                              coords = {
                                latitude: item.poi.latitude,
                                longitude: item.poi.longitude,
                              };
                            } else if (item.type === 'google_poi' && item.googlePOI) {
                              coords = {
                                latitude: item.googlePOI.latitude,
                                longitude: item.googlePOI.longitude,
                              };
                            }

                            if (coords && mapRef.current) {
                              // Mark this item as selected
                              setSelectedListItemId(item.id);

                              // Animate map to the location
                              mapRef.current.animateToRegion({
                                ...coords,
                                latitudeDelta: 0.005,
                                longitudeDelta: 0.005,
                              }, 300);

                              // Show red preview marker
                              setPreviewMarker({
                                latitude: coords.latitude,
                                longitude: coords.longitude,
                                name: name,
                              });
                            }
                          }}
                        >
                          {/* Left column: Icon + Distance */}
                          <View style={styles.poiLeftColumn}>
                            {selectedListItemId === item.id ? (
                              // Red marker icon when selected
                              <Svg width={20} height={20} viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth={2}>
                                <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                                <Circle cx={12} cy={10} r={3} fill="white" />
                              </Svg>
                            ) : item.type === 'saved' ? (
                              // Star icon for saved locations
                              <Svg width={20} height={20} viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth={2}>
                                <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
                              </Svg>
                            ) : item.type === 'google_poi' ? (
                              // Map marker icon for Google POI (tapped on map)
                              <Svg width={20} height={20} viewBox="0 0 24 24" fill="#4285f4" stroke="#4285f4" strokeWidth={2}>
                                <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                                <Circle cx={12} cy={10} r={3} fill="white" />
                              </Svg>
                            ) : (
                              // Pin icon for POIs
                              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                                <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                                <Circle cx={12} cy={10} r={3} fill={theme.colors.text.tertiary} />
                              </Svg>
                            )}
                            <Text style={styles.poiDistanceSmall}>
                              {formatDistanceWithUnits(item.distance, settings.units)}
                            </Text>
                          </View>
                          {/* Middle column: Name, Category, Address */}
                          <View style={styles.poiInfo}>
                            <Text style={styles.poiName} numberOfLines={1}>
                              {ui.searchQuery.length < 2 && `${index + 1}. `}{item.name}
                            </Text>
                            {item.type === 'poi' && item.category && typeof item.category === 'string' && (
                              <Text style={styles.poiCategory} numberOfLines={1}>{item.category}</Text>
                            )}
                            {item.type === 'google_poi' && (
                              <Text style={styles.poiCategory}>Tapped on map</Text>
                            )}
                            {item.type === 'saved' && item.city && (
                              <Text style={styles.poiCategory} numberOfLines={1}>Saved · {item.city}</Text>
                            )}
                            {item.address && typeof item.address === 'string' && (
                              <Text style={styles.poiAddress} numberOfLines={1}>{item.address}</Text>
                            )}
                          </View>
                          {/* Right column: Select button */}
                          <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                // For saved locations, we can return directly (already has all hierarchy data)
                                // For POIs, go through details flow to get Mapbox enrichment
                                if (item.type === 'saved' && item.savedLocation) {
                                  const loc = item.savedLocation;
                                  onSelect({
                                    location_id: loc.location_id, // Reuse existing location
                                    latitude: loc.latitude,
                                    longitude: loc.longitude,
                                    name: loc.name,
                                    address: loc.address || undefined,
                                    city: loc.city || undefined,
                                    region: loc.region || undefined,
                                    country: loc.country || undefined,
                                    postalCode: loc.postal_code || undefined,
                                    neighborhood: loc.neighborhood || undefined,
                                    subdivision: loc.subdivision || undefined,
                                    source: (loc.source as any) || 'user_custom',
                                  });
                                  onClose();
                                } else if (item.type === 'poi' && item.poi) {
                                  // Go through handlePOISelect to trigger Mapbox enrichment
                                  // Set quickSelectMode to auto-complete after enrichment
                                  setUI(prev => ({ ...prev, quickSelectMode: true }));
                                  handlePOISelect(item.poi);
                                } else if (item.type === 'google_poi' && item.googlePOI) {
                                  // Go through handlePOISelect to trigger Mapbox enrichment
                                  // Set quickSelectMode to auto-complete after enrichment
                                  setUI(prev => ({ ...prev, quickSelectMode: true }));
                                  const googlePoi: POIItem = {
                                    id: item.googlePOI.placeId,
                                    source: 'google',
                                    name: item.googlePOI.name,
                                    latitude: item.googlePOI.latitude,
                                    longitude: item.googlePOI.longitude,
                                    address: item.googlePOI.address || undefined,
                                  };
                                  handlePOISelect(googlePoi);
                                }
                              }}
                            style={styles.selectButton}
                          >
                            <Text style={styles.selectButtonText}>Select</Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ))}
                    </>
                  );
                } else if (!isLoading && !hasItems && !selection.location) {
                  // Determine empty state text based on context
                  const getEmptyStateText = () => {
                    if (ui.searchQuery.length >= 2) {
                      return { title: 'No results found', subtitle: 'Try a different search term' };
                    }
                    if (activeListTab === 'saved') {
                      return { title: 'No saved locations', subtitle: 'Save locations from the Nearby tab to see them here' };
                    }
                    return { title: 'No nearby places found', subtitle: 'Try moving the map or tap a location on the map' };
                  };
                  const emptyState = getEmptyStateText();

                  return (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>
                        {emptyState.title}
                      </Text>
                      <Text style={styles.emptyStateSubtext}>
                        {emptyState.subtitle}
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}
            </ScrollView>
          </View>
        ) : (
          /* Create Location View - Clean form layout */
          <View style={styles.createLocationContainer}>
            {selection.isLoadingDetails && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>Loading location details...</Text>
              </View>
            )}

            {selection.location ? (
              <ScrollView style={styles.createLocationScroll} contentContainerStyle={styles.createLocationContent}>
                {/* NAME Section */}
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>NAME</Text>
                  {readOnly ? (
                    <Text style={styles.formValueLarge}>{ui.editableNameInput || 'Unnamed Location'}</Text>
                  ) : (
                    <TextInput
                      style={styles.formInput}
                      value={ui.editableNameInput}
                      onChangeText={(text) => setUI(prev => ({ ...prev, editableNameInput: text }))}
                      placeholder="Enter location name..."
                      placeholderTextColor={theme.colors.text.tertiary}
                    />
                  )}
                </View>

                {/* ADDRESS Section */}
                {(() => {
                  // Build formatted address lines (without neighborhood)
                  const addressLines: string[] = [];

                  // Line 1: Street address
                  if (selection.location.address) {
                    addressLines.push(selection.location.address);
                  }

                  // Line 2: City, State ZIP
                  const cityStateZip: string[] = [];
                  if (selection.location.city) cityStateZip.push(selection.location.city);
                  if (selection.location.region) cityStateZip.push(selection.location.region);
                  if (selection.location.postalCode) cityStateZip.push(selection.location.postalCode);
                  if (cityStateZip.length > 0) {
                    addressLines.push(cityStateZip.join(', '));
                  }

                  // Line 3: Country
                  if (selection.location.country) {
                    addressLines.push(selection.location.country);
                  }

                  return addressLines.length > 0 ? (
                    <View style={styles.formSection}>
                      <Text style={styles.formLabel}>ADDRESS</Text>
                      <Text style={styles.formValue}>{addressLines.join('\n')}</Text>
                    </View>
                  ) : null;
                })()}

                {/* COORDINATES Section with OK Button */}
                <View style={styles.formSectionRow}>
                  <View style={styles.formSectionRowContent}>
                    <Text style={styles.formLabel}>COORDINATES</Text>
                    <Text style={styles.formValue}>
                      {selection.location.latitude.toFixed(6)}, {selection.location.longitude.toFixed(6)}
                    </Text>
                  </View>
                  {!readOnly && (
                    <TouchableOpacity
                      style={styles.okButton}
                      onPress={handleOKPress}
                    >
                      <Text style={styles.okButtonText}>OK</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Action Buttons - Hidden in read-only mode */}
                {!readOnly && (
                  <>
                    {/* Divider */}
                    <View style={styles.formDivider} />

                    {/* Action Buttons */}
                    <View style={styles.formActions}>
                      {/* Select New Location Button */}
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                          console.log('[LocationPicker] Select New Location pressed');
                          setUI(prev => ({ ...prev, showingDetails: false }));
                          setPreviewMarker(null);
                        }}
                      >
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
                          <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                          <Circle cx={12} cy={10} r={3} fill={theme.colors.text.primary} />
                        </Svg>
                        <Text style={styles.actionButtonText}>Select New Location</Text>
                      </TouchableOpacity>

                      {/* Remove Location Button */}
                      <TouchableOpacity
                        style={styles.actionButtonDanger}
                        onPress={() => {
                          console.log('[LocationPicker] Remove Location pressed');
                          onSelect(null);
                          onClose();
                        }}
                      >
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}>
                          <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                        <Text style={styles.actionButtonDangerText}>Remove Location</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </ScrollView>
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
  mapContainer: {
    position: 'relative',
    height: 250,
  },
  map: {
    flex: 1,
  },
  mapLocationButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  searchClearButton: {
    padding: 12,
    marginRight: 4,
  },
  // List Tabs
  listTabs: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 16,
  },
  listTab: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  listTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.text.primary,
  },
  listTabText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text.tertiary,
  },
  listTabTextActive: {
    color: theme.colors.text.primary,
    fontWeight: '600',
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
  poiItemSelected: {
    backgroundColor: '#fef2f2',
    borderWidth: 2,
    borderColor: '#ef4444',
    borderLeftWidth: 2,
    borderLeftColor: '#ef4444',
    borderBottomWidth: 2,
    borderBottomColor: '#ef4444',
    borderRadius: 8,
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  selectedPOI: {
    backgroundColor: '#e0f2fe',
    borderBottomColor: '#0ea5e9',
    borderBottomWidth: 2,
  },
  // Callout styles for map markers
  calloutContainer: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: 200,
  },
  calloutContainerRed: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: 200,
  },
  calloutText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  savedLocationItem: {
    backgroundColor: '#fef9ee', // Light amber background for saved locations
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b', // Amber border
  },
  poiLeftColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    width: 44,
  },
  poiIconContainer: {
    marginRight: 12,
    width: 24,
    alignItems: 'center',
  },
  poiDistanceSmall: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 4,
  },
  poiInfo: {
    flex: 1,
    marginRight: 8,
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
    marginTop: 2,
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
  placeNameLabelContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  placeNameLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  savedLocationHint: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 2,
  },
  editNameButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
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
  // Location Info Scroll Styles
  locationInfoScrollView: {
    flex: 1,
  },
  locationInfoScrollContent: {
    paddingBottom: 24,
  },
  // Location Info Section Styles
  locationInfoSection: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  locationInfoRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  locationInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.tertiary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  locationInfoValue: {
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  // Create Location Form Styles
  createLocationContainer: {
    flex: 1,
  },
  createLocationScroll: {
    flex: 1,
  },
  createLocationContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formSection: {
    marginBottom: 20,
  },
  formSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  formSectionRowContent: {
    flex: 1,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.tertiary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  formInput: {
    fontSize: 16,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.medium,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  formValue: {
    fontSize: 15,
    color: theme.colors.text.primary,
    lineHeight: 22,
  },
  formValueLarge: {
    fontSize: 18,
    fontWeight: '500',
    color: theme.colors.text.primary,
    lineHeight: 24,
  },
  okButtonFull: {
    backgroundColor: theme.colors.text.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  formDivider: {
    height: 1,
    backgroundColor: theme.colors.border.light,
    marginBottom: 20,
  },
  formActions: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border.medium,
    backgroundColor: '#fff',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginLeft: 8,
  },
  actionButtonDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  actionButtonDangerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
    marginLeft: 8,
  },
  okButton: {
    backgroundColor: theme.colors.text.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  okButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  clearLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  clearLocationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
    marginLeft: 8,
  },
  reselectLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border.medium,
    backgroundColor: theme.colors.background.secondary,
  },
  reselectLocationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginLeft: 8,
  },
  selectLink: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
  selectButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  poiRightContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
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
