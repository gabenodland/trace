/**
 * AttributesPicker - Entry options menu showing all attributes, photos, and actions
 *
 * Structure:
 * - ATTRIBUTES: All stream-enabled attributes with current values
 * - PHOTOS: Take Photo and Add from Gallery
 * - ACTIONS: Delete Entry (only when editing)
 */

import { ScrollView } from "react-native";
import { PickerBottomSheet } from "../../../../components/sheets";
import { MenuRow, MenuSection, type MenuRowProps } from "../../../../components/sheets";
import { type IconName } from "../../../../shared/components";
import { useTheme } from "../../../../shared/contexts/ThemeContext";
import {
  getStatusLabel,
  formatRatingDisplay,
  getLocationLabel,
  getPriorityInfo,
  type EntryStatus,
  type RatingType,
  type Location as LocationType,
  resolveStreamColorHex,
} from "@trace/core";

interface AttributesPickerProps {
  visible: boolean;
  onClose: () => void;
  isEditing: boolean;
  // Stream
  streamName: string | null;
  streamIcon?: string | null;
  streamColor?: string | null;
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
  onVersionHistory?: () => void;
  onDelete: () => void;
}

type RowConfig = Omit<MenuRowProps, 'showSeparator'>;

export function AttributesPicker({
  visible,
  onClose,
  isEditing,
  streamName,
  streamIcon,
  streamColor,
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
  onVersionHistory,
  onDelete,
}: AttributesPickerProps) {
  const theme = useTheme();

  const hasLocationData = !!(
    locationData?.name ||
    locationData?.city ||
    locationData?.neighborhood ||
    locationData?.region ||
    locationData?.country ||
    (locationData?.latitude && locationData?.longitude)
  );

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const unset = theme.colors.text.secondary;
  const set = theme.colors.text.primary;

  const streamIconColor = resolveStreamColorHex(streamColor, theme.colors.stream)
    || (streamName ? set : unset);

  const locationIcon: IconName = hasLocationData
    ? locationData?.location_id ? "MapPinFavoriteLine" : locationData?.name ? "MapPin" : "MapPinEmpty"
    : "MapPin";

  // Build attribute rows so separator logic can use index < length - 1
  const attributeRows: RowConfig[] = [
    {
      icon: (streamIcon ?? "Layers") as IconName,
      iconColor: streamIconColor,
      label: streamName ? `Stream: ${streamName}` : "Set Stream",
      labelColor: streamName ? set : unset,
      onPress: onShowStreamPicker,
    },
    ...(showLocation ? [{
      icon: locationIcon,
      label: hasLocationData ? `Place: ${getLocationLabel(locationData)}` : "Set Place",
      labelColor: hasLocationData ? set : unset,
      onPress: onShowLocationPicker,
    }] : []),
    ...(showStatus ? [{
      icon: "Circle" as IconName,
      label: status !== "none" ? `Status: ${getStatusLabel(status)}` : "Set Status",
      labelColor: status !== "none" ? set : unset,
      onPress: onShowStatusPicker,
    }] : []),
    ...(showType ? [{
      icon: "Bookmark" as IconName,
      label: type ? `Type: ${type}` : "Set Type",
      labelColor: type ? set : unset,
      onPress: onShowTypePicker,
    }] : []),
    ...(showDueDate ? [{
      icon: "CalendarClock" as IconName,
      label: dueDate ? `Due Date: ${formatDate(dueDate)}` : "Set Due Date",
      labelColor: dueDate ? set : unset,
      onPress: onShowDatePicker,
    }] : []),
    ...(showRating ? [{
      icon: "Star" as IconName,
      label: rating > 0 ? `Rating: ${formatRatingDisplay(rating, ratingType)}` : "Set Rating",
      labelColor: rating > 0 ? set : unset,
      onPress: onShowRatingPicker,
    }] : []),
    ...(showPriority ? [{
      icon: "Flag" as IconName,
      label: priority > 0 ? `Priority: ${getPriorityInfo(priority)?.label || `P${priority}`}` : "Set Priority",
      labelColor: priority > 0 ? set : unset,
      onPress: onShowPriorityPicker,
    }] : []),
  ];

  // Build action rows so separator logic can use index < length - 1
  const actionRows: RowConfig[] = [
    ...(onPinToggle ? [{
      icon: (isPinned ? "PinOff" : "Pin") as IconName,
      label: isPinned ? "Unpin Entry" : "Pin Entry",
      onPress: () => { onPinToggle(); onClose(); },
    }] : []),
    ...(onArchiveToggle ? [{
      icon: (isArchived ? "ArchiveRestore" : "Archive") as IconName,
      label: isArchived ? "Unarchive Entry" : "Archive Entry",
      onPress: () => { onArchiveToggle(); onClose(); },
    }] : []),
    ...(onVersionHistory && isEditing ? [{
      icon: "Clock" as IconName,
      label: "Version History",
      onPress: () => { onClose(); onVersionHistory(); },
    }] : []),
    ...(onDuplicate && isEditing ? [{
      icon: "Copy" as IconName,
      label: "Duplicate Entry",
      onPress: () => { onDuplicate(); onClose(); },
    }] : []),
    ...(isEditing ? [{
      icon: "Trash2" as IconName,
      label: "Delete Entry",
      isDanger: true as const,
      onPress: () => { onDelete(); onClose(); },
    }] : []),
  ];

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Entry Options"
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ATTRIBUTES */}
        <MenuSection title="Attributes">
          {attributeRows.map((row, i) => (
            <MenuRow key={row.label} {...row} showSeparator={i < attributeRows.length - 1} />
          ))}
        </MenuSection>

        {/* PHOTOS */}
        {showPhotos && (
          <MenuSection title="Photos">
            <MenuRow
              icon="CustomCamera"
              label="Take Photo"
              onPress={() => { onClose(); requestAnimationFrame(() => onTakePhoto()); }}
              showSeparator
            />
            <MenuRow
              icon="CustomGallery"
              label="Add from Gallery"
              onPress={() => { onClose(); requestAnimationFrame(() => onGallery()); }}
            />
          </MenuSection>
        )}

        {/* ACTIONS — only rendered when there is at least one action */}
        {actionRows.length > 0 && (
          <MenuSection title="Actions">
            {actionRows.map((row, i) => (
              <MenuRow key={row.label} {...row} showSeparator={i < actionRows.length - 1} />
            ))}
          </MenuSection>
        )}
      </ScrollView>
    </PickerBottomSheet>
  );
}
