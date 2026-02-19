/**
 * EntryListItemMetadata - Shared metadata badges for entry list items
 * Used by both TitleOnly and Default display modes
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { Entry, PriorityCategory, RatingType, EntryDisplayMode } from "@trace/core";
import { formatRatingDisplay, getLocationLabel, getPriorityInfo, getStatusLabel, getStatusColor } from "@trace/core";
import type { EntryWithRelations } from "../../EntryWithRelationsTypes";
import { Icon } from "../../../../shared/components/Icon";
import { StatusIcon } from "../../../../shared/components/StatusIcon";
import { useTheme } from "../../../../shared/contexts/ThemeContext";
import { themeBase } from "../../../../shared/theme/themeBase";

interface MetadataProps {
  entry: EntryWithRelations;
  streamName?: string | null;
  locationName?: string | null;
  currentStreamId?: string | null;
  displayMode: EntryDisplayMode;
  photoCount?: number;
  photosCollapsed?: boolean;
  onPhotoPress?: () => void;
  onStreamPress?: (streamId: string | null, streamName: string) => void;
  onTagPress?: (tag: string) => void;
  onMentionPress?: (mention: string) => void;
  // Formatted data
  updatedDateStr: string;
  dueDateStr: string | null;
  isOverdue: boolean;
  // Attribute visibility
  showLocation: boolean;
  showType: boolean;
  showStatus: boolean;
  showDueDate: boolean;
  showRating: boolean;
  showPriority: boolean;
  ratingType: RatingType;
}

export function EntryListItemMetadata({
  entry,
  streamName,
  locationName,
  currentStreamId,
  displayMode,
  photoCount = 0,
  photosCollapsed = false,
  onPhotoPress,
  onStreamPress,
  onTagPress,
  onMentionPress,
  updatedDateStr,
  dueDateStr,
  isOverdue,
  showLocation,
  showType,
  showStatus,
  showDueDate,
  showRating,
  showPriority,
  ratingType,
}: MetadataProps) {
  const theme = useTheme();

  // Hide stream badge if we're already viewing within that stream
  const shouldShowStream = currentStreamId !== entry.stream_id;

  return (
    <>
      {/* Stream Badge - hide when viewing within the same stream */}
      {shouldShowStream && (
        <TouchableOpacity
          style={[styles.stream, { backgroundColor: theme.colors.background.tertiary }]}
          onPress={(e) => {
            e.stopPropagation();
            if (onStreamPress) {
              const streamId = entry.stream_id || null;
              const displayName = streamName || "Unassigned";
              onStreamPress(streamId, displayName);
            }
          }}
          activeOpacity={0.7}
        >
          <Icon name="Layers" size={10} color={theme.colors.text.secondary} />
          <Text style={[styles.streamText, { color: theme.colors.text.tertiary }]}>{streamName || "Unassigned"}</Text>
        </TouchableOpacity>
      )}

      {/* Location Badge - only show if stream supports location */}
      {showLocation && (locationName || (entry.entry_latitude !== null && entry.entry_latitude !== undefined && entry.entry_longitude !== null && entry.entry_longitude !== undefined)) && (
        <View style={[styles.locationBadge, { backgroundColor: theme.colors.background.tertiary }]}>
          <Icon name={(entry.location_id || entry.place_name) ? "MapPin" : "Compass"} size={10} color={theme.colors.text.tertiary} />
          <Text style={[styles.locationText, { color: theme.colors.text.tertiary }]}>
            {locationName || getLocationLabel({ name: entry.place_name, city: entry.city, neighborhood: entry.neighborhood, region: entry.region, country: entry.country })}
          </Text>
        </View>
      )}

      {/* Type Badge - only show if stream supports type */}
      {showType && entry.type && (
        <View style={[styles.typeBadge, { backgroundColor: theme.colors.background.tertiary }]}>
          <Icon name="Bookmark" size={10} color={theme.colors.text.secondary} />
          <Text style={[styles.typeText, { color: theme.colors.text.tertiary }]}>{entry.type}</Text>
        </View>
      )}

      {/* Status Badge - only show if stream supports status and status is not 'none' */}
      {showStatus && entry.status && entry.status !== 'none' && (
        <View style={[styles.statusBadge, { backgroundColor: theme.colors.background.tertiary }]}>
          <StatusIcon status={entry.status} size={10} />
          <Text style={[styles.statusText, { color: getStatusColor(entry.status) }]}>
            {getStatusLabel(entry.status)}
          </Text>
        </View>
      )}

      {/* Priority Badge - only show if stream supports priority */}
      {showPriority && (entry.priority !== null && entry.priority !== undefined && entry.priority > 0) && (() => {
        const priorityInfo = getPriorityInfo(entry.priority);
        const priorityColor = theme.colors.priority[priorityInfo?.category as PriorityCategory || 'none'];
        return (
          <View style={[styles.priorityBadge, { backgroundColor: priorityColor + '20' }]}>
            <Icon name="Flag" size={10} color={priorityColor} />
            <Text style={[styles.priorityText, { color: priorityColor }]}>{priorityInfo?.label || `P${entry.priority}`}</Text>
          </View>
        );
      })()}

      {/* Rating Badge - only show if stream supports rating */}
      {showRating && (entry.rating !== null && entry.rating !== undefined && entry.rating > 0) && (
        <View style={[styles.ratingBadge, { backgroundColor: theme.colors.background.tertiary }]}>
          <Icon name="Star" size={10} color={theme.colors.text.secondary} />
          <Text style={[styles.ratingText, { color: theme.colors.text.tertiary }]}>{formatRatingDisplay(entry.rating, ratingType)}</Text>
        </View>
      )}

      {/* Due Date Badge - only show if stream supports due dates */}
      {showDueDate && dueDateStr && (
        <View style={[
          styles.dueDate,
          { backgroundColor: theme.colors.background.tertiary },
          isOverdue && { backgroundColor: theme.colors.functional.overdue + '15' },
          dueDateStr === "Today" && { backgroundColor: theme.colors.background.tertiary }
        ]}>
          <Icon name="CalendarClock" size={10} color={isOverdue ? theme.colors.functional.overdue : theme.colors.text.secondary} />
          <Text style={[
            styles.dueDateText,
            { color: theme.colors.text.tertiary },
            isOverdue && { color: theme.colors.functional.overdue },
            dueDateStr === "Today" && { color: theme.colors.text.secondary }
          ]}>
            {dueDateStr}
          </Text>
        </View>
      )}

      {/* Photo Count Badge - show for modes that don't display photos inline (short/smashed/title) */}
      {(displayMode === 'smashed' || displayMode === 'title') && photoCount > 0 && (
        <TouchableOpacity
          style={[styles.photoBadge, { backgroundColor: theme.colors.background.tertiary, borderColor: theme.colors.border.medium }]}
          onPress={(e) => {
            e.stopPropagation();
            onPhotoPress?.();
          }}
          activeOpacity={0.6}
        >
          <Icon name="CustomCamera" size={12} color={theme.colors.text.secondary} />
          <Text style={[styles.photoBadgeText, { color: theme.colors.text.secondary }]}>
            {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Tags - only show in title mode */}
      {displayMode === 'title' && entry.tags && entry.tags.length > 0 && (
        <View style={styles.tags}>
          {entry.tags.slice(0, 3).map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[styles.tag, { backgroundColor: theme.colors.background.tertiary }]}
              onPress={(e) => {
                e.stopPropagation();
                onTagPress?.(tag);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.tagText, { color: theme.colors.text.tertiary }]}>#{tag}</Text>
            </TouchableOpacity>
          ))}
          {entry.tags.length > 3 && (
            <Text style={[styles.moreText, { color: theme.colors.text.tertiary }]}>+{entry.tags.length - 3}</Text>
          )}
        </View>
      )}

      {/* Mentions - only show in title mode */}
      {displayMode === 'title' && entry.mentions && entry.mentions.length > 0 && (
        <View style={styles.mentions}>
          {entry.mentions.slice(0, 3).map((mention) => (
            <TouchableOpacity
              key={mention}
              style={[styles.mention, { backgroundColor: theme.colors.background.tertiary }]}
              onPress={(e) => {
                e.stopPropagation();
                onMentionPress?.(mention);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.mentionText, { color: theme.colors.text.tertiary }]}>@{mention}</Text>
            </TouchableOpacity>
          ))}
          {entry.mentions.length > 3 && (
            <Text style={[styles.moreText, { color: theme.colors.text.tertiary }]}>+{entry.mentions.length - 3}</Text>
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: themeBase.spacing.xs - 2,
    borderRadius: themeBase.borderRadius.full,
  },
  locationText: {
    fontSize: themeBase.typography.fontSize.xs,
    fontWeight: themeBase.typography.fontWeight.medium,
  },
  stream: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: themeBase.spacing.xs - 2,
    borderRadius: themeBase.borderRadius.full,
  },
  streamText: {
    fontSize: themeBase.typography.fontSize.xs,
    fontWeight: themeBase.typography.fontWeight.medium,
  },
  photoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: themeBase.spacing.md,
    paddingVertical: themeBase.spacing.xs,
    borderRadius: themeBase.borderRadius.full,
    borderWidth: 1,
  },
  photoBadgeText: {
    fontSize: themeBase.typography.fontSize.xs,
    fontWeight: themeBase.typography.fontWeight.semibold,
  },
  tags: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.xs,
  },
  tag: {
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: themeBase.spacing.xs - 2,
    borderRadius: themeBase.borderRadius.full,
  },
  tagText: {
    fontSize: themeBase.typography.fontSize.xs,
    fontWeight: themeBase.typography.fontWeight.medium,
  },
  mentions: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.xs,
  },
  mention: {
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: themeBase.spacing.xs - 2,
    borderRadius: themeBase.borderRadius.full,
  },
  mentionText: {
    fontSize: themeBase.typography.fontSize.xs,
    fontWeight: themeBase.typography.fontWeight.medium,
  },
  moreText: {
    fontSize: themeBase.typography.fontSize.xs,
  },
  dueDate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: themeBase.spacing.xs - 2,
    borderRadius: themeBase.borderRadius.full,
  },
  dueDateText: {
    fontSize: themeBase.typography.fontSize.xs,
    fontWeight: themeBase.typography.fontWeight.medium,
  },
  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: themeBase.spacing.xs - 2,
    borderRadius: themeBase.borderRadius.full,
  },
  priorityText: {
    fontSize: themeBase.typography.fontSize.xs,
    fontWeight: themeBase.typography.fontWeight.medium,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: themeBase.spacing.xs - 2,
    borderRadius: themeBase.borderRadius.full,
  },
  ratingText: {
    fontSize: themeBase.typography.fontSize.xs,
    fontWeight: themeBase.typography.fontWeight.medium,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: themeBase.spacing.xs - 2,
    borderRadius: themeBase.borderRadius.full,
  },
  typeText: {
    fontSize: themeBase.typography.fontSize.xs,
    fontWeight: themeBase.typography.fontWeight.medium,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: themeBase.spacing.xs - 2,
    borderRadius: themeBase.borderRadius.full,
  },
  statusText: {
    fontSize: themeBase.typography.fontSize.xs,
    fontWeight: themeBase.typography.fontWeight.medium,
  },
});
