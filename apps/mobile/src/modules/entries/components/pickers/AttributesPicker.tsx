/**
 * AttributesPicker - Entry options menu showing all attributes, photos, and actions
 *
 * Structure:
 * - ATTRIBUTES: All stream-enabled attributes with current values
 * - PHOTOS: Take Photo and Add from Gallery
 * - ACTIONS: Delete Entry (only when editing)
 */

import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { PickerBottomSheet } from "../../../../components/sheets";
import { Icon } from "../../../../shared/components";
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
  // Stream
  streamName: string | null;
  onShowStreamPicker: () => void;
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
  isPinned?: boolean;
  isArchived?: boolean;
  // Callbacks
  onShowLocationPicker: () => void;
  onShowStatusPicker: () => void;
  onShowTypePicker: () => void;
  onShowDatePicker: () => void;
  onShowRatingPicker: () => void;
  onShowPriorityPicker: () => void;
  onTakePhoto: () => void;
  onGallery: () => void;
  onPinToggle?: () => void;
  onArchiveToggle?: () => void;
  onDuplicate?: () => void;
  onDelete: () => void;
}

export function AttributesPicker({
  visible,
  onClose,
  isEditing,
  streamName,
  onShowStreamPicker,
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
  isPinned = false,
  isArchived = false,
  onShowLocationPicker,
  onShowStatusPicker,
  onShowTypePicker,
  onShowDatePicker,
  onShowRatingPicker,
  onShowPriorityPicker,
  onTakePhoto,
  onGallery,
  onPinToggle,
  onArchiveToggle,
  onDuplicate,
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
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ATTRIBUTES Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: dynamicTheme.colors.text.tertiary, fontFamily: dynamicTheme.typography.fontFamily.semibold }]}>
            ATTRIBUTES
          </Text>

          {/* Stream - always shown first */}
          <TouchableOpacity
            style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
            onPress={onShowStreamPicker}
          >
            <View style={styles.optionIcon}>
              <Icon name="Layers" size={16} color={streamName ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary} />
            </View>
            <Text
              style={[
                styles.optionText,
                {
                  fontFamily: streamName ? dynamicTheme.typography.fontFamily.medium : dynamicTheme.typography.fontFamily.regular,
                  color: dynamicTheme.colors.text.primary,
                }
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {streamName ? `Stream: ${streamName}` : "Set Stream"}
            </Text>
          </TouchableOpacity>

          {/* Location */}
          {showLocation && (
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={onShowLocationPicker}
            >
              <View style={styles.optionIcon}>
                <Icon name="MapPin" size={16} color={hasLocationData ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary} />
              </View>
              <Text
                style={[
                  styles.optionText,
                  {
                    fontFamily: hasLocationData ? dynamicTheme.typography.fontFamily.medium : dynamicTheme.typography.fontFamily.regular,
                    color: dynamicTheme.colors.text.primary,
                  }
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
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
                <Icon name="Circle" size={16} color={status !== "none" ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary} />
              </View>
              <Text
                style={[
                  styles.optionText,
                  {
                    fontFamily: status !== "none" ? dynamicTheme.typography.fontFamily.medium : dynamicTheme.typography.fontFamily.regular,
                    color: dynamicTheme.colors.text.primary,
                  }
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
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
                <Icon name="Folder" size={16} color={type ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary} />
              </View>
              <Text
                style={[
                  styles.optionText,
                  {
                    fontFamily: type ? dynamicTheme.typography.fontFamily.medium : dynamicTheme.typography.fontFamily.regular,
                    color: dynamicTheme.colors.text.primary,
                  }
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
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
                <Icon name="CalendarClock" size={16} color={dueDate ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary} />
              </View>
              <Text
                style={[
                  styles.optionText,
                  {
                    fontFamily: dueDate ? dynamicTheme.typography.fontFamily.medium : dynamicTheme.typography.fontFamily.regular,
                    color: dynamicTheme.colors.text.primary,
                  }
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
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
                <Icon name="Star" size={16} color={rating > 0 ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary} />
              </View>
              <Text
                style={[
                  styles.optionText,
                  {
                    fontFamily: rating > 0 ? dynamicTheme.typography.fontFamily.medium : dynamicTheme.typography.fontFamily.regular,
                    color: dynamicTheme.colors.text.primary,
                  }
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
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
                <Icon name="Flag" size={16} color={priority > 0 ? dynamicTheme.colors.text.primary : dynamicTheme.colors.text.secondary} />
              </View>
              <Text
                style={[
                  styles.optionText,
                  {
                    fontFamily: priority > 0 ? dynamicTheme.typography.fontFamily.medium : dynamicTheme.typography.fontFamily.regular,
                    color: dynamicTheme.colors.text.primary,
                  }
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
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
                <Icon name="CustomCamera" size={16} color={dynamicTheme.colors.text.primary} />
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
                <Icon name="CustomGallery" size={16} color={dynamicTheme.colors.text.primary} />
              </View>
              <Text style={[styles.optionText, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.primary }]}>
                Add from Gallery
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ACTIONS Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: dynamicTheme.colors.text.tertiary, fontFamily: dynamicTheme.typography.fontFamily.semibold }]}>
            ACTIONS
          </Text>

          {/* Pin/Unpin Entry */}
          {onPinToggle && (
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={() => {
                onPinToggle();
                onClose();
              }}
            >
              <View style={styles.optionIcon}>
                <Icon name={isPinned ? "PinOff" : "Pin"} size={16} color={dynamicTheme.colors.text.primary} />
              </View>
              <Text style={[styles.optionText, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.primary }]}>
                {isPinned ? "Unpin Entry" : "Pin Entry"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Archive/Unarchive Entry */}
          {onArchiveToggle && (
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={() => {
                onArchiveToggle();
                onClose();
              }}
            >
              <View style={styles.optionIcon}>
                <Icon name={isArchived ? "ArchiveRestore" : "Archive"} size={16} color={dynamicTheme.colors.text.primary} />
              </View>
              <Text style={[styles.optionText, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.primary }]}>
                {isArchived ? "Unarchive Entry" : "Archive Entry"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Duplicate Entry */}
          {onDuplicate && isEditing && (
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={() => {
                onDuplicate();
                onClose();
              }}
            >
              <View style={styles.optionIcon}>
                <Icon name="Copy" size={16} color={dynamicTheme.colors.text.primary} />
              </View>
              <Text style={[styles.optionText, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.primary }]}>
                Duplicate Entry
              </Text>
            </TouchableOpacity>
          )}

          {/* Delete Entry */}
          {isEditing && (
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={() => {
                onDelete();
                onClose();
              }}
            >
              <View style={styles.optionIcon}>
                <Icon name="Trash2" size={16} color="#ef4444" />
              </View>
              <Text style={[styles.optionText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: "#ef4444" }]}>
                Delete Entry
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
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
    flex: 1,
  },
});
