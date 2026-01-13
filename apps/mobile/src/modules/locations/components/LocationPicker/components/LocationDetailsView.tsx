/**
 * LocationDetailsView Component
 *
 * Shows the location details form for creating or viewing a location.
 * - Create mode: editable name input, address display, Save button at bottom
 * - View mode: read-only display with Change / Remove buttons
 */

import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
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
}

export function LocationDetailsView({
  effectiveMode,
  selection,
  ui,
  setUI,
  handleOKPress,
  handleSwitchToSelectMode,
  handleRemoveLocation,
}: LocationDetailsViewProps) {
  const dynamicTheme = useTheme();
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

  return (
    <View style={styles.createLocationContainer}>
      {selection.isLoadingDetails && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={dynamicTheme.colors.functional.accent} />
          <Text style={[styles.loadingText, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.secondary }]}>Loading location details...</Text>
        </View>
      )}

      {selection.location ? (
        <ScrollView style={styles.createLocationScroll} contentContainerStyle={styles.createLocationContent}>
          {/* Name Section */}
          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.secondary }]}>Name</Text>
            {isViewMode ? (
              <Text style={[styles.formValueLarge, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.primary }]}>{ui.editableNameInput || 'Unnamed Location'}</Text>
            ) : (
              <TextInput
                style={[styles.formInput, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.primary, backgroundColor: dynamicTheme.colors.background.secondary, borderColor: dynamicTheme.colors.border.light }]}
                value={ui.editableNameInput}
                onChangeText={(text) => setUI(prev => ({ ...prev, editableNameInput: text }))}
                placeholder="Enter location name..."
                placeholderTextColor={dynamicTheme.colors.text.tertiary}
                autoFocus={!ui.editableNameInput}
              />
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
            {/* Primary action - Save (create mode) or hidden (view mode) */}
            {!isViewMode && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: dynamicTheme.colors.functional.accent }]}
                onPress={handleOKPress}
              >
                <Text style={[styles.primaryButtonText, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: '#ffffff' }]}>Save Location</Text>
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
