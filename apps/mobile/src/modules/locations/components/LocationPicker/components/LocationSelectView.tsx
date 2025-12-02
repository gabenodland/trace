/**
 * LocationSelectView Component
 *
 * Shows the search input, Nearby/Saved tabs, and POI list.
 * Used when user is selecting a location (not viewing details).
 */

import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import {
  type POIItem,
  type LocationEntity,
  calculateDistance,
  formatDistanceWithUnits,
} from '@trace/core';
import { useSettings } from '../../../../../shared/contexts/SettingsContext';
import { locationPickerStyles as styles } from '../../../styles/locationPickerStyles';
import {
  type LocationSelection,
  type LocationPickerUI,
  type MapState,
} from '../../../types/LocationPickerTypes';
import type MapView from 'react-native-maps';

interface TappedGooglePOI {
  placeId: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string | null;
}

interface LocationSelectViewProps {
  // UI State
  ui: LocationPickerUI;
  setUI: React.Dispatch<React.SetStateAction<LocationPickerUI>>;
  activeListTab: 'nearby' | 'saved';
  setActiveListTab: React.Dispatch<React.SetStateAction<'nearby' | 'saved'>>;

  // Selection
  selection: LocationSelection;
  setSelection: React.Dispatch<React.SetStateAction<LocationSelection>>;

  // Map State
  mapState: MapState;
  mapRef: React.RefObject<MapView | null>;

  // Loading States
  isLoadingSavedLocations: boolean;

  // Locations
  savedLocations: Array<LocationEntity & { distance: number }>;
  displayedPOIs: POIItem[] | undefined;
  displayedLoading: boolean;

  // Google POI
  tappedGooglePOI: TappedGooglePOI | null;

  // Preview Marker
  previewMarker: { latitude: number; longitude: number; name: string } | null;
  setPreviewMarker: React.Dispatch<React.SetStateAction<{ latitude: number; longitude: number; name: string } | null>>;

  // Selected List Item
  selectedListItemId: string | null;
  setSelectedListItemId: React.Dispatch<React.SetStateAction<string | null>>;

  // Reverse Geocode
  setReverseGeocodeRequest: React.Dispatch<React.SetStateAction<{ latitude: number; longitude: number } | null>>;

  // Handlers
  handlePOISelect: (poi: POIItem) => void;

  // Callbacks
  onSelect: (location: any) => void;
  onClose: () => void;
}

export function LocationSelectView({
  ui,
  setUI,
  activeListTab,
  setActiveListTab,
  selection,
  setSelection,
  mapState,
  mapRef,
  isLoadingSavedLocations,
  savedLocations,
  displayedPOIs,
  displayedLoading,
  tappedGooglePOI,
  previewMarker,
  setPreviewMarker,
  selectedListItemId,
  setSelectedListItemId,
  setReverseGeocodeRequest,
  handlePOISelect,
  onSelect,
  onClose,
}: LocationSelectViewProps) {
  const { settings } = useSettings();

  // Get subtitle text for "Currently Selected" row
  const getSubtitleText = () => {
    if (selection.isLoadingDetails) {
      return 'Loading address...';
    }
    if (selection.location?.address) {
      return selection.location.address;
    }
    const coords = selection.location
      ? { lat: selection.location.latitude, lng: selection.location.longitude }
      : mapState.markerPosition
        ? { lat: mapState.markerPosition.latitude, lng: mapState.markerPosition.longitude }
        : null;

    if (coords) {
      return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
    }
    return 'Tap map to set location';
  };

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
    googlePOI?: TappedGooglePOI;
  };

  const buildMergedList = (): MergedItem[] => {
    const mergedItems: MergedItem[] = [];

    const isSearching = ui.searchQuery.length >= 2;
    const showSavedOnly = !isSearching && activeListTab === 'saved';
    const showNearby = isSearching || activeListTab === 'nearby';

    const googlePoiName = tappedGooglePOI?.name.toLowerCase().trim();

    // Add tapped Google POI as first item
    if (tappedGooglePOI && showNearby && !isSearching) {
      mergedItems.push({
        type: 'google_poi',
        id: `google-${tappedGooglePOI.placeId}`,
        name: tappedGooglePOI.name,
        distance: 0,
        address: tappedGooglePOI.address || `${tappedGooglePOI.latitude.toFixed(6)}, ${tappedGooglePOI.longitude.toFixed(6)}`,
        googlePOI: tappedGooglePOI,
      });
    }

    // Add saved locations
    if (savedLocations.length > 0 && (showSavedOnly || showNearby)) {
      savedLocations.forEach(loc => {
        if (isSearching) {
          const query = ui.searchQuery.toLowerCase().trim();
          const matchesName = loc.name.toLowerCase().includes(query);
          const matchesCity = loc.city?.toLowerCase().includes(query);
          const matchesAddress = loc.address?.toLowerCase().includes(query);
          if (!matchesName && !matchesCity && !matchesAddress) {
            return;
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

    // Add POIs (only for Nearby tab or when searching)
    if (showNearby && !showSavedOnly && displayedPOIs && displayedPOIs.length > 0) {
      const savedLocationKeys = new Map<string, LocationEntity & { distance: number }>();
      savedLocations.forEach(loc => {
        const nameKey = loc.name.toLowerCase().trim();
        savedLocationKeys.set(nameKey, loc);
        if (loc.address) {
          const fullKey = `${nameKey}|${loc.address.toLowerCase().trim()}`;
          savedLocationKeys.set(fullKey, loc);
        }
      });

      displayedPOIs.forEach(poi => {
        const normalizedName = poi.name.toLowerCase().trim();
        const normalizedAddress = poi.address?.toLowerCase().trim() || '';

        const fullKey = normalizedAddress ? `${normalizedName}|${normalizedAddress}` : '';
        const isDuplicateByFullKey = fullKey && savedLocationKeys.has(fullKey);
        const isDuplicateByName = savedLocationKeys.has(normalizedName);
        const isDuplicateOfSaved = isDuplicateByFullKey || isDuplicateByName;
        const isDuplicateOfGoogle = googlePoiName && normalizedName === googlePoiName;

        if (isDuplicateOfSaved || isDuplicateOfGoogle) {
          return;
        }

        const isSearching = ui.searchQuery.length >= 2;
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

    // Sort by distance
    mergedItems.sort((a, b) => a.distance - b.distance);

    return mergedItems;
  };

  const mergedItems = buildMergedList();
  const isLoading = displayedLoading || isLoadingSavedLocations;
  const hasItems = mergedItems.length > 0;

  // Handle item selection (Select button press)
  const handleItemSelect = (item: MergedItem) => {
    if (item.type === 'saved' && item.savedLocation) {
      const loc = item.savedLocation;
      onSelect({
        location_id: loc.location_id,
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
      setUI(prev => ({ ...prev, quickSelectMode: true }));
      handlePOISelect(item.poi);
    } else if (item.type === 'google_poi' && item.googlePOI) {
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
  };

  // Render icon based on item type and selection state
  const renderIcon = (item: MergedItem, isSelected: boolean) => {
    // Saved items: yellow star normally, red pin when selected (on yellow background)
    if (item.type === 'saved') {
      if (isSelected) {
        return (
          <View style={[styles.poiIconContainer, styles.poiIconContainerSaved]}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth={2}>
              <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={12} cy={10} r={3} fill="white" />
            </Svg>
          </View>
        );
      }
      return (
        <View style={[styles.poiIconContainer, styles.poiIconContainerSaved]}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth={2}>
            <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      );
    }

    // Selected non-saved items show red pin (matches map marker)
    if (isSelected) {
      return (
        <View style={[styles.poiIconContainer, styles.poiIconContainerSelected]}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth={2}>
            <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={12} cy={10} r={3} fill="white" />
          </Svg>
        </View>
      );
    }

    // Default: gray pin
    return (
      <View style={styles.poiIconContainer}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
          <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={12} cy={10} r={3} fill="#6b7280" />
        </Svg>
      </View>
    );
  };

  return (
    <View style={styles.listContainer}>
      {/* Search Input with Icon */}
      <View style={styles.searchContainer}>
        <View style={styles.searchIcon}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2}>
            <Circle cx={11} cy={11} r={8} />
            <Path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </Svg>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search places..."
          placeholderTextColor="#9ca3af"
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

      {/* Results List */}
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

        {/* Currently Selected Location - Card at top */}
        {(selection.location || mapState.markerPosition) && (
          <TouchableOpacity
            style={[styles.poiItem, styles.mapLocationItem]}
            onPress={() => {
              // Click on row = refocus map on blue marker
              if (mapState.markerPosition && mapRef.current) {
                mapRef.current.animateToRegion({
                  latitude: mapState.markerPosition.latitude,
                  longitude: mapState.markerPosition.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }, 300);
                setPreviewMarker(null);
                setSelectedListItemId(null);
              }
            }}
          >
            {/* Blue marker icon */}
            <View style={[styles.poiIconContainer, { backgroundColor: '#dbeafe' }]}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="#3b82f6" stroke="#3b82f6" strokeWidth={2}>
                <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={12} cy={10} r={3} fill="white" />
              </Svg>
            </View>
            <View style={styles.poiInfo}>
              <Text style={styles.poiName}>
                {selection.location?.name || 'Selected Location'}
              </Text>
              <Text style={styles.poiCategory} numberOfLines={1}>{getSubtitleText()}</Text>
            </View>
            {/* Use button - consistent with Select buttons */}
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                setUI(prev => ({
                  ...prev,
                  showingDetails: true,
                  editableNameInput: selection.location?.name || '',
                }));
                setPreviewMarker(null);
              }}
              style={styles.useButton}
            >
              <Text style={styles.useButtonText}>New</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* POI List */}
        {hasItems && !isLoading && (
          <>
            {mergedItems.map((item) => {
              const isSelected = selectedListItemId === item.id;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.poiItem,
                    item.type === 'saved' && styles.savedLocationItem,
                    isSelected && styles.poiItemSelected
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
                      setSelectedListItemId(item.id);
                      mapRef.current.animateToRegion({
                        ...coords,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                      }, 300);
                      setPreviewMarker({
                        latitude: coords.latitude,
                        longitude: coords.longitude,
                        name: name,
                      });
                    }
                  }}
                >
                  {/* Icon */}
                  {renderIcon(item, isSelected)}

                  {/* Info */}
                  <View style={styles.poiInfo}>
                    <Text style={styles.poiName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.type === 'poi' && item.category && typeof item.category === 'string' && (
                      <Text style={styles.poiCategory} numberOfLines={1}>{item.category}</Text>
                    )}
                    {item.type === 'google_poi' && (
                      <Text style={styles.poiCategory}>From map</Text>
                    )}
                    {item.type === 'saved' && item.city && (
                      <Text style={styles.poiCategory} numberOfLines={1}>{item.city}</Text>
                    )}
                    {item.address && typeof item.address === 'string' && (
                      <Text style={styles.poiAddress} numberOfLines={1}>{item.address}</Text>
                    )}
                  </View>

                  {/* Right side: Distance + Select button (only when selected) */}
                  <View style={styles.poiRightColumn}>
                    <Text style={styles.poiDistance}>
                      {formatDistanceWithUnits(item.distance, settings.units)}
                    </Text>
                    {isSelected && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleItemSelect(item);
                        }}
                        style={styles.selectButton}
                      >
                        <Text style={styles.selectButtonText}>Select</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Empty state */}
        {!isLoading && !hasItems && !selection.location && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {ui.searchQuery.length >= 2
                ? 'No results found'
                : activeListTab === 'saved'
                  ? 'No saved locations'
                  : 'No nearby places found'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {ui.searchQuery.length >= 2
                ? 'Try a different search term'
                : activeListTab === 'saved'
                  ? 'Save locations from the Nearby tab'
                  : 'Tap the map to drop a pin'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
