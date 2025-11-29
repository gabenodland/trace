/**
 * LocationDetailsView Component
 *
 * Shows the location details form for creating or viewing a location.
 * - Create mode: editable name input, address display, Save button at bottom
 * - View mode: read-only display with Change / Remove buttons
 */

import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { theme } from '../../../../../shared/theme/theme';
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
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading location details...</Text>
        </View>
      )}

      {selection.location ? (
        <ScrollView style={styles.createLocationScroll} contentContainerStyle={styles.createLocationContent}>
          {/* Name Section */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Name</Text>
            {isViewMode ? (
              <Text style={styles.formValueLarge}>{ui.editableNameInput || 'Unnamed Location'}</Text>
            ) : (
              <TextInput
                style={styles.formInput}
                value={ui.editableNameInput}
                onChangeText={(text) => setUI(prev => ({ ...prev, editableNameInput: text }))}
                placeholder="Enter location name..."
                placeholderTextColor="#9ca3af"
                autoFocus={!ui.editableNameInput}
              />
            )}
          </View>

          {/* Address or Coordinates Section (show address if available, otherwise coords) */}
          <View style={styles.formSection}>
            {addressLines.length > 0 ? (
              <>
                <Text style={styles.formLabel}>Address</Text>
                <Text style={styles.formValue}>{addressLines.join('\n')}</Text>
              </>
            ) : (
              <>
                <Text style={styles.formLabel}>Coordinates</Text>
                <Text style={styles.formValue}>
                  {selection.location.latitude.toFixed(6)}, {selection.location.longitude.toFixed(6)}
                </Text>
              </>
            )}
          </View>

          {/* Divider */}
          <View style={styles.formDivider} />

          {/* Action Buttons */}
          <View style={styles.formActions}>
            {/* Primary action - Save (create mode) or hidden (view mode) */}
            {!isViewMode && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleOKPress}
              >
                <Text style={styles.primaryButtonText}>Save Location</Text>
              </TouchableOpacity>
            )}

            {/* Change Location Button */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleSwitchToSelectMode}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
                <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={12} cy={10} r={3} fill={theme.colors.text.primary} />
              </Svg>
              <Text style={styles.actionButtonText}>Change Location</Text>
            </TouchableOpacity>

            {/* Remove Location Button - same outline style, red text */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleRemoveLocation}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}>
                <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[styles.actionButtonText, { color: '#dc2626' }]}>Remove Location</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.emptyDetailsState}>
          <View style={[styles.poiIconContainer, { width: 48, height: 48, borderRadius: 24, marginBottom: 16 }]}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2}>
              <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={12} cy={10} r={3} fill="#9ca3af" />
            </Svg>
          </View>
          <Text style={styles.emptyDetailsText}>No location selected</Text>
          <Text style={styles.emptyDetailsSubtext}>
            Tap the map or search for a place to get started
          </Text>
        </View>
      )}
    </View>
  );
}
