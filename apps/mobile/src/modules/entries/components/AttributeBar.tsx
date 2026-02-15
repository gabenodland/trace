/**
 * AttributeBar - Shows and allows editing of entry attributes
 *
 * Display logic:
 * - Entry IN a stream: show all stream-enabled attributes (values + "Set X" placeholders for unset)
 * - Entry NOT in a stream: only show attributes that already have values (use ... menu to add)
 * - Unsupported attributes (value set but stream disabled): show in muted color with strikethrough
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
  isLegacyType,
  type EntryStatus,
  type RatingType,
  type PriorityCategory,
} from '@trace/core';
import { getEntryFieldVisibility, getUnsupportedFieldFlags } from './helpers/entryVisibility';
import { buildLocationFromEntry } from './helpers/entryLocationHelpers';
import type { EntryWithRelations } from '../EntryWithRelationsTypes';

const UNSUPPORTED_COLOR = '#9ca3af';
const LEGACY_TYPE_COLOR = '#f59e0b';

interface AttributeBarProps {
  entry: EntryWithRelations;
  onStreamPress: () => void;
  onStatusPress: () => void;
  onRatingPress: () => void;
  onPriorityPress: () => void;
  onLocationPress: () => void;
  onDueDatePress: () => void;
  onTypePress: () => void;
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
  onTypePress,
  onPhotosPress = () => {},
  onMorePress,
  photoCount,
}: AttributeBarProps) {
  const theme = useTheme();

  const stream = entry.stream;
  const inStream = !!stream;
  const ratingType: RatingType = (stream?.entry_rating_type as RatingType) ?? 'stars';
  const availableTypes: string[] = (stream?.entry_types as string[]) ?? [];

  // Visibility from stream config
  const visibility = getEntryFieldVisibility(stream ?? null);

  // Location data
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

  // Unsupported flags (value set but stream doesn't support the attribute)
  // Only compute when in a stream — no-stream entries can't have "unsupported" attributes
  const locationData = buildLocationFromEntry(entry);
  const unsupported = inStream
    ? getUnsupportedFieldFlags(visibility, {
        status: (entry.status as EntryStatus) ?? 'none',
        type: entry.type ?? null,
        dueDate: entry.due_date ?? null,
        rating: entry.rating ?? 0,
        priority: entry.priority ?? 0,
        locationData,
      })
    : { unsupportedStatus: false, unsupportedType: false, unsupportedDueDate: false, unsupportedRating: false, unsupportedPriority: false, unsupportedLocation: false };

  // Priority info
  const priorityInfo = entry.priority > 0 ? getPriorityInfo(entry.priority) : null;

  // Should an attribute be visible?
  // Has value (even if unsupported) OR in a stream with attribute enabled (placeholder)
  const shouldShowType =
    ((visibility.showType || unsupported.unsupportedType) && !!entry.type) ||
    (inStream && visibility.showType && !entry.type);
  const shouldShowStatus =
    ((visibility.showStatus || unsupported.unsupportedStatus) && entry.status !== 'none') ||
    (inStream && visibility.showStatus && entry.status === 'none');
  const shouldShowRating =
    ((visibility.showRating || unsupported.unsupportedRating) && entry.rating > 0) ||
    (inStream && visibility.showRating && entry.rating === 0);
  const shouldShowPriority =
    ((visibility.showPriority || unsupported.unsupportedPriority) && entry.priority > 0) ||
    (inStream && visibility.showPriority && entry.priority === 0);
  const shouldShowLocation =
    ((visibility.showLocation || unsupported.unsupportedLocation) && hasLocation) ||
    (inStream && visibility.showLocation && !hasLocation);
  const shouldShowDueDate =
    ((visibility.showDueDate || unsupported.unsupportedDueDate) && !!entry.due_date) ||
    (inStream && visibility.showDueDate && !entry.due_date);
  const shouldShowPhotos = visibility.showPhotos && (photoCount ?? 0) > 0;

  // Precompute type color (avoid calling function multiple times in JSX)
  const computedTypeColor = (() => {
    if (unsupported.unsupportedType) return UNSUPPORTED_COLOR;
    if (entry.type && isLegacyType(entry.type, availableTypes)) return LEGACY_TYPE_COLOR;
    return entry.type ? theme.colors.text.primary : theme.colors.text.disabled;
  })();

  // Photo count with safe default
  const photos = photoCount ?? 0;

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
              ellipsizeMode="tail"
            >
              {stream?.name || 'No Stream'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Type */}
        {shouldShowType && (
          <>
            <Text style={[styles.divider, { color: theme.colors.text.tertiary }]}>·</Text>
            <TouchableOpacity style={styles.attribute} onPress={onTypePress}>
              <View style={styles.attributeContent}>
                <Icon name="Folder" size={12} color={computedTypeColor} />
                <Text
                  style={[
                    styles.attributeText,
                    entry.type
                      ? { fontFamily: theme.typography.fontFamily.medium, color: computedTypeColor }
                      : { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.disabled },
                    unsupported.unsupportedType && styles.unsupportedText,
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {entry.type || 'Set Type'}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Status */}
        {shouldShowStatus && (
          <>
            <Text style={[styles.divider, { color: theme.colors.text.tertiary }]}>·</Text>
            <TouchableOpacity style={styles.attribute} onPress={onStatusPress}>
              <View style={styles.attributeContent}>
                <StatusIcon
                  status={entry.status as EntryStatus}
                  size={12}
                  color={unsupported.unsupportedStatus ? UNSUPPORTED_COLOR : undefined}
                />
                <Text
                  style={[
                    styles.attributeText,
                    entry.status !== 'none'
                      ? {
                          fontFamily: theme.typography.fontFamily.medium,
                          color: unsupported.unsupportedStatus ? UNSUPPORTED_COLOR : theme.colors.text.primary,
                        }
                      : { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.disabled },
                    unsupported.unsupportedStatus && styles.unsupportedText,
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {entry.status !== 'none' ? getStatusLabel(entry.status as EntryStatus) : 'Set Status'}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Rating */}
        {shouldShowRating && (
          <>
            <Text style={[styles.divider, { color: theme.colors.text.tertiary }]}>·</Text>
            <TouchableOpacity style={styles.attribute} onPress={onRatingPress}>
              <View style={styles.attributeContent}>
                <Icon
                  name="Star"
                  size={12}
                  color={
                    entry.rating > 0
                      ? unsupported.unsupportedRating ? UNSUPPORTED_COLOR : theme.colors.text.primary
                      : theme.colors.text.disabled
                  }
                />
                <Text
                  style={[
                    styles.attributeText,
                    entry.rating > 0
                      ? {
                          fontFamily: theme.typography.fontFamily.medium,
                          color: unsupported.unsupportedRating ? UNSUPPORTED_COLOR : theme.colors.text.primary,
                        }
                      : { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.disabled },
                    unsupported.unsupportedRating && styles.unsupportedText,
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {entry.rating > 0
                    ? formatRatingDisplay(entry.rating, ratingType)
                    : ratingType === 'stars' ? 'Rate ☆/5' : ratingType === 'decimal_whole' ? 'Rate ?/10' : 'Rate ?.?/10'}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Priority */}
        {shouldShowPriority && (
          <>
            <Text style={[styles.divider, { color: theme.colors.text.tertiary }]}>·</Text>
            <TouchableOpacity style={styles.attribute} onPress={onPriorityPress}>
              <View style={styles.attributeContent}>
                <Icon
                  name="Flag"
                  size={12}
                  color={
                    priorityInfo
                      ? unsupported.unsupportedPriority
                        ? UNSUPPORTED_COLOR
                        : theme.colors.priority[priorityInfo.category as PriorityCategory]
                      : theme.colors.text.disabled
                  }
                />
                <Text
                  style={[
                    styles.attributeText,
                    priorityInfo
                      ? {
                          fontFamily: theme.typography.fontFamily.medium,
                          color: unsupported.unsupportedPriority
                            ? UNSUPPORTED_COLOR
                            : theme.colors.priority[priorityInfo.category as PriorityCategory],
                        }
                      : { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.disabled },
                    unsupported.unsupportedPriority && styles.unsupportedText,
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {priorityInfo?.label || 'Set Priority'}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Location */}
        {shouldShowLocation && (
          <>
            <Text style={[styles.divider, { color: theme.colors.text.tertiary }]}>·</Text>
            <TouchableOpacity style={styles.attribute} onPress={onLocationPress}>
              <View style={styles.attributeContent}>
                <Icon
                  name="MapPin"
                  size={12}
                  color={
                    hasLocation
                      ? unsupported.unsupportedLocation ? UNSUPPORTED_COLOR : theme.colors.text.primary
                      : theme.colors.text.disabled
                  }
                />
                <Text
                  style={[
                    styles.attributeText,
                    hasLocation
                      ? {
                          fontFamily: theme.typography.fontFamily.medium,
                          color: unsupported.unsupportedLocation ? UNSUPPORTED_COLOR : theme.colors.text.primary,
                        }
                      : { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.disabled },
                    unsupported.unsupportedLocation && styles.unsupportedText,
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {locationLabel || 'Set Location'}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Due Date */}
        {shouldShowDueDate && (
          <>
            <Text style={[styles.divider, { color: theme.colors.text.tertiary }]}>·</Text>
            <TouchableOpacity style={styles.attribute} onPress={onDueDatePress}>
              <View style={styles.attributeContent}>
                <Icon
                  name="CalendarClock"
                  size={12}
                  color={
                    entry.due_date
                      ? unsupported.unsupportedDueDate ? UNSUPPORTED_COLOR : theme.colors.text.primary
                      : theme.colors.text.disabled
                  }
                />
                <Text
                  style={[
                    styles.attributeText,
                    entry.due_date
                      ? {
                          fontFamily: theme.typography.fontFamily.medium,
                          color: unsupported.unsupportedDueDate ? UNSUPPORTED_COLOR : theme.colors.text.primary,
                        }
                      : { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.text.disabled },
                    unsupported.unsupportedDueDate && styles.unsupportedText,
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {entry.due_date
                    ? new Date(entry.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    : 'Set Due Date'}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Photos - only shown when gallery is collapsed and has photos */}
        {shouldShowPhotos && (
          <>
            <Text style={[styles.divider, { color: theme.colors.text.tertiary }]}>·</Text>
            <TouchableOpacity style={styles.attribute} onPress={onPhotosPress}>
              <View style={styles.attributeContent}>
                <Icon name="Image" size={12} color={theme.colors.text.primary} />
                <Text
                  style={[
                    styles.attributeText,
                    { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.text.primary },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {`${photos} ${photos === 1 ? 'photo' : 'photos'}`}
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
  unsupportedText: {
    textDecorationLine: 'line-through',
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
