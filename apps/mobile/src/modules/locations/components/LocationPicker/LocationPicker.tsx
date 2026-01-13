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

import { View, Text, TouchableOpacity, Modal, SafeAreaView, Platform } from 'react-native';
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: dynamicTheme.colors.background.primary }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: dynamicTheme.colors.border.light }]}>
          <Text style={[styles.headerTitle, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.primary }]}>{getHeaderTitle()}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.primary} strokeWidth={2}>
              <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Map - Always visible */}
          {picker.mapState.region && (
            <View style={styles.mapContainer}>
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
            </View>
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
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
