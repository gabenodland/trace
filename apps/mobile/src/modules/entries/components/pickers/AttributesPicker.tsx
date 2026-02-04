/**
 * AttributesPicker - Entry options menu showing all attributes, photos, and actions
 *
 * Structure:
 * - ATTRIBUTES: All stream-enabled attributes with current values
 * - PHOTOS: Take Photo and Add from Gallery
 * - ACTIONS: Delete Entry (only when editing)
 */

import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { PickerBottomSheet } from "../../../../components/sheets";
import { useTheme } from "../../../../shared/contexts/ThemeContext";
import { themeBase } from "../../../../shared/theme/themeBase";
import {
  getStatusLabel,
  formatRatingDisplay,
  getLocationLabel,
  getPriorityInfo,
  type EntryStatus,
  type RatingType,
  type Location as LocationType
} from "@trace/core";

interface AttributesPickerProps {
  visible: boolean;
  onClose: () => void;
  isEditing: boolean;
  // Visibility flags
  showLocation: boolean;
  showStatus: boolean;
  showType: boolean;
  showDueDate: boolean;
  showRating: boolean;
  showPriority: boolean;
  showPhotos: boolean;
  // Current values
  locationData: LocationType | null;
  status: EntryStatus;
  type: string | null;
  dueDate: string | null;
  rating: number;
  priority: number;
  ratingType?: RatingType;
  // Callbacks
  onShowLocationPicker: () => void;
  onShowStatusPicker: () => void;
  onShowTypePicker: () => void;
  onShowDatePicker: () => void;
  onShowRatingPicker: () => void;
  onShowPriorityPicker: () => void;
  onTakePhoto: () => void;
  onGallery: () => void;
  onDelete: () => void;
}

export function AttributesPicker({
  visible,
  onClose,
  isEditing,
  showLocation,
  showStatus,
  showType,
  showDueDate,
  showRating,
  showPriority,
  showPhotos,
  locationData,
  status,
  type,
  dueDate,
  rating,
  priority,
  ratingType = 'stars',
  onShowLocationPicker,
  onShowStatusPicker,
  onShowTypePicker,
  onShowDatePicker,
  onShowRatingPicker,
  onShowPriorityPicker,
  onTakePhoto,
  onGallery,
  onDelete,
}: AttributesPickerProps) {
  const dynamicTheme = useTheme();

  // Check if location has any data
  const hasLocationData = !!(
    locationData?.name ||
    locationData?.city ||
    locationData?.neighborhood ||
    locationData?.region ||
    locationData?.country ||
    (locationData?.latitude && locationData?.longitude)
  );

  // Helper to format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Entry Options"
    >
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* ATTRIBUTES Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: dynamicTheme.colors.text.tertiary, fontFamily: dynamicTheme.typography.fontFamily.semibold }]}>
            ATTRIBUTES
          </Text>

          {/* Location */}
          {showLocation && (
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={onShowLocationPicker}
            >
              <View style={styles.optionIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={hasLocationData ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary} strokeWidth={2}>
                  <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={12} cy={10} r={3} fill={hasLocationData ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary} />
                </Svg>
              </View>
              <Text style={[
                styles.optionText,
                {
                  fontFamily: hasLocationData ? dynamicTheme.typography.fontFamily.medium : dynamicTheme.typography.fontFamily.regular,
                  color: hasLocationData ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary
                }
              ]}>
                {hasLocationData ? `Location: ${getLocationLabel(locationData)}` : "Set Location"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Status */}
          {showStatus && (
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={onShowStatusPicker}
            >
              <View style={styles.optionIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={status !== "none" ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary} strokeWidth={2}>
                  <Circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={[
                styles.optionText,
                {
                  fontFamily: status !== "none" ? dynamicTheme.typography.fontFamily.medium : dynamicTheme.typography.fontFamily.regular,
                  color: status !== "none" ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary
                }
              ]}>
                {status !== "none" ? `Status: ${getStatusLabel(status)}` : "Set Status"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Type */}
          {showType && (
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={onShowTypePicker}
            >
              <View style={styles.optionIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={type ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary} strokeWidth={2}>
                  <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={[
                styles.optionText,
                {
                  fontFamily: type ? dynamicTheme.typography.fontFamily.medium : dynamicTheme.typography.fontFamily.regular,
                  color: type ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary
                }
              ]}>
                {type ? `Type: ${type}` : "Set Type"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Due Date */}
          {showDueDate && (
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={onShowDatePicker}
            >
              <View style={styles.optionIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={dueDate ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary} strokeWidth={2}>
                  <Path d="M3 4a2 2 0 012-2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V4z" strokeLinecap="round" strokeLinejoin="round" />
                  <Line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" strokeLinejoin="round" />
                  <Line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" strokeLinejoin="round" />
                  <Line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={[
                styles.optionText,
                {
                  fontFamily: dueDate ? dynamicTheme.typography.fontFamily.medium : dynamicTheme.typography.fontFamily.regular,
                  color: dueDate ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary
                }
              ]}>
                {dueDate ? `Due Date: ${formatDate(dueDate)}` : "Set Due Date"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Rating */}
          {showRating && (
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={onShowRatingPicker}
            >
              <View style={styles.optionIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill={rating > 0 ? dynamicTheme.colors.text.primary : "none"} stroke={rating > 0 ? "none" : dynamicTheme.colors.text.secondary} strokeWidth={2}>
                  <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={[
                styles.optionText,
                {
                  fontFamily: rating > 0 ? dynamicTheme.typography.fontFamily.medium : dynamicTheme.typography.fontFamily.regular,
                  color: rating > 0 ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary
                }
              ]}>
                {rating > 0 ? `Rating: ${formatRatingDisplay(rating, ratingType)}` : "Set Rating"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Priority */}
          {showPriority && (
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={onShowPriorityPicker}
            >
              <View style={styles.optionIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill={priority > 0 ? dynamicTheme.colors.text.primary : "none"} stroke={priority > 0 ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary} strokeWidth={2}>
                  <Path d="M5 3v18" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M5 3h13l-4 5 4 5H5z" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={[
                styles.optionText,
                {
                  fontFamily: priority > 0 ? dynamicTheme.typography.fontFamily.medium : dynamicTheme.typography.fontFamily.regular,
                  color: priority > 0 ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary
                }
              ]}>
                {priority > 0 ? `Priority: ${getPriorityInfo(priority)?.label || `P${priority}`}` : "Set Priority"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* PHOTOS Section */}
        {showPhotos && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: dynamicTheme.colors.text.tertiary, fontFamily: dynamicTheme.typography.fontFamily.semibold }]}>
              PHOTOS
            </Text>

            {/* Take Photo */}
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={() => {
                onClose();
                setTimeout(() => onTakePhoto(), 100);
              }}
            >
              <View style={styles.optionIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.primary} strokeWidth={2}>
                  <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={12} cy={13} r={4} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={[styles.optionText, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.primary }]}>
                Take Photo
              </Text>
            </TouchableOpacity>

            {/* Add from Gallery */}
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={() => {
                onClose();
                setTimeout(() => onGallery(), 100);
              }}
            >
              <View style={styles.optionIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.primary} strokeWidth={2}>
                  <Path d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14.5" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6z" strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={8.5} cy={8.5} r={1.5} fill={dynamicTheme.colors.text.primary} />
                </Svg>
              </View>
              <Text style={[styles.optionText, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.primary }]}>
                Add from Gallery
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ACTIONS Section */}
        {isEditing && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: dynamicTheme.colors.text.tertiary, fontFamily: dynamicTheme.typography.fontFamily.semibold }]}>
              ACTIONS
            </Text>

            {/* Delete Entry */}
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={() => {
                onClose();
                setTimeout(() => onDelete(), 100);
              }}
            >
              <View style={styles.optionIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2}>
                  <Path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={[styles.optionText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: "#ef4444" }]}>
                Delete Entry
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    maxHeight: 500,
  },
  section: {
    marginBottom: themeBase.spacing.md,
  },
  sectionHeader: {
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: themeBase.spacing.sm,
    marginLeft: themeBase.spacing.xs,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
    gap: themeBase.spacing.md,
  },
  optionIcon: {
    width: 24,
    alignItems: "center",
  },
  optionText: {
    fontSize: 16,
  },
});
