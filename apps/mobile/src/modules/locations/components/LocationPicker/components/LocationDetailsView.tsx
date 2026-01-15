/**
 * LocationDetailsView Component
 *
 * Shows the location details form for creating or viewing a location.
 * - Create mode: editable name input, address display, Save button at bottom
 * - View mode: read-only display with Edit / Change / Remove buttons
 * - Edit mode (view mode with editing enabled): editable name, Save changes button
 */

import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { useTheme } from '../../../../../shared/contexts/ThemeContext';
import { locationPickerStyles as styles } from '../../../styles/locationPickerStyles';
import {
  type LocationSelection,
  type LocationPickerUI,
  type LocationPickerMode,
} from '../../../types/LocationPickerTypes';

interface LocationDetailsViewProps {
  // Mode
  effectiveMode: LocationPickerMode;

  // Selection
  selection: LocationSelection;

  // UI State
  ui: LocationPickerUI;
  setUI: React.Dispatch<React.SetStateAction<LocationPickerUI>>;

  // Handlers
  handleOKPress: () => void;
  handleSwitchToSelectMode: () => void;
  handleRemoveLocation: () => void;
  handleEditLocation?: (newName: string) => void; // Edit saved location

  // Keyboard
  keyboardHeight?: number;
}

export function LocationDetailsView({
  effectiveMode,
  selection,
  ui,
  setUI,
  handleOKPress,
  handleSwitchToSelectMode,
  handleRemoveLocation,
  handleEditLocation,
  keyboardHeight = 0,
}: LocationDetailsViewProps) {
  const dynamicTheme = useTheme();

  // Local editing state - when true, name is editable even in view mode
  const [isEditing, setIsEditing] = useState(false);
  // Build formatted address lines
  const getAddressLines = (): string[] => {
    if (!selection.location) return [];

    const addressLines: string[] = [];

    // Line 1: Street address
    if (selection.location.address) {
      addressLines.push(selection.location.address);
    }

    // Line 2: City, State ZIP
    const cityStateZip: string[] = [];
    if (selection.location.city) cityStateZip.push(selection.location.city);
    if (selection.location.region) cityStateZip.push(selection.location.region);
    if (selection.location.postalCode) cityStateZip.push(selection.location.postalCode);
    if (cityStateZip.length > 0) {
      addressLines.push(cityStateZip.join(', '));
    }

    // Line 3: Country
    if (selection.location.country) {
      addressLines.push(selection.location.country);
    }

    return addressLines;
  };

  const addressLines = getAddressLines();
  const isViewMode = effectiveMode === 'view';

  // Determine if we should show editable name input
  // - Create mode: always editable
  // - View mode: only editable when isEditing is true
  const showEditableName = !isViewMode || isEditing;

  // Can edit if this is a saved location (has location_id) and handler is provided
  const canEdit = isViewMode && !!selection.locationId && !!handleEditLocation;

  // Entry count for display
  const entryCount = selection.entryCount ?? 0;

  // Handle save when editing
  const handleSaveEdit = () => {
    if (handleEditLocation && ui.editableNameInput.trim()) {
      handleEditLocation(ui.editableNameInput.trim());
      setIsEditing(false);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    // Reset name to original
    setUI(prev => ({ ...prev, editableNameInput: selection.location?.name || '' }));
    setIsEditing(false);
  };

  return (
    <View style={styles.createLocationContainer}>
      {selection.isLoadingDetails && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={dynamicTheme.colors.functional.accent} />
          <Text style={[styles.loadingText, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.secondary }]}>Loading location details...</Text>
        </View>
      )}

      {selection.location ? (
        <ScrollView
          style={styles.createLocationScroll}
          contentContainerStyle={[
            styles.createLocationContent,
            keyboardHeight > 0 && { paddingBottom: keyboardHeight + 40 }
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Entry count badge - show in view mode for saved locations */}
          {isViewMode && entryCount > 0 && (
            <View style={[styles.entryCountBadge, { backgroundColor: dynamicTheme.colors.background.secondary }]}>
              <Text style={[styles.entryCountText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.secondary }]}>
                Used by {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
              </Text>
            </View>
          )}

          {/* Name Section */}
          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.secondary }]}>Name</Text>
            {showEditableName ? (
              <TextInput
                style={[styles.formInput, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.primary, backgroundColor: dynamicTheme.colors.background.secondary, borderColor: dynamicTheme.colors.border.light }]}
                value={ui.editableNameInput}
                onChangeText={(text) => setUI(prev => ({ ...prev, editableNameInput: text }))}
                placeholder="Enter location name..."
                placeholderTextColor={dynamicTheme.colors.text.tertiary}
                autoFocus={isEditing || !ui.editableNameInput}
              />
            ) : (
              <Text style={[styles.formValueLarge, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.primary }]}>{ui.editableNameInput || 'Unnamed Location'}</Text>
            )}
          </View>

          {/* Address or Coordinates Section (show address if available, otherwise coords) */}
          <View style={styles.formSection}>
            {addressLines.length > 0 ? (
              <>
                <Text style={[styles.formLabel, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.secondary }]}>Address</Text>
                <Text style={[styles.formValue, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.primary }]}>{addressLines.join('\n')}</Text>
              </>
            ) : (
              <>
                <Text style={[styles.formLabel, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.secondary }]}>Coordinates</Text>
                <Text style={[styles.formValue, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.primary }]}>
                  {selection.location.latitude.toFixed(6)}, {selection.location.longitude.toFixed(6)}
                </Text>
              </>
            )}
          </View>

          {/* Divider */}
          <View style={[styles.formDivider, { backgroundColor: dynamicTheme.colors.border.light }]} />

          {/* Action Buttons */}
          <View style={styles.formActions}>
            {/* Editing state buttons (when editing in view mode) */}
            {isEditing ? (
              <>
                {/* Save Changes button */}
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: dynamicTheme.colors.functional.accent }]}
                  onPress={handleSaveEdit}
                >
                  <Text style={[styles.primaryButtonText, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: '#ffffff' }]}>
                    Save Changes{entryCount > 1 ? ` (${entryCount} entries)` : ''}
                  </Text>
                </TouchableOpacity>

                {/* Cancel button */}
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
                  onPress={handleCancelEdit}
                >
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.primary} strokeWidth={2}>
                    <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
                    <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
                  </Svg>
                  <Text style={[styles.actionButtonText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Primary action - Save (create mode) or hidden (view mode) */}
                {!isViewMode && (
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: dynamicTheme.colors.functional.accent }]}
                    onPress={handleOKPress}
                  >
                    <Text style={[styles.primaryButtonText, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: '#ffffff' }]}>Save Location</Text>
                  </TouchableOpacity>
                )}

                {/* Edit Location Button - only in view mode for saved locations */}
                {canEdit && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
                    onPress={() => setIsEditing(true)}
                  >
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.primary} strokeWidth={2}>
                      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={[styles.actionButtonText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary }]}>Edit Name</Text>
                  </TouchableOpacity>
                )}

                {/* Change Location Button */}
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
                  onPress={handleSwitchToSelectMode}
                >
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.primary} strokeWidth={2}>
                    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx={12} cy={10} r={3} fill={dynamicTheme.colors.text.primary} />
                  </Svg>
                  <Text style={[styles.actionButtonText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary }]}>Change Location</Text>
                </TouchableOpacity>

                {/* Remove Location Button - same outline style, red text */}
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
                  onPress={handleRemoveLocation}
                >
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}>
                    <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={[styles.actionButtonText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: '#dc2626' }]}>Remove Location</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.emptyDetailsState}>
          <View style={[styles.poiIconContainer, { width: 48, height: 48, borderRadius: 24, marginBottom: 16, backgroundColor: dynamicTheme.colors.background.secondary }]}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.tertiary} strokeWidth={2}>
              <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={12} cy={10} r={3} fill={dynamicTheme.colors.text.tertiary} />
            </Svg>
          </View>
          <Text style={[styles.emptyDetailsText, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.secondary }]}>No location selected</Text>
          <Text style={[styles.emptyDetailsSubtext, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.tertiary }]}>
            Tap the map or search for a place to get started
          </Text>
        </View>
      )}
    </View>
  );
}
