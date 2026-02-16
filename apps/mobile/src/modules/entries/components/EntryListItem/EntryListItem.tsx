/**
 * EntryListItem - Main orchestrator for entry list item rendering
 * Handles all display modes (title/flow/cards/smashed)
 */

import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import type { DropdownMenuItem } from "../../../../components/layout/DropdownMenu";
import { formatEntryDateTime, formatRelativeTime, isTask, formatDueDate, isTaskOverdue } from "@trace/core";
import { useTheme } from "../../../../shared/contexts/ThemeContext";
import { themeBase } from "../../../../shared/theme/themeBase";
import { EntryListItemDefault } from "./EntryListItemDefault";
import { PhotoViewer } from "../../../photos/components/PhotoViewer";
import { getAttachmentUri } from "../../../attachments/mobileAttachmentApi";
import type { EntryListItemProps } from "./types";

export function EntryListItem({
  entry,
  onPress,
  onTagPress,
  onMentionPress,
  onStreamPress,
  onToggleComplete,
  onMove,
  onCopy,
  onDelete,
  onPin,
  onArchive,
  onSelectOnMap,
  streamName,
  locationName,
  currentStreamId,
  displayMode = 'smashed',
  showMenu = false,
  onMenuToggle,
  attributeVisibility
}: EntryListItemProps) {
  const theme = useTheme();
  const [menuPosition, setMenuPosition] = React.useState<{ x: number; y: number } | undefined>(undefined);
  const [photoCount, setPhotoCount] = React.useState(entry.attachments?.length ?? 0);
  const [photosCollapsed, setPhotosCollapsed] = React.useState(false); // Start expanded
  const [viewerVisible, setViewerVisible] = React.useState(false);
  const [viewerPhotos, setViewerPhotos] = React.useState<{ photoId: string; uri: string | null; width?: number | null; height?: number | null; fileSize?: number | null }[]>([]);

  // Entry date (normal format) - shown below title in flow mode
  const entryDateStr = formatEntryDateTime(entry.entry_date || entry.updated_at);
  // Updated date (relative format) - shown in metadata at bottom
  const updatedDateStr = formatRelativeTime(entry.updated_at);
  const isATask = isTask(entry.status);
  const isOverdue = isTaskOverdue(entry.status, entry.due_date);
  const dueDateStr = formatDueDate(entry.due_date, entry.status);

  // Attribute visibility - default to showing all if not provided
  const showStatus = attributeVisibility?.showStatus ?? true;
  const showType = attributeVisibility?.showType ?? true;
  const showDueDate = attributeVisibility?.showDueDate ?? true;
  const showRating = attributeVisibility?.showRating ?? true;
  const showPriority = attributeVisibility?.showPriority ?? true;
  const showLocation = attributeVisibility?.showLocation ?? true;
  const ratingType = attributeVisibility?.ratingType ?? 'stars';

  // Open PhotoViewer directly for non-flow modes (no inline gallery exists)
  const isResolvingRef = React.useRef(false);
  const handleOpenPhotoViewer = async () => {
    if (isResolvingRef.current) return;
    const attachments = entry.attachments;
    if (!attachments || attachments.length === 0) return;

    isResolvingRef.current = true;
    try {
      const sorted = [...attachments].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const results = await Promise.allSettled(sorted.map(async (att) => {
        const uri = att.local_path || await getAttachmentUri(att.attachment_id);
        return {
          photoId: att.attachment_id,
          uri,
          width: att.width,
          height: att.height,
          fileSize: att.file_size,
        };
      }));

      const items = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<{ photoId: string; uri: string | null; width?: number | null; height?: number | null; fileSize?: number | null }>).value);

      // Only open if we have at least one photo with a valid URI
      const hasValidUri = items.some(item => item.uri);
      if (!hasValidUri) return;

      setViewerPhotos(items);
      setViewerVisible(true);
    } finally {
      isResolvingRef.current = false;
    }
  };

  const handleCheckboxPress = (e: any) => {
    e.stopPropagation();
    // Allow toggling for any actionable status or completed status
    if (onToggleComplete && entry.status !== "none") {
      onToggleComplete(entry.entry_id, entry.status);
    }
  };

  const handleMenuPress = (e: any) => {
    e.stopPropagation();
    // Capture the touch position
    setMenuPosition({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
    onMenuToggle?.();
  };

  const menuItems: DropdownMenuItem[] = [
    // "Select on Map" only shown when callback provided (MapScreen)
    ...(onSelectOnMap ? [{
      label: "Select on Map",
      onPress: () => onSelectOnMap(entry.entry_id),
    }] : []),
    {
      label: entry.is_pinned ? "Unpin" : "Pin",
      onPress: () => {
        if (onPin) {
          onPin(entry.entry_id, entry.is_pinned);
        }
      },
    },
    {
      label: "Move",
      onPress: () => {
        if (onMove) {
          onMove(entry.entry_id);
        }
      },
    },
    {
      label: "Copy",
      onPress: () => {
        if (onCopy) {
          onCopy(entry.entry_id);
        }
      },
    },
    ...(onArchive ? [{
      label: entry.is_archived ? "Unarchive" : "Archive",
      onPress: () => onArchive(entry.entry_id, entry.is_archived),
    }] : []),
    {
      label: "Delete",
      onPress: () => {
        if (onDelete) {
          onDelete(entry.entry_id);
        }
      },
      isDanger: true,
    },
  ];

  // Common props shared by both modes
  const commonProps = {
    entry,
    streamName,
    locationName,
    currentStreamId,
    showMenu,
    onMenuToggle,
    onSelectOnMap,
    onStreamPress,
    onTagPress,
    onMentionPress,
    onToggleComplete,
    onMove,
    onCopy,
    onDelete,
    onPin,
    onArchive,
    showStatus,
    showType,
    showDueDate,
    showRating,
    showPriority,
    showLocation,
    ratingType,
    entryDateStr,
    updatedDateStr,
    dueDateStr,
    isATask,
    isOverdue,
    menuPosition,
    menuItems,
    onMenuPress: handleMenuPress,
    onCheckboxPress: handleCheckboxPress,
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.container,
          { backgroundColor: theme.colors.background.primary },
          theme.shadows.xs,
          displayMode === 'title' && styles.containerTitleOnly,
          isOverdue && { backgroundColor: theme.colors.background.secondary }
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <EntryListItemDefault
          {...commonProps}
          displayMode={displayMode}
          photoCount={photoCount}
          photosCollapsed={photosCollapsed}
          onPhotoCountChange={setPhotoCount}
          onPhotosCollapsedChange={setPhotosCollapsed}
          onOpenPhotoViewer={handleOpenPhotoViewer}
        />
      </TouchableOpacity>
      {viewerVisible && (
        <PhotoViewer
          visible={viewerVisible}
          photos={viewerPhotos}
          initialIndex={0}
          onClose={() => {
            setViewerVisible(false);
            setViewerPhotos([]);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: themeBase.borderRadius.lg,
    padding: themeBase.spacing.xl,
    marginBottom: themeBase.spacing.lg,
  },
  containerTitleOnly: {
    padding: themeBase.spacing.md,
    marginBottom: themeBase.spacing.sm,
  },
});
