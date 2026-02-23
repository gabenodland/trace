/**
 * CurrentLocationView Component
 *
 * View/edit mode for an existing place on an entry (picker context)
 * or a place from the management list (manage context).
 *
 * Shows:
 * - Hero card with tier icon, name, address hierarchy, coords, entry count
 *   - Edit pill enters focused edit state (title changes, actions hide, Save in header)
 * - GPS snap info (if original coords differ from place coords)
 * - Issue banners (management context only)
 * - Context-dependent action rows
 *
 * Editing state is lifted to useLocationPicker hook so LocationPicker can
 * control the header title ("Edit Place") and PickerBottomSheet actions (Cancel/Save).
 */

import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, InteractionManager } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import MapView from 'react-native-maps';
import { Icon } from '../../../../../shared/components';
import type { IconName } from '../../../../../shared/components';
import { calculateDistance, formatDistanceWithUnits } from '@trace/core';
import type { LocationIssue } from '@trace/core';
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
  setSelection: React.Dispatch<React.SetStateAction<LocationSelection>>;

  // UI State
  ui: LocationPickerUI;
  setUI: React.Dispatch<React.SetStateAction<LocationPickerUI>>;

  // Map ref for zoom control
  mapRef?: React.RefObject<MapView | null>;

  // Picker-context handlers
  handleSwitchToSelectMode: () => void;
  handleRemoveLocation: () => void;
  handleRemovePin: () => void;

  // Editing state (lifted to hook)
  isEditing: boolean;
  editName: string;
  onEditNameChange: (name: string) => void;
  editAddress: string;
  onEditAddressChange: (address: string) => void;
  onStartEditing: () => void;

  // Management-context handlers (only passed when mode='manage')
  onDelete?: () => void;
  onEnrich?: () => void;
  onViewEntries?: () => void;
  onToggleMyPlace?: () => void;
  onMergeDuplicate?: () => void;
  onDismissMerge?: () => void;
  issues?: LocationIssue[];
  context?: 'picker' | 'manage';

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
  isEditing,
  editName,
  onEditNameChange,
  editAddress,
  onEditAddressChange,
  onStartEditing,
  onDelete,
  onEnrich,
  onViewEntries,
  onToggleMyPlace,
  onMergeDuplicate,
  onDismissMerge,
  issues = [],
  context = 'picker',
  keyboardHeight = 0,
}: CurrentLocationViewProps) {
  const theme = useTheme();
  const { settings } = useSettings();
  const isManage = context === 'manage';

  // Auto-focus name input when entering edit mode
  const nameInputRef = useRef<TextInput>(null);
  useEffect(() => {
    if (isEditing) {
      InteractionManager.runAfterInteractions(() => {
        nameInputRef.current?.focus();
      });
    }
  }, [isEditing]);

  // Zoom level cycle: city (default) -> street -> state -> city...
  const [zoomLevel, setZoomLevel] = useState<'city' | 'street' | 'state'>('city');

  // Handle location card tap - cycle through zoom levels
  const handleLocationCardPress = () => {
    if (!selection.location || !mapRef?.current) return;

    const nextLevel = zoomLevel === 'city' ? 'street' : zoomLevel === 'street' ? 'state' : 'city';
    setZoomLevel(nextLevel);

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

  const entryCount = selection.entryCount ?? 0;

  // GPS info — shows original coords and snap distance if location was snapped
  const getGpsInfo = () => {
    const loc = selection.location;
    if (!loc) return null;

    const hasOriginalCoords = loc.originalLatitude != null && loc.originalLongitude != null;
    const wasSnapped = hasOriginalCoords && (
      Math.abs(loc.originalLatitude! - loc.latitude) > 0.000001 ||
      Math.abs(loc.originalLongitude! - loc.longitude) > 0.000001
    );

    let snapDistance: string | null = null;
    if (wasSnapped) {
      const distance = calculateDistance(
        { latitude: loc.originalLatitude!, longitude: loc.originalLongitude! },
        { latitude: loc.latitude, longitude: loc.longitude }
      );
      snapDistance = formatDistanceWithUnits(distance.meters, settings.units);
    }

    if (!hasOriginalCoords) return null;

    return {
      originalLatitude: loc.originalLatitude!,
      originalLongitude: loc.originalLongitude!,
      snapDistance,
      wasSnapped,
    };
  };

  const gpsInfo = getGpsInfo();

  const canEdit = !!onStartEditing;
  const hasSavedLocation = !!selection.locationId;

  // Smart location display builder
  const getLocationDisplay = () => {
    const loc = selection.location;
    if (!loc) return null;

    const hasName = !!loc.name;
    const hasCity = !!loc.city;
    const hasRegion = !!loc.region;
    const hasAddress = !!loc.address;
    const hasPostalCode = !!loc.postalCode;
    const hasCountry = !!loc.country;

    const primaryText = hasName ? loc.name : 'Unnamed Place';

    const addressLine = hasAddress ? loc.address : null;

    let cityStateZip: string | null = null;
    if (hasCity) {
      const stateZipParts: string[] = [];
      if (hasRegion) stateZipParts.push(loc.region!);
      if (hasPostalCode) stateZipParts.push(loc.postalCode!);
      const stateZip = stateZipParts.join(' ');
      cityStateZip = stateZip ? `${loc.city!}, ${stateZip}` : loc.city!;
    }

    const regionOnlyLine = (!hasCity && hasRegion) ? loc.region : null;
    const countryLine = hasCountry ? loc.country : null;
    const coordsText = `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`;

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
      hasName,
      iconState,
    };
  };

  const locationDisplay = getLocationDisplay();

  // Clear place with confirmation
  const handleClearLocationPress = () => {
    Alert.alert(
      'Clear Place',
      'Are you sure you want to remove all place data from this entry?',
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
            Loading place details...
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
            <Icon name="MapPinEmpty" size={24} color={theme.colors.text.tertiary} />
          </View>
          <Text style={[styles.emptyDetailsText, { fontFamily: theme.typography.fontFamily.semibold, color: theme.colors.text.secondary }]}>
            No place selected
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
        {/* Issue Banners — management context only, hidden when editing */}
        {!isEditing && isManage && issues.length > 0 && issues.map((issue, i) => {
          const bannerColor = issue.type === 'missing_data' ? theme.colors.functional.overdue : theme.colors.functional.accent;
          const iconName: IconName = issue.type === 'missing_data' ? 'AlertTriangle'
            : issue.type === 'snap_candidate' ? 'Link'
            : issue.type === 'needs_geocoding' ? 'MapPin'
            : 'Merge';

          // Build action buttons per issue type
          const actions: Array<{ label: string; onPress: () => void; style?: 'outline' }> = [];
          if (issue.type === 'missing_data' && onEnrich) {
            actions.push({ label: 'Fill', onPress: onEnrich });
          }
          if (issue.type === 'merge_candidate' && onMergeDuplicate) {
            actions.push({ label: 'Merge', onPress: onMergeDuplicate });
          }
          if (issue.type === 'merge_candidate' && onDismissMerge) {
            actions.push({ label: 'Ignore', onPress: onDismissMerge, style: 'outline' });
          }

          return (
            <View
              key={`issue-${i}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 14,
                borderRadius: 12,
                gap: 10,
                marginBottom: 12,
                backgroundColor: bannerColor + '15',
              }}
            >
              <Icon name={iconName} size={18} color={bannerColor} />
              <Text style={{ fontSize: 14, flex: 1, fontFamily: theme.typography.fontFamily.medium, color: bannerColor }}>
                {issue.message}
              </Text>
              {actions.map((action) => (
                <TouchableOpacity
                  key={action.label}
                  style={action.style === 'outline'
                    ? { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: bannerColor }
                    : { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: bannerColor }
                  }
                  onPress={action.onPress}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: action.style === 'outline' ? bannerColor : '#ffffff',
                    fontSize: 12,
                    fontFamily: theme.typography.fontFamily.semibold,
                  }}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}

        {/* Location Card — single card, two internal layouts (view vs edit) */}
        {locationDisplay && (
          <View
            style={[
              {
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
                backgroundColor: theme.colors.background.primary,
                // View mode: horizontal row layout. Edit mode: vertical column.
                flexDirection: isEditing ? 'column' : 'row',
                alignItems: isEditing ? undefined : 'flex-start',
                gap: isEditing ? undefined : 16,
              },
              theme.shadows.sm,
            ]}
          >
            {/* Top-right pill: Edit (view mode only) or Zoom indicator */}
            {!isEditing && canEdit && (
              <TouchableOpacity
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: theme.colors.background.secondary,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 12,
                  zIndex: 1,
                }}
                onPress={onStartEditing}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="Edit" size={14} color={theme.colors.functional.accent} />
                <Text style={{
                  fontSize: 12,
                  fontFamily: theme.typography.fontFamily.medium,
                  color: theme.colors.functional.accent,
                }}>
                  Edit
                </Text>
              </TouchableOpacity>
            )}
            {!isEditing && !canEdit && (
              <TouchableOpacity
                style={{
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
                }}
                onPress={handleLocationCardPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="Search" size={14} color={theme.colors.text.tertiary} />
                <Text style={{
                  fontSize: 12,
                  fontFamily: theme.typography.fontFamily.medium,
                  color: theme.colors.text.tertiary,
                }}>
                  ±
                </Text>
              </TouchableOpacity>
            )}

            {isEditing ? (
              /* ── Edit layout: vertical, no tier icon ── */
              <>
                {/* Name */}
                <Text style={{
                  fontSize: 11,
                  fontFamily: theme.typography.fontFamily.medium,
                  color: theme.colors.text.tertiary,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 6,
                }}>
                  Name
                </Text>
                <TextInput
                  ref={nameInputRef}
                  style={{
                    fontSize: 16,
                    fontFamily: theme.typography.fontFamily.regular,
                    color: theme.colors.text.primary,
                    backgroundColor: theme.colors.background.secondary,
                    borderWidth: 1,
                    borderColor: theme.colors.border.light,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    marginBottom: 14,
                  }}
                  value={editName}
                  onChangeText={onEditNameChange}
                  placeholder="Place name..."
                  placeholderTextColor={theme.colors.text.tertiary}
                  returnKeyType="next"
                  autoCorrect={false}
                  selectTextOnFocus
                />

                {/* Street Address */}
                <Text style={{
                  fontSize: 11,
                  fontFamily: theme.typography.fontFamily.medium,
                  color: theme.colors.text.tertiary,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 6,
                }}>
                  Street Address
                </Text>
                <TextInput
                  style={{
                    fontSize: 16,
                    fontFamily: theme.typography.fontFamily.regular,
                    color: theme.colors.text.primary,
                    backgroundColor: theme.colors.background.secondary,
                    borderWidth: 1,
                    borderColor: theme.colors.border.light,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    marginBottom: 8,
                  }}
                  value={editAddress}
                  onChangeText={onEditAddressChange}
                  placeholder="Street address..."
                  placeholderTextColor={theme.colors.text.tertiary}
                  returnKeyType="done"
                  autoCorrect={false}
                />

                {/* Read-only metadata below inputs */}
                {(locationDisplay.cityStateZip || locationDisplay.regionOnlyLine || locationDisplay.countryLine) && (
                  <View style={{ marginTop: 4 }}>
                    {locationDisplay.cityStateZip && (
                      <Text style={{ fontSize: 13, fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }}>
                        {locationDisplay.cityStateZip}
                      </Text>
                    )}
                    {locationDisplay.regionOnlyLine && (
                      <Text style={{ fontSize: 13, fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }}>
                        {locationDisplay.regionOnlyLine}
                      </Text>
                    )}
                    {locationDisplay.countryLine && (
                      <Text style={{ fontSize: 13, fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }}>
                        {locationDisplay.countryLine}
                      </Text>
                    )}
                  </View>
                )}

                {/* Coordinates */}
                <View style={[styles.locationCardCoordsRow, { marginTop: 8 }]}>
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                    <Circle cx={12} cy={12} r={10} />
                    <Circle cx={12} cy={12} r={3} fill={theme.colors.text.tertiary} />
                  </Svg>
                  <Text style={[styles.locationCardCoords, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]}>
                    {locationDisplay.coordsText}
                  </Text>
                </View>
              </>
            ) : (
              /* ── View layout: horizontal with tier icon, tappable for zoom ── */
              <>
                {/* Tier Icon */}
                <TouchableOpacity
                  style={[styles.locationCardIcon, { backgroundColor: theme.colors.functional.accentLight }]}
                  onPress={handleLocationCardPress}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={locationDisplay.iconState === 'saved' ? 'MapPinFavorite' : locationDisplay.iconState === 'dropped_pin' ? 'MapPinEmpty' : 'MapPinSolid'}
                    size={28}
                    color={theme.colors.functional.accent}
                  />
                </TouchableOpacity>

                {/* Location Data */}
                <TouchableOpacity
                  style={styles.locationCardContent}
                  onPress={handleLocationCardPress}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.locationCardName, { fontFamily: theme.typography.fontFamily.semibold, color: theme.colors.text.primary }]} numberOfLines={2}>
                    {locationDisplay.primaryText}
                  </Text>

                  {locationDisplay.addressLine && (
                    <Text style={[styles.locationCardAddress, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.secondary }]} numberOfLines={1}>
                      {locationDisplay.addressLine}
                    </Text>
                  )}

                  {locationDisplay.cityStateZip && (
                    <Text style={[styles.locationCardAddress, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]} numberOfLines={1}>
                      {locationDisplay.cityStateZip}
                    </Text>
                  )}

                  {locationDisplay.regionOnlyLine && (
                    <Text style={[styles.locationCardAddress, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]} numberOfLines={1}>
                      {locationDisplay.regionOnlyLine}
                    </Text>
                  )}

                  {locationDisplay.countryLine && (
                    <Text style={[styles.locationCardAddress, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]} numberOfLines={1}>
                      {locationDisplay.countryLine}
                    </Text>
                  )}

                  {/* Coordinates */}
                  <View style={styles.locationCardCoordsRow}>
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                      <Circle cx={12} cy={12} r={10} />
                      <Circle cx={12} cy={12} r={3} fill={theme.colors.text.tertiary} />
                    </Svg>
                    <Text style={[styles.locationCardCoords, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]}>
                      {locationDisplay.coordsText}
                    </Text>
                  </View>

                  {/* Entry Count Badge */}
                  {entryCount > 0 && (
                    <View style={[styles.locationCardBadge, { backgroundColor: theme.colors.background.secondary }]}>
                      <Text style={[styles.locationCardBadgeText, { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.secondary }]}>
                        {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Everything below is hidden during editing — focused temp state */}
        {!isEditing && (
          <>
            {/* GPS Snap Info — if entry was snapped to a saved place */}
            {gpsInfo?.wasSnapped && (
              <View style={[styles.infoCard, { backgroundColor: theme.colors.background.primary, paddingVertical: 12 }, theme.shadows.sm]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="Navigation" size={16} color={theme.colors.text.tertiary} />
                  <Text style={{ fontSize: 13, fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }}>
                    GPS was {gpsInfo.snapDistance} from place
                  </Text>
                </View>
              </View>
            )}

            {/* Action Card — context-dependent rows */}
            <View style={[styles.actionCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
              {/* Save to / Remove from My Places (both contexts) — only for named locations or already saved */}
              {onToggleMyPlace && (hasSavedLocation || locationDisplay?.hasName) && (
                <TouchableOpacity
                  style={[styles.actionRow, { borderBottomColor: theme.colors.border.light, paddingVertical: 18 }]}
                  onPress={onToggleMyPlace}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionRowContent}>
                    <Icon
                      name={hasSavedLocation ? 'MapPinFavoriteLine' : 'MapPinFavorite'}
                      size={20}
                      color={hasSavedLocation ? theme.colors.text.primary : theme.colors.functional.accent}
                    />
                    <Text style={[styles.actionRowText, { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.primary }]}>
                      {hasSavedLocation ? 'Remove from My Places' : 'Add to My Places'}
                    </Text>
                  </View>
                  <Icon name="ChevronRight" size={16} color={theme.colors.text.tertiary} />
                </TouchableOpacity>
              )}

              {/* View Entries — management context only */}
              {isManage && onViewEntries && entryCount > 0 && (
                <TouchableOpacity
                  style={[styles.actionRow, { borderBottomColor: theme.colors.border.light, paddingVertical: 18 }]}
                  onPress={onViewEntries}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionRowContent}>
                    <Icon name="List" size={20} color={theme.colors.text.primary} />
                    <Text style={[styles.actionRowText, { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.primary }]}>
                      View Entries ({entryCount})
                    </Text>
                  </View>
                  <Icon name="ChevronRight" size={16} color={theme.colors.text.tertiary} />
                </TouchableOpacity>
              )}

              {/* Change Place — picker context only */}
              {!isManage && (
                <TouchableOpacity
                  style={[styles.actionRow, { borderBottomColor: theme.colors.border.light, paddingVertical: 18 }]}
                  onPress={handleSwitchToSelectMode}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionRowContent}>
                    <Icon name="MapPin" size={20} color={theme.colors.text.primary} />
                    <Text style={[styles.actionRowText, { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.primary }]}>
                      Select a Different Place
                    </Text>
                  </View>
                  <Icon name="ChevronRight" size={16} color={theme.colors.text.tertiary} />
                </TouchableOpacity>
              )}

              {/* Clear Place — picker context only */}
              {!isManage && (
                <TouchableOpacity
                  style={[styles.actionRow, styles.actionRowLast, { paddingVertical: 18 }]}
                  onPress={handleClearLocationPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionRowContent}>
                    <Icon name="MapPinXInside" size={20} color="#dc2626" />
                    <Text style={[styles.actionRowText, { fontFamily: theme.typography.fontFamily.medium, color: '#dc2626' }]}>
                      Remove Place from Entry
                    </Text>
                  </View>
                  <Icon name="ChevronRight" size={16} color={theme.colors.text.tertiary} />
                </TouchableOpacity>
              )}

              {/* Delete Place — management context only — hidden since "Remove from My Places" covers this */}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
