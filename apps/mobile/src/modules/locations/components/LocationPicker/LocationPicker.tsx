/**
 * LocationPicker Component
 *
 * Full-screen modal for selecting, creating, or viewing locations.
 * Parent orchestrator that composes:
 * - MapView with markers
 * - LocationSelectView (search, tabs, POI list)
 * - CurrentLocationView (view mode - existing location display)
 * - CreateLocationView (create mode - name input and save)
 *
 * Uses useLocationPicker hook for all state and logic.
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, SafeAreaView, Platform, Animated, PanResponder, Dimensions, Keyboard } from 'react-native';
import Svg2, { Line } from 'react-native-svg';
import MapView, { Marker, Callout, Circle as MapCircle, Polyline } from 'react-native-maps';
import Svg, { Path, Circle } from 'react-native-svg';
import { type Location as LocationType } from '@trace/core';
import { useTheme } from '../../../../shared/contexts/ThemeContext';
import { locationPickerStyles as styles } from '../../styles/locationPickerStyles';
import { type LocationPickerMode, createSelectionFromMapTap } from '../../types/LocationPickerTypes';
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
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
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
}: LocationPickerProps) {
  const dynamicTheme = useTheme();

  // Support legacy readOnly prop - convert to mode
  const propMode: LocationPickerMode = mode ?? (readOnly ? 'view' : 'select');

  // Animation values - start off-screen
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

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

  // Ref to hold latest onClose to avoid stale closure in pan responder
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Open sheet with animation
  const openSheet = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, backdropOpacity]);

  // Close sheet with animation
  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onCloseRef.current();
    });
  }, [translateY, backdropOpacity]);

  // Animate in when visible changes
  useEffect(() => {
    if (visible) {
      // Ensure starting from off-screen position before animating
      translateY.setValue(SCREEN_HEIGHT);
      backdropOpacity.setValue(0);
      // Start animation after a frame to ensure modal is rendered
      requestAnimationFrame(() => {
        openSheet();
      });
      // Note: radius is initialized by useLocationPicker hook from initialLocation.locationRadius
    }
  }, [visible, openSheet, translateY, backdropOpacity]);

  // Pan responder for swipe-to-dismiss on grabber/header area
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward swipes
        return gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped down more than 100px or with velocity, dismiss
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          closeSheet();
        } else {
          // Snap back
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

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

    // Clear radius when tapping a new location (exact point selection)
    picker.setRadius(0);

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

  // Wrapper for map press - hook's handleMapPress already clears radius
  const handleMapPress = (event: any) => {
    picker.handleMapPress(event);
  };

  // Get header title based on mode
  const getHeaderTitle = () => {
    if (picker.effectiveMode === 'view') {
      return 'Current Location';
    }
    return picker.ui.showingDetails ? 'Create Location' : 'Select Location';
  };

  // Don't render Modal when not visible (avoids flash on mount)
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={closeSheet}
    >
      <View style={styles.modalContainer}>
        {/* Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: backdropOpacity },
          ]}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={closeSheet}
          />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: dynamicTheme.colors.background.primary,
              transform: [{ translateY }],
            }
          ]}
        >
          <SafeAreaView style={styles.container}>
            {/* Grabber bar for swipe-to-dismiss (attaches pan responder here) */}
            <View {...panResponder.panHandlers}>
              <View style={styles.grabberContainer}>
                <View style={[styles.grabber, { backgroundColor: dynamicTheme.colors.border.medium }]} />
              </View>

              {/* Header - left-aligned title, close button on right (matches PickerBottomSheet) */}
              <View style={styles.pickerHeader}>
                <Text style={[styles.pickerHeaderTitle, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.primary }]}>{getHeaderTitle()}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {/* Map button - shows in compact search mode to restore map view */}
                  {keyboardHeight > 0 && picker.effectiveMode === 'select' && !picker.ui.showingDetails && (
                    <TouchableOpacity
                      style={styles.pickerCloseButton}
                      onPress={() => Keyboard.dismiss()}
                      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    >
                      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.functional.accent} strokeWidth={2}>
                        <Path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" strokeLinecap="round" strokeLinejoin="round" />
                        <Path d="M8 2v16M16 6v16" strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.pickerCloseButton}
                    onPress={closeSheet}
                    hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  >
                    <Svg2 width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.secondary} strokeWidth={2}>
                      <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
                      <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
                    </Svg2>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Map - Always visible, shrinks when keyboard is showing */}
          {picker.mapState.region && (
            <Animated.View style={[styles.mapContainer, { height: mapHeight }]}>
              <MapView
                ref={picker.mapRef}
                style={styles.map}
                initialRegion={picker.mapState.region}
                onPress={picker.effectiveMode === 'select' && !picker.ui.showingDetails ? handleMapPress : undefined}
                onRegionChangeComplete={picker.effectiveMode === 'select' && !picker.ui.showingDetails ? picker.handleRegionChangeComplete : undefined}
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
                onPoiClick={Platform.OS === 'android' && picker.effectiveMode === 'select' && !picker.ui.showingDetails ? handlePoiClick : undefined}
                onPanDrag={() => Keyboard.dismiss()}
              >
                {/* Location Radius Circle - shows GPS accuracy or user-set precision area */}
                {picker.radius > 0 && picker.mapState.markerPosition && (
                  <MapCircle
                    center={picker.mapState.markerPosition}
                    radius={picker.radius}
                    fillColor={`${dynamicTheme.colors.functional.accent}35`}
                    strokeColor={dynamicTheme.colors.functional.accent}
                    strokeWidth={2}
                  />
                )}

                {/* Area Marker - sits at top of circle, pointing down into the area */}
                {picker.radius > 0 && picker.mapState.markerPosition && (
                  <Marker
                    coordinate={{
                      // Position at top of circle: add radius in meters converted to degrees
                      // 1 degree latitude ≈ 111,000 meters
                      latitude: picker.mapState.markerPosition.latitude + (picker.radius / 111000),
                      longitude: picker.mapState.markerPosition.longitude,
                    }}
                    anchor={{ x: 0.5, y: 1 }} // Anchor at bottom center so pin points down into circle
                  >
                    <Svg width={32} height={32} viewBox="0 0 24 24" fill={dynamicTheme.colors.functional.accent}>
                      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <Circle cx="12" cy="10" r="3" fill="#ffffff" />
                    </Svg>
                  </Marker>
                )}

                {/* Selected Location Marker (accent color) - hidden when precision circle is shown */}
                {picker.mapState.markerPosition && picker.radius === 0 && (
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
                            {picker.selection.location?.name || "Selected Location"}
                          </Text>
                        </View>
                      </Callout>
                    )}
                  </Marker>
                )}

                {/* Preview Circle (secondary accent color) - for saved locations with locationRadius */}
                {picker.previewMarker && picker.previewMarker.locationRadius && picker.previewMarker.locationRadius > 0 && (
                  <MapCircle
                    center={{
                      latitude: picker.previewMarker.latitude,
                      longitude: picker.previewMarker.longitude,
                    }}
                    radius={picker.previewMarker.locationRadius}
                    fillColor={`${dynamicTheme.colors.functional.accentSecondary}35`}
                    strokeColor={dynamicTheme.colors.functional.accentSecondary}
                    strokeWidth={2}
                  />
                )}

                {/* Preview Marker (secondary accent color) - for hovering over list items */}
                {picker.previewMarker && (
                  <Marker
                    ref={picker.redMarkerRef}
                    coordinate={{
                      // Position at top of circle if locationRadius is set, otherwise at exact location
                      latitude: picker.previewMarker.locationRadius && picker.previewMarker.locationRadius > 0
                        ? picker.previewMarker.latitude + (picker.previewMarker.locationRadius / 111000)
                        : picker.previewMarker.latitude,
                      longitude: picker.previewMarker.longitude,
                    }}
                    anchor={picker.previewMarker.locationRadius && picker.previewMarker.locationRadius > 0
                      ? { x: 0.5, y: 1 }  // Anchor at bottom so pin points down into circle
                      : { x: 0.5, y: 1 }  // Default anchor
                    }
                  >
                    <Svg width={32} height={32} viewBox="0 0 24 24" fill={dynamicTheme.colors.functional.accentSecondary}>
                      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <Circle cx="12" cy="10" r="3" fill="#ffffff" />
                    </Svg>
                  </Marker>
                )}

                {/* Search Radius Circle (dashed) - shows 50km autocomplete search area around selected pin */}
                {(() => {
                  const shouldShow = picker.ui.searchQuery.length >= 2 && picker.mapState.markerPosition;
                  if (shouldShow) {
                    console.log('🔵 [SearchRadius] Drawing circle at:', picker.mapState.markerPosition?.latitude.toFixed(4), picker.mapState.markerPosition?.longitude.toFixed(4));
                  }
                  return shouldShow ? (
                    <Polyline
                      coordinates={generateCirclePoints(picker.mapState.markerPosition!, AUTOCOMPLETE_SEARCH_RADIUS)}
                      strokeColor="#FFCC00"
                      strokeWidth={2}
                      lineDashPattern={[10, 10]}
                    />
                  ) : null;
                })()}
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
                  {picker.effectiveMode === 'view' ? (
                    /* Navigation arrow icon - shows "you relative to pin" in view mode */
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

          {/* Switchable Content Below Map - 3 views */}
          {/* showingDetails takes precedence - allows "Save Location" from view mode */}
          {picker.ui.showingDetails ? (
            /* Create Mode - CreateLocationView */
            <CreateLocationView
              selection={picker.selection}
              setSelection={picker.setSelection}
              ui={picker.ui}
              setUI={picker.setUI}
              mapRef={picker.mapRef}
              saveToMyPlaces={picker.saveToMyPlaces}
              onSaveToMyPlacesChange={picker.setSaveToMyPlaces}
              handleOKPress={picker.handleOKPress}
              onBack={() => {
                picker.handleSwitchToSelectMode();
                picker.setRadius(0); // Clear precision circle when going back
              }}
              onClearAddress={picker.handleClearAddress}
              onResetToOriginal={picker.handleResetToOriginal}
              radius={picker.radius}
              onRadiusChange={picker.setRadius}
              keyboardHeight={keyboardHeight}
            />
          ) : picker.effectiveMode === 'view' ? (
            /* View Mode - CurrentLocationView */
            <CurrentLocationView
              selection={picker.selection}
              setSelection={picker.setSelection}
              ui={picker.ui}
              setUI={picker.setUI}
              mapRef={picker.mapRef}
              handleSwitchToSelectMode={picker.handleSwitchToSelectMode}
              handleRemoveLocation={picker.handleRemoveLocation}
              handleRemovePin={picker.handleRemovePin}
              handleEditLocation={picker.handleEditLocation}
              onResetToOriginal={picker.handleResetToOriginal}
              radius={picker.radius}
              onRadiusChange={picker.setRadius}
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
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}
