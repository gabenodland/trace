/**
 * LocationSelectView Component
 *
 * Shows the search input, Nearby/Saved tabs, and POI list.
 * Used when user is selecting a location (not viewing details).
 */

import { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Keyboard } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import {
  type POIItem,
  type LocationEntity,
  calculateDistance,
  formatDistanceWithUnits,
  getStateAbbreviation,
} from '@trace/core';
import { useSettings } from '../../../../../shared/contexts/SettingsContext';
import { useTheme } from '../../../../../shared/contexts/ThemeContext';
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

// Ref type for external access to scroll methods
export interface LocationSelectViewRef {
  scrollToSelectedItem: () => void;
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

  // Offline status
  isOffline?: boolean;

  // Loading States
  isLoadingSavedLocations: boolean;

  // Locations (with entry counts for saved locations)
  savedLocations: Array<LocationEntity & { distance: number; entry_count: number }>;
  allSavedLocations: Array<LocationEntity & { entry_count: number }>; // All saved locations for search
  displayedPOIs: POIItem[] | undefined;
  displayedLoading: boolean;

  // Google POI
  tappedGooglePOI: TappedGooglePOI | null;

  // Preview Marker
  previewMarker: { latitude: number; longitude: number; name: string; locationRadius?: number | null } | null;
  setPreviewMarker: React.Dispatch<React.SetStateAction<{ latitude: number; longitude: number; name: string; locationRadius?: number | null } | null>>;

  // Selected List Item
  selectedListItemId: string | null;
  setSelectedListItemId: React.Dispatch<React.SetStateAction<string | null>>;

  // Selected Location Highlight (for "Selected Location" row)
  isSelectedLocationHighlighted: boolean;
  setIsSelectedLocationHighlighted: React.Dispatch<React.SetStateAction<boolean>>;

  // Reverse Geocode
  setReverseGeocodeRequest: React.Dispatch<React.SetStateAction<{ latitude: number; longitude: number } | null>>;

  // Handlers
  handlePOISelect: (poi: POIItem) => void;
  handlePOIQuickSelect: (poi: POIItem) => Promise<void>;
  handleSavedLocationSelect: (location: LocationEntity & { distance: number }) => void;

  // Keyboard
  keyboardHeight?: number;
}

export const LocationSelectView = forwardRef<LocationSelectViewRef, LocationSelectViewProps>(function LocationSelectView({
  ui,
  setUI,
  activeListTab,
  setActiveListTab,
  selection,
  setSelection,
  mapState,
  mapRef,
  isOffline = false,
  isLoadingSavedLocations,
  savedLocations,
  allSavedLocations,
  displayedPOIs,
  displayedLoading,
  tappedGooglePOI,
  previewMarker,
  setPreviewMarker,
  selectedListItemId,
  setSelectedListItemId,
  isSelectedLocationHighlighted,
  setIsSelectedLocationHighlighted,
  setReverseGeocodeRequest,
  handlePOISelect,
  handlePOIQuickSelect,
  handleSavedLocationSelect,
  keyboardHeight = 0,
}, ref) {
  const { settings } = useSettings();
  const dynamicTheme = useTheme();

  // Refs for scrolling
  const scrollViewRef = useRef<ScrollView>(null);
  const itemPositionsRef = useRef<Record<string, number>>({});

  // 3-click zoom pattern state - cycles through street -> city -> state
  const [zoomLevel, setZoomLevel] = useState<'street' | 'city' | 'state'>('street');

  // Compact mode when keyboard is visible - maximize screen space for results
  const isCompactMode = keyboardHeight > 0;

  // Track previous compact mode to detect transition
  const wasCompactModeRef = useRef(isCompactMode);

  // Scroll to selected item when transitioning from compact to normal mode
  useEffect(() => {
    if (wasCompactModeRef.current && !isCompactMode && selectedListItemId) {
      // Delay scroll slightly to allow layout to settle after keyboard dismisses
      const timer = setTimeout(() => {
        if (scrollViewRef.current && itemPositionsRef.current[selectedListItemId] !== undefined) {
          scrollViewRef.current.scrollTo({
            y: Math.max(0, itemPositionsRef.current[selectedListItemId] - 100),
            animated: true,
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
    wasCompactModeRef.current = isCompactMode;
  }, [isCompactMode, selectedListItemId]);

  // Expose scroll method via ref
  useImperativeHandle(ref, () => ({
    scrollToSelectedItem: () => {
      if (selectedListItemId && scrollViewRef.current) {
        const yPosition = itemPositionsRef.current[selectedListItemId];
        if (yPosition !== undefined) {
          // Scroll to item with some offset from top
          scrollViewRef.current.scrollTo({ y: Math.max(0, yPosition - 100), animated: true });
        }
      }
    },
  }), [selectedListItemId]);

  // Get address lines for "Currently Selected" row - returns separate lines for display
  const getAddressLines = (): { line1: string; line2?: string } => {
    // When offline and loading, just show coordinates (can't fetch address)
    if (selection.isLoadingDetails) {
      if (isOffline && mapState.markerPosition) {
        return { line1: `${mapState.markerPosition.latitude.toFixed(6)}, ${mapState.markerPosition.longitude.toFixed(6)}` };
      }
      return { line1: 'Loading address...' };
    }

    const loc = selection.location;
    if (!loc) {
      // Fall back to coordinates from marker
      if (mapState.markerPosition) {
        return { line1: `${mapState.markerPosition.latitude.toFixed(6)}, ${mapState.markerPosition.longitude.toFixed(6)}` };
      }
      return { line1: 'Tap map to set location' };
    }

    // Line 1: Street address
    const line1 = loc.address || undefined;

    // Line 2: City, State, Postal Code
    const cityParts: string[] = [];
    if (loc.city) cityParts.push(loc.city);
    if (loc.region) cityParts.push(getStateAbbreviation(loc.region));
    if (loc.postalCode) cityParts.push(loc.postalCode);
    const line2 = cityParts.length > 0 ? cityParts.join(', ') : undefined;

    // If we have both lines
    if (line1 && line2) {
      return { line1, line2 };
    }

    // If only line1 (address)
    if (line1) {
      return { line1 };
    }

    // If only line2 (city/state)
    if (line2) {
      return { line1: line2 };
    }

    // Fall back to country
    if (loc.country) {
      return { line1: loc.country };
    }

    // Final fallback to coordinates
    return { line1: `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}` };
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
    entryCount?: number; // Number of entries using this location (for saved locations)
    poi?: POIItem;
    savedLocation?: LocationEntity & { distance: number; entry_count: number };
    googlePOI?: TappedGooglePOI;
  };

  const buildMergedList = (): MergedItem[] => {
    const mergedItems: MergedItem[] = [];

    const isSearching = ui.searchQuery.length >= 2;
    // Star button now works during search too - search saved locations only (no API call)
    const showSavedOnly = activeListTab === 'saved';
    const showNearby = activeListTab === 'nearby';

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
    // When searching, use ALL saved locations (not just nearby) so users can find any saved place
    // When not searching, use nearby savedLocations (already filtered to 10 miles)
    if (showSavedOnly || showNearby) {
      const locationsToShow = isSearching ? allSavedLocations : savedLocations;

      locationsToShow.forEach(loc => {
        if (isSearching) {
          const query = ui.searchQuery.toLowerCase().trim();
          const matchesName = loc.name.toLowerCase().includes(query);
          const matchesCity = loc.city?.toLowerCase().includes(query);
          const matchesAddress = loc.address?.toLowerCase().includes(query);
          if (!matchesName && !matchesCity && !matchesAddress) {
            return;
          }
        }

        // Calculate distance for allSavedLocations (they don't have distance pre-computed)
        const distance = 'distance' in loc
          ? (loc as any).distance
          : (mapState.markerPosition
            ? calculateDistance(
                { latitude: mapState.markerPosition.latitude, longitude: mapState.markerPosition.longitude },
                { latitude: loc.latitude, longitude: loc.longitude }
              ).meters
            : 0);

        mergedItems.push({
          type: 'saved',
          id: `saved-${loc.location_id}`,
          name: loc.name,
          distance,
          address: loc.address,
          city: loc.city,
          entryCount: loc.entry_count,
          savedLocation: { ...loc, distance } as LocationEntity & { distance: number; entry_count: number },
        });
      });
    }

    // Add POIs (only for Nearby tab - not when savedOnly/star is active)
    if (showNearby && displayedPOIs && displayedPOIs.length > 0) {
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

        // Check for exact duplicate by name+address
        const fullKey = normalizedAddress ? `${normalizedName}|${normalizedAddress}` : '';
        const isDuplicateByFullKey = fullKey && savedLocationKeys.has(fullKey);

        // Check for name match, but only suppress if within 91 meters (300 feet)
        // This allows chains like "The Peanut" to show multiple locations
        let isDuplicateByNameAndProximity = false;
        const savedWithSameName = savedLocationKeys.get(normalizedName);
        if (savedWithSameName && savedWithSameName.latitude && savedWithSameName.longitude) {
          const distanceToSaved = calculateDistance(
            { latitude: poi.latitude, longitude: poi.longitude },
            { latitude: savedWithSameName.latitude, longitude: savedWithSameName.longitude }
          ).meters;
          isDuplicateByNameAndProximity = distanceToSaved < 91; // ~300 feet
        }

        const isDuplicateOfSaved = isDuplicateByFullKey || isDuplicateByNameAndProximity;
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
  // Quick-selects immediately save to Location table and apply to entry
  const handleItemSelect = (item: MergedItem) => {
    if (item.type === 'saved' && item.savedLocation) {
      // Saved locations (My Places) add immediately to entry
      handleSavedLocationSelect(item.savedLocation);
    } else if (item.type === 'poi' && item.poi) {
      // POI quick select - saves to Location table and applies immediately
      handlePOIQuickSelect(item.poi);
    } else if (item.type === 'google_poi' && item.googlePOI) {
      // Google POI quick select - saves to Location table and applies immediately
      const googlePoi: POIItem = {
        id: item.googlePOI.placeId,
        source: 'google',
        name: item.googlePOI.name,
        latitude: item.googlePOI.latitude,
        longitude: item.googlePOI.longitude,
        address: item.googlePOI.address || undefined,
      };
      handlePOIQuickSelect(googlePoi);
    }
  };

  // Render icon based on item type and selection state
  const renderIcon = (item: MergedItem, isSelected: boolean, compact: boolean = false) => {
    const iconSize = compact ? 14 : 18;
    const containerStyle = compact
      ? [styles.poiIconContainer, styles.poiIconContainerCompact]
      : [styles.poiIconContainer];

    // Saved items: yellow star normally, accentSecondary pin when selected (matches preview marker)
    if (item.type === 'saved') {
      if (isSelected) {
        return (
          <View style={[...containerStyle, styles.poiIconContainerSaved, { backgroundColor: `${dynamicTheme.colors.functional.accentSecondary}20` }]}>
            <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill={dynamicTheme.colors.functional.accentSecondary} stroke={dynamicTheme.colors.functional.accentSecondary} strokeWidth={2}>
              <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={12} cy={10} r={3} fill="white" />
            </Svg>
          </View>
        );
      }
      return (
        <View style={[...containerStyle, styles.poiIconContainerSaved, { backgroundColor: '#fef3c720' }]}>
          <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth={2}>
            <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      );
    }

    // Selected non-saved items show accentSecondary pin (matches preview marker on map)
    if (isSelected) {
      return (
        <View style={[...containerStyle, styles.poiIconContainerSelected, { backgroundColor: `${dynamicTheme.colors.functional.accentSecondary}20` }]}>
          <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill={dynamicTheme.colors.functional.accentSecondary} stroke={dynamicTheme.colors.functional.accentSecondary} strokeWidth={2}>
            <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={12} cy={10} r={3} fill="white" />
          </Svg>
        </View>
      );
    }

    // Default: gray pin
    return (
      <View style={[...containerStyle, { backgroundColor: dynamicTheme.colors.background.secondary }]}>
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.tertiary} strokeWidth={2}>
          <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={12} cy={10} r={3} fill={dynamicTheme.colors.text.tertiary} />
        </Svg>
      </View>
    );
  };

  // Saved count for toggle badge
  const savedCount = savedLocations.length;

  return (
    <View style={styles.listContainer}>
      {/* Search Row: Search Input + Saved Only Toggle */}
      <View style={styles.searchRow}>
        {/* Search Input */}
        <View style={[styles.searchContainer, { backgroundColor: dynamicTheme.colors.background.secondary, flex: 1 }]}>
          <View style={styles.searchIcon}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.tertiary} strokeWidth={2}>
              <Circle cx={11} cy={11} r={8} />
              <Path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </Svg>
          </View>
          <TextInput
            style={[styles.searchInput, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.primary }]}
            placeholder={isOffline ? "Search saved places..." : "Search places..."}
            placeholderTextColor={dynamicTheme.colors.text.tertiary}
            value={ui.searchQuery}
            onChangeText={(text) => setUI(prev => ({ ...prev, searchQuery: text }))}
          />
          {ui.searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.searchClearButton}
              onPress={() => setUI(prev => ({ ...prev, searchQuery: '' }))}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.tertiary} strokeWidth={2}>
                <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          )}
        </View>

        {/* Saved Only Toggle */}
        <TouchableOpacity
          style={[
            styles.savedOnlyToggle,
            { backgroundColor: dynamicTheme.colors.background.secondary },
            activeListTab === 'saved' && { backgroundColor: dynamicTheme.colors.functional.accent + '20', borderColor: dynamicTheme.colors.functional.accent }
          ]}
          onPress={() => setActiveListTab(activeListTab === 'saved' ? 'nearby' : 'saved')}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24" fill={activeListTab === 'saved' ? dynamicTheme.colors.functional.accent : 'none'} stroke={activeListTab === 'saved' ? dynamicTheme.colors.functional.accent : dynamicTheme.colors.text.tertiary} strokeWidth={2}>
            <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[
            styles.savedOnlyText,
            { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.secondary },
            activeListTab === 'saved' && { color: dynamicTheme.colors.functional.accent }
          ]}>
            ({savedCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Offline Banner */}
      {isOffline && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#f59e0b',
          paddingVertical: 6,
          paddingHorizontal: 12,
          marginHorizontal: 12,
          marginTop: 8,
          borderRadius: 6,
          gap: 6,
        }}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
            <Path d="M1 1l22 22" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M8.53 16.11a6 6 0 0 1 6.95 0" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={12} cy={20} r={0.5} fill="#ffffff" stroke="none" />
          </Svg>
          <Text style={{ color: '#ffffff', fontSize: 12, fontFamily: dynamicTheme.typography.fontFamily.medium }}>
            Offline - Showing saved locations only
          </Text>
        </View>
      )}

      {/* Results List */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.poiList}
        contentContainerStyle={[
          styles.poiListContent,
          isCompactMode && styles.poiListContentCompact,
          keyboardHeight > 0 && { paddingBottom: keyboardHeight + 40 }
        ]}
        keyboardShouldPersistTaps="handled"
        // Keep keyboard visible while scrolling - only dismiss when user taps an item
      >
        {displayedLoading && <ActivityIndicator style={styles.loader} />}

        {/* Currently Selected Location - Card at top (hidden in compact mode) */}
        {!isCompactMode && (selection.location || mapState.markerPosition) && (
          <TouchableOpacity
            style={[
              styles.poiItem,
              styles.mapLocationItem,
              { backgroundColor: dynamicTheme.colors.background.secondary, borderColor: dynamicTheme.colors.border.light },
              isSelectedLocationHighlighted && [styles.poiItemSelected, { borderColor: dynamicTheme.colors.functional.accent, backgroundColor: `${dynamicTheme.colors.functional.accent}08` }]
            ]}
            onPress={() => {
              // Toggle highlight state and refocus map on marker
              setIsSelectedLocationHighlighted(!isSelectedLocationHighlighted);
              setSelectedListItemId(null); // Clear any selected list item
              setPreviewMarker(null);

              if (mapState.markerPosition && mapRef.current) {
                mapRef.current.animateToRegion({
                  latitude: mapState.markerPosition.latitude,
                  longitude: mapState.markerPosition.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }, 300);
              }
            }}
          >
            {/* Marker icon - accent color */}
            <View style={[styles.poiIconContainer, { backgroundColor: `${dynamicTheme.colors.functional.accent}20` }]}>
              {ui.searchQuery.length >= 2 ? (
                // Crosshairs icon when in search mode - indicates search center point
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.functional.accent} strokeWidth={2}>
                  <Circle cx={12} cy={12} r={10} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M22 12h-4M6 12H2M12 6V2M12 22v-4" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              ) : (
                // Map pin icon when not searching
                <Svg width={18} height={18} viewBox="0 0 24 24" fill={dynamicTheme.colors.functional.accent} stroke={dynamicTheme.colors.functional.accent} strokeWidth={2}>
                  <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={12} cy={10} r={3} fill="white" />
                </Svg>
              )}
            </View>
            <View style={styles.poiInfo}>
              <Text style={[styles.poiName, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary }]} numberOfLines={1}>
                {/* Show user-given name if exists, otherwise contextual label */}
                {selection.location?.name?.trim() ? selection.location.name : (ui.searchQuery.length >= 2 ? 'Search Center' : 'Current Point')}
              </Text>
              {(() => {
                const addressLines = getAddressLines();
                return (
                  <>
                    <Text style={[styles.poiCategory, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.secondary }]} numberOfLines={1}>
                      {addressLines.line1}
                    </Text>
                    {addressLines.line2 && (
                      <Text style={[styles.poiCategory, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.secondary }]} numberOfLines={1}>
                        {addressLines.line2}
                      </Text>
                    )}
                  </>
                );
              })()}
            </View>
            {/* Create button - only shown when highlighted */}
            {isSelectedLocationHighlighted && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setUI(prev => ({
                    ...prev,
                    showingDetails: true,
                    editableNameInput: selection.location?.name || '',
                  }));
                  setPreviewMarker(null);
                  setIsSelectedLocationHighlighted(false);
                }}
                style={[styles.useButton, { backgroundColor: dynamicTheme.colors.functional.accent }]}
              >
                <Text style={[styles.useButtonText, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: '#ffffff' }]}>Create</Text>
              </TouchableOpacity>
            )}
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
                    isCompactMode && styles.poiItemCompact,
                    { backgroundColor: dynamicTheme.colors.background.primary, borderColor: dynamicTheme.colors.border.light },
                    item.type === 'saved' && styles.savedLocationItem,
                    isSelected && [styles.poiItemSelected, { borderColor: dynamicTheme.colors.functional.accentSecondary }]
                  ]}
                  onLayout={(event) => {
                    // Track item position for scrolling
                    itemPositionsRef.current[item.id] = event.nativeEvent.layout.y;
                  }}
                  onPress={() => {
                    // Dismiss keyboard first to restore normal view
                    Keyboard.dismiss();
                    // Click on row = pan/zoom to location and show red preview marker
                    // 3-click zoom pattern: street -> city -> state -> street
                    let coords: { latitude: number; longitude: number } | null = null;
                    let name = item.name;
                    let locationRadius: number | null = null;

                    if (item.type === 'saved' && item.savedLocation) {
                      coords = {
                        latitude: item.savedLocation.latitude,
                        longitude: item.savedLocation.longitude,
                      };
                      locationRadius = item.savedLocation.location_radius ?? null;
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
                      // Determine zoom level: if same item, cycle; if different item, start at street
                      const isSameItem = selectedListItemId === item.id;
                      const nextZoom = isSameItem
                        ? (zoomLevel === 'street' ? 'city' : zoomLevel === 'city' ? 'state' : 'street')
                        : 'street';

                      // Zoom deltas matching CurrentLocationView pattern
                      const deltas: Record<typeof nextZoom, number> = {
                        street: 0.005,  // ~500m view
                        city: 0.05,     // ~5km view
                        state: 2.0,     // ~200km view
                      };

                      setSelectedListItemId(item.id);
                      setZoomLevel(nextZoom);
                      setIsSelectedLocationHighlighted(false); // Clear "Selected Location" highlight
                      mapRef.current.animateToRegion({
                        ...coords,
                        latitudeDelta: deltas[nextZoom],
                        longitudeDelta: deltas[nextZoom],
                      }, 300);
                      setPreviewMarker({
                        latitude: coords.latitude,
                        longitude: coords.longitude,
                        name: name,
                        locationRadius: locationRadius,
                      });
                    }
                  }}
                >
                  {/* Icon */}
                  {renderIcon(item, isSelected, isCompactMode)}

                  {/* Info - compact mode shows only name + address (2 lines) */}
                  <View style={[styles.poiInfo, isCompactMode && styles.poiInfoCompact]}>
                    <Text
                      style={[
                        styles.poiName,
                        isCompactMode && styles.poiNameCompact,
                        { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary }
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {/* Category/city line - hidden in compact mode */}
                    {!isCompactMode && item.type === 'poi' && item.category && typeof item.category === 'string' && (
                      <Text style={[styles.poiCategory, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.secondary }]} numberOfLines={1}>{item.category}</Text>
                    )}
                    {!isCompactMode && item.type === 'google_poi' && (
                      <Text style={[styles.poiCategory, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.secondary }]}>From map</Text>
                    )}
                    {!isCompactMode && item.type === 'saved' && (
                      <Text style={[styles.poiCategory, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.secondary }]} numberOfLines={1}>
                        {item.city ? `${item.city}` : ''}{item.city && item.entryCount ? ' • ' : ''}{item.entryCount ? `${item.entryCount} ${item.entryCount === 1 ? 'entry' : 'entries'}` : ''}
                      </Text>
                    )}
                    {/* Address line - always shown, compact uses smaller font */}
                    {item.address && typeof item.address === 'string' && (
                      <Text
                        style={[
                          styles.poiAddress,
                          isCompactMode && styles.poiAddressCompact,
                          { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.tertiary }
                        ]}
                        numberOfLines={1}
                      >
                        {item.address}
                      </Text>
                    )}
                  </View>

                  {/* Right side: Distance + Select button (only when selected, hidden in compact) */}
                  <View style={styles.poiRightColumn}>
                    <Text style={[styles.poiDistance, isCompactMode && styles.poiDistanceCompact, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.secondary }]}>
                      {formatDistanceWithUnits(item.distance, settings.units)}
                    </Text>
                    {!isCompactMode && isSelected && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleItemSelect(item);
                        }}
                        style={[styles.selectButton, { backgroundColor: dynamicTheme.colors.functional.accent }]}
                      >
                        <Text style={[styles.selectButtonText, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: '#ffffff' }]}>Select</Text>
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
            <Text style={[styles.emptyStateText, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.secondary }]}>
              {ui.searchQuery.length >= 2
                ? 'No results found'
                : activeListTab === 'saved'
                  ? 'No saved locations'
                  : 'No nearby places found'}
            </Text>
            <Text style={[styles.emptyStateSubtext, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.tertiary }]}>
              {ui.searchQuery.length >= 2
                ? 'Try a different search term'
                : activeListTab === 'saved'
                  ? 'Select a location and save it'
                  : 'Tap the map to drop a pin'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
});
