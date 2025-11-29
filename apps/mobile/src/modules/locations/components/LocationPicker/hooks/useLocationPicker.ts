/**
 * useLocationPicker Hook
 *
 * Manages all state and logic for the LocationPicker component:
 * - GPS location fetching
 * - Map state and interactions
 * - Selection state (single source of truth)
 * - Reverse geocoding (via core hooks)
 * - Saved/nearby location filtering
 *
 * All API calls go through core layer hooks:
 * - useReverseGeocode (Mapbox via core)
 * - useNearbyPOIs (Foursquare via core)
 * - useLocationAutocomplete (Foursquare via core)
 * - useLocations (SQLite via mobileLocationHooks)
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import {
  useReverseGeocode,
  useNearbyPOIs,
  useLocationAutocomplete,
  parseMapboxHierarchy,
  calculateDistance,
  type POIItem,
  type Location as LocationType,
  type LocationEntity,
  type MapboxReverseGeocodeResponse,
} from '@trace/core';
import { useLocations } from '../../../mobileLocationHooks';
import {
  type LocationSelection,
  type LocationPickerUI,
  type MapState,
  type LocationPickerMode,
  createEmptySelection,
  createSelectionFromLocation,
  createSelectionFromPOI,
  createSelectionFromMapTap,
} from '../../../types/LocationPickerTypes';

interface UseLocationPickerProps {
  visible: boolean;
  initialLocation?: LocationType | null;
  mode: LocationPickerMode;
  onSelect: (location: LocationType | null) => void;
  onClose: () => void;
}

interface TappedGooglePOI {
  placeId: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string | null;
}

interface PreviewMarker {
  latitude: number;
  longitude: number;
  name: string;
}

/**
 * Parse Mapbox response to extract location hierarchy
 * Uses core's parseMapboxHierarchy and enriches with additional fields
 */
function enrichLocationFromMapbox(
  location: LocationType,
  response: MapboxReverseGeocodeResponse
): LocationType {
  const hierarchy = parseMapboxHierarchy(response);

  // Get street address from the main feature
  let streetAddress: string | null = null;
  if (response.features.length > 0) {
    const feature = response.features[0];
    // MapboxFeature doesn't have 'address' property - use place_name
    if (feature.place_name) {
      streetAddress = feature.place_name.split(',')[0];
    }
  }

  return {
    ...location,
    address: streetAddress || location.address || null,
    city: hierarchy.place || location.city || null,
    region: hierarchy.region || location.region || null,
    country: hierarchy.country || location.country || null,
    postalCode: hierarchy.postcode || location.postalCode || null,
    neighborhood: hierarchy.neighborhood || location.neighborhood || null,
    subdivision: hierarchy.district || location.subdivision || null,
  };
}

export function useLocationPicker({
  visible,
  initialLocation,
  mode: propMode,
  onSelect,
  onClose,
}: UseLocationPickerProps) {
  // Internal mode override - allows switching from view to select
  const [modeOverride, setModeOverride] = useState<LocationPickerMode | null>(null);
  const effectiveMode: LocationPickerMode = modeOverride ?? propMode;

  // Fetch all saved locations via React Query hook (SQLite)
  const { data: allSavedLocations = [] } = useLocations();

  // UNIFIED STATE ARCHITECTURE
  // 1. Selection state - SINGLE SOURCE OF TRUTH for what user has chosen
  const [selection, setSelection] = useState<LocationSelection>(createEmptySelection());

  // 2. UI state - View mode and input fields
  const [ui, setUI] = useState<LocationPickerUI>({
    showingDetails: !!initialLocation,
    searchQuery: '',
    editableNameInput: '',
  });

  // Tab state for Nearby/Saved
  const [activeListTab, setActiveListTab] = useState<'nearby' | 'saved'>('nearby');

  // 3. Map state - Separate from selection (map can pan independently)
  const [mapState, setMapState] = useState<MapState>({
    region: initialLocation ? {
      latitude: initialLocation.latitude,
      longitude: initialLocation.longitude,
      latitudeDelta: 0.005,
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

  // State for tapped Google Maps POI
  const [tappedGooglePOI, setTappedGooglePOI] = useState<TappedGooglePOI | null>(null);

  // State for preview marker (red)
  const [previewMarker, setPreviewMarker] = useState<PreviewMarker | null>(null);

  // State to track selected list item for visual highlighting
  const [selectedListItemId, setSelectedListItemId] = useState<string | null>(null);

  // Refs
  const mapRef = useRef<MapView>(null);
  const blueMarkerRef = useRef<any>(null);
  const redMarkerRef = useRef<any>(null);

  // Initialize when picker opens
  useEffect(() => {
    if (visible) {
      setModeOverride(null);

      if (initialLocation) {
        const hasLocationName = !!initialLocation.name;
        const isGpsOnlyEntry = !hasLocationName && !initialLocation.address;

        const newSelection = isGpsOnlyEntry
          ? createSelectionFromMapTap(
              initialLocation.originalLatitude || initialLocation.latitude,
              initialLocation.originalLongitude || initialLocation.longitude
            )
          : createSelectionFromLocation(initialLocation);
        setSelection(newSelection);

        setUI(prev => ({
          ...prev,
          showingDetails: hasLocationName,
          editableNameInput: initialLocation.name || '',
        }));

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

        setReverseGeocodeRequest({
          latitude: initialLocation.originalLatitude || initialLocation.latitude,
          longitude: initialLocation.originalLongitude || initialLocation.longitude,
        });

        if (!isGpsOnlyEntry) {
          setSelection(prev => ({ ...prev, isLoadingDetails: true }));
        }
      } else {
        setSelection(createEmptySelection());
        setTappedGooglePOI(null);
        setUI({
          showingDetails: false,
          searchQuery: '',
          editableNameInput: '',
        });
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

  // Fetch current GPS location when picker opens (using expo-location)
  useEffect(() => {
    if (visible && !initialLocation && !mapState.region) {
      setIsLoadingLocation(true);

      const fetchCurrentLocation = async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            let location = await Location.getLastKnownPositionAsync();
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
              const newSelection = createSelectionFromMapTap(coords.latitude, coords.longitude);
              setSelection(newSelection);
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

  // Filter saved locations by distance when marker position changes
  useEffect(() => {
    if (!mapState.markerPosition || ui.showingDetails) {
      return;
    }

    setIsLoadingSavedLocations(true);

    const nearbyRadius = 16093; // 10 miles in meters
    const locationsWithDistance = allSavedLocations
      .map((loc: LocationEntity) => {
        const distance = calculateDistance(
          { latitude: mapState.markerPosition!.latitude, longitude: mapState.markerPosition!.longitude },
          { latitude: loc.latitude, longitude: loc.longitude }
        );
        return { ...loc, distance: distance.meters };
      })
      .filter((loc: LocationEntity & { distance: number }) => loc.distance <= nearbyRadius)
      .sort((a: LocationEntity & { distance: number }, b: LocationEntity & { distance: number }) => a.distance - b.distance);

    setSavedLocations(locationsWithDistance);
    setIsLoadingSavedLocations(false);
  }, [mapState.markerPosition?.latitude, mapState.markerPosition?.longitude, ui.showingDetails, allSavedLocations]);

  // Auto-show callout when preview marker appears
  useEffect(() => {
    if (previewMarker && redMarkerRef.current) {
      const timer = setTimeout(() => {
        redMarkerRef.current?.showCallout();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [previewMarker]);

  // Calculate dynamic search radius based on map width
  const calculateSearchRadius = useCallback((region: MapState['region']): number => {
    if (!region) return 500;
    const latitude = region.latitude;
    const longitudeDelta = region.longitudeDelta;
    const metersPerDegreeLon = 111320 * Math.cos(latitude * Math.PI / 180);
    const mapWidthMeters = longitudeDelta * metersPerDegreeLon;
    const radius = Math.round(mapWidthMeters / 2);
    return Math.max(500, Math.min(10000, radius));
  }, []);

  // Fetch nearby POIs via core hook (Foursquare)
  const nearbyRequest = useMemo(() => {
    if (ui.showingDetails || !mapState.markerPosition || ui.searchQuery.length > 0) {
      return null;
    }
    const radius = calculateSearchRadius(mapState.region);
    return {
      latitude: mapState.markerPosition.latitude,
      longitude: mapState.markerPosition.longitude,
      radius,
      limit: 50
    };
  }, [ui.showingDetails, mapState.markerPosition?.latitude, mapState.markerPosition?.longitude, mapState.region?.longitudeDelta, mapState.region?.latitude, ui.searchQuery.length, calculateSearchRadius]);

  const { data: nearbyPOIs, isLoading: nearbyLoading } = useNearbyPOIs(nearbyRequest);

  // Fetch autocomplete results via core hook (Foursquare)
  const searchRequest = useMemo(() => {
    return !ui.showingDetails && ui.searchQuery.length >= 2 && mapState.region
      ? { query: ui.searchQuery, latitude: mapState.region.latitude, longitude: mapState.region.longitude }
      : null;
  }, [ui.showingDetails, ui.searchQuery, mapState.region?.latitude, mapState.region?.longitude]);

  const { data: searchResults, isLoading: searchLoading } = useLocationAutocomplete(searchRequest);

  // Fetch reverse geocode data via core hook (Mapbox)
  const { data: mapboxData, isLoading: mapboxLoading } = useReverseGeocode(reverseGeocodeRequest);

  // Update selection with Mapbox data when it arrives
  useEffect(() => {
    if (selection.isLoadingDetails && mapboxData && !mapboxLoading && selection.location) {
      // Use core helper to parse and enrich location
      const enrichedLocation = enrichLocationFromMapbox(selection.location, mapboxData);

      // Store mapboxJson for privacy level selection (temporary, not saved to entry)
      (enrichedLocation as any).mapboxJson = mapboxData;

      setSelection(prev => ({
        ...prev,
        location: enrichedLocation,
        isLoadingDetails: false,
      }));

      if (tappedGooglePOI) {
        setTappedGooglePOI(prev => prev ? {
          ...prev,
          address: enrichedLocation.address,
        } : null);
      }

      if (enrichedLocation.name && !ui.editableNameInput && selection.type !== 'map_tap') {
        setUI(prev => ({ ...prev, editableNameInput: enrichedLocation.name || '' }));
      }

      if (ui.quickSelectMode && enrichedLocation.name) {
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

        setUI(prev => ({ ...prev, quickSelectMode: false }));
        onSelect(finalLocation);
        onClose();
      }
    }
  }, [selection.isLoadingDetails, mapboxData, mapboxLoading, selection.type, ui.editableNameInput, ui.quickSelectMode, onSelect, onClose, tappedGooglePOI]);

  // Handler: Saved location selected from list
  const handleSavedLocationSelect = useCallback((location: LocationEntity & { distance: number }) => {
    const coords = {
      latitude: location.latitude,
      longitude: location.longitude,
    };

    setMapState(prev => ({
      region: {
        ...coords,
        latitudeDelta: prev.region?.latitudeDelta || 0.005,
        longitudeDelta: prev.region?.longitudeDelta || 0.005,
      },
      markerPosition: coords,
    }));

    if (mapRef.current) {
      mapRef.current.animateToRegion({
        ...coords,
        latitudeDelta: mapState.region?.latitudeDelta || 0.005,
        longitudeDelta: mapState.region?.longitudeDelta || 0.005,
      }, 300);
    }

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
      locationId: location.location_id,
    };
    setSelection(newSelection);

    setUI(prev => ({
      ...prev,
      showingDetails: true,
      editableNameInput: location.name,
    }));

    setReverseGeocodeRequest({ latitude: location.latitude, longitude: location.longitude });
  }, [mapState.region]);

  // Handler: POI selected from list
  const handlePOISelect = useCallback((poi: POIItem) => {
    const coords = {
      latitude: poi.latitude,
      longitude: poi.longitude,
    };

    setMapState(prev => ({
      region: {
        ...coords,
        latitudeDelta: prev.region?.latitudeDelta || 0.005,
        longitudeDelta: prev.region?.longitudeDelta || 0.005,
      },
      markerPosition: coords,
    }));

    if (mapRef.current) {
      mapRef.current.animateToRegion({
        ...coords,
        latitudeDelta: mapState.region?.latitudeDelta || 0.005,
        longitudeDelta: mapState.region?.longitudeDelta || 0.005,
      }, 300);
    }

    const newSelection = createSelectionFromPOI(poi);
    setSelection(newSelection);

    setUI(prev => ({
      ...prev,
      showingDetails: true,
      editableNameInput: poi.name,
    }));

    setReverseGeocodeRequest({ latitude: poi.latitude, longitude: poi.longitude });
  }, [mapState.region]);

  // Handler: Google POI clicked on map
  const handleGooglePOIClick = useCallback((event: any) => {
    const { name, placeId, coordinate } = event.nativeEvent;

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

    if (ui.showingDetails) {
      setUI(prev => ({
        ...prev,
        showingDetails: false,
        editableNameInput: name,
      }));
    }

    setReverseGeocodeRequest({ latitude: coordinate.latitude, longitude: coordinate.longitude });
  }, [ui.showingDetails]);

  // Handler: Map region changed
  const handleRegionChangeComplete = useCallback((region: any) => {
    const hasSignificantChange = !mapState.region ||
      Math.abs(region.latitudeDelta - mapState.region.latitudeDelta) > 0.0001 ||
      Math.abs(region.longitude - mapState.region.longitude) > 0.001 ||
      Math.abs(region.latitude - mapState.region.latitude) > 0.001;

    if (!hasSignificantChange) return;

    setMapState(prev => ({
      ...prev,
      region: {
        latitude: region.latitude,
        longitude: region.longitude,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      },
    }));
  }, [mapState.region]);

  // Handler: Map tapped
  const handleMapPress = useCallback((event: any) => {
    const { coordinate } = event.nativeEvent;

    setPreviewMarker(null);
    setSelectedListItemId(null);

    if (ui.showingDetails) {
      const coords = {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      };

      setMapState(prev => ({
        region: {
          ...coords,
          latitudeDelta: prev.region?.latitudeDelta || 0.01,
          longitudeDelta: prev.region?.longitudeDelta || 0.01,
        },
        markerPosition: coords,
      }));

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

      setReverseGeocodeRequest({ latitude: coordinate.latitude, longitude: coordinate.longitude });
      return;
    }

    const coords = {
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    };

    setMapState(prev => ({
      region: {
        ...coords,
        latitudeDelta: prev.region?.latitudeDelta || 0.01,
        longitudeDelta: prev.region?.longitudeDelta || 0.01,
      },
      markerPosition: coords,
    }));

    setTappedGooglePOI(null);

    const newSelection = createSelectionFromMapTap(coordinate.latitude, coordinate.longitude);
    setSelection(newSelection);

    setReverseGeocodeRequest({ latitude: coordinate.latitude, longitude: coordinate.longitude });
  }, [ui.showingDetails]);

  // Handler: OK button
  const handleOKPress = useCallback(() => {
    if (selection.location) {
      const finalLocation: LocationType = {
        location_id: selection.location.location_id,
        latitude: selection.location.latitude,
        longitude: selection.location.longitude,
        originalLatitude: selection.location.originalLatitude ?? selection.location.latitude,
        originalLongitude: selection.location.originalLongitude ?? selection.location.longitude,
        name: ui.editableNameInput || selection.location.name || null,
        source: selection.location.source,
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

      onSelect(finalLocation);
      onClose();
    }
  }, [selection.location, ui.editableNameInput, onSelect, onClose]);

  // Handler: Center on my location (uses expo-location)
  const handleCenterOnMyLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

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

        // In view mode, zoom to fit both marker and user location
        if (effectiveMode === 'view' && mapState.markerPosition) {
          const markerLat = mapState.markerPosition.latitude;
          const markerLng = mapState.markerPosition.longitude;
          const userLat = coords.latitude;
          const userLng = coords.longitude;

          const centerLat = (markerLat + userLat) / 2;
          const centerLng = (markerLng + userLng) / 2;
          const latDelta = Math.abs(markerLat - userLat) * 1.5;
          const lngDelta = Math.abs(markerLng - userLng) * 1.5;

          const fitRegion = {
            latitude: centerLat,
            longitude: centerLng,
            latitudeDelta: Math.max(latDelta, 0.01),
            longitudeDelta: Math.max(lngDelta, 0.01),
          };

          mapRef.current.animateToRegion(fitRegion, 500);
          setMapState(prev => ({
            ...prev,
            region: fitRegion,
          }));
          return;
        }

        // Select mode - animate and move marker
        mapRef.current.animateToRegion(newRegion, 500);
        setMapState(prev => ({
          ...prev,
          region: newRegion,
          markerPosition: coords,
        }));

        const newSelection = createSelectionFromMapTap(coords.latitude, coords.longitude);
        setSelection(newSelection);
        setReverseGeocodeRequest(coords);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  }, [effectiveMode, mapState.markerPosition]);

  // Handler: Switch to select mode (from view mode)
  const handleSwitchToSelectMode = useCallback(() => {
    setModeOverride('select');
    setUI(prev => ({ ...prev, showingDetails: false }));
    setPreviewMarker(null);
  }, []);

  // Handler: Remove location
  const handleRemoveLocation = useCallback(() => {
    onSelect(null);
    onClose();
  }, [onSelect, onClose]);

  // Displayed POIs
  const displayedPOIs = ui.searchQuery.length >= 2 ? searchResults : nearbyPOIs;
  const displayedLoading = ui.searchQuery.length >= 2 ? searchLoading : nearbyLoading;

  return {
    // Mode
    effectiveMode,
    setModeOverride,

    // Selection
    selection,
    setSelection,

    // UI State
    ui,
    setUI,
    activeListTab,
    setActiveListTab,

    // Map State
    mapState,
    setMapState,
    mapRef,
    blueMarkerRef,
    redMarkerRef,

    // Loading States
    isLoadingLocation,
    isLoadingSavedLocations,

    // Locations
    savedLocations,
    displayedPOIs,
    displayedLoading,

    // Google POI
    tappedGooglePOI,
    setTappedGooglePOI,

    // Preview Marker
    previewMarker,
    setPreviewMarker,

    // Selected List Item
    selectedListItemId,
    setSelectedListItemId,

    // Reverse Geocode Request
    setReverseGeocodeRequest,

    // Handlers
    handleSavedLocationSelect,
    handlePOISelect,
    handleGooglePOIClick,
    handleRegionChangeComplete,
    handleMapPress,
    handleOKPress,
    handleCenterOnMyLocation,
    handleSwitchToSelectMode,
    handleRemoveLocation,

    // Helpers
    calculateSearchRadius,
  };
}
