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

import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../../../../../shared/contexts/ThemeContext';
import { locationPickerStyles as styles } from '../../../styles/locationPickerStyles';
import {
  type LocationSelection,
  type LocationPickerUI,
} from '../../../types/LocationPickerTypes';

interface CreateLocationViewProps {
  // Selection
  selection: LocationSelection;

  // UI State
  ui: LocationPickerUI;
  setUI: React.Dispatch<React.SetStateAction<LocationPickerUI>>;

  // Handlers
  handleOKPress: () => void;
  onBack: () => void;
  onClearAddress?: () => void;
  onLookupAddress?: () => void;

  // Keyboard
  keyboardHeight?: number;
}

export function CreateLocationView({
  selection,
  ui,
  setUI,
  handleOKPress,
  onBack,
  onClearAddress,
  onLookupAddress,
  keyboardHeight = 0,
}: CreateLocationViewProps) {
  const theme = useTheme();

  // Build formatted location info lines (no label - content speaks for itself)
  const getLocationInfo = (): string[] => {
    if (!selection.location) return [];

    const loc = selection.location;
    const lines: string[] = [];

    // Street address
    if (loc.address) {
      lines.push(loc.address);
    }

    // City, State, Postal Code
    const cityStateZip: string[] = [];
    if (loc.city) cityStateZip.push(loc.city);
    if (loc.region) cityStateZip.push(loc.region);
    if (loc.postalCode) cityStateZip.push(loc.postalCode);
    if (cityStateZip.length > 0) {
      lines.push(cityStateZip.join(', '));
    }

    // Country
    if (loc.country) {
      lines.push(loc.country);
    }

    return lines;
  };

  const locationInfo = getLocationInfo();
  const hasName = ui.editableNameInput.trim().length > 0;

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
            autoFocus={!ui.editableNameInput}
          />
        </View>

        {/* Location Info Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          {/* Clear Address link (when address exists) or Lookup Address link (when cleared) */}
          {selection.location?.address && onClearAddress ? (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: locationInfo.length > 0 ? 4 : 0 }}>
              <TouchableOpacity onPress={onClearAddress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 13, fontFamily: theme.typography.fontFamily.medium, color: theme.colors.functional.accent }}>
                  Clear Address
                </Text>
              </TouchableOpacity>
            </View>
          ) : !selection.location?.address && onLookupAddress ? (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: locationInfo.length > 0 ? 4 : 0 }}>
              <TouchableOpacity onPress={onLookupAddress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 13, fontFamily: theme.typography.fontFamily.medium, color: theme.colors.functional.accent }}>
                  Lookup Address
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {locationInfo.length > 0 ? (
            <Text style={[styles.infoCardText, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.primary }]}>
              {locationInfo.join('\n')}
            </Text>
          ) : null}
          {/* Coordinates */}
          <View style={[
            styles.infoCardCoords,
            { borderTopColor: theme.colors.border.light },
            locationInfo.length === 0 && { marginTop: 0, paddingTop: 0, borderTopWidth: 0 }
          ]}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
              <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={12} cy={10} r={3} fill={theme.colors.text.tertiary} />
            </Svg>
            <Text style={[styles.infoCardCoordsText, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]}>
              {selection.location.latitude.toFixed(6)}, {selection.location.longitude.toFixed(6)}
            </Text>
          </View>
        </View>

        {/* Change Location Link */}
        <TouchableOpacity
          style={styles.changeLocationButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.functional.accent} strokeWidth={2}>
            <Path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[styles.changeLocationText, { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.functional.accent }]}>
            Change Location
          </Text>
        </TouchableOpacity>

        {/* Action Button - contextual based on whether name is entered */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: theme.colors.functional.accent,
            }
          ]}
          onPress={handleOKPress}
          activeOpacity={0.7}
        >
          {hasName ? (
            /* Save icon for "Save Location" */
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
              <Path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M17 21v-8H7v8M7 3v5h8" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          ) : (
            /* Crosshairs icon for "Use Pin" */
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
              <Circle cx={12} cy={12} r={10} strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={12} cy={12} r={3} fill="#ffffff" stroke="none" />
              <Path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round" />
            </Svg>
          )}
          <Text style={[styles.saveButtonText, { fontFamily: theme.typography.fontFamily.semibold, color: '#ffffff' }]}>
            {hasName ? 'Save Location' : 'Use Pin'}
          </Text>
        </TouchableOpacity>

        {/* Helper text */}
        <Text style={[{ fontSize: 13, textAlign: 'center', marginTop: 12, fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]}>
          {hasName
            ? 'Location will be saved to My Places'
            : 'Enter a name to save to My Places'}
        </Text>
      </ScrollView>
    </View>
  );
}
