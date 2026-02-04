/**
 * MetadataBar - Displays and allows editing of entry metadata
 * Extracted from EntryScreen for maintainability
 */

import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { Icon } from "../../../shared/components";
import { styles } from "./EntryScreen.styles";
import { StatusIcon } from "../../../shared/components/StatusIcon";
import { getStatusLabel, isLegacyType, formatRatingDisplay, decimalToStars, getLocationLabel, hasLocationLabel, getPriorityInfo, type Location as LocationType, type EntryStatus, type RatingType, type PriorityCategory } from "@trace/core";

interface MetadataBarProps {
  // Form data
  streamName: string | null;
  /** Location data - coordinates, name, address, and privacy radius */
  locationData: LocationType | null;
  status: EntryStatus;
  type: string | null;
  dueDate: string | null;
  rating: number;
  priority: number;
  photoCount: number;
  photosCollapsed: boolean;
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
  // Edit mode
  isEditMode: boolean;
  // Callbacks
  onStreamPress: () => void;
  onLocationPress: () => void;
  onStatusPress: () => void;
  onTypePress: () => void;
  onDueDatePress: () => void;
  onRatingPress: () => void;
  onPriorityPress: () => void;
  onPhotosPress: () => void;
  onAttributesPress: () => void;
  // Editor ref for blur
  editorRef: React.RefObject<any>;
}

export function MetadataBar({
  streamName,
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
  unsupportedStatus,
  unsupportedType,
  unsupportedDueDate,
  unsupportedRating,
  unsupportedPriority,
  unsupportedLocation,
  availableTypes,
  ratingType = 'stars',
  isEditMode,
  onStreamPress,
  onLocationPress,
  onStatusPress,
  onTypePress,
  onDueDatePress,
  onRatingPress,
  onPriorityPress,
  onPhotosPress,
  onAttributesPress,
  editorRef,
}: MetadataBarProps) {
  const theme = useTheme();

  // Unified location display logic using core helper
  const hasGpsCoords = !!(locationData?.latitude && locationData?.longitude);
  const hasAnyLocation = !!(locationData?.name || locationData?.city || locationData?.neighborhood || locationData?.region || locationData?.country || hasGpsCoords);

  // Determine what text to display for location using standardized helper
  const getLocationDisplayText = () => {
    if (locationData) {
      const label = getLocationLabel(locationData);
      // If we have actual label data, use it
      if (label !== 'Unnamed Location') return label;
    }
    // If we have GPS but no geocoded data, show "Unnamed Location"
    if (hasGpsCoords) return "Unnamed Location";
    return "Set Location";
  };

  // Determine if location is "set" (has any data)
  const locationIsSet = hasAnyLocation;

  const handlePress = (callback: () => void) => {
    editorRef.current?.blur();
    // Note: We don't dismiss keyboard - pickers appear over it
    setTimeout(() => {
      callback();
    }, 100);
  };

  return (
    <View style={[styles.metadataBar, { backgroundColor: theme.colors.background.secondary, borderBottomColor: theme.colors.border.light }]}>
      {/* Metadata content - wraps attributes */}
      <View style={styles.metadataContent}>
        {/* Stream - always shown */}
        <TouchableOpacity
          style={styles.metadataLink}
          onPress={() => handlePress(onStreamPress)}
        >
          <View style={styles.metadataLinkContent}>
            <Icon name="Layers" size={12} color={theme.colors.text.primary} />
            <Text style={[styles.metadataText, styles.metadataTextActive, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]} numberOfLines={1} ellipsizeMode="tail">
              {streamName || "No Stream"}
            </Text>
          </View>
        </TouchableOpacity>

      {/* Type - show if supported OR unsupported with value */}
      {(showType || unsupportedType) && type && (
        <>
          <Text style={[styles.metadataDivider, { color: theme.colors.text.tertiary }]}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={onTypePress}
          >
            <View style={styles.metadataLinkContent}>
              {/* Type Icon */}
              <Icon name="Folder" size={12} color={unsupportedType ? "#9ca3af" : isLegacyType(type, availableTypes) ? "#f59e0b" : theme.colors.text.secondary} />
              <Text style={[
                styles.metadataText,
                styles.metadataTextActive,
                { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium },
                unsupportedType && styles.metadataTextUnsupported,
                !unsupportedType && isLegacyType(type, availableTypes) && { color: "#f59e0b" }
              ]} numberOfLines={1} ellipsizeMode="tail">
                {type}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Type placeholder - show if stream assigned AND supported but not set */}
      {streamName && showType && !unsupportedType && !type && (
        <>
          <Text style={[styles.metadataDivider, { color: theme.colors.text.tertiary }]}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={onTypePress}
          >
            <View style={styles.metadataLinkContent}>
              <Icon name="Folder" size={12} color={theme.colors.text.disabled} />
              <Text style={[styles.metadataText, { color: theme.colors.text.disabled, fontFamily: theme.typography.fontFamily.regular }]} numberOfLines={1} ellipsizeMode="tail">
                Set Type
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Unified Location Display - shows location label based on available data */}
      {/* Show if: has any location data, OR stream supports location (placeholder) */}
      {((showLocation || unsupportedLocation) && locationIsSet) && (
        <>
          <Text style={[styles.metadataDivider, { color: theme.colors.text.tertiary }]}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={() => handlePress(onLocationPress)}
          >
            <View style={styles.metadataLinkContent}>
              {/* Icon varies by location type:
                  - Pin icon: Saved location (has location_id) or named place (has name)
                  - Crosshairs: Dropped pin with only geocoded data or coordinates */}
              {(locationData?.location_id || locationData?.name) ? (
                // Pin icon for saved locations or named places
                <Icon name="MapPin" size={12} color={unsupportedLocation ? "#9ca3af" : theme.colors.text.primary} />
              ) : (
                // Crosshair icon for dropped pins (coordinates + geocoded data but no location_id/name)
                <Icon name="MapPin" size={12} color={theme.colors.text.primary} />
              )}
              <Text style={[
                styles.metadataText,
                styles.metadataTextActive,
                { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium },
                unsupportedLocation && styles.metadataTextUnsupported
              ]} numberOfLines={1} ellipsizeMode="tail">
                {getLocationDisplayText()}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Location placeholder - show if stream assigned AND supported but not set */}
      {streamName && showLocation && !unsupportedLocation && !locationIsSet && (
        <>
          <Text style={[styles.metadataDivider, { color: theme.colors.text.tertiary }]}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={() => handlePress(onLocationPress)}
          >
            <View style={styles.metadataLinkContent}>
              <Icon name="MapPin" size={12} color={theme.colors.text.disabled} />
              <Text style={[styles.metadataText, { color: theme.colors.text.disabled, fontFamily: theme.typography.fontFamily.regular }]} numberOfLines={1} ellipsizeMode="tail">
                Set Location
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Status - show if supported OR unsupported with value */}
      {(showStatus || unsupportedStatus) && status !== "none" && (
        <>
          <Text style={[styles.metadataDivider, { color: theme.colors.text.tertiary }]}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={onStatusPress}
          >
            <View style={styles.metadataLinkContent}>
              <StatusIcon status={status} size={12} color={unsupportedStatus ? "#9ca3af" : undefined} />
              <Text style={[
                styles.metadataText,
                styles.metadataTextActive,
                { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium },
                unsupportedStatus && styles.metadataTextUnsupported
              ]} numberOfLines={1} ellipsizeMode="tail">
                {getStatusLabel(status)}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Status placeholder - show if stream assigned AND supported but not set */}
      {streamName && showStatus && !unsupportedStatus && status === "none" && (
        <>
          <Text style={[styles.metadataDivider, { color: theme.colors.text.tertiary }]}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={onStatusPress}
          >
            <View style={styles.metadataLinkContent}>
              <StatusIcon status="none" size={12} color={theme.colors.text.disabled} />
              <Text style={[styles.metadataText, { color: theme.colors.text.disabled, fontFamily: theme.typography.fontFamily.regular }]} numberOfLines={1} ellipsizeMode="tail">
                Set Status
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Due Date - show if supported OR unsupported with value */}
      {(showDueDate || unsupportedDueDate) && dueDate && (
        <>
          <Text style={[styles.metadataDivider, { color: theme.colors.text.tertiary }]}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={() => handlePress(onDueDatePress)}
          >
            <View style={styles.metadataLinkContent}>
              <Icon name="CalendarClock" size={12} color={unsupportedDueDate ? "#9ca3af" : theme.colors.text.primary} />
              <Text style={[
                styles.metadataText,
                styles.metadataTextActive,
                { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium },
                unsupportedDueDate && styles.metadataTextUnsupported
              ]} numberOfLines={1} ellipsizeMode="tail">
                {new Date(dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Due Date placeholder - show if stream assigned AND supported but not set */}
      {streamName && showDueDate && !unsupportedDueDate && !dueDate && (
        <>
          <Text style={[styles.metadataDivider, { color: theme.colors.text.tertiary }]}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={() => handlePress(onDueDatePress)}
          >
            <View style={styles.metadataLinkContent}>
              <Icon name="CalendarClock" size={12} color={theme.colors.text.disabled} />
              <Text style={[styles.metadataText, { color: theme.colors.text.disabled, fontFamily: theme.typography.fontFamily.regular }]} numberOfLines={1} ellipsizeMode="tail">
                Set Due Date
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Rating - show if supported OR unsupported with value */}
      {(showRating || unsupportedRating) && rating > 0 && (
        <>
          <Text style={[styles.metadataDivider, { color: theme.colors.text.tertiary }]}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={() => handlePress(onRatingPress)}
          >
            <View style={styles.metadataLinkContent}>
              <Icon name="Star" size={12} color={unsupportedRating ? "#9ca3af" : theme.colors.text.primary} />
              <Text style={[
                styles.metadataText,
                styles.metadataTextActive,
                { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium },
                unsupportedRating && styles.metadataTextUnsupported
              ]} numberOfLines={1} ellipsizeMode="tail">
                {formatRatingDisplay(rating, ratingType)}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Rating placeholder - show if stream assigned AND supported but not set */}
      {streamName && showRating && !unsupportedRating && rating === 0 && (
        <>
          <Text style={[styles.metadataDivider, { color: theme.colors.text.tertiary }]}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={() => handlePress(onRatingPress)}
          >
            <View style={styles.metadataLinkContent}>
              <Icon name="Star" size={12} color={theme.colors.text.disabled} />
              <Text style={[styles.metadataText, { color: theme.colors.text.disabled, fontFamily: theme.typography.fontFamily.regular }]} numberOfLines={1} ellipsizeMode="tail">
                {ratingType === 'stars' ? 'Rate ☆/5' : ratingType === 'decimal_whole' ? 'Rate ?/10' : 'Rate ?.?/10'}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Priority - show if supported OR unsupported with value */}
      {(showPriority || unsupportedPriority) && priority > 0 && (() => {
        const priorityInfo = getPriorityInfo(priority);
        const priorityColor = unsupportedPriority
          ? "#9ca3af"
          : theme.colors.priority[priorityInfo?.category as PriorityCategory || 'none'];
        return (
          <>
            <Text style={[styles.metadataDivider, { color: theme.colors.text.tertiary }]}>·</Text>
            <TouchableOpacity
              style={styles.metadataLink}
              onPress={() => handlePress(onPriorityPress)}
            >
              <View style={styles.metadataLinkContent}>
                <Icon name="Flag" size={12} color={priorityColor} />
                <Text style={[
                  styles.metadataText,
                  styles.metadataTextActive,
                  { color: priorityColor, fontFamily: theme.typography.fontFamily.medium },
                  unsupportedPriority && styles.metadataTextUnsupported
                ]} numberOfLines={1} ellipsizeMode="tail">
                  {priorityInfo?.label || `P${priority}`}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        );
      })()}

      {/* Priority placeholder - show if stream assigned AND supported but not set */}
      {streamName && showPriority && !unsupportedPriority && priority === 0 && (
        <>
          <Text style={[styles.metadataDivider, { color: theme.colors.text.tertiary }]}>·</Text>
          <TouchableOpacity
            style={styles.metadataLink}
            onPress={() => handlePress(onPriorityPress)}
          >
            <View style={styles.metadataLinkContent}>
              <Icon name="Flag" size={12} color={theme.colors.text.disabled} />
              <Text style={[styles.metadataText, { color: theme.colors.text.disabled, fontFamily: theme.typography.fontFamily.regular }]} numberOfLines={1} ellipsizeMode="tail">
                Set Priority
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

        {/* Photos - only if has photos and collapsed */}
        {showPhotos && photoCount > 0 && photosCollapsed && (
          <>
            <Text style={[styles.metadataDivider, { color: theme.colors.text.tertiary }]}>·</Text>
            <TouchableOpacity
              style={styles.metadataLink}
              onPress={onPhotosPress}
            >
              <View style={styles.metadataLinkContent}>
                <Icon name="CustomCamera" size={12} color={theme.colors.text.primary} />
                <Text style={[styles.metadataText, styles.metadataTextActive, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]} numberOfLines={1} ellipsizeMode="tail">
                  {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Separator */}
      <View style={[styles.metadataSeparator, { backgroundColor: theme.colors.border.medium }]} />

      {/* Menu section - dedicated area for entry options */}
      <View style={styles.metadataMenuSection}>
        <TouchableOpacity
          style={[styles.entryMenuButton, { backgroundColor: theme.colors.background.tertiary }]}
          onPress={() => handlePress(onAttributesPress)}
        >
          <Icon name="MoreVertical" size={16} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
