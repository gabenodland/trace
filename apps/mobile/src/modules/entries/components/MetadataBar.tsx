/**
 * MetadataBar - Displays and allows editing of entry metadata
 * Extracted from CaptureForm for maintainability
 */

import { View, Text, TouchableOpacity, Keyboard } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { theme } from "../../../shared/theme/theme";
import { styles } from "./CaptureForm.styles";
import { StatusIcon } from "../../../shared/components/StatusIcon";
import { getStatusLabel, isLegacyType, type Location as LocationType, type EntryStatus } from "@trace/core";
import type { GpsData } from "./hooks/useCaptureFormState";

interface MetadataBarProps {
  // Form data
  streamName: string | null;
  /** GPS coordinates - where entry was created */
  gpsData: GpsData | null;
  /** Named location - where entry "lives" */
  locationData: LocationType | null;
  status: EntryStatus;
  type: string | null;
  dueDate: string | null;
  rating: number;
  priority: number;
  photoCount: number;
  photosCollapsed: boolean;
  // Visibility flags
  showLocation: boolean;
  showStatus: boolean;
  showType: boolean;
  showDueDate: boolean;
  showRating: boolean;
  showPriority: boolean;
  showPhotos: boolean;
  // Type configuration
  availableTypes: string[];
  // Edit mode
  isEditMode: boolean;
  enterEditMode: () => void;
  // Callbacks
  onStreamPress: () => void;
  onGpsPress: () => void;
  onLocationPress: () => void;
  onStatusPress: () => void;
  onTypePress: () => void;
  onDueDatePress: () => void;
  onRatingPress: () => void;
  onPriorityPress: () => void;
  onPhotosPress: () => void;
  onMenuPress: () => void;
  // Editor ref for blur
  editorRef: React.RefObject<any>;
}

export function MetadataBar({
  streamName,
  gpsData,
  locationData,
  status,
  type,
  dueDate,
  rating,
  priority,
  photoCount,
  photosCollapsed,
  showLocation,
  showStatus,
  showType,
  showDueDate,
  showRating,
  showPriority,
  showPhotos,
  availableTypes,
  isEditMode,
  enterEditMode,
  onStreamPress,
  onGpsPress,
  onLocationPress,
  onStatusPress,
  onTypePress,
  onDueDatePress,
  onRatingPress,
  onPriorityPress,
  onPhotosPress,
  onMenuPress,
  editorRef,
}: MetadataBarProps) {
  const handlePress = (callback: () => void, needsEditMode = false) => {
    editorRef.current?.blur();
    Keyboard.dismiss();
    setTimeout(() => {
      callback();
      if (needsEditMode && !isEditMode) enterEditMode();
    }, 100);
  };

  return (
    <View style={styles.metadataBar}>
      {/* Stream - always shown */}
      <TouchableOpacity
        style={styles.metadataLink}
        onPress={() => handlePress(onStreamPress)}
      >
        <View style={styles.metadataLinkContent}>
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2.5}>
            <Path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[styles.metadataText, styles.metadataTextActive]} numberOfLines={1} ellipsizeMode="tail">
            {streamName || "No Stream"}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Type - only if set */}
      {showType && type && (
        <>
          <Text style={styles.metadataDivider}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={onTypePress}
          >
            <View style={styles.metadataLinkContent}>
              {/* Bookmark Icon */}
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={isLegacyType(type, availableTypes) ? "#f59e0b" : "#6b7280"} strokeWidth={2.5}>
                <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[
                styles.metadataText,
                styles.metadataTextActive,
                isLegacyType(type, availableTypes) && { color: "#f59e0b" }
              ]} numberOfLines={1} ellipsizeMode="tail">
                {type}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* GPS - only if coordinates are set */}
      {gpsData && (
        <>
          <Text style={styles.metadataDivider}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={() => handlePress(onGpsPress)}
          >
            <View style={styles.metadataLinkContent}>
              {/* GPS Crosshair Icon */}
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2.5}>
                <Circle cx={12} cy={12} r={10} strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={12} cy={12} r={3} fill={theme.colors.text.primary} stroke="none" />
                <Line x1={12} y1={2} x2={12} y2={6} strokeLinecap="round" />
                <Line x1={12} y1={18} x2={12} y2={22} strokeLinecap="round" />
                <Line x1={2} y1={12} x2={6} y2={12} strokeLinecap="round" />
                <Line x1={18} y1={12} x2={22} y2={12} strokeLinecap="round" />
              </Svg>
              <Text style={[styles.metadataText, styles.metadataTextActive]} numberOfLines={1} ellipsizeMode="tail">
                GPS
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Location (named place) - only if set */}
      {showLocation && locationData && locationData.name && (
        <>
          <Text style={styles.metadataDivider}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={() => handlePress(onLocationPress)}
          >
            <View style={styles.metadataLinkContent}>
              {/* Location Pin Icon */}
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2.5}>
                <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={12} cy={10} r={3} fill={theme.colors.text.primary} />
              </Svg>
              <Text style={[styles.metadataText, styles.metadataTextActive]} numberOfLines={1} ellipsizeMode="tail">
                {locationData.name}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Status - only if set (not "none") */}
      {showStatus && status !== "none" && (
        <>
          <Text style={styles.metadataDivider}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={onStatusPress}
          >
            <View style={styles.metadataLinkContent}>
              <StatusIcon status={status} size={12} />
              <Text style={[styles.metadataText, styles.metadataTextActive]} numberOfLines={1} ellipsizeMode="tail">
                {getStatusLabel(status)}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Due Date - only if set */}
      {showDueDate && dueDate && (
        <>
          <Text style={styles.metadataDivider}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={() => handlePress(onDueDatePress, true)}
          >
            <View style={styles.metadataLinkContent}>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2.5}>
                <Path d="M3 4a2 2 0 012-2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V4z" strokeLinecap="round" strokeLinejoin="round" />
                <Line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" strokeLinejoin="round" />
                <Line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" strokeLinejoin="round" />
                <Line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[styles.metadataText, styles.metadataTextActive]} numberOfLines={1} ellipsizeMode="tail">
                {new Date(dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Rating - only if set */}
      {showRating && rating > 0 && (
        <>
          <Text style={styles.metadataDivider}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={() => handlePress(onRatingPress, true)}
          >
            <View style={styles.metadataLinkContent}>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill={theme.colors.text.primary} stroke="none">
                <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </Svg>
              <Text style={[styles.metadataText, styles.metadataTextActive]} numberOfLines={1} ellipsizeMode="tail">
                {rating}/5
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Priority - only if set */}
      {showPriority && priority > 0 && (
        <>
          <Text style={styles.metadataDivider}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={() => handlePress(onPriorityPress, true)}
          >
            <View style={styles.metadataLinkContent}>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill={theme.colors.text.primary} stroke="none">
                <Path d="M5 3v18" strokeWidth="2" stroke={theme.colors.text.primary} />
                <Path d="M5 3h13l-4 5 4 5H5z" />
              </Svg>
              <Text style={[styles.metadataText, styles.metadataTextActive]} numberOfLines={1} ellipsizeMode="tail">
                P{priority}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Photos - only if has photos and collapsed */}
      {showPhotos && photoCount > 0 && photosCollapsed && (
        <>
          <Text style={styles.metadataDivider}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={onPhotosPress}
          >
            <View style={styles.metadataLinkContent}>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2.5}>
                <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={12} cy={13} r={4} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[styles.metadataText, styles.metadataTextActive]} numberOfLines={1} ellipsizeMode="tail">
                {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Entry Menu Button (...) */}
      <TouchableOpacity
        style={styles.entryMenuButton}
        onPress={() => handlePress(onMenuPress)}
      >
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="#6b7280" stroke="none">
          <Circle cx={12} cy={5} r={2} />
          <Circle cx={12} cy={12} r={2} />
          <Circle cx={12} cy={19} r={2} />
        </Svg>
      </TouchableOpacity>
    </View>
  );
}
