/**
 * CreateLocationView Component
 *
 * Create-only: names and saves new places from map taps or POI selections.
 * Shows:
 * - Tier icon + Name input card
 * - Address/coordinates info card (from geocoding)
 * - Save to My Places toggle
 * - Save button (Save Place / Save Point)
 * - Change Place action row (below save, clearly separated)
 */

import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Icon } from '../../../../../shared/components';
import { useTheme } from '../../../../../shared/contexts/ThemeContext';
import { locationPickerStyles as styles } from '../../../styles/locationPickerStyles';
import {
  type LocationSelection,
  type LocationPickerUI,
} from '../../../types/LocationPickerTypes';

interface CreateLocationViewProps {
  // Selection
  selection: LocationSelection;
  setSelection: React.Dispatch<React.SetStateAction<LocationSelection>>;

  // UI State
  ui: LocationPickerUI;
  setUI: React.Dispatch<React.SetStateAction<LocationPickerUI>>;

  // Save to My Places toggle
  saveToMyPlaces: boolean;
  onSaveToMyPlacesChange: (value: boolean) => void;

  // Handlers
  handleOKPress: () => void;
  onBack: () => void;
  onClearAddress?: () => void;
  onResetToOriginal?: () => void;

  // Keyboard
  keyboardHeight?: number;
}

export function CreateLocationView({
  selection,
  setSelection,
  ui,
  setUI,
  saveToMyPlaces,
  onSaveToMyPlacesChange,
  handleOKPress,
  onBack,
  onClearAddress,
  onResetToOriginal,
  keyboardHeight = 0,
}: CreateLocationViewProps) {
  const theme = useTheme();

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

  // Tier icon: shows what the user is creating
  // MapPinFavorite = My Place (saved), MapPinSolid = Place (named), MapPinEmpty = Unnamed Place
  const tierIcon = saveToMyPlaces && hasName ? 'MapPinFavorite'
    : hasName ? 'MapPinSolid'
    : 'MapPinEmpty';
  const tierColor = saveToMyPlaces && hasName ? theme.colors.functional.accent
    : hasName ? theme.colors.text.primary
    : theme.colors.text.tertiary;

  const saveButtonText = hasName ? 'Save Place' : 'Save Unnamed Place';

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
            No place selected
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
        {/* ── Properties Section ── */}

        {/* Name Input Card with Tier Icon */}
        <View style={[styles.inputCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Icon name={tierIcon} size={20} color={tierColor} />
            <Text style={[styles.inputCardLabel, { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.secondary, marginBottom: 0 }]}>
              NAME
            </Text>
          </View>
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
            placeholder="Enter place name..."
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

          {/* Coordinates */}
          <View style={[
            styles.infoCardCoords,
            { borderTopColor: theme.colors.border.light },
            // Hide border when there's nothing above (no address data and not editing)
            (!ui.isAddressEditing && !hasLocationData) && { marginTop: 0, paddingTop: 0, borderTopWidth: 0 }
          ]}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
              <Circle cx={12} cy={12} r={10} />
              <Circle cx={12} cy={12} r={3} fill={theme.colors.text.tertiary} />
            </Svg>
            <Text style={[styles.infoCardCoordsText, { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.tertiary }]}>
              {`${selection.location?.latitude.toFixed(6)}, ${selection.location?.longitude.toFixed(6)}`}
            </Text>
          </View>
        </View>

        {/* Save to My Places Toggle — only available for named locations */}
        {hasName && (
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
                Add to My Places
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
        )}

        {/* ── Save Button ── */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: theme.colors.functional.accent }
          ]}
          onPress={handleOKPress}
          activeOpacity={0.7}
        >
          <Icon name="Save" size={20} color="#ffffff" />
          <Text style={[styles.saveButtonText, { fontFamily: theme.typography.fontFamily.semibold, color: '#ffffff' }]}>
            {saveButtonText}
          </Text>
        </TouchableOpacity>

        {/* ── Actions Section (below save, clearly separated) ── */}
        <View style={[styles.actionCard, { backgroundColor: theme.colors.background.primary, marginTop: 16 }, theme.shadows.sm]}>
          <TouchableOpacity
            style={[styles.actionRow, styles.actionRowLast]}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <View style={styles.actionRowContent}>
              <Icon name="MapPin" size={20} color={theme.colors.text.primary} />
              <Text style={[styles.actionRowText, { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.primary }]}>
                Change Place
              </Text>
            </View>
            <Icon name="ChevronRight" size={16} color={theme.colors.text.tertiary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
