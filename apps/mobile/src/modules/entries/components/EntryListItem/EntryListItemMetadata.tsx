/**
 * EntryListItemMetadata - Shared metadata badges for entry list items
 * Used by both TitleOnly and Default display modes
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import type { Entry, PriorityCategory, RatingType, EntryDisplayMode } from "@trace/core";
import { formatRatingDisplay, getLocationLabel, getPriorityInfo, getStatusLabel, getStatusColor } from "@trace/core";
import { StatusIcon } from "../../../../shared/components/StatusIcon";
import { useTheme } from "../../../../shared/contexts/ThemeContext";
import { themeBase } from "../../../../shared/theme/themeBase";

interface MetadataProps {
  entry: Entry;
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
          <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.secondary} strokeWidth={2}>
            <Path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[styles.streamText, { color: theme.colors.text.tertiary }]}>{streamName || "Unassigned"}</Text>
        </TouchableOpacity>
      )}

      {/* Location Badge - only show if stream supports location */}
      {showLocation && (locationName || (entry.entry_latitude !== null && entry.entry_latitude !== undefined && entry.entry_longitude !== null && entry.entry_longitude !== undefined)) && (
        <View style={[styles.locationBadge, { backgroundColor: theme.colors.background.tertiary }]}>
          {(entry.location_id || entry.place_name) ? (
            <Svg width={10} height={10} viewBox="0 0 24 24" fill={theme.colors.text.tertiary} stroke="none">
              <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </Svg>
          ) : (
            <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2.5}>
              <Circle cx={12} cy={12} r={10} strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={12} cy={12} r={3} fill={theme.colors.text.tertiary} stroke="none" />
              <Line x1={12} y1={2} x2={12} y2={6} strokeLinecap="round" />
              <Line x1={12} y1={18} x2={12} y2={22} strokeLinecap="round" />
              <Line x1={2} y1={12} x2={6} y2={12} strokeLinecap="round" />
              <Line x1={18} y1={12} x2={22} y2={12} strokeLinecap="round" />
            </Svg>
          )}
          <Text style={[styles.locationText, { color: theme.colors.text.tertiary }]}>
            {locationName || getLocationLabel({ name: entry.place_name, city: entry.city, neighborhood: entry.neighborhood, region: entry.region, country: entry.country })}
          </Text>
        </View>
      )}

      {/* Type Badge - only show if stream supports type */}
      {showType && entry.type && (
        <View style={[styles.typeBadge, { backgroundColor: theme.colors.background.tertiary }]}>
          <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.secondary} strokeWidth={2}>
            <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
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
            <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
            <Text style={[styles.priorityText, { color: priorityColor }]}>{priorityInfo?.label || `P${entry.priority}`}</Text>
          </View>
        );
      })()}

      {/* Rating Badge - only show if stream supports rating */}
      {showRating && (entry.rating !== null && entry.rating !== undefined && entry.rating > 0) && (
        <View style={[styles.ratingBadge, { backgroundColor: theme.colors.background.tertiary }]}>
          <Svg width={10} height={10} viewBox="0 0 24 24" fill={theme.colors.text.secondary} stroke="none">
            <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </Svg>
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
          <Svg width={10} height={10} viewBox="0 0 24 24" fill={isOverdue ? theme.colors.functional.overdue : theme.colors.text.secondary} stroke="none">
            <Path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
          </Svg>
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
      {(displayMode === 'short' || displayMode === 'smashed' || displayMode === 'title') && photoCount > 0 && (
        <TouchableOpacity
          style={[styles.photoBadge, { backgroundColor: theme.colors.background.tertiary }]}
          onPress={(e) => {
            e.stopPropagation();
            onPhotoPress?.();
          }}
          activeOpacity={0.7}
        >
          <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
            <Path
              d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
              stroke={theme.colors.text.secondary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M12 17a4 4 0 100-8 4 4 0 000 8z"
              stroke={theme.colors.text.secondary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={[styles.photoBadgeText, { color: theme.colors.text.tertiary }]}>
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
    gap: 3,
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: themeBase.spacing.xs - 2,
    borderRadius: themeBase.borderRadius.full,
  },
  photoBadgeText: {
    fontSize: themeBase.typography.fontSize.xs,
    fontWeight: themeBase.typography.fontWeight.medium,
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
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
