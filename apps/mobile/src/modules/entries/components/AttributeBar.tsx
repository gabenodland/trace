/**
 * AttributeBar - Shows and allows editing of entry attributes
 * Simpler version of MetadataBar for EntryManagementScreen
 */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { Icon } from '../../../shared/components';
import { StatusIcon } from '../../../shared/components/StatusIcon';
import { themeBase } from '../../../shared/theme/themeBase';
import {
  getStatusLabel,
  formatRatingDisplay,
  getPriorityInfo,
  getLocationLabel,
  type EntryStatus,
  type RatingType,
  type PriorityCategory,
} from '@trace/core';
import type { EntryWithRelations } from '../EntryWithRelationsTypes';

interface AttributeBarProps {
  entry: EntryWithRelations;
  onStreamPress: () => void;
  onStatusPress: () => void;
  onRatingPress: () => void;
  onPriorityPress: () => void;
  onLocationPress: () => void;
  onDueDatePress: () => void;
  onPhotosPress?: () => void;
  onMorePress: () => void;
  photoCount?: number;
}

export function AttributeBar({
  entry,
  onStreamPress,
  onStatusPress,
  onRatingPress,
  onPriorityPress,
  onLocationPress,
  onDueDatePress,
  onPhotosPress = () => {},
  onMorePress,
  photoCount,
}: AttributeBarProps) {
  const theme = useTheme();

  // Stream settings determine which attributes are enabled
  // Default to true when no stream (all attributes available)
  const stream = entry.stream;
  const showStatus = stream?.entry_use_status ?? true;
  const showRating = stream?.entry_use_rating ?? true;
  const showPriority = stream?.entry_use_priority ?? true;
  const showLocation = stream?.entry_use_location ?? true;
  const showDueDate = stream?.entry_use_duedates ?? true;
  const showPhotos = stream?.entry_use_photos ?? true;
  const ratingType: RatingType = (stream?.entry_rating_type as RatingType) ?? 'stars';

  // Extract location data
  const hasLocation = !!(entry.place_name || entry.city || entry.entry_latitude);
  const locationLabel = hasLocation
    ? getLocationLabel({
        place_name: entry.place_name,
        city: entry.city,
        neighborhood: entry.neighborhood,
        region: entry.region,
        country: entry.country,
      })
    : null;

  // Priority info
  const priorityInfo = entry.priority > 0 ? getPriorityInfo(entry.priority) : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary, borderBottomColor: theme.colors.border.light }]}>
      <View style={styles.content}>
        {/* Stream - always shown */}
        <TouchableOpacity style={styles.attribute} onPress={onStreamPress}>
          <View style={styles.attributeContent}>
            <Icon name="Layers" size={12} color={stream ? theme.colors.text.primary : theme.colors.text.disabled} />
            <Text
              style={[
                styles.attributeText,
                { fontFamily: theme.typography.fontFamily.medium },
                stream ? { color: theme.colors.text.primary } : { color: theme.colors.text.disabled },
              ]}
              numberOfLines={1}
            >
              {stream?.name || 'No Stream'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Status */}
        {showStatus && (
          <>
            <Text style={[styles.divider, { color: theme.colors.text.tertiary }]}>·</Text>
            <TouchableOpacity style={styles.attribute} onPress={onStatusPress}>
              <View style={styles.attributeContent}>
                <StatusIcon status={entry.status as EntryStatus} size={12} />
                <Text
                  style={[
                    styles.attributeText,
                    { fontFamily: theme.typography.fontFamily.medium },
                    entry.status !== 'none' ? { color: theme.colors.text.primary } : { color: theme.colors.text.disabled },
                  ]}
                  numberOfLines={1}
                >
                  {entry.status !== 'none' ? getStatusLabel(entry.status as EntryStatus) : 'Set Status'}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Rating */}
        {showRating && (
          <>
            <Text style={[styles.divider, { color: theme.colors.text.tertiary }]}>·</Text>
            <TouchableOpacity style={styles.attribute} onPress={onRatingPress}>
              <View style={styles.attributeContent}>
                <Icon name="Star" size={12} color={entry.rating > 0 ? theme.colors.text.primary : theme.colors.text.disabled} />
                <Text
                  style={[
                    styles.attributeText,
                    { fontFamily: theme.typography.fontFamily.medium },
                    entry.rating > 0 ? { color: theme.colors.text.primary } : { color: theme.colors.text.disabled },
                  ]}
                  numberOfLines={1}
                >
                  {entry.rating > 0 ? formatRatingDisplay(entry.rating, ratingType) : 'Rate'}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Priority */}
        {showPriority && (
          <>
            <Text style={[styles.divider, { color: theme.colors.text.tertiary }]}>·</Text>
            <TouchableOpacity style={styles.attribute} onPress={onPriorityPress}>
              <View style={styles.attributeContent}>
                <Icon
                  name="Flag"
                  size={12}
                  color={
                    priorityInfo
                      ? theme.colors.priority[priorityInfo.category as PriorityCategory]
                      : theme.colors.text.disabled
                  }
                />
                <Text
                  style={[
                    styles.attributeText,
                    { fontFamily: theme.typography.fontFamily.medium },
                    priorityInfo
                      ? { color: theme.colors.priority[priorityInfo.category as PriorityCategory] }
                      : { color: theme.colors.text.disabled },
                  ]}
                  numberOfLines={1}
                >
                  {priorityInfo?.label || 'Priority'}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Location */}
        {showLocation && (
          <>
            <Text style={[styles.divider, { color: theme.colors.text.tertiary }]}>·</Text>
            <TouchableOpacity style={styles.attribute} onPress={onLocationPress}>
              <View style={styles.attributeContent}>
                <Icon name="MapPin" size={12} color={hasLocation ? theme.colors.text.primary : theme.colors.text.disabled} />
                <Text
                  style={[
                    styles.attributeText,
                    { fontFamily: theme.typography.fontFamily.medium },
                    hasLocation ? { color: theme.colors.text.primary } : { color: theme.colors.text.disabled },
                  ]}
                  numberOfLines={1}
                >
                  {locationLabel || 'Location'}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Due Date */}
        {showDueDate && (
          <>
            <Text style={[styles.divider, { color: theme.colors.text.tertiary }]}>·</Text>
            <TouchableOpacity style={styles.attribute} onPress={onDueDatePress}>
              <View style={styles.attributeContent}>
                <Icon name="CalendarClock" size={12} color={entry.due_date ? theme.colors.text.primary : theme.colors.text.disabled} />
                <Text
                  style={[
                    styles.attributeText,
                    { fontFamily: theme.typography.fontFamily.medium },
                    entry.due_date ? { color: theme.colors.text.primary } : { color: theme.colors.text.disabled },
                  ]}
                  numberOfLines={1}
                >
                  {entry.due_date
                    ? new Date(entry.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    : 'Due Date'}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Photos - only shown when gallery is collapsed (photoCount is defined) */}
        {showPhotos && photoCount !== undefined && (
          <>
            <Text style={[styles.divider, { color: theme.colors.text.tertiary }]}>·</Text>
            <TouchableOpacity style={styles.attribute} onPress={onPhotosPress}>
              <View style={styles.attributeContent}>
                <Icon name="Image" size={12} color={photoCount > 0 ? theme.colors.text.primary : theme.colors.text.disabled} />
                <Text
                  style={[
                    styles.attributeText,
                    { fontFamily: theme.typography.fontFamily.medium },
                    photoCount > 0 ? { color: theme.colors.text.primary } : { color: theme.colors.text.disabled },
                  ]}
                  numberOfLines={1}
                >
                  {photoCount > 0 ? `${photoCount} Photo${photoCount !== 1 ? 's' : ''}` : 'Photos'}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* More button */}
      <View style={styles.menuSection}>
        <TouchableOpacity
          style={[styles.menuButton, { backgroundColor: theme.colors.background.tertiary }]}
          onPress={onMorePress}
        >
          <Icon name="MoreVertical" size={16} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: themeBase.spacing.lg,
    paddingVertical: themeBase.spacing.sm,
    borderBottomWidth: 1,
    minHeight: 44,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 2,
  },
  attribute: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    maxWidth: 120,
  },
  attributeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  attributeText: {
    fontSize: 13,
  },
  divider: {
    fontSize: 12,
    marginHorizontal: 2,
  },
  menuSection: {
    marginLeft: themeBase.spacing.sm,
  },
  menuButton: {
    padding: 6,
    borderRadius: themeBase.borderRadius.sm,
  },
});
