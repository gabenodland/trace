/**
 * LocationPicker Component
 *
 * Full-screen modal for selecting, creating, or viewing locations.
 * Parent orchestrator that composes:
 * - MapView with markers
 * - LocationSelectView (search, tabs, POI list)
 * - LocationDetailsView (name input, address, actions)
 *
 * Uses useLocationPicker hook for all state and logic.
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, SafeAreaView, Platform, Animated, PanResponder, Dimensions, Keyboard } from 'react-native';
import Svg2, { Line } from 'react-native-svg';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import Svg, { Path, Circle } from 'react-native-svg';
import { type Location as LocationType } from '@trace/core';
import { useTheme } from '../../../../shared/contexts/ThemeContext';
import { locationPickerStyles as styles } from '../../styles/locationPickerStyles';
import { type LocationPickerMode, createSelectionFromMapTap } from '../../types/LocationPickerTypes';
import { useLocationPicker } from './hooks/useLocationPicker';
import { LocationSelectView } from './components/LocationSelectView';
import { LocationDetailsView } from './components/LocationDetailsView';

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
const MAP_HEIGHT_KEYBOARD = 140; // Shrink map when keyboard is visible

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

        {/* Main Content */}
        <View style={styles.content}>
          {/* Map - Always visible, shrinks when keyboard is showing */}
          {picker.mapState.region && (
            <Animated.View style={[styles.mapContainer, { height: mapHeight }]}>
              <MapView
                ref={picker.mapRef}
                style={styles.map}
                initialRegion={picker.mapState.region}
                onPress={picker.effectiveMode === 'select' ? picker.handleMapPress : undefined}
                onRegionChangeComplete={picker.effectiveMode === 'select' ? picker.handleRegionChangeComplete : undefined}
                mapType="standard"
                userInterfaceStyle={dynamicTheme.isDark ? "dark" : "light"}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
                showsScale={false}
                showsTraffic={false}
                showsBuildings={false}
                showsIndoors={false}
                toolbarEnabled={false}
                // Hide POI labels on iOS since onPoiClick doesn't work with Apple Maps
                // Users can still find POIs via the search/nearby list below
                showsPointsOfInterest={Platform.OS === 'android'}
                onPoiClick={Platform.OS === 'android' && picker.effectiveMode === 'select' ? handlePoiClick : undefined}
              >
                {/* Selected Location Marker (blue) */}
                {picker.mapState.markerPosition && (
                  <Marker
                    ref={picker.blueMarkerRef}
                    coordinate={picker.mapState.markerPosition}
                    pinColor="blue"
                  >
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

                {/* Preview Marker (red) - no callout, just a simple pin */}
                {picker.previewMarker && (
                  <Marker
                    ref={picker.redMarkerRef}
                    coordinate={{
                      latitude: picker.previewMarker.latitude,
                      longitude: picker.previewMarker.longitude,
                    }}
                    pinColor="red"
                  />
                )}
              </MapView>

              {/* My Location Button */}
              <TouchableOpacity
                style={[styles.mapLocationButton, { backgroundColor: dynamicTheme.colors.background.primary }]}
                onPress={picker.handleCenterOnMyLocation}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.primary} strokeWidth={2}>
                  <Circle cx="12" cy="12" r="10" />
                  <Path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                </Svg>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Switchable Content Below Map */}
          {!picker.ui.showingDetails ? (
            <LocationSelectView
              ui={picker.ui}
              setUI={picker.setUI}
              activeListTab={picker.activeListTab}
              setActiveListTab={picker.setActiveListTab}
              selection={picker.selection}
              setSelection={picker.setSelection}
              mapState={picker.mapState}
              mapRef={picker.mapRef}
              isLoadingSavedLocations={picker.isLoadingSavedLocations}
              savedLocations={picker.savedLocations}
              displayedPOIs={picker.displayedPOIs}
              displayedLoading={picker.displayedLoading}
              tappedGooglePOI={picker.tappedGooglePOI}
              previewMarker={picker.previewMarker}
              setPreviewMarker={picker.setPreviewMarker}
              selectedListItemId={picker.selectedListItemId}
              setSelectedListItemId={picker.setSelectedListItemId}
              setReverseGeocodeRequest={picker.setReverseGeocodeRequest}
              handlePOISelect={picker.handlePOISelect}
              onSelect={onSelect}
              onClose={onClose}
              keyboardHeight={keyboardHeight}
            />
          ) : (
            <LocationDetailsView
              effectiveMode={picker.effectiveMode}
              selection={picker.selection}
              ui={picker.ui}
              setUI={picker.setUI}
              handleOKPress={picker.handleOKPress}
              handleSwitchToSelectMode={picker.handleSwitchToSelectMode}
              handleRemoveLocation={picker.handleRemoveLocation}
              handleEditLocation={picker.handleEditLocation}
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
