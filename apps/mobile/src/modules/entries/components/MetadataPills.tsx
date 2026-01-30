/**
 * MetadataPills - Horizontal scrollable pills for entry metadata
 *
 * Replaces the old MetadataBar with a modern pill-based design.
 * Pills scroll horizontally and tap to open pickers/sheets.
 */

import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { themeBase } from "../../../shared/theme/themeBase";
import { Pill } from "../../../shared/components/Pill";
import { StatusIcon } from "../../../shared/components/StatusIcon";
import {
  getStatusLabel,
  isLegacyType,
  formatRatingDisplay,
  getLocationLabel,
  getPriorityInfo,
  type Location as LocationType,
  type EntryStatus,
  type RatingType,
  type PriorityCategory,
} from "@trace/core";

interface MetadataPillsProps {
  // Form data
  streamName: string | null;
  locationData: LocationType | null;
  status: EntryStatus;
  type: string | null;
  dueDate: string | null;
  rating: number;
  priority: number;
  photoCount: number;
  // Visibility flags (feature enabled in stream)
  showLocation: boolean;
  showStatus: boolean;
  showType: boolean;
  showDueDate: boolean;
  showRating: boolean;
  showPriority: boolean;
  showPhotos: boolean;
  // Unsupported flags (feature disabled but entry has value)
  unsupportedStatus?: boolean;
  unsupportedType?: boolean;
  unsupportedDueDate?: boolean;
  unsupportedRating?: boolean;
  unsupportedPriority?: boolean;
  unsupportedLocation?: boolean;
  // Type configuration
  availableTypes: string[];
  // Rating configuration
  ratingType?: RatingType;
  // Callbacks
  onStreamPress: () => void;
  onLocationPress: () => void;
  onAttributesPress: () => void; // Opens combined attribute sheet
  onPhotosPress: () => void;
}

export const MetadataPills = React.memo(function MetadataPills({
  streamName,
  locationData,
  status,
  type,
  dueDate,
  rating,
  priority,
  photoCount,
  showLocation,
  showStatus,
  showType,
  showDueDate,
  showRating,
  showPriority,
  showPhotos,
  unsupportedStatus,
  unsupportedType,
  unsupportedDueDate,
  unsupportedRating,
  unsupportedPriority,
  unsupportedLocation,
  availableTypes,
  ratingType = "stars",
  onStreamPress,
  onLocationPress,
  onAttributesPress,
  onPhotosPress,
}: MetadataPillsProps) {
  const theme = useTheme();

  // Location display logic
  const hasGpsCoords = !!(locationData?.latitude && locationData?.longitude);
  const hasAnyLocation = !!(
    locationData?.name ||
    locationData?.city ||
    locationData?.neighborhood ||
    locationData?.region ||
    locationData?.country ||
    hasGpsCoords
  );

  const getLocationDisplayText = () => {
    if (locationData) {
      const label = getLocationLabel(locationData);
      if (label !== "Unnamed Location") return label;
    }
    if (hasGpsCoords) return "Unnamed Location";
    return "Location";
  };

  // Check if any attribute is set (for combined pill)
  const hasStatus = status !== "none";
  const hasType = !!type;
  const hasDueDate = !!dueDate;
  const hasRating = rating > 0;
  const hasPriority = priority > 0;

  // Count set attributes for the combined pill label
  const setAttributeCount = [
    hasStatus && (showStatus || unsupportedStatus),
    hasType && (showType || unsupportedType),
    hasDueDate && (showDueDate || unsupportedDueDate),
    hasRating && (showRating || unsupportedRating),
    hasPriority && (showPriority || unsupportedPriority),
  ].filter(Boolean).length;

  // Build the attribute summary label
  const getAttributeLabel = () => {
    // Show most important set attribute, or "Attributes" if none
    if (hasStatus && (showStatus || unsupportedStatus)) {
      return getStatusLabel(status);
    }
    if (hasDueDate && (showDueDate || unsupportedDueDate)) {
      return new Date(dueDate!).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    }
    if (hasPriority && (showPriority || unsupportedPriority)) {
      const info = getPriorityInfo(priority);
      return info?.label || `P${priority}`;
    }
    if (hasRating && (showRating || unsupportedRating)) {
      return formatRatingDisplay(rating, ratingType);
    }
    if (hasType && (showType || unsupportedType)) {
      return type!;
    }
    return "Attributes";
  };

  // Get icon for attribute pill based on what's set
  const getAttributeIcon = () => {
    const iconColor = setAttributeCount > 0 ? theme.colors.text.primary : theme.colors.text.disabled;
    const size = 14;

    if (hasStatus && (showStatus || unsupportedStatus)) {
      return <StatusIcon status={status} size={size} />;
    }
    if (hasDueDate && (showDueDate || unsupportedDueDate)) {
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2.5}>
          <Path d="M3 4a2 2 0 012-2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V4z" strokeLinecap="round" strokeLinejoin="round" />
          <Line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" strokeLinejoin="round" />
          <Line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" strokeLinejoin="round" />
          <Line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    }
    if (hasPriority && (showPriority || unsupportedPriority)) {
      const info = getPriorityInfo(priority);
      const priorityColor = theme.colors.priority[info?.category as PriorityCategory || "none"];
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={priorityColor} stroke="none">
          <Path d="M5 3v18" strokeWidth="2" stroke={priorityColor} />
          <Path d="M5 3h13l-4 5 4 5H5z" />
        </Svg>
      );
    }
    if (hasRating && (showRating || unsupportedRating)) {
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={iconColor} stroke="none">
          <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </Svg>
      );
    }
    // Default: sliders icon for attributes
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2}>
        <Line x1="4" y1="21" x2="4" y2="14" strokeLinecap="round" />
        <Line x1="4" y1="10" x2="4" y2="3" strokeLinecap="round" />
        <Line x1="12" y1="21" x2="12" y2="12" strokeLinecap="round" />
        <Line x1="12" y1="8" x2="12" y2="3" strokeLinecap="round" />
        <Line x1="20" y1="21" x2="20" y2="16" strokeLinecap="round" />
        <Line x1="20" y1="12" x2="20" y2="3" strokeLinecap="round" />
        <Line x1="1" y1="14" x2="7" y2="14" strokeLinecap="round" />
        <Line x1="9" y1="8" x2="15" y2="8" strokeLinecap="round" />
        <Line x1="17" y1="16" x2="23" y2="16" strokeLinecap="round" />
      </Svg>
    );
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Stream Pill - Always shown */}
      <Pill
        label={streamName || "No Stream"}
        icon={
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={streamName ? theme.colors.text.primary : theme.colors.text.disabled} strokeWidth={2.5}>
            <Path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        }
        isSet={!!streamName}
        onPress={onStreamPress}
      />

      {/* Location Pill - Show if has location OR stream supports it */}
      {(showLocation || unsupportedLocation || hasAnyLocation) && (
        <Pill
          label={getLocationDisplayText()}
          icon={
            locationData?.location_id || locationData?.name ? (
              // Pin icon for saved locations
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={unsupportedLocation ? "#9ca3af" : hasAnyLocation ? theme.colors.text.primary : theme.colors.text.disabled} strokeWidth={2.5}>
                <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={12} cy={10} r={3} fill={unsupportedLocation ? "#9ca3af" : hasAnyLocation ? theme.colors.text.primary : theme.colors.text.disabled} />
              </Svg>
            ) : hasGpsCoords ? (
              // Crosshair for dropped pins
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2.5}>
                <Circle cx={12} cy={12} r={10} strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={12} cy={12} r={3} fill={theme.colors.text.primary} stroke="none" />
                <Line x1={12} y1={2} x2={12} y2={6} strokeLinecap="round" />
                <Line x1={12} y1={18} x2={12} y2={22} strokeLinecap="round" />
                <Line x1={2} y1={12} x2={6} y2={12} strokeLinecap="round" />
                <Line x1={18} y1={12} x2={22} y2={12} strokeLinecap="round" />
              </Svg>
            ) : (
              // Default pin icon
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.disabled} strokeWidth={2.5}>
                <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={12} cy={10} r={3} fill={theme.colors.text.disabled} />
              </Svg>
            )
          }
          isSet={hasAnyLocation}
          isUnsupported={unsupportedLocation}
          onPress={onLocationPress}
        />
      )}

      {/* Combined Attributes Pill */}
      <Pill
        label={
          setAttributeCount > 1
            ? `${getAttributeLabel()} +${setAttributeCount - 1}`
            : getAttributeLabel()
        }
        icon={getAttributeIcon()}
        isSet={setAttributeCount > 0}
        onPress={onAttributesPress}
      />

      {/* Photos Pill - Only show if has photos */}
      {showPhotos && photoCount > 0 && (
        <Pill
          label={`${photoCount} ${photoCount === 1 ? "photo" : "photos"}`}
          icon={
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2.5}>
              <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={12} cy={13} r={4} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          }
          isSet={true}
          onPress={onPhotosPress}
        />
      )}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    flexGrow: 0,
    flexShrink: 0,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: themeBase.spacing.lg,
    paddingVertical: themeBase.spacing.sm,
    gap: themeBase.spacing.sm,
  },
});
