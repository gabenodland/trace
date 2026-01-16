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
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { calculateDistance, formatDistanceWithUnits } from '@trace/core';
import { useSettings } from '../../../../../shared/contexts/SettingsContext';
import { useTheme } from '../../../../../shared/contexts/ThemeContext';
import { locationPickerStyles as styles } from '../../../styles/locationPickerStyles';
import {
  type LocationSelection,
  type LocationPickerUI,
} from '../../../types/LocationPickerTypes';

interface CurrentLocationViewProps {
  // Selection
  selection: LocationSelection;

  // UI State
  ui: LocationPickerUI;
  setUI: React.Dispatch<React.SetStateAction<LocationPickerUI>>;

  // Handlers
  handleSwitchToSelectMode: () => void;
  handleRemoveLocation: () => void;
  handleEditLocation?: (newName: string) => void;
  onClearAddress?: () => void;
  onLookupAddress?: () => void;

  // Keyboard
  keyboardHeight?: number;
}

export function CurrentLocationView({
  selection,
  ui,
  setUI,
  handleSwitchToSelectMode,
  handleRemoveLocation,
  handleEditLocation,
  onClearAddress,
  onLookupAddress,
  keyboardHeight = 0,
}: CurrentLocationViewProps) {
  const theme = useTheme();
  const { settings } = useSettings();

  // DEBUG: Log all selection data
  console.log('[CurrentLocationView] 📍 SELECTION DATA:', JSON.stringify({
    locationId: selection.locationId,
    entryCount: selection.entryCount,
    isLoadingDetails: selection.isLoadingDetails,
    type: selection.type,
    location: selection.location ? {
      name: selection.location.name,
      address: selection.location.address,
      neighborhood: selection.location.neighborhood,
      city: selection.location.city,
      region: selection.location.region,
      country: selection.location.country,
      postalCode: selection.location.postalCode,
      latitude: selection.location.latitude,
      longitude: selection.location.longitude,
      geographicFeature: selection.location.geographicFeature,
    } : null,
  }, null, 2));

  // Local editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(ui.editableNameInput || '');

  // Entry count for display
  const entryCount = selection.entryCount ?? 0;

  // GPS info display - shows original GPS coordinates and accuracy if available
  const getGpsInfo = () => {
    const loc = selection.location;
    if (!loc) return null;

    const hasOriginalCoords = loc.originalLatitude != null && loc.originalLongitude != null;
    const hasAccuracy = loc.accuracy != null && loc.accuracy > 0;

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

    // Format accuracy for display
    let accuracyText: string | null = null;
    if (hasAccuracy) {
      if (settings.units === 'imperial') {
        const feet = Math.round(loc.accuracy! * 3.28084);
        accuracyText = `±${feet} ft`;
      } else {
        accuracyText = `±${Math.round(loc.accuracy!)} m`;
      }
    }

    // Only show GPS info section if we have something meaningful to show
    if (!hasOriginalCoords && !hasAccuracy) return null;

    return {
      originalLatitude: hasOriginalCoords ? loc.originalLatitude! : loc.latitude,
      originalLongitude: hasOriginalCoords ? loc.originalLongitude! : loc.longitude,
      accuracyText,
      snapDistance,
      wasSnapped,
      hasOriginalCoords,
    };
  };

  const gpsInfo = getGpsInfo();

  // Can edit if this is a saved location (has location_id) and handler is provided
  const canEdit = !!selection.locationId && !!handleEditLocation;

  // Smart location data builder - avoids duplication, shows what we have
  // Order: Name > Address > City, State, ZIP > Country > Coordinates
  const getLocationDisplay = () => {
    const loc = selection.location;
    if (!loc) return null;

    const hasName = !!loc.name;
    const hasNeighborhood = !!loc.neighborhood;
    const hasCity = !!loc.city;
    const hasRegion = !!loc.region;
    const hasAddress = !!loc.address;
    const hasPostalCode = !!loc.postalCode;
    const hasCountry = !!loc.country;
    const hasAnyAddressData = hasNeighborhood || hasCity || hasRegion || hasAddress || hasPostalCode || hasCountry;

    // Primary: Name or formatted coordinates
    const primaryText = hasName ? loc.name : `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`;

    // Address line (street address or tiledata like "Missouri River")
    const addressLine = hasAddress ? loc.address : null;

    // City, State, ZIP line
    const cityStateZipParts: string[] = [];
    if (hasCity) cityStateZipParts.push(loc.city!);
    if (hasRegion) cityStateZipParts.push(loc.region!);
    if (hasPostalCode) cityStateZipParts.push(loc.postalCode!);
    const cityStateZip = cityStateZipParts.length > 0 ? cityStateZipParts.join(', ') : null;

    // Country (separate line)
    const countryLine = hasCountry ? loc.country : null;

    // Coordinates (always show as reference, subtle)
    const coordsText = `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`;

    return {
      primaryText,
      addressLine,
      cityStateZip,
      countryLine,
      coordsText,
      hasAnyAddressData,
      hasName,
    };
  };

  const locationDisplay = getLocationDisplay();

  // Handle start editing
  const handleStartEdit = () => {
    setEditName(selection.location?.name || '');
    setIsEditing(true);
  };

  // Handle save edit
  const handleSaveEdit = () => {
    if (handleEditLocation && editName.trim()) {
      handleEditLocation(editName.trim());
      setUI(prev => ({ ...prev, editableNameInput: editName.trim() }));
      setIsEditing(false);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditName(selection.location?.name || '');
    setIsEditing(false);
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
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter location name..."
                placeholderTextColor={theme.colors.text.tertiary}
                autoFocus
              />
            </View>

            {/* Location Info Card */}
            <View style={[styles.infoCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
              {/* Clear Address link (when address exists) or Lookup Address link (when cleared) */}
              {selection.location?.address && onClearAddress ? (
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: locationDisplay?.addressLine || locationDisplay?.cityStateZip ? 4 : 0 }}>
                  <TouchableOpacity onPress={onClearAddress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 13, fontFamily: theme.typography.fontFamily.medium, color: theme.colors.functional.accent }}>
                      Clear Address
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : !selection.location?.address && onLookupAddress ? (
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: locationDisplay?.addressLine || locationDisplay?.cityStateZip ? 4 : 0 }}>
                  <TouchableOpacity onPress={onLookupAddress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 13, fontFamily: theme.typography.fontFamily.medium, color: theme.colors.functional.accent }}>
                      Lookup Address
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {/* Address info lines */}
              {(locationDisplay?.addressLine || locationDisplay?.cityStateZip || locationDisplay?.countryLine) && (
                <Text style={[styles.infoCardText, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.primary }]}>
                  {[locationDisplay?.addressLine, locationDisplay?.cityStateZip, locationDisplay?.countryLine].filter(Boolean).join('\n')}
                </Text>
              )}
              {/* Coordinates */}
              <View style={[
                styles.infoCardCoords,
                { borderTopColor: theme.colors.border.light },
                !(locationDisplay?.addressLine || locationDisplay?.cityStateZip || locationDisplay?.countryLine) && { marginTop: 0, paddingTop: 0, borderTopWidth: 0 }
              ]}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                  <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={12} cy={10} r={3} fill={theme.colors.text.tertiary} />
                </Svg>
                <Text style={[styles.infoCardCoordsText, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]}>
                  {locationDisplay?.coordsText || `${selection.location?.latitude.toFixed(6)}, ${selection.location?.longitude.toFixed(6)}`}
                </Text>
              </View>
            </View>

            {/* Entry count warning */}
            {entryCount > 1 && (
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

            {/* Cancel Link */}
            <TouchableOpacity
              style={styles.changeLocationButton}
              onPress={handleCancelEdit}
              activeOpacity={0.7}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.functional.accent} strokeWidth={2}>
                <Path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[styles.changeLocationText, { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.functional.accent }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                {
                  backgroundColor: editName.trim() ? theme.colors.functional.accent : theme.colors.border.medium,
                }
              ]}
              onPress={handleSaveEdit}
              disabled={!editName.trim()}
              activeOpacity={0.7}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
                <Path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M17 21v-8H7v8M7 3v5h8" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[styles.saveButtonText, { fontFamily: theme.typography.fontFamily.semibold, color: '#ffffff' }]}>
                Save Changes
              </Text>
            </TouchableOpacity>

            {/* Helper text */}
            {!editName.trim() && (
              <Text style={[{ fontSize: 13, textAlign: 'center', marginTop: 12, fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]}>
                Enter a name to save this location
              </Text>
            )}
          </>
        ) : locationDisplay && (
          /* Location Card - Horizontal layout: Pin left, data right */
          <View style={[styles.locationCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
            {/* Pin Icon - Left side */}
            <View style={[styles.locationCardIcon, { backgroundColor: theme.colors.functional.accentLight }]}>
              <Svg width={28} height={28} viewBox="0 0 24 24" fill={theme.colors.functional.accent}>
                <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <Circle cx={12} cy={10} r={3} fill="#ffffff" />
              </Svg>
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

              {/* City, State, ZIP */}
              {locationDisplay.cityStateZip && (
                <Text style={[styles.locationCardAddress, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]} numberOfLines={1}>
                  {locationDisplay.cityStateZip}
                </Text>
              )}

              {/* Country */}
              {locationDisplay.countryLine && (
                <Text style={[styles.locationCardAddress, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]} numberOfLines={1}>
                  {locationDisplay.countryLine}
                </Text>
              )}

              {/* Coordinates (always show, very subtle) */}
              {locationDisplay.hasName && (
                <View style={styles.locationCardCoordsRow}>
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                    <Circle cx={12} cy={12} r={10} />
                    <Path d="M12 8v4l2 2" strokeLinecap="round" />
                  </Svg>
                  <Text style={[styles.locationCardCoords, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]}>
                    {locationDisplay.coordsText}
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
          </View>
        )}

        {/* GPS Info Card - Shows original GPS coordinates and accuracy */}
        {!isEditing && gpsInfo && (
          <View style={[styles.infoCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
            <Text style={[styles.infoCardLabel, { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.secondary }]}>
              GPS INFO
            </Text>

            {/* Original GPS coordinates */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: gpsInfo.accuracyText || gpsInfo.snapDistance ? 8 : 0 }}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                <Circle cx={12} cy={12} r={10} />
                <Circle cx={12} cy={12} r={3} fill={theme.colors.text.tertiary} />
              </Svg>
              <Text style={[styles.infoCardText, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.primary, marginBottom: 0 }]}>
                {gpsInfo.originalLatitude.toFixed(6)}, {gpsInfo.originalLongitude.toFixed(6)}
              </Text>
            </View>

            {/* Accuracy */}
            {gpsInfo.accuracyText && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: gpsInfo.snapDistance ? 8 : 0 }}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                  <Circle cx={12} cy={12} r={10} />
                  <Path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round" />
                </Svg>
                <Text style={[{ fontSize: 14, fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.secondary }]}>
                  Accuracy: {gpsInfo.accuracyText}
                </Text>
              </View>
            )}

            {/* Snap distance (if location was snapped from GPS) */}
            {gpsInfo.snapDistance && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                  <Path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={[{ fontSize: 14, fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.secondary }]}>
                  Snapped {gpsInfo.snapDistance} from GPS
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Action Card - Settings-style rows */}
        {!isEditing && (
          <View style={[styles.actionCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
            {/* Edit Location Row */}
            {canEdit && (
              <TouchableOpacity
                style={[styles.actionRow, { borderBottomColor: theme.colors.border.light }]}
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

            {/* Change Location Row */}
            <TouchableOpacity
              style={[
                styles.actionRow,
                { borderBottomColor: theme.colors.border.light },
                !canEdit && { borderTopWidth: 0 },
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

            {/* Remove Location Row */}
            <TouchableOpacity
              style={[styles.actionRow, styles.actionRowLast]}
              onPress={handleRemoveLocation}
              activeOpacity={0.7}
            >
              <View style={styles.actionRowContent}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}>
                  <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={[styles.actionRowText, { fontFamily: theme.typography.fontFamily.medium, color: '#dc2626' }]}>
                  Remove Location
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
