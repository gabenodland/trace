/**
 * AttributesPicker - Entry menu for adding attributes
 * Extracted from CaptureForm for maintainability
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { theme } from "../../../../shared/theme/theme";
import { styles } from "../CaptureForm.styles";
import type { PhotoCaptureRef } from "../../../photos/components/PhotoCapture";

interface AttributesPickerProps {
  visible: boolean;
  onClose: () => void;
  isEditing: boolean;
  isEditMode: boolean;
  enterEditMode: () => void;
  // Visibility flags
  showLocation: boolean;
  showStatus: boolean;
  showDueDate: boolean;
  showRating: boolean;
  showPriority: boolean;
  showPhotos: boolean;
  // Current values
  hasGpsData: boolean;
  hasLocationData: boolean;
  status: "none" | "incomplete" | "in_progress" | "complete";
  dueDate: string | null;
  rating: number;
  priority: number;
  photoCount: number;
  // Callbacks
  onAddGps: () => void;
  onShowLocationPicker: () => void;
  onShowStatusPicker: () => void;
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
  showDueDate,
  showRating,
  showPriority,
  showPhotos,
  hasGpsData,
  hasLocationData,
  status,
  dueDate,
  rating,
  priority,
  photoCount,
  onAddGps,
  onShowLocationPicker,
  onShowStatusPicker,
  onShowDatePicker,
  onShowRatingPicker,
  onShowPriorityPicker,
  onAddPhoto,
  onDelete,
  onSnackbar,
}: AttributesPickerProps) {
  const hasUnsetAttributes =
    !hasGpsData ||
    (showLocation && !hasLocationData) ||
    (showStatus && status === "none") ||
    (showDueDate && !dueDate) ||
    (showRating && rating === 0) ||
    (showPriority && priority === 0) ||
    (showPhotos && photoCount === 0);

  return (
    <TopBarDropdownContainer visible={visible} onClose={onClose}>
      <View style={localStyles.container}>
        {/* Header with title and close button */}
        <View style={localStyles.header}>
          <Text style={localStyles.title}>
            {hasUnsetAttributes ? "Add Attribute" : "Entry Options"}
          </Text>
          <TouchableOpacity style={localStyles.closeButton} onPress={onClose}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Attributes Section - only show if there are unset attributes */}
        {hasUnsetAttributes && (
          <>

            {/* GPS */}
            {!hasGpsData && (
              <TouchableOpacity
                style={styles.attributePickerItem}
                onPress={() => {
                  onClose();
                  onAddGps();
                  if (!isEditMode) enterEditMode();
                }}
              >
                <View style={styles.attributePickerItemIcon}>
                  {/* GPS Crosshair Icon */}
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                    <Circle cx={12} cy={12} r={10} strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx={12} cy={12} r={3} fill="#6b7280" stroke="none" />
                    <Line x1={12} y1={2} x2={12} y2={6} strokeLinecap="round" />
                    <Line x1={12} y1={18} x2={12} y2={22} strokeLinecap="round" />
                    <Line x1={2} y1={12} x2={6} y2={12} strokeLinecap="round" />
                    <Line x1={18} y1={12} x2={22} y2={12} strokeLinecap="round" />
                  </Svg>
                </View>
                <Text style={styles.attributePickerItemText}>GPS</Text>
              </TouchableOpacity>
            )}

            {/* Location (named place) */}
            {showLocation && !hasLocationData && (
              <TouchableOpacity
                style={styles.attributePickerItem}
                onPress={() => {
                  onClose();
                  setTimeout(() => onShowLocationPicker(), 100);
                }}
              >
                <View style={styles.attributePickerItemIcon}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx={12} cy={10} r={3} fill="#6b7280" />
                  </Svg>
                </View>
                <Text style={styles.attributePickerItemText}>Location</Text>
              </TouchableOpacity>
            )}

            {/* Status */}
            {showStatus && status === "none" && (
              <TouchableOpacity
                style={styles.attributePickerItem}
                onPress={() => {
                  onClose();
                  setTimeout(() => onShowStatusPicker(), 100);
                  if (!isEditMode) enterEditMode();
                }}
              >
                <View style={styles.attributePickerItemIcon}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                    <Circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={styles.attributePickerItemText}>Status</Text>
              </TouchableOpacity>
            )}

            {/* Due Date */}
            {showDueDate && !dueDate && (
              <TouchableOpacity
                style={styles.attributePickerItem}
                onPress={() => {
                  onClose();
                  setTimeout(() => onShowDatePicker(), 100);
                  if (!isEditMode) enterEditMode();
                }}
              >
                <View style={styles.attributePickerItemIcon}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                    <Path d="M3 4a2 2 0 012-2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V4z" strokeLinecap="round" strokeLinejoin="round" />
                    <Line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" strokeLinejoin="round" />
                    <Line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" strokeLinejoin="round" />
                    <Line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={styles.attributePickerItemText}>Due Date</Text>
              </TouchableOpacity>
            )}

            {/* Rating */}
            {showRating && rating === 0 && (
              <TouchableOpacity
                style={styles.attributePickerItem}
                onPress={() => {
                  onClose();
                  setTimeout(() => onShowRatingPicker(), 100);
                  if (!isEditMode) enterEditMode();
                }}
              >
                <View style={styles.attributePickerItemIcon}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                    <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={styles.attributePickerItemText}>Rating</Text>
              </TouchableOpacity>
            )}

            {/* Priority */}
            {showPriority && priority === 0 && (
              <TouchableOpacity
                style={styles.attributePickerItem}
                onPress={() => {
                  onClose();
                  setTimeout(() => onShowPriorityPicker(), 100);
                  if (!isEditMode) enterEditMode();
                }}
              >
                <View style={styles.attributePickerItemIcon}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                    <Path d="M5 3v18" strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M5 3h13l-4 5 4 5H5z" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={styles.attributePickerItemText}>Priority</Text>
              </TouchableOpacity>
            )}

            {/* Photos */}
            {showPhotos && photoCount === 0 && (
              <TouchableOpacity
                style={styles.attributePickerItem}
                onPress={() => {
                  onClose();
                  if (!isEditMode) enterEditMode();
                  setTimeout(() => onAddPhoto(), 100);
                }}
              >
                <View style={styles.attributePickerItemIcon}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx={12} cy={13} r={4} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={styles.attributePickerItemText}>Photos</Text>
              </TouchableOpacity>
            )}

          </>
        )}

        {/* Delete Entry - only shown for existing entries */}
        {isEditing && (
          <>
            {hasUnsetAttributes && <View style={localStyles.divider} />}
            <TouchableOpacity
              style={localStyles.deleteButton}
              onPress={() => {
                onClose();
                setTimeout(() => onDelete(), 100);
              }}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2}>
                <Path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={localStyles.deleteButtonText}>Delete Entry</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </TopBarDropdownContainer>
  );
}

const localStyles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border.light,
    marginVertical: theme.spacing.sm,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: "#fee2e2",
    gap: theme.spacing.md,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.medium,
    color: "#ef4444",
  },
});
