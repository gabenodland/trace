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
  locationToCreateInput,
  type POIItem,
  type Location as LocationType,
  type LocationEntity,
  type MapboxReverseGeocodeResponse,
} from '@trace/core';
import { useLocationsWithCounts, useUpdateLocationDetails } from '../../../mobileLocationHooks';
import { createLocation } from '../../../mobileLocationApi';
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
 *
 * For most geo fields: replaces with Mapbox data (prevents stale data).
 * For address: preserves existing if Mapbox returns none (keeps tiledata like "Missouri River").
 *
 * This is important for water body locations where:
 * - Tilequery returned "Missouri River" as address
 * - Mapbox reverse geocode returns no nearby address (filtered by distance)
 * - We want to keep "Missouri River" instead of replacing with null
 */
function enrichLocationFromMapbox(
  location: LocationType,
  response: MapboxReverseGeocodeResponse
): LocationType {
  // parseMapboxHierarchy includes distance validation - address/poi/neighborhood
  // are only returned if the feature is within 500ft of the query point
  const hierarchy = parseMapboxHierarchy(response);

  // For address: preserve existing if Mapbox doesn't return one
  // This keeps tiledata (like "Missouri River") when viewing saved water body locations
  const newAddress = hierarchy.address || location.address || null;

  // Replace geo fields from Mapbox, but preserve address from tiledata
  return {
    ...location,
    address: newAddress,
    city: hierarchy.place || null,
    region: hierarchy.region || null,
    country: hierarchy.country || null,
    postalCode: hierarchy.postcode || null,
    neighborhood: hierarchy.neighborhood || null,
    subdivision: hierarchy.district || null,
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

  // Fetch all saved locations with entry counts via React Query hook (SQLite)
  const { data: allSavedLocations = [] } = useLocationsWithCounts();

  // Mutation for updating location details (name and address)
  const updateLocationDetailsMutation = useUpdateLocationDetails();

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

  // State for saved locations from SQLite (My Places) - includes entry counts
  const [savedLocations, setSavedLocations] = useState<Array<LocationEntity & { distance: number; entry_count: number }>>([]);
  const [isLoadingSavedLocations, setIsLoadingSavedLocations] = useState(false);

  // State for triggering reverse geocoding
  const [reverseGeocodeRequest, setReverseGeocodeRequest] = useState<{ latitude: number; longitude: number } | null>(null);

  // State for tapped Google Maps POI
  const [tappedGooglePOI, setTappedGooglePOI] = useState<TappedGooglePOI | null>(null);

  // State for preview marker (red)
  const [previewMarker, setPreviewMarker] = useState<PreviewMarker | null>(null);

  // State to track selected list item for visual highlighting
  const [selectedListItemId, setSelectedListItemId] = useState<string | null>(null);

  // State to track if "Selected Location" row is highlighted
  const [isSelectedLocationHighlighted, setIsSelectedLocationHighlighted] = useState(false);

  // GPS accuracy in meters (for circle on map)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

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

        // Look up entry count if this is a saved location
        let entryCount: number | undefined;
        if (initialLocation.location_id && allSavedLocations.length > 0) {
          const savedLoc = allSavedLocations.find(
            loc => loc.location_id === initialLocation.location_id
          );
          entryCount = savedLoc?.entry_count;
        }

        setSelection({
          ...newSelection,
          locationId: initialLocation.location_id,
          entryCount,
          // In view mode, don't show loading since we're not reverse geocoding
          // (createSelectionFromMapTap sets isLoadingDetails: true by default)
          isLoadingDetails: propMode === 'view' ? false : newSelection.isLoadingDetails,
        });

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

        // Set GPS accuracy for the accuracy ring on the map
        if (initialLocation.accuracy && initialLocation.accuracy > 0) {
          setGpsAccuracy(initialLocation.accuracy);
        } else {
          setGpsAccuracy(null);
        }

        // Only reverse geocode in SELECT mode (not view mode)
        // In view mode, we use the saved data as-is to respect user's cleared address
        if (propMode !== 'view') {
          setReverseGeocodeRequest({
            latitude: initialLocation.originalLatitude || initialLocation.latitude,
            longitude: initialLocation.originalLongitude || initialLocation.longitude,
          });

          if (!isGpsOnlyEntry) {
            setSelection(prev => ({ ...prev, isLoadingDetails: true }));
          }
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
        setGpsAccuracy(null);
      }
    }
  }, [visible]);

  // Update entry count when allSavedLocations loads (may not be ready on first render)
  useEffect(() => {
    if (selection.locationId && allSavedLocations.length > 0 && selection.entryCount === undefined) {
      const savedLoc = allSavedLocations.find(
        loc => loc.location_id === selection.locationId
      );
      if (savedLoc) {
        setSelection(prev => ({ ...prev, entryCount: savedLoc.entry_count }));
      }
    }
  }, [selection.locationId, allSavedLocations, selection.entryCount]);

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
              // Store GPS accuracy for circle display
              if (location.coords.accuracy) {
                setGpsAccuracy(location.coords.accuracy);
              }
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
      .map((loc: LocationEntity & { entry_count: number }) => {
        const distance = calculateDistance(
          { latitude: mapState.markerPosition!.latitude, longitude: mapState.markerPosition!.longitude },
          { latitude: loc.latitude, longitude: loc.longitude }
        );
        return { ...loc, distance: distance.meters };
      })
      .filter((loc: LocationEntity & { distance: number; entry_count: number }) => loc.distance <= nearbyRadius)
      .sort((a: LocationEntity & { distance: number; entry_count: number }, b: LocationEntity & { distance: number; entry_count: number }) => a.distance - b.distance);

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
    // DEBUG: Log effect state
    console.log('[LocationPicker] 📍 Mapbox effect check:', {
      isLoadingDetails: selection.isLoadingDetails,
      hasMapboxData: !!mapboxData,
      mapboxLoading,
      hasLocation: !!selection.location,
      reverseGeocodeRequest,
    });

    if (selection.isLoadingDetails && mapboxData && !mapboxLoading && selection.location) {
      // DEBUG: Log full Mapbox response
      console.log('[LocationPicker] 📍 MAPBOX RESPONSE - Processing data');

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
  }, [selection.isLoadingDetails, mapboxData, mapboxLoading, selection.type, ui.editableNameInput, ui.quickSelectMode, onSelect, onClose, tappedGooglePOI, reverseGeocodeRequest]);

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
    setIsSelectedLocationHighlighted(false);
    // Clear GPS accuracy when user manually taps the map (no longer GPS position)
    setGpsAccuracy(null);

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

  // Handler: Clear address (for saving location without nearby address)
  const handleClearAddress = useCallback(() => {
    if (selection.location) {
      setSelection(prev => ({
        ...prev,
        location: prev.location ? {
          ...prev.location,
          address: null,
        } : null,
      }));
    }
  }, [selection.location]);

  // Handler: Lookup address (re-trigger reverse geocoding after clearing)
  const handleLookupAddress = useCallback(() => {
    if (selection.location) {
      console.log('[LocationPicker] 🔍 handleLookupAddress called, re-triggering reverse geocode');
      // Use original coordinates if available (preserves the original pin location)
      const lat = selection.location.originalLatitude ?? selection.location.latitude;
      const lng = selection.location.originalLongitude ?? selection.location.longitude;
      console.log('[LocationPicker] 🔍 Coordinates:', { lat, lng });

      // Set isLoadingDetails to true so the effect processes the result
      setSelection(prev => ({
        ...prev,
        isLoadingDetails: true,
      }));

      setReverseGeocodeRequest({ latitude: lat, longitude: lng });
    }
  }, [selection.location]);

  // Handler: OK button - saves location to database if new, then returns to parent
  const handleOKPress = useCallback(async () => {
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

      // If this is a new location (no location_id), save it to the database first
      if (!finalLocation.location_id && finalLocation.name) {
        try {
          const locationInput = locationToCreateInput(finalLocation);
          const savedLocation = await createLocation(locationInput);
          finalLocation.location_id = savedLocation.location_id;
        } catch (error) {
          console.error('Failed to save location:', error);
          // Still proceed with the location even if save fails
        }
      }

      onSelect(finalLocation);
      onClose();
    }
  }, [selection.location, ui.editableNameInput, onSelect, onClose]);

  // Handler: Center on my location (uses expo-location)
  // In Create mode (showingDetails), recenters on selected point instead
  const handleCenterOnMyLocation = useCallback(async () => {
    // In Create mode, just recenter on the selected point (don't get GPS)
    if (ui.showingDetails && mapState.markerPosition && mapRef.current) {
      const recenterRegion = {
        latitude: mapState.markerPosition.latitude,
        longitude: mapState.markerPosition.longitude,
        latitudeDelta: mapState.region?.latitudeDelta || 0.01,
        longitudeDelta: mapState.region?.longitudeDelta || 0.01,
      };
      mapRef.current.animateToRegion(recenterRegion, 300);
      setMapState(prev => ({
        ...prev,
        region: recenterRegion,
      }));
      return;
    }

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

        // Store GPS accuracy for circle display
        if (location.coords.accuracy) {
          setGpsAccuracy(location.coords.accuracy);
        }

        const newSelection = createSelectionFromMapTap(coords.latitude, coords.longitude);
        setSelection(newSelection);
        setReverseGeocodeRequest(coords);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  }, [effectiveMode, mapState.markerPosition, mapState.region, ui.showingDetails]);

  // Handler: Switch to select mode (from view mode)
  const handleSwitchToSelectMode = useCallback(() => {
    setModeOverride('select');
    setUI(prev => ({ ...prev, showingDetails: false }));
    setPreviewMarker(null);
  }, []);

  // Handler: Save dropped pin - switch to create mode to name and save the location
  const handleSaveDroppedPin = useCallback(() => {
    setModeOverride('select');
    setUI(prev => ({
      ...prev,
      showingDetails: true,
      editableNameInput: '', // Start with empty name for user to fill in
    }));
  }, []);

  // Handler: Remove location (for saved locations)
  // Unlinks from saved location (clears location_id and name) but preserves all GPS/geo data
  // After this, the entry becomes a "dropped pin" with coordinates and address data
  const handleRemoveLocation = useCallback(() => {
    if (selection.location && selection.locationId) {
      // Keep coordinates and reverse-geocoded data, just unlink from saved location
      const geoOnlyLocation: LocationType = {
        latitude: selection.location.latitude,
        longitude: selection.location.longitude,
        originalLatitude: selection.location.originalLatitude ?? selection.location.latitude,
        originalLongitude: selection.location.originalLongitude ?? selection.location.longitude,
        name: null, // Clear the place name
        source: 'user_custom', // No longer from a saved location
        // Preserve all reverse-geocoded address data
        address: selection.location.address,
        city: selection.location.city,
        region: selection.location.region,
        country: selection.location.country,
        postalCode: selection.location.postalCode,
        neighborhood: selection.location.neighborhood,
        subdivision: selection.location.subdivision,
        category: selection.location.category,
        distance: selection.location.distance,
        // No location_id - not linked to a saved location
      };
      onSelect(geoOnlyLocation);
      onClose();
    }
  }, [selection.location, selection.locationId, onSelect, onClose]);

  // Handler: Remove pin (clears ALL location data)
  // This completely removes all geo data from the entry
  const handleRemovePin = useCallback(() => {
    onSelect(null);
    onClose();
  }, [onSelect, onClose]);

  // Handler: Edit location details (name and address) - updates location and all entries using it
  const handleEditLocation = useCallback(async (newName: string) => {
    if (!selection.locationId || !newName.trim()) return;

    // Get current address from selection (may be null if user clicked "Clear Address")
    const currentAddress = selection.location?.address ?? null;

    try {
      await updateLocationDetailsMutation.mutateAsync({
        locationId: selection.locationId,
        name: newName.trim(),
        address: currentAddress,
      });

      // Update local selection with new name (address was already updated by handleClearAddress)
      const updatedLocation = selection.location ? { ...selection.location, name: newName.trim() } : null;

      setSelection(prev => ({
        ...prev,
        location: updatedLocation,
      }));

      // Update the editable name input
      setUI(prev => ({ ...prev, editableNameInput: newName.trim() }));

      // Propagate update to parent form - this ensures the current entry's form state is updated
      // without closing the picker (user can continue viewing/editing)
      if (updatedLocation) {
        const finalLocation: LocationType = {
          location_id: selection.locationId,
          latitude: updatedLocation.latitude,
          longitude: updatedLocation.longitude,
          originalLatitude: updatedLocation.originalLatitude ?? updatedLocation.latitude,
          originalLongitude: updatedLocation.originalLongitude ?? updatedLocation.longitude,
          name: newName.trim(),
          source: updatedLocation.source,
          address: currentAddress,
          postalCode: updatedLocation.postalCode,
          neighborhood: updatedLocation.neighborhood,
          city: updatedLocation.city,
          subdivision: updatedLocation.subdivision,
          region: updatedLocation.region,
          country: updatedLocation.country,
          category: updatedLocation.category,
          distance: updatedLocation.distance,
        };
        onSelect(finalLocation);
      }
    } catch (error) {
      console.error('Failed to update location details:', error);
    }
  }, [selection.locationId, selection.location, updateLocationDetailsMutation, setSelection, setUI, onSelect]);

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

    // Selected Location Highlight (for "Selected Location" row)
    isSelectedLocationHighlighted,
    setIsSelectedLocationHighlighted,

    // GPS Accuracy (for circle on map)
    gpsAccuracy,

    // Reverse Geocode Request
    setReverseGeocodeRequest,

    // Handlers
    handleSavedLocationSelect,
    handlePOISelect,
    handleGooglePOIClick,
    handleRegionChangeComplete,
    handleMapPress,
    handleOKPress,
    handleClearAddress,
    handleLookupAddress,
    handleCenterOnMyLocation,
    handleSwitchToSelectMode,
    handleSaveDroppedPin,
    handleRemoveLocation,
    handleRemovePin,
    handleEditLocation,

    // Helpers
    calculateSearchRadius,
  };
}
