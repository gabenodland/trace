/**
 * CreateLocationView Component
 *
 * Displays the create location form with a modern card-based design.
 * Shows:
 * - Name input card (auto-focused)
 * - Address/coordinates info card (from geocoding)
 * - Save Location button
 *
 * Every named place creates a saved location with location_id.
 */

import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal } from 'react-native';
import Slider from '@react-native-community/slider';
import Svg, { Path, Circle } from 'react-native-svg';
import MapView from 'react-native-maps';
import { useTheme } from '../../../../../shared/contexts/ThemeContext';
import { useSettings } from '../../../../../shared/contexts/SettingsContext';
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

/**
 * Round a coordinate to the specified number of decimal places
 */
function roundCoordinate(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

interface CreateLocationViewProps {
  // Selection
  selection: LocationSelection;
  setSelection: React.Dispatch<React.SetStateAction<LocationSelection>>;

  // UI State
  ui: LocationPickerUI;
  setUI: React.Dispatch<React.SetStateAction<LocationPickerUI>>;

  // Map ref for zoom control
  mapRef?: React.RefObject<MapView | null>;

  // Save to My Places toggle
  saveToMyPlaces: boolean;
  onSaveToMyPlacesChange: (value: boolean) => void;

  // Handlers
  handleOKPress: () => void;
  onBack: () => void;
  onClearAddress?: () => void;
  onResetToOriginal?: () => void;
  onPrecisionChange?: (radiusMeters: number) => void;

  // Keyboard
  keyboardHeight?: number;
}

export function CreateLocationView({
  selection,
  setSelection,
  ui,
  setUI,
  mapRef,
  saveToMyPlaces,
  onSaveToMyPlacesChange,
  handleOKPress,
  onBack,
  onClearAddress,
  onResetToOriginal,
  onPrecisionChange,
  keyboardHeight = 0,
}: CreateLocationViewProps) {
  const theme = useTheme();
  const { settings } = useSettings();
  const isMetric = settings.units === 'metric';

  // Precision slider state (0 = exact, up to 5000m)
  const [precisionRadius, setPrecisionRadius] = useState(0);
  const [showPrecisionPicker, setShowPrecisionPicker] = useState(false);

  // Clear locationRadius when entering create mode - always start at Exact
  useEffect(() => {
    if (selection.location?.locationRadius !== null && selection.location?.locationRadius !== undefined) {
      setSelection(prev => ({
        ...prev,
        location: prev.location ? {
          ...prev.location,
          locationRadius: null,
        } : null,
      }));
      // Also notify parent to clear precision circle on map
      onPrecisionChange?.(0);
    }
  }, []); // Only run on mount

  // Calculate rounded coordinates based on precision
  const getRoundedCoords = () => {
    if (!selection.location) return { lat: 0, lng: 0 };
    const decimals = getDecimalsForRadius(precisionRadius);
    const lat = roundCoordinate(selection.location.latitude, decimals);
    const lng = roundCoordinate(selection.location.longitude, decimals);
    return { lat, lng };
  };

  // Handle precision change from slider
  // Note: We do NOT round coordinates when setting location radius.
  // The radius is a user-selected privacy/generalization value, not GPS accuracy.
  // Coordinates remain exact - the radius just indicates the displayed area.
  const handlePrecisionChange = (radiusMeters: number) => {
    setPrecisionRadius(radiusMeters);

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

      onPrecisionChange?.(radiusMeters);

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

  // Build city/state/country display text (when not in editing mode)
  const getLocationDisplayInfo = (): string => {
    if (!selection.location) return '';

    const loc = selection.location;
    const parts: string[] = [];

    // City, State, Postal Code
    const cityState: string[] = [];
    if (loc.city) cityState.push(loc.city);
    if (loc.region) cityState.push(loc.region);
    if (loc.postalCode) cityState.push(loc.postalCode);
    if (cityState.length > 0) {
      parts.push(cityState.join(', '));
    }

    // Country
    if (loc.country) {
      parts.push(loc.country);
    }

    return parts.join('\n');
  };

  const locationDisplayInfo = getLocationDisplayInfo();

  // Check if any location fields have data (for showing edit button)
  const hasLocationData = !!(
    selection.location?.address ||
    selection.location?.city ||
    selection.location?.region ||
    selection.location?.country
  );

  const hasName = ui.editableNameInput.trim().length > 0;

  // Common input style for all editable fields
  const inputStyle = {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 15,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  };

  const labelStyle = {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.text.tertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  };

  // Don't show loading overlay - per UX requirement, just gray out Lookup Address button instead
  // The isLoadingDetails flag is used below to disable the Lookup Address button

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
          <Text style={[styles.emptyDetailsSubtext, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]}>
            Tap the map or search for a place to get started
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
        {/* Name Input Card */}
        <View style={[styles.inputCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          <Text style={[styles.inputCardLabel, { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.secondary }]}>
            NAME
          </Text>
          <TextInput
            style={[
              styles.inputCardInput,
              {
                fontFamily: theme.typography.fontFamily.regular,
                color: theme.colors.text.primary,
                backgroundColor: theme.colors.background.secondary,
                borderColor: theme.colors.border.light,
              }
            ]}
            value={ui.editableNameInput}
            onChangeText={(text) => setUI(prev => ({ ...prev, editableNameInput: text }))}
            placeholder="Enter location name..."
            placeholderTextColor={theme.colors.text.tertiary}
          />
        </View>

        {/* Location Info Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          {/* Editing Mode - Only Street Address Editable */}
          {ui.isAddressEditing ? (
            <>
              {/* Header with Reset to Original button */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontFamily: theme.typography.fontFamily.semibold, color: theme.colors.text.primary }}>
                  Edit Street Address
                </Text>
                {onResetToOriginal && (
                  <TouchableOpacity
                    onPress={onResetToOriginal}
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
                <Text style={labelStyle}>Street Address</Text>
                <TextInput
                  style={inputStyle}
                  value={ui.editableAddressInput}
                  onChangeText={(text) => setUI(prev => ({ ...prev, editableAddressInput: text }))}
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
              {hasLocationData && (
                <View style={{ marginBottom: locationDisplayInfo ? 4 : 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 }}>
                    {onClearAddress && (
                      <TouchableOpacity onPress={onClearAddress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={{ fontSize: 13, fontFamily: theme.typography.fontFamily.medium, color: theme.colors.functional.accent }}>
                          Edit
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {/* Street Address */}
                  {selection.location?.address && (
                    <Text style={[styles.infoCardText, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.primary }]}>
                      {selection.location.address}
                    </Text>
                  )}
                  {/* City, State, Country */}
                  {locationDisplayInfo && (
                    <Text style={[styles.infoCardText, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary, marginTop: selection.location?.address ? 4 : 0 }]}>
                      {locationDisplayInfo}
                    </Text>
                  )}
                </View>
              )}
            </>
          )}

          {/* Coordinates with Precision Dropdown */}
          <View style={[
            styles.infoCardCoords,
            { borderTopColor: theme.colors.border.light, justifyContent: 'space-between' },
            // Hide border when there's nothing above (no address data and not editing)
            (!ui.isAddressEditing && !hasLocationData) && { marginTop: 0, paddingTop: 0, borderTopWidth: 0 }
          ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                <Circle cx={12} cy={12} r={10} />
                <Circle cx={12} cy={12} r={3} fill={theme.colors.text.tertiary} />
              </Svg>
              <Text style={[styles.infoCardCoordsText, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]}>
                {roundedCoords.lat.toFixed(getDecimalsForRadius(precisionRadius))}, {roundedCoords.lng.toFixed(getDecimalsForRadius(precisionRadius))}
              </Text>
            </View>
            {/* Precision Dropdown Button */}
            <TouchableOpacity
              onPress={() => setShowPrecisionPicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.background.secondary,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                gap: 4,
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ fontSize: 12, fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.secondary }}>
                {formatPrecision(precisionRadius, isMetric)}
              </Text>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                <Path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        </View>

        {/* Precision Picker Modal with Slider */}
        <Modal
          visible={showPrecisionPicker}
          transparent
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
                  {formatPrecision(precisionRadius, isMetric)}
                </Text>
                {getPrecisionDescription(precisionRadius) && (
                  <Text style={{ fontSize: 14, fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.secondary, marginTop: 4 }}>
                    {getPrecisionDescription(precisionRadius)}
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
                  value={precisionRadius}
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

        {/* Action Card - Settings-style row */}
        <View style={[styles.actionCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          {/* Change Location Row */}
          <TouchableOpacity
            style={[styles.actionRow, styles.actionRowLast]}
            onPress={onBack}
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
        </View>

        {/* Save to My Places Toggle */}
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme.colors.background.primary,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            ...theme.shadows.sm,
          }}
          onPress={() => onSaveToMyPlacesChange(!saveToMyPlaces)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
              <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={{ fontSize: 15, fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.primary }}>
              Save to My Places
            </Text>
          </View>
          {/* Toggle switch */}
          <View style={{
            width: 51,
            height: 31,
            borderRadius: 16,
            backgroundColor: saveToMyPlaces ? theme.colors.functional.accent : theme.colors.background.tertiary,
            padding: 2,
            justifyContent: 'center',
          }}>
            <View style={{
              width: 27,
              height: 27,
              borderRadius: 14,
              backgroundColor: '#ffffff',
              alignSelf: saveToMyPlaces ? 'flex-end' : 'flex-start',
              ...theme.shadows.sm,
            }} />
          </View>
        </TouchableOpacity>

        {/* Action Button - requires name to save */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: hasName ? theme.colors.functional.accent : theme.colors.background.tertiary,
            }
          ]}
          onPress={handleOKPress}
          activeOpacity={hasName ? 0.7 : 1}
          disabled={!hasName}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={hasName ? "#ffffff" : theme.colors.text.disabled} strokeWidth={2}>
            <Path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M17 21v-8H7v8M7 3v5h8" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[styles.saveButtonText, { fontFamily: theme.typography.fontFamily.semibold, color: hasName ? '#ffffff' : theme.colors.text.disabled }]}>
            Save Location
          </Text>
        </TouchableOpacity>

        {/* Helper text */}
        {!hasName && (
          <Text style={[{ fontSize: 13, textAlign: 'center', marginTop: 12, fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]}>
            Enter a name to save this location
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
