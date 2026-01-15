/**
 * AttributesPicker - Entry menu for adding attributes
 * Uses PickerBottomSheet for consistent bottom sheet presentation
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { PickerBottomSheet } from "../../../../components/sheets";
import { useTheme } from "../../../../shared/contexts/ThemeContext";
import { themeBase } from "../../../../shared/theme/themeBase";
import type { EntryStatus } from "@trace/core";

interface AttributesPickerProps {
  visible: boolean;
  onClose: () => void;
  isEditing: boolean;
  isEditMode: boolean;
  enterEditMode: () => void;
  // Visibility flags
  showLocation: boolean;
  showStatus: boolean;
  showType: boolean;
  showDueDate: boolean;
  showRating: boolean;
  showPriority: boolean;
  showPhotos: boolean;
  // Current values - unified location (includes GPS, geocoded, and named)
  hasLocationData: boolean;
  status: EntryStatus;
  type: string | null;
  dueDate: string | null;
  rating: number;
  priority: number;
  photoCount: number;
  // Callbacks
  onShowLocationPicker: () => void;
  onShowStatusPicker: () => void;
  onShowTypePicker: () => void;
  onShowDatePicker: () => void;
  onShowRatingPicker: () => void;
  onShowPriorityPicker: () => void;
  onAddPhoto: () => void;
  onDelete: () => void;
  onSnackbar: (message: string) => void;
}

export function AttributesPicker({
  visible,
  onClose,
  isEditing,
  isEditMode,
  enterEditMode,
  showLocation,
  showStatus,
  showType,
  showDueDate,
  showRating,
  showPriority,
  showPhotos,
  hasLocationData,
  status,
  type,
  dueDate,
  rating,
  priority,
  photoCount,
  onShowLocationPicker,
  onShowStatusPicker,
  onShowTypePicker,
  onShowDatePicker,
  onShowRatingPicker,
  onShowPriorityPicker,
  onAddPhoto,
  onDelete,
  onSnackbar,
}: AttributesPickerProps) {
  const dynamicTheme = useTheme();
  const hasUnsetAttributes =
    (showLocation && !hasLocationData) ||
    (showStatus && status === "none") ||
    (showType && !type) ||
    (showDueDate && !dueDate) ||
    (showRating && rating === 0) ||
    (showPriority && priority === 0) ||
    (showPhotos && photoCount === 0);

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title={hasUnsetAttributes ? "Add Attribute" : "Entry Options"}
    >
      {/* Attributes Section - only show if there are unset attributes */}
      {hasUnsetAttributes && (
        <View style={styles.optionsContainer}>
          {/* Location (unified - handles GPS, geocoded, and named locations) */}
          {showLocation && !hasLocationData && (
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={() => {
                // Direct transition - changes activePicker without going through null
                onShowLocationPicker();
              }}
            >
              <View style={styles.optionIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.secondary} strokeWidth={2}>
                  <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={12} cy={10} r={3} fill={dynamicTheme.colors.text.secondary} />
                </Svg>
              </View>
              <Text style={[styles.optionText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary }]}>Location</Text>
            </TouchableOpacity>
          )}

          {/* Status */}
          {showStatus && status === "none" && (
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={() => {
                // Direct transition - changes activePicker without going through null
                if (!isEditMode) enterEditMode();
                onShowStatusPicker();
              }}
            >
              <View style={styles.optionIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.secondary} strokeWidth={2}>
                  <Circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={[styles.optionText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary }]}>Status</Text>
            </TouchableOpacity>
          )}

          {/* Type */}
          {showType && !type && (
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={() => {
                // Direct transition - changes activePicker without going through null
                if (!isEditMode) enterEditMode();
                onShowTypePicker();
              }}
            >
              <View style={styles.optionIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.secondary} strokeWidth={2}>
                  <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={[styles.optionText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary }]}>Type</Text>
            </TouchableOpacity>
          )}

          {/* Due Date */}
          {showDueDate && !dueDate && (
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={() => {
                // Direct transition - changes activePicker without going through null
                if (!isEditMode) enterEditMode();
                onShowDatePicker();
              }}
            >
              <View style={styles.optionIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.secondary} strokeWidth={2}>
                  <Path d="M3 4a2 2 0 012-2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V4z" strokeLinecap="round" strokeLinejoin="round" />
                  <Line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" strokeLinejoin="round" />
                  <Line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" strokeLinejoin="round" />
                  <Line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={[styles.optionText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary }]}>Due Date</Text>
            </TouchableOpacity>
          )}

          {/* Rating */}
          {showRating && rating === 0 && (
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={() => {
                // Direct transition - changes activePicker without going through null
                if (!isEditMode) enterEditMode();
                onShowRatingPicker();
              }}
            >
              <View style={styles.optionIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.secondary} strokeWidth={2}>
                  <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={[styles.optionText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary }]}>Rating</Text>
            </TouchableOpacity>
          )}

          {/* Priority */}
          {showPriority && priority === 0 && (
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={() => {
                // Direct transition - changes activePicker without going through null
                if (!isEditMode) enterEditMode();
                onShowPriorityPicker();
              }}
            >
              <View style={styles.optionIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.secondary} strokeWidth={2}>
                  <Path d="M5 3v18" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M5 3h13l-4 5 4 5H5z" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={[styles.optionText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary }]}>Priority</Text>
            </TouchableOpacity>
          )}

          {/* Photos */}
          {showPhotos && photoCount === 0 && (
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={() => {
                // Photos need close + delay for camera (no direct transition)
                onClose();
                if (!isEditMode) enterEditMode();
                setTimeout(() => onAddPhoto(), 100);
              }}
            >
              <View style={styles.optionIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.secondary} strokeWidth={2}>
                  <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={12} cy={13} r={4} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={[styles.optionText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary }]}>Photos</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Delete Entry - only shown for existing entries */}
      {isEditing && (
        <>
          {hasUnsetAttributes && <View style={[styles.divider, { backgroundColor: dynamicTheme.colors.border.light }]} />}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => {
              onClose();
              setTimeout(() => onDelete(), 100);
            }}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2}>
              <Path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        </>
      )}
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  optionsContainer: {
    gap: themeBase.spacing.sm,
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
  divider: {
    height: 1,
    marginVertical: themeBase.spacing.sm,
  },
  deleteButton: {
    alignSelf: "flex-end",
    padding: themeBase.spacing.sm,
  },
});
