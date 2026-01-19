/**
 * CurrentLocationView Component
 *
 * Displays the current location in view mode with a modern card-based design.
 * Shows:
 * - Hero card with location name, subtitle, and entry count badge
 * - Address info card
 * - Action rows (Edit Location, Change Location, Remove Location)
 *
 * When editing, transforms to a CreateLocationView-style layout with:
 * - Name input card
 * - Address info card with Clear Address option
 * - Entry count warning (shows how many entries will be affected)
 * - Save/Cancel buttons
 */

import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, Alert } from 'react-native';
import Slider from '@react-native-community/slider';
import Svg, { Path, Circle } from 'react-native-svg';
import MapView from 'react-native-maps';
import { calculateDistance, formatDistanceWithUnits } from '@trace/core';
import { useSettings } from '../../../../../shared/contexts/SettingsContext';
import { useTheme } from '../../../../../shared/contexts/ThemeContext';
import { locationPickerStyles as styles } from '../../../styles/locationPickerStyles';
import {
  type LocationSelection,
  type LocationPickerUI,
} from '../../../types/LocationPickerTypes';

/**
 * Get decimal places for coordinate rounding based on radius
 */
function getDecimalsForRadius(radiusMeters: number): number {
  if (radiusMeters === 0) return 6;      // Exact
  if (radiusMeters <= 10) return 4;      // ~10m - Building level
  if (radiusMeters <= 100) return 3;     // ~100m - Block level
  return 2;                               // 500m+ - Neighborhood/District/Area
}

/**
 * Format precision radius for display
 */
function formatPrecision(radiusMeters: number, isMetric: boolean): string {
  if (radiusMeters === 0) return 'Exact';

  if (isMetric) {
    if (radiusMeters >= 1000) {
      return `~${(radiusMeters / 1000).toFixed(1)} km`;
    }
    return `~${Math.round(radiusMeters)} m`;
  } else {
    const feet = radiusMeters * 3.28084;
    if (feet >= 5280) {
      return `~${(feet / 5280).toFixed(1)} mi`;
    }
    return `~${Math.round(feet)} ft`;
  }
}

/**
 * Get description based on radius
 */
function getPrecisionDescription(radiusMeters: number): string {
  if (radiusMeters === 0) return '';
  if (radiusMeters <= 10) return 'Building level';
  if (radiusMeters <= 100) return 'Block level';
  if (radiusMeters <= 500) return 'Neighborhood';
  if (radiusMeters <= 1000) return 'District';
  return 'Area level';
}

function roundCoordinate(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

interface CurrentLocationViewProps {
  // Selection
  selection: LocationSelection;
  setSelection: React.Dispatch<React.SetStateAction<LocationSelection>>;

  // UI State
  ui: LocationPickerUI;
  setUI: React.Dispatch<React.SetStateAction<LocationPickerUI>>;

  // Map ref for zoom control
  mapRef?: React.RefObject<MapView | null>;

  // Handlers
  handleSwitchToSelectMode: () => void;
  handleRemoveLocation: () => void;
  handleRemovePin: () => void;
  handleEditLocation?: (newName: string, newAddress?: string | null, newLocationRadius?: number | null) => void;
  onResetToOriginal?: () => void;

  // Unified radius (from GPS accuracy or user precision slider)
  radius: number;
  onRadiusChange: (radiusMeters: number) => void;

  // Keyboard
  keyboardHeight?: number;
}

export function CurrentLocationView({
  selection,
  setSelection,
  ui,
  setUI,
  mapRef,
  handleSwitchToSelectMode,
  handleRemoveLocation,
  handleRemovePin,
  handleEditLocation,
  onResetToOriginal,
  radius,
  onRadiusChange,
  keyboardHeight = 0,
}: CurrentLocationViewProps) {
  const theme = useTheme();
  const { settings } = useSettings();
  const isMetric = settings.units === 'metric';

  // Local editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(ui.editableNameInput || '');
  const [editAddress, setEditAddress] = useState('');
  const [isAddressEditing, setIsAddressEditing] = useState(false);
  const [showPrecisionPicker, setShowPrecisionPicker] = useState(false);

  // Calculate rounded coordinates based on precision
  const getRoundedCoords = () => {
    if (!selection.location) return { lat: 0, lng: 0 };
    const decimals = getDecimalsForRadius(radius);
    const lat = roundCoordinate(selection.location.latitude, decimals);
    const lng = roundCoordinate(selection.location.longitude, decimals);
    return { lat, lng };
  };

  // Handle precision change from slider
  // Note: We do NOT round coordinates when setting location radius.
  // The radius is a user-selected privacy/generalization value, not GPS accuracy.
  // Coordinates remain exact - the radius just indicates the displayed area.
  const handlePrecisionChange = (radiusMeters: number) => {
    onRadiusChange(radiusMeters);

    if (selection.location) {
      const originalLat = selection.location.originalLatitude ?? selection.location.latitude;
      const originalLng = selection.location.originalLongitude ?? selection.location.longitude;

      setSelection(prev => ({
        ...prev,
        location: prev.location ? {
          ...prev.location,
          // 0 = Exact means null locationRadius (no precision circle)
          locationRadius: radiusMeters > 0 ? radiusMeters : null,
        } : null,
      }));

      // Note: onRadiusChange already called above to update parent state

      if (mapRef?.current) {
        const delta = radiusMeters > 0
          ? Math.max(0.005, (radiusMeters * 3) / 111000)
          : 0.005;

        mapRef.current.animateToRegion({
          latitude: originalLat,
          longitude: originalLng,
          latitudeDelta: delta,
          longitudeDelta: delta,
        }, 300);
      }
    }
  };

  const roundedCoords = getRoundedCoords();

  // Zoom level cycle: city (default) -> street -> state -> city...
  const [zoomLevel, setZoomLevel] = useState<'city' | 'street' | 'state'>('city');

  // Handle location card tap - cycle through zoom levels
  const handleLocationCardPress = () => {
    if (!selection.location || !mapRef?.current) return;

    // Cycle: city -> street -> state -> city
    const nextLevel = zoomLevel === 'city' ? 'street' : zoomLevel === 'street' ? 'state' : 'city';
    setZoomLevel(nextLevel);

    // Zoom deltas:
    // - Street level: ~0.005 delta (very close, ~500m view)
    // - City level: ~0.05 delta (city-wide, ~5km view)
    // - State level: ~2.0 delta (~200km view, roughly Columbia MO to St. Louis)
    const deltas: Record<typeof nextLevel, number> = {
      street: 0.005,
      city: 0.05,
      state: 2.0,
    };

    mapRef.current.animateToRegion({
      latitude: selection.location.latitude,
      longitude: selection.location.longitude,
      latitudeDelta: deltas[nextLevel],
      longitudeDelta: deltas[nextLevel],
    }, 300);
  };

  // Entry count for display
  const entryCount = selection.entryCount ?? 0;

  // GPS info display - shows original GPS coordinates and location radius if available
  const getGpsInfo = () => {
    const loc = selection.location;
    if (!loc) return null;

    const hasOriginalCoords = loc.originalLatitude != null && loc.originalLongitude != null;
    const hasLocationRadius = loc.locationRadius != null && loc.locationRadius > 0;

    // Check if original coords differ from display coords (location was snapped)
    const wasSnapped = hasOriginalCoords && (
      Math.abs(loc.originalLatitude! - loc.latitude) > 0.000001 ||
      Math.abs(loc.originalLongitude! - loc.longitude) > 0.000001
    );

    // Calculate distance from GPS to location if snapped
    let snapDistance: string | null = null;
    if (wasSnapped) {
      const distance = calculateDistance(
        { latitude: loc.originalLatitude!, longitude: loc.originalLongitude! },
        { latitude: loc.latitude, longitude: loc.longitude }
      );
      snapDistance = formatDistanceWithUnits(distance.meters, settings.units);
    }

    // Format location radius for display
    let radiusText: string | null = null;
    if (hasLocationRadius) {
      if (settings.units === 'imperial') {
        const feet = Math.round(loc.locationRadius! * 3.28084);
        radiusText = `±${feet} ft`;
      } else {
        radiusText = `±${Math.round(loc.locationRadius!)} m`;
      }
    }

    // Only show GPS info section if we have something meaningful to show
    if (!hasOriginalCoords && !hasLocationRadius) return null;

    return {
      originalLatitude: hasOriginalCoords ? loc.originalLatitude! : loc.latitude,
      originalLongitude: hasOriginalCoords ? loc.originalLongitude! : loc.longitude,
      radiusText,
      snapDistance,
      wasSnapped,
      hasOriginalCoords,
    };
  };

  const gpsInfo = getGpsInfo();

  // Can edit if the location has a name and handler is provided
  // (place name is required to save changes)
  const canEdit = !!selection.location?.name && !!handleEditLocation;

  // Smart location data builder - hierarchical display based on available data
  // Never show neighborhood on this screen (per user request)
  // State abbreviation rule: abbreviated when city shown, full name when state-only
  const getLocationDisplay = () => {
    const loc = selection.location;
    if (!loc) return null;

    const hasName = !!loc.name;
    const hasSavedLocation = !!selection.locationId;
    const hasCity = !!loc.city;
    const hasRegion = !!loc.region;
    const hasAddress = !!loc.address;
    const hasPostalCode = !!loc.postalCode;
    const hasCountry = !!loc.country;
    const hasAnyAddressData = hasCity || hasRegion || hasAddress || hasPostalCode || hasCountry;

    // Primary: Name if available, otherwise "Dropped Pin"
    // Icon logic determines visual state (crosshairs vs pin vs pin+star)
    const primaryText = hasName ? loc.name : 'Dropped Pin';

    // First detail line: Address only (no neighborhood)
    const addressLine = hasAddress ? loc.address : null;

    // City, State ZIP line (only when city is present)
    // Format: "Kansas City, MO 64111" - state and zip combined after city
    let cityStateZip: string | null = null;
    if (hasCity) {
      const stateZipParts: string[] = [];
      if (hasRegion) stateZipParts.push(loc.region!);
      if (hasPostalCode) stateZipParts.push(loc.postalCode!);
      const stateZip = stateZipParts.join(' '); // "MO 64111" or "Missouri 64111"
      cityStateZip = stateZip ? `${loc.city!}, ${stateZip}` : loc.city!;
    }

    // Region-only line (when no city, show full state name on its own line)
    // Per TODO: use full name when state is the only geographic info
    const regionOnlyLine = (!hasCity && hasRegion) ? loc.region : null;

    // Country (separate line)
    const countryLine = hasCountry ? loc.country : null;

    // Coordinates (always show for dropped pins as GPS-ish feel)
    const coordsText = `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`;

    // Icon state logic:
    // - No name → 'dropped_pin' (crosshairs icon)
    // - Has name, no location_id → 'poi' (pin with dot)
    // - Has name, has location_id → 'saved' (pin with star)
    const iconState: 'dropped_pin' | 'poi' | 'saved' = !hasName
      ? 'dropped_pin'
      : hasSavedLocation
        ? 'saved'
        : 'poi';

    return {
      primaryText,
      addressLine,
      cityStateZip,
      regionOnlyLine,
      countryLine,
      coordsText,
      hasAnyAddressData,
      hasName,
      iconState,
    };
  };

  const locationDisplay = getLocationDisplay();

  // Handle start editing - preserve current precision based on location radius
  const handleStartEdit = () => {
    setEditName(selection.location?.name || '');
    setEditAddress(selection.location?.address || '');
    setIsAddressEditing(false);
    // Determine precision from current locationRadius if set
    const locationRadius = selection.location?.locationRadius;
    if (locationRadius && locationRadius > 0) {
      // Use locationRadius directly as precision radius
      onRadiusChange(locationRadius);
    } else {
      onRadiusChange(0); // Exact
    }
    setIsEditing(true);
  };

  // Handle save edit
  const handleSaveEdit = () => {
    if (editName.trim()) {
      // Name provided - update the saved location
      if (handleEditLocation) {
        // Pass edited address if in address editing mode, otherwise pass current address
        const finalAddress = isAddressEditing ? editAddress.trim() || null : selection.location?.address;
        // Pass precision radius (0 = exact, otherwise the radius in meters)
        const finalLocationRadius = radius > 0 ? radius : null;
        handleEditLocation(editName.trim(), finalAddress, finalLocationRadius);
        setUI(prev => ({ ...prev, editableNameInput: editName.trim() }));
        setIsEditing(false);
        setIsAddressEditing(false);
      }
    } else {
      // Name cleared - convert to dropped pin (keeps geo data, removes location_id)
      handleRemoveLocation();
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditName(selection.location?.name || '');
    setIsEditing(false);
  };

  // Handle clear location with confirmation
  const handleClearLocationPress = () => {
    Alert.alert(
      'Clear Location',
      'Are you sure you want to remove all location data from your entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: handleRemovePin },
      ]
    );
  };

  // Loading state
  if (selection.isLoadingDetails) {
    return (
      <View style={styles.viewContainer}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.colors.functional.accent} />
          <Text style={[styles.loadingText, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.secondary }]}>
            Loading location details...
          </Text>
        </View>
      </View>
    );
  }

  // Empty state
  if (!selection.location) {
    return (
      <View style={styles.viewContainer}>
        <View style={styles.emptyDetailsState}>
          <View style={[styles.heroIconContainer, { backgroundColor: theme.colors.background.secondary }]}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
              <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={12} cy={10} r={3} fill={theme.colors.text.tertiary} />
            </Svg>
          </View>
          <Text style={[styles.emptyDetailsText, { fontFamily: theme.typography.fontFamily.semibold, color: theme.colors.text.secondary }]}>
            No location selected
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.viewContainer}>
      <ScrollView
        style={styles.viewScroll}
        contentContainerStyle={[
          styles.viewContent,
          keyboardHeight > 0 && { paddingBottom: keyboardHeight + 40 }
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Edit Mode - CreateLocationView-style layout */}
        {isEditing ? (
          <>
            {/* Name Input Card */}
            <View style={[styles.inputCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
              <Text style={[styles.inputCardLabel, { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.secondary }]}>
                NAME
              </Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[
                    styles.inputCardInput,
                    {
                      fontFamily: theme.typography.fontFamily.regular,
                      color: theme.colors.text.primary,
                      backgroundColor: theme.colors.background.secondary,
                      borderColor: theme.colors.border.light,
                      paddingRight: editName ? 40 : 16, // Make room for clear button
                    }
                  ]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter location name..."
                  placeholderTextColor={theme.colors.text.tertiary}
                  autoFocus
                />
                {/* Clear button */}
                {editName ? (
                  <TouchableOpacity
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: 0,
                      bottom: 0,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    onPress={() => setEditName('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <View style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: theme.colors.text.tertiary,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={3}>
                        <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </View>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* Location Info Card - Address editing like CreateLocationView */}
            <View style={[styles.infoCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
              {/* Editing Mode - Only Street Address Editable */}
              {isAddressEditing ? (
                <>
                  {/* Header with Reset to Original button */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 13, fontFamily: theme.typography.fontFamily.semibold, color: theme.colors.text.primary }}>
                      Edit Street Address
                    </Text>
                    {onResetToOriginal && (
                      <TouchableOpacity
                        onPress={() => {
                          setIsAddressEditing(false);
                          setEditAddress(selection.location?.address || '');
                          onResetToOriginal();
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={{
                          fontSize: 13,
                          fontFamily: theme.typography.fontFamily.medium,
                          color: theme.colors.functional.accent
                        }}>
                          Reset to Original
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Street Address - Editable */}
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.secondary, marginBottom: 6 }}>
                      Street Address
                    </Text>
                    <TextInput
                      style={{
                        fontSize: 15,
                        fontFamily: theme.typography.fontFamily.regular,
                        color: theme.colors.text.primary,
                        backgroundColor: theme.colors.background.secondary,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderWidth: 1,
                        borderColor: theme.colors.border.light,
                      }}
                      value={editAddress}
                      onChangeText={setEditAddress}
                      placeholder="123 Main St"
                      placeholderTextColor={theme.colors.text.tertiary}
                    />
                  </View>

                  {/* City, State, Postal Code, Country - Read-only display */}
                  {(selection.location?.city || selection.location?.region || selection.location?.postalCode || selection.location?.country) && (
                    <View style={{
                      backgroundColor: theme.colors.background.secondary,
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 8,
                    }}>
                      {/* City and Postal Code Row */}
                      {(selection.location?.city || selection.location?.postalCode) && (
                        <Text style={{
                          fontSize: 14,
                          fontFamily: theme.typography.fontFamily.regular,
                          color: theme.colors.text.tertiary,
                          marginBottom: (selection.location?.region || selection.location?.country) ? 4 : 0,
                        }}>
                          {[selection.location?.city, selection.location?.postalCode].filter(Boolean).join(', ')}
                        </Text>
                      )}
                      {/* State/Region */}
                      {selection.location?.region && (
                        <Text style={{
                          fontSize: 14,
                          fontFamily: theme.typography.fontFamily.regular,
                          color: theme.colors.text.tertiary,
                          marginBottom: selection.location?.country ? 4 : 0,
                        }}>
                          {selection.location.region}
                        </Text>
                      )}
                      {/* Country */}
                      {selection.location?.country && (
                        <Text style={{
                          fontSize: 14,
                          fontFamily: theme.typography.fontFamily.regular,
                          color: theme.colors.text.tertiary,
                        }}>
                          {selection.location.country}
                        </Text>
                      )}
                    </View>
                  )}
                </>
              ) : (
                <>
                  {/* Display Mode - Show location info with Edit button */}
                  {(locationDisplay?.addressLine || locationDisplay?.cityStateZip || locationDisplay?.regionOnlyLine || locationDisplay?.countryLine) && (
                    <View style={{ marginBottom: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 }}>
                        <TouchableOpacity
                          onPress={() => {
                            setEditAddress(selection.location?.address || '');
                            setIsAddressEditing(true);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={{ fontSize: 13, fontFamily: theme.typography.fontFamily.medium, color: theme.colors.functional.accent }}>
                            Edit
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={[styles.infoCardText, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.primary }]}>
                        {[locationDisplay?.addressLine, locationDisplay?.cityStateZip, locationDisplay?.regionOnlyLine, locationDisplay?.countryLine].filter(Boolean).join('\n')}
                      </Text>
                    </View>
                  )}
                  {/* Coordinates with precision info */}
                  <View style={[
                    styles.infoCardCoords,
                    { borderTopColor: theme.colors.border.light },
                    !(locationDisplay?.addressLine || locationDisplay?.cityStateZip || locationDisplay?.regionOnlyLine || locationDisplay?.countryLine) && { marginTop: 0, paddingTop: 0, borderTopWidth: 0 }
                  ]}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                      <Circle cx={12} cy={10} r={3} fill={theme.colors.text.tertiary} />
                    </Svg>
                    <Text style={[styles.infoCardCoordsText, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]}>
                      {radius === 0
                        ? `${selection.location?.latitude.toFixed(6)}, ${selection.location?.longitude.toFixed(6)}`
                        : `${roundedCoords.lat}, ${roundedCoords.lng}`}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Precision Dropdown - same as CreateLocationView */}
            <TouchableOpacity
              style={[styles.infoCard, { backgroundColor: theme.colors.background.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, theme.shadows.sm]}
              onPress={() => setShowPrecisionPicker(true)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
                  <Circle cx={12} cy={12} r={10} />
                  <Circle cx={12} cy={12} r={6} />
                  <Circle cx={12} cy={12} r={2} fill={theme.colors.text.primary} />
                </Svg>
                <View>
                  <Text style={{ fontSize: 15, fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.primary }}>
                    Coordinate Precision
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.secondary }}>
                    {formatPrecision(radius, isMetric)}
                    {getPrecisionDescription(radius) ? ` · ${getPrecisionDescription(radius)}` : ''}
                  </Text>
                </View>
              </View>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                <Path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>

            {/* Precision Picker Modal with Slider */}
            <Modal
              visible={showPrecisionPicker}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowPrecisionPicker(false)}
            >
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                activeOpacity={1}
                onPress={() => setShowPrecisionPicker(false)}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  style={{
                    backgroundColor: theme.colors.background.primary,
                    borderRadius: 16,
                    padding: 20,
                    width: '85%',
                    maxWidth: 340,
                  }}
                >
                  <Text style={{ fontSize: 17, fontFamily: theme.typography.fontFamily.semibold, color: theme.colors.text.primary, marginBottom: 8, textAlign: 'center' }}>
                    Coordinate Precision
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary, marginBottom: 20, textAlign: 'center' }}>
                    Adjust how precisely coordinates are shared
                  </Text>

                  {/* Current value display */}
                  <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ fontSize: 28, fontFamily: theme.typography.fontFamily.semibold, color: theme.colors.functional.accent }}>
                      {formatPrecision(radius, isMetric)}
                    </Text>
                    {getPrecisionDescription(radius) && (
                      <Text style={{ fontSize: 14, fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.secondary, marginTop: 4 }}>
                        {getPrecisionDescription(radius)}
                      </Text>
                    )}
                  </View>

                  {/* Slider */}
                  <View style={{ paddingHorizontal: 8 }}>
                    <Slider
                      style={{ width: '100%', height: 40 }}
                      minimumValue={0}
                      maximumValue={5000}
                      step={10}
                      value={radius}
                      onValueChange={(value) => handlePrecisionChange(Math.round(value))}
                      minimumTrackTintColor={theme.colors.functional.accent}
                      maximumTrackTintColor={theme.colors.border.medium}
                      thumbTintColor={theme.colors.functional.accent}
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={{ fontSize: 12, fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }}>
                        Exact
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }}>
                        {isMetric ? '5 km' : '~3 mi'}
                      </Text>
                    </View>
                  </View>

                  {/* Done button */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: theme.colors.functional.accent,
                      borderRadius: 10,
                      paddingVertical: 14,
                      marginTop: 20,
                      alignItems: 'center',
                    }}
                    onPress={() => setShowPrecisionPicker(false)}
                  >
                    <Text style={{ fontSize: 16, fontFamily: theme.typography.fontFamily.semibold, color: '#ffffff' }}>
                      Done
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>

            {/* Entry count warning - only show for saved locations (has location_id) */}
            {entryCount > 1 && selection.locationId && (
              <View style={[styles.infoCard, { backgroundColor: theme.colors.background.primary, paddingVertical: 12 }, theme.shadows.sm]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.functional.accent} strokeWidth={2}>
                    <Circle cx={12} cy={12} r={10} />
                    <Path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
                  </Svg>
                  <Text style={{ fontSize: 14, fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.primary }}>
                    Changes will update {entryCount} entries
                  </Text>
                </View>
              </View>
            )}

            {/* Cancel Action Card - Settings-style row matching CreateLocationView */}
            <View style={[styles.actionCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
              <TouchableOpacity
                style={[styles.actionRow, styles.actionRowLast]}
                onPress={handleCancelEdit}
                activeOpacity={0.7}
              >
                <View style={styles.actionRowContent}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
                    <Path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={[styles.actionRowText, { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.primary }]}>
                    Cancel
                  </Text>
                </View>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                  <Path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            </View>

            {/* Save Button - contextual based on whether name is entered */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: theme.colors.functional.accent }
              ]}
              onPress={handleSaveEdit}
              activeOpacity={0.7}
            >
              {editName.trim() ? (
                /* Save icon for "Save Changes" */
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
                  <Path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M17 21v-8H7v8M7 3v5h8" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              ) : (
                /* Crosshairs icon for "Save Pin" */
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
                  <Circle cx={12} cy={12} r={10} strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={12} cy={12} r={3} fill="#ffffff" stroke="none" />
                  <Path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round" />
                </Svg>
              )}
              <Text style={[styles.saveButtonText, { fontFamily: theme.typography.fontFamily.semibold, color: '#ffffff' }]}>
                {editName.trim() ? 'Save Changes' : 'Save Pin'}
              </Text>
            </TouchableOpacity>

            {/* Helper text */}
            <Text style={[{ fontSize: 13, textAlign: 'center', marginTop: 12, fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]}>
              {editName.trim()
                ? 'Changes will update all entries using this location'
                : 'Clear name to convert to a dropped pin'}
            </Text>
          </>
        ) : locationDisplay && (
          /* Location Card - Horizontal layout: Icon left, data right */
          /* Tappable to toggle zoom: street level <-> city level */
          <TouchableOpacity
            style={[styles.locationCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}
            onPress={handleLocationCardPress}
            activeOpacity={0.7}
          >
            {/* Zoom Level Indicator - upper right corner */}
            <View style={{
              position: 'absolute',
              top: 10,
              right: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
              backgroundColor: theme.colors.background.secondary,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
              zIndex: 1,
            }}>
              {/* Magnifying glass icon */}
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                <Circle cx={11} cy={11} r={8} />
                <Path d="M21 21l-4.35-4.35" strokeLinecap="round" />
              </Svg>
              <Text style={{
                fontSize: 12,
                fontFamily: theme.typography.fontFamily.medium,
                color: theme.colors.text.tertiary,
              }}>
                ±
              </Text>
            </View>

            {/* Icon based on state: crosshairs (no name), pin+dot (POI), pin+star (saved) */}
            <View style={[styles.locationCardIcon, { backgroundColor: theme.colors.functional.accentLight }]}>
              {locationDisplay.iconState === 'dropped_pin' ? (
                /* Crosshairs icon for dropped pins (no name) */
                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={theme.colors.functional.accent} strokeWidth={2}>
                  <Circle cx={12} cy={12} r={10} />
                  <Path d="M22 12h-4M6 12H2M12 6V2M12 22v-4" strokeLinecap="round" />
                  <Circle cx={12} cy={12} r={3} fill={theme.colors.functional.accent} />
                </Svg>
              ) : locationDisplay.iconState === 'saved' ? (
                /* Pin with star for saved locations (has name + location_id) */
                <Svg width={28} height={28} viewBox="0 0 24 24" fill={theme.colors.functional.accent}>
                  <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  {/* Star instead of dot */}
                  <Path d="M12 7l1.12 2.27 2.5.36-1.81 1.77.43 2.5L12 12.77l-2.24 1.18.43-2.5-1.81-1.77 2.5-.36L12 7z" fill="#ffffff" />
                </Svg>
              ) : (
                /* Pin with dot for POI (has name, no location_id) */
                <Svg width={28} height={28} viewBox="0 0 24 24" fill={theme.colors.functional.accent}>
                  <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <Circle cx={12} cy={10} r={3} fill="#ffffff" />
                </Svg>
              )}
            </View>

            {/* Location Data - Right side */}
            <View style={styles.locationCardContent}>
              {/* Primary: Name or Coordinates */}
              <Text style={[styles.locationCardName, { fontFamily: theme.typography.fontFamily.semibold, color: theme.colors.text.primary }]} numberOfLines={2}>
                {locationDisplay.primaryText}
              </Text>

              {/* Address (street address or tiledata like "Missouri River") */}
              {locationDisplay.addressLine && (
                <Text style={[styles.locationCardAddress, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.secondary }]} numberOfLines={1}>
                  {locationDisplay.addressLine}
                </Text>
              )}

              {/* City, State ZIP */}
              {locationDisplay.cityStateZip && (
                <Text style={[styles.locationCardAddress, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]} numberOfLines={1}>
                  {locationDisplay.cityStateZip}
                </Text>
              )}

              {/* Region only (when no city - show full state name) */}
              {locationDisplay.regionOnlyLine && (
                <Text style={[styles.locationCardAddress, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]} numberOfLines={1}>
                  {locationDisplay.regionOnlyLine}
                </Text>
              )}

              {/* Country */}
              {locationDisplay.countryLine && (
                <Text style={[styles.locationCardAddress, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]} numberOfLines={1}>
                  {locationDisplay.countryLine}
                </Text>
              )}

              {/* Coordinates (always show) */}
              {(locationDisplay.hasName || locationDisplay.iconState === 'dropped_pin') && (
                <View style={styles.locationCardCoordsRow}>
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                    <Circle cx={12} cy={12} r={10} />
                    <Circle cx={12} cy={12} r={3} fill={theme.colors.text.tertiary} />
                  </Svg>
                  <Text style={[styles.locationCardCoords, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]}>
                    {locationDisplay.coordsText}{gpsInfo?.radiusText ? ` (${gpsInfo.radiusText})` : ''}
                  </Text>
                </View>
              )}

              {/* Entry Count Badge */}
              {entryCount > 0 && (
                <View style={[styles.locationCardBadge, { backgroundColor: theme.colors.background.secondary }]}>
                  <Text style={[styles.locationCardBadgeText, { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.secondary }]}>
                    {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Action Card - Settings-style rows */}
        {!isEditing && (
          <View style={[styles.actionCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
            {/* Edit Location Row - for saved locations only */}
            {canEdit && (
              <TouchableOpacity
                style={[styles.actionRow, { borderBottomColor: theme.colors.border.light, paddingVertical: 18 }]}
                onPress={handleStartEdit}
                activeOpacity={0.7}
              >
                <View style={styles.actionRowContent}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
                    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={[styles.actionRowText, { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.primary }]}>
                    Edit Location
                  </Text>
                </View>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                  <Path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            )}

            {/* Save Location Row - for unsaved locations (no location_id) */}
            {!selection.locationId && (
              <TouchableOpacity
                style={[styles.actionRow, { borderBottomColor: theme.colors.border.light, paddingVertical: 18 }]}
                onPress={() => setUI(prev => ({ ...prev, showingDetails: true }))}
                activeOpacity={0.7}
              >
                <View style={styles.actionRowContent}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
                    <Path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M17 21v-8H7v8M7 3v5h8" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={[styles.actionRowText, { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.primary }]}>
                    Save Location
                  </Text>
                </View>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                  <Path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            )}

            {/* Change Location Row */}
            <TouchableOpacity
              style={[
                styles.actionRow,
                { borderBottomColor: theme.colors.border.light, paddingVertical: 18 },
              ]}
              onPress={handleSwitchToSelectMode}
              activeOpacity={0.7}
            >
              <View style={styles.actionRowContent}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
                  <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={12} cy={10} r={3} fill={theme.colors.text.primary} />
                </Svg>
                <Text style={[styles.actionRowText, { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.primary }]}>
                  Change Location
                </Text>
              </View>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                <Path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>

            {/* Clear Location Row - removes all location data */}
            <TouchableOpacity
              style={[styles.actionRow, styles.actionRowLast, { paddingVertical: 18 }]}
              onPress={handleClearLocationPress}
              activeOpacity={0.7}
            >
              <View style={styles.actionRowContent}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}>
                  <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={[styles.actionRowText, { fontFamily: theme.typography.fontFamily.medium, color: '#dc2626' }]}>
                  Clear Location
                </Text>
              </View>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                <Path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
