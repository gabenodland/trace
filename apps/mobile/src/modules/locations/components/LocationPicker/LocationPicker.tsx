/**
 * LocationPicker Component
 *
 * Full-screen sheet for selecting, creating, or viewing locations.
 * Parent orchestrator that composes:
 * - MapView with markers
 * - LocationSelectView (search, tabs, POI list)
 * - CurrentLocationView (view mode - existing location display)
 * - CreateLocationView (create mode - name input and save)
 *
 * Uses useLocationPicker hook for all state and logic.
 * Uses PickerBottomSheet with noPadding for edge-to-edge map layout.
 */

import { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Animated, Keyboard } from 'react-native';
import MapView, { Marker, Callout, Polyline } from 'react-native-maps';
import Svg, { Path, Circle } from 'react-native-svg';
import { type Location as LocationType } from '@trace/core';
import type { LocationIssue } from '@trace/core';
import { useTheme } from '../../../../shared/contexts/ThemeContext';
import { Icon } from '../../../../shared/components';
import { PickerBottomSheet } from '../../../../components/sheets/PickerBottomSheet';
import { locationPickerStyles as styles } from '../../styles/locationPickerStyles';
import { type LocationPickerMode } from '../../types/LocationPickerTypes';
import { useLocationPicker } from './hooks/useLocationPicker';
import { LocationSelectView, type LocationSelectViewRef } from './components/LocationSelectView';
import { CurrentLocationView } from './components/CurrentLocationView';
import { CreateLocationView } from './components/CreateLocationView';

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: LocationType | null) => void;
  initialLocation?: LocationType | null;
  mode?: LocationPickerMode;
  /** @deprecated Use mode='view' instead */
  readOnly?: boolean;

  // Management-context props (only used when mode='manage')
  onDelete?: () => void;
  onEnrich?: () => void;
  onViewEntries?: () => void;
  onToggleMyPlace?: () => void;
  onMergeDuplicate?: () => void;
  onDismissMerge?: () => void;
  issues?: LocationIssue[];
}

const MAP_HEIGHT_NORMAL = 280;
const MAP_HEIGHT_KEYBOARD = 0; // Collapse map completely when keyboard is visible
const AUTOCOMPLETE_SEARCH_RADIUS = 50000; // 50km in meters

/**
 * Generate points for a circle polyline (for dashed circle effect)
 * @param center - Center coordinates
 * @param radiusMeters - Radius in meters
 * @param numPoints - Number of points to generate (more = smoother circle)
 */
function generateCirclePoints(
  center: { latitude: number; longitude: number },
  radiusMeters: number,
  numPoints: number = 72
): Array<{ latitude: number; longitude: number }> {
  const points: Array<{ latitude: number; longitude: number }> = [];
  const earthRadius = 6371000; // Earth's radius in meters

  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const latOffset = (radiusMeters / earthRadius) * Math.cos(angle) * (180 / Math.PI);
    const lngOffset = (radiusMeters / earthRadius) * Math.sin(angle) * (180 / Math.PI) / Math.cos(center.latitude * Math.PI / 180);

    points.push({
      latitude: center.latitude + latOffset,
      longitude: center.longitude + lngOffset,
    });
  }

  return points;
}

export function LocationPicker({
  visible,
  onClose,
  onSelect,
  initialLocation,
  mode,
  readOnly = false,
  onDelete,
  onEnrich,
  onViewEntries,
  onToggleMyPlace,
  onMergeDuplicate,
  onDismissMerge,
  issues = [],
}: LocationPickerProps) {
  const dynamicTheme = useTheme();

  // Support legacy readOnly prop - convert to mode
  const propMode: LocationPickerMode = mode ?? (readOnly ? 'view' : 'select');

  // Keyboard-aware map height
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const mapHeight = useRef(new Animated.Value(MAP_HEIGHT_NORMAL)).current;

  // Ref to LocationSelectView for scrolling to selected item
  const locationSelectViewRef = useRef<LocationSelectViewRef>(null);

  // Track keyboard for responsive layout
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showListener = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      // Animate map to smaller height
      Animated.timing(mapHeight, {
        toValue: MAP_HEIGHT_KEYBOARD,
        duration: Platform.OS === 'ios' ? 250 : 150,
        useNativeDriver: false, // height can't use native driver
      }).start();
    });
    const hideListener = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      // Animate map back to normal height
      Animated.timing(mapHeight, {
        toValue: MAP_HEIGHT_NORMAL,
        duration: Platform.OS === 'ios' ? 250 : 150,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, [mapHeight]);

  // All state and logic from hook
  const picker = useLocationPicker({
    visible,
    initialLocation,
    mode: propMode,
    onSelect,
    onClose,
  });

  // Check if a point is a general area (park, neighborhood, etc.)
  const isGeneralArea = (poiName: string): boolean => {
    const lowerName = poiName.toLowerCase();
    const areaPatterns = [
      /\bpark\b/,
      /\bneighborhood\b/,
      /\bdistrict\b/,
      /\bquarter\b/,
      /\bvillage\b/,
      /\bheights\b/,
      /\bhills?\b/,
      /\bbeach\b/,
      /\bisland\b/,
      /\bgardens?\b/,
      /\bcommons?\b/,
      /\bgreen\b/,
      /\bsquare\b/,
      /\bplaza\b/,
      /\bdowntown\b/,
      /\bmidtown\b/,
      /\buptown\b/,
    ];
    return areaPatterns.some(pattern => pattern.test(lowerName));
  };

  // Handle Google POI click on map
  const handlePoiClick = (event: any) => {
    const { coordinate, placeId, name } = event.nativeEvent;

    if (placeId && name && !isGeneralArea(name)) {
      // Store the tapped POI
      picker.setTappedGooglePOI({
        placeId,
        name,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      });

      // Move marker
      picker.setMapState(prev => ({
        region: {
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          latitudeDelta: prev.region?.latitudeDelta || 0.01,
          longitudeDelta: prev.region?.longitudeDelta || 0.01,
        },
        markerPosition: coordinate,
      }));

      // Create selection
      picker.setSelection({
        type: 'map_tap',
        location: {
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          name: null,
          source: 'google_poi',
        },
        tempCoordinates: coordinate,
        isLoadingDetails: true,
      });

      // Trigger reverse geocoding
      picker.setReverseGeocodeRequest(coordinate);
    } else {
      // Treat as regular map tap
      picker.handleMapPress({ nativeEvent: { coordinate } } as any);
    }
  };

  // Wrapper for map press
  const handleMapPress = (event: any) => {
    picker.handleMapPress(event);
  };

  const isManageMode = picker.effectiveMode === 'manage';

  // Get header title based on mode and editing state
  const getHeaderTitle = () => {
    // Inline editing overrides title
    if (picker.isEditingPlace) return 'Edit Place';
    if (picker.effectiveMode === 'manage') {
      return picker.ui.showingDetails ? 'Edit Place' : 'My Place Details';
    }
    if (picker.effectiveMode === 'view') {
      return picker.ui.showingDetails ? 'Edit Place' : 'Current Place';
    }
    return picker.ui.showingDetails ? 'Create Place' : 'Select Place';
  };

  // Don't render when not visible (avoids flash on mount)
  if (!visible) return null;

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={picker.isEditingPlace ? picker.cancelEditPlace : onClose}
      title={getHeaderTitle()}
      height="full"
      swipeArea="grabber"
      dismissKeyboard={false}
      noPadding
      headerLeft={picker.isEditingPlace ? (
        <TouchableOpacity
          onPress={picker.cancelEditPlace}
          style={{ paddingVertical: 4, paddingRight: 12 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ fontSize: 16, fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.primary }}>
            Cancel
          </Text>
        </TouchableOpacity>
      ) : undefined}
      headerRight={picker.isEditingPlace ? (
        picker.hasEditChanges ? (
          <TouchableOpacity
            onPress={picker.saveEditPlace}
            style={{ paddingVertical: 4, paddingLeft: 12 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ fontSize: 16, fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.functional.accent }}>
              Save
            </Text>
          </TouchableOpacity>
        ) : <View />
      ) : undefined}
    >
      <View style={styles.content}>
        {/* Show Map button - appears when keyboard collapses the map */}
        {keyboardHeight > 0 && picker.effectiveMode === 'select' && !picker.ui.showingDetails && (
          <TouchableOpacity
            style={[styles.showMapBar, { backgroundColor: dynamicTheme.colors.background.tertiary }]}
            onPress={() => Keyboard.dismiss()}
            activeOpacity={0.7}
          >
            <Icon name="Map" size={16} color={dynamicTheme.colors.functional.accent} />
            <Text style={[styles.showMapText, { color: dynamicTheme.colors.functional.accent, fontFamily: dynamicTheme.typography.fontFamily.medium }]}>
              Show Map
            </Text>
          </TouchableOpacity>
        )}

        {/* Map - Always visible, shrinks when keyboard is showing */}
        {picker.mapState.region && (
          <Animated.View style={[styles.mapContainer, { height: mapHeight }]}>
            <MapView
              ref={picker.mapRef}
              style={styles.map}
              initialRegion={picker.mapState.region}
              onPress={picker.effectiveMode === 'select' && !picker.ui.showingDetails && !isManageMode ? handleMapPress : undefined}
              onRegionChangeComplete={picker.effectiveMode === 'select' && !picker.ui.showingDetails && !isManageMode ? picker.handleRegionChangeComplete : undefined}
              mapType="standard"
              userInterfaceStyle={dynamicTheme.isDark ? "dark" : "light"}
              showsUserLocation={true}
              showsMyLocationButton={false}
              showsCompass={false}
              showsScale={false}
              showsTraffic={false}
              showsBuildings={false}
              showsIndoors={false}
              toolbarEnabled={false}
              // Hide POI labels on iOS since onPoiClick doesn't work with Apple Maps
              // Users can still find POIs via the search/nearby list below
              showsPointsOfInterests={Platform.OS === 'android'}
              onPoiClick={Platform.OS === 'android' && picker.effectiveMode === 'select' && !picker.ui.showingDetails && !isManageMode ? handlePoiClick : undefined}
              onPanDrag={() => Keyboard.dismiss()}
            >
              {/* Selected Location Marker (accent color) */}
              {picker.mapState.markerPosition && (
                <Marker
                  ref={picker.blueMarkerRef}
                  coordinate={picker.mapState.markerPosition}
                >
                  <Svg width={32} height={32} viewBox="0 0 24 24" fill={dynamicTheme.colors.functional.accent}>
                    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <Circle cx="12" cy="10" r="3" fill="#ffffff" />
                  </Svg>
                  {picker.effectiveMode !== 'view' && (
                    <Callout tooltip>
                      <View style={[styles.calloutContainer, { backgroundColor: dynamicTheme.colors.functional.accent }]}>
                        <Text style={[styles.calloutText, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: '#ffffff' }]} numberOfLines={2}>
                          {picker.selection.location?.name || "Selected Place"}
                        </Text>
                      </View>
                    </Callout>
                  )}
                </Marker>
              )}

              {/* Preview Marker (secondary accent color) - for hovering over list items */}
              {picker.previewMarker && (
                <Marker
                  ref={picker.redMarkerRef}
                  coordinate={{
                    latitude: picker.previewMarker.latitude,
                    longitude: picker.previewMarker.longitude,
                  }}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <Svg width={32} height={32} viewBox="0 0 24 24" fill={dynamicTheme.colors.functional.accentSecondary}>
                    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <Circle cx="12" cy="10" r="3" fill="#ffffff" />
                  </Svg>
                </Marker>
              )}

              {/* Search Radius Circle (dashed) - shows 50km autocomplete search area around selected pin */}
              {picker.ui.searchQuery.length >= 2 && picker.mapState.markerPosition && (
                <Polyline
                  coordinates={generateCirclePoints(picker.mapState.markerPosition, AUTOCOMPLETE_SEARCH_RADIUS)}
                  strokeColor="#FFCC00"
                  strokeWidth={2}
                  lineDashPattern={[10, 10]}
                />
              )}
            </MapView>

            {/* Fit Both Markers Button - shows when preview marker is visible (hidden when keyboard up) */}
            {keyboardHeight === 0 && picker.previewMarker && picker.mapState.markerPosition && (
              <TouchableOpacity
                style={[styles.mapFitButton, { backgroundColor: dynamicTheme.colors.background.primary }]}
                onPress={() => {
                  if (picker.mapRef.current && picker.mapState.markerPosition && picker.previewMarker) {
                    // Fit map to show both markers
                    picker.mapRef.current.fitToCoordinates(
                      [
                        { latitude: picker.mapState.markerPosition.latitude, longitude: picker.mapState.markerPosition.longitude },
                        { latitude: picker.previewMarker.latitude, longitude: picker.previewMarker.longitude },
                      ],
                      {
                        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                        animated: true,
                      }
                    );
                    // Also scroll list to ensure selected item is visible
                    locationSelectViewRef.current?.scrollToSelectedItem();
                  }
                }}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.primary} strokeWidth={2}>
                  <Path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            )}

            {/* My Location Button - different icon for View mode vs Select mode (hidden when keyboard up) */}
            {keyboardHeight === 0 && (
              <TouchableOpacity
                style={[styles.mapLocationButton, { backgroundColor: dynamicTheme.colors.background.primary }]}
                onPress={picker.handleCenterOnMyLocation}
              >
                {picker.effectiveMode === 'view' || picker.effectiveMode === 'manage' ? (
                  /* Navigation arrow icon - shows "you relative to pin" in view/manage mode */
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.primary} strokeWidth={2}>
                    <Path d="M3 11l19-9-9 19-2-8-8-2z" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                ) : (
                  /* Crosshair icon - target GPS location in select mode */
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.primary} strokeWidth={2}>
                    <Circle cx="12" cy="12" r="10" />
                    <Path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                  </Svg>
                )}
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {/* Switchable Content Below Map */}
        {/* showingDetails = Create/Edit view. Otherwise: view/manage = CurrentLocationView, select = LocationSelectView */}
        {picker.ui.showingDetails ? (
          /* Create/Edit Mode - CreateLocationView */
          <CreateLocationView
            selection={picker.selection}
            setSelection={picker.setSelection}
            ui={picker.ui}
            setUI={picker.setUI}
            saveToMyPlaces={picker.saveToMyPlaces}
            onSaveToMyPlacesChange={picker.setSaveToMyPlaces}
            handleOKPress={picker.handleOKPress}
            onBack={picker.handleSwitchToSelectMode}
            onClearAddress={picker.handleClearAddress}
            onResetToOriginal={picker.handleResetToOriginal}
            keyboardHeight={keyboardHeight}
          />
        ) : (picker.effectiveMode === 'view' || isManageMode) ? (
          /* View/Manage Mode - CurrentLocationView */
          <CurrentLocationView
            selection={picker.selection}
            setSelection={picker.setSelection}
            ui={picker.ui}
            setUI={picker.setUI}
            mapRef={picker.mapRef}
            handleSwitchToSelectMode={picker.handleSwitchToSelectMode}
            handleRemoveLocation={picker.handleRemoveLocation}
            handleRemovePin={picker.handleRemovePin}
            // Editing state (lifted to hook for header/action control)
            isEditing={picker.isEditingPlace}
            editName={picker.editPlaceName}
            onEditNameChange={picker.setEditPlaceName}
            editAddress={picker.editPlaceAddress}
            onEditAddressChange={picker.setEditPlaceAddress}
            onStartEditing={picker.startEditingPlace}
            // Management props — only passed in manage mode
            context={isManageMode ? 'manage' : 'picker'}
            onDelete={isManageMode ? onDelete : undefined}
            onEnrich={isManageMode ? onEnrich : undefined}
            onViewEntries={isManageMode ? onViewEntries : undefined}
            onToggleMyPlace={onToggleMyPlace ?? picker.handleToggleMyPlace}
            onMergeDuplicate={isManageMode ? onMergeDuplicate : undefined}
            onDismissMerge={isManageMode ? onDismissMerge : undefined}
            issues={isManageMode ? issues : undefined}
            keyboardHeight={keyboardHeight}
          />
        ) : (
          /* Select Mode - LocationSelectView */
          <LocationSelectView
            ref={locationSelectViewRef}
            ui={picker.ui}
            setUI={picker.setUI}
            activeListTab={picker.activeListTab}
            setActiveListTab={picker.setActiveListTab}
            selection={picker.selection}
            setSelection={picker.setSelection}
            mapState={picker.mapState}
            mapRef={picker.mapRef}
            isOffline={picker.isOffline}
            isLoadingSavedLocations={picker.isLoadingSavedLocations}
            savedLocations={picker.savedLocations}
            allSavedLocations={picker.allSavedLocations}
            displayedPOIs={picker.displayedPOIs}
            displayedLoading={picker.displayedLoading}
            tappedGooglePOI={picker.tappedGooglePOI}
            previewMarker={picker.previewMarker}
            setPreviewMarker={picker.setPreviewMarker}
            selectedListItemId={picker.selectedListItemId}
            setSelectedListItemId={picker.setSelectedListItemId}
            isSelectedLocationHighlighted={picker.isSelectedLocationHighlighted}
            setIsSelectedLocationHighlighted={picker.setIsSelectedLocationHighlighted}
            setReverseGeocodeRequest={picker.setReverseGeocodeRequest}
            handlePOISelect={picker.handlePOISelect}
            handlePOIQuickSelect={picker.handlePOIQuickSelect}
            handleSavedLocationSelect={picker.handleSavedLocationSelect}
            keyboardHeight={keyboardHeight}
          />
        )}
      </View>
    </PickerBottomSheet>
  );
}
