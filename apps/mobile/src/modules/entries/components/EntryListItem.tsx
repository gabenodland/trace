import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import type { Entry, EntryStatus, StreamAttributeVisibility, EntryDisplayMode, PriorityCategory } from "@trace/core";
import { formatEntryDateTime, formatEntryDateOnly, formatRelativeTime, isTask, formatDueDate, isTaskOverdue, isCompletedStatus, getStatusLabel, getStatusColor, formatRatingDisplay, getFormattedContent, getDisplayModeLines, getFirstLineOfText, getLocationLabel, hasLocationLabel, getPriorityInfo } from "@trace/core";
import { HtmlRenderer } from "../helpers/htmlRenderer";
import { WebViewHtmlRenderer } from "../helpers/webViewHtmlRenderer";
import { PhotoGallery } from "../../photos/components/PhotoGallery";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { themeBase } from "../../../shared/theme/themeBase";
import { DropdownMenu, type DropdownMenuItem } from "../../../components/layout/DropdownMenu";
import { StatusIcon } from "../../../shared/components/StatusIcon";

interface EntryListItemProps {
  entry: Entry;
  onPress: () => void;
  onTagPress?: (tag: string) => void;
  onMentionPress?: (mention: string) => void;
  onStreamPress?: (streamId: string | null, streamName: string) => void;
  onToggleComplete?: (entryId: string, currentStatus: EntryStatus) => void;
  onMove?: (entryId: string) => void;
  onCopy?: (entryId: string) => void;
  onDelete?: (entryId: string) => void;
  onPin?: (entryId: string, currentPinned: boolean) => void;
  onArchive?: (entryId: string, currentArchived: boolean) => void; // Archive/unarchive entry
  onSelectOnMap?: (entryId: string) => void; // Select entry on map (MapScreen only)
  streamName?: string | null; // Stream name to display
  locationName?: string | null; // Location name to display
  displayMode?: EntryDisplayMode; // Display mode for content rendering
  showMenu?: boolean; // Whether menu is shown for this entry
  onMenuToggle?: () => void; // Toggle menu visibility
  /** Attribute visibility settings from stream - if not provided, all attributes show */
  attributeVisibility?: StreamAttributeVisibility;
}

export function EntryListItem({ entry, onPress, onTagPress, onMentionPress, onStreamPress, onToggleComplete, onMove, onCopy, onDelete, onPin, onArchive, onSelectOnMap, streamName, locationName, displayMode = 'smashed', showMenu = false, onMenuToggle, attributeVisibility }: EntryListItemProps) {
  const theme = useTheme();
  const [menuPosition, setMenuPosition] = React.useState<{ x: number; y: number } | undefined>(undefined);
  const [photoCount, setPhotoCount] = React.useState(0);
  const [photosCollapsed, setPhotosCollapsed] = React.useState(false); // Start expanded

  // Format content based on display mode
  const formattedContent = getFormattedContent(entry.content, displayMode);
  const maxLines = getDisplayModeLines(displayMode);

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

  return (
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
      {/* Title Only Mode - special compact layout */}
      {displayMode === 'title' ? (
        <>
          {/* Title row with status icon inline */}
          <View style={styles.titleOnlyRow}>
            {/* Status Icon inline with title - only show if stream supports status */}
            {showStatus && isATask && (
              <TouchableOpacity
                style={styles.titleOnlyStatusIcon}
                onPress={handleCheckboxPress}
                activeOpacity={0.7}
              >
                <StatusIcon status={entry.status} size={18} />
              </TouchableOpacity>
            )}
            {/* Pin Icon inline */}
            {entry.is_pinned && (
              <View style={styles.titleOnlyPinIcon}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"
                    fill="#3b82f6"
                  />
                </Svg>
              </View>
            )}
            <Text style={[
              styles.titleOnlyText,
              { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold },
              isCompletedStatus(entry.status) && styles.strikethrough
            ]} numberOfLines={1}>
              {entry.title || getFirstLineOfText(entry.content)}
            </Text>
            {/* Map Pin Button - only shown when onSelectOnMap is provided (MapScreen) */}
            {onSelectOnMap && (
              <TouchableOpacity
                style={styles.mapPinButton}
                onPress={(e) => {
                  e.stopPropagation();
                  onSelectOnMap(entry.entry_id);
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                    stroke={theme.colors.text.tertiary}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Circle cx={12} cy={10} r={3} stroke={theme.colors.text.tertiary} strokeWidth={2} />
                </Svg>
              </TouchableOpacity>
            )}
            {/* Menu Button - fixed width reserved area */}
            <TouchableOpacity
              style={styles.menuButton}
              onPress={handleMenuPress}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={6} r={showMenu ? 2 : 1.5} fill={showMenu ? theme.colors.text.primary : theme.colors.text.tertiary} />
                <Circle cx={12} cy={12} r={showMenu ? 2 : 1.5} fill={showMenu ? theme.colors.text.primary : theme.colors.text.tertiary} />
                <Circle cx={12} cy={18} r={showMenu ? 2 : 1.5} fill={showMenu ? theme.colors.text.primary : theme.colors.text.tertiary} />
              </Svg>
            </TouchableOpacity>
          </View>
          {/* Dropdown menu modal */}
          <DropdownMenu
            visible={showMenu}
            onClose={() => onMenuToggle?.()}
            items={menuItems}
            anchorPosition={menuPosition}
          />
          {/* Metadata row for title-only mode */}
          <View style={styles.titleOnlyMetadata}>
            <Text style={[styles.date, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
              {formatEntryDateOnly(entry.entry_date || entry.updated_at)}
            </Text>
            {/* Location Badge - only show if stream supports location */}
            {showLocation && (locationName || (entry.entry_latitude !== null && entry.entry_latitude !== undefined && entry.entry_longitude !== null && entry.entry_longitude !== undefined)) && (
              <View style={[styles.locationBadge, { backgroundColor: theme.colors.background.tertiary }]}>
                {/* Pin icon for saved locations (has location_id) or named places (has place_name)
                    Crosshairs for dropped pins (only coordinates + geocoded data) */}
                {(entry.location_id || entry.place_name) ? (
                  // Pin icon for saved locations or named places
                  <Svg width={10} height={10} viewBox="0 0 24 24" fill={theme.colors.text.tertiary} stroke="none">
                    <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </Svg>
                ) : (
                  // Crosshairs icon for dropped pins (coordinates + geocoded data but no location_id/name)
                  <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2.5}>
                    <Circle cx={12} cy={12} r={10} strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx={12} cy={12} r={3} fill={theme.colors.text.tertiary} stroke="none" />
                    <Line x1={12} y1={2} x2={12} y2={6} strokeLinecap="round" />
                    <Line x1={12} y1={18} x2={12} y2={22} strokeLinecap="round" />
                    <Line x1={2} y1={12} x2={6} y2={12} strokeLinecap="round" />
                    <Line x1={18} y1={12} x2={22} y2={12} strokeLinecap="round" />
                  </Svg>
                )}
                <Text style={[styles.locationText, { color: theme.colors.text.tertiary }]}>{locationName || getLocationLabel({ name: entry.place_name, city: entry.city, neighborhood: entry.neighborhood, region: entry.region, country: entry.country })}</Text>
              </View>
            )}
            {/* Stream Badge */}
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
              <Svg width={10} height={10} viewBox="0 0 24 24" fill={theme.colors.text.secondary} stroke="none">
                <Path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
              </Svg>
              <Text style={[styles.streamText, { color: theme.colors.text.tertiary }]}>{streamName || "Unassigned"}</Text>
            </TouchableOpacity>
            {/* Type Badge - only show if stream supports type */}
            {showType && entry.type && (
              <View style={[styles.typeBadge, { backgroundColor: theme.colors.background.tertiary }]}>
                <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.secondary} strokeWidth={2}>
                  <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={[styles.typeText, { color: theme.colors.text.tertiary }]}>{entry.type}</Text>
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
            {/* Tags */}
            {entry.tags && entry.tags.length > 0 && (
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
            {/* Mentions */}
            {entry.mentions && entry.mentions.length > 0 && (
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
          </View>
        </>
      ) : (
        /* Other display modes - restructured layout */
        <>
          {/* First line row: status icon + title/first line + menu */}
          <View style={styles.firstLineRow}>
            {/* Status Icon - shows for any task (entry with status != "none") - only if stream supports status */}
            {showStatus && isATask && (
              <TouchableOpacity
                style={styles.statusIcon}
                onPress={handleCheckboxPress}
                activeOpacity={0.7}
              >
                <StatusIcon status={entry.status} size={22} />
              </TouchableOpacity>
            )}

            {/* Pin Icon inline */}
            {entry.is_pinned && (
              <View style={styles.firstLinePinIcon}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"
                    fill="#3b82f6"
                  />
                </Svg>
              </View>
            )}

            {/* Title or first line of content */}
            <Text style={[
              entry.title ? styles.title : styles.contentFirstLine,
              { color: theme.colors.text.primary, fontFamily: entry.title ? theme.typography.fontFamily.bold : theme.typography.fontFamily.semibold },
              isCompletedStatus(entry.status) && styles.strikethrough,
              styles.firstLineText
            ]} numberOfLines={entry.title ? undefined : 1}>
              {entry.title || getFirstLineOfText(entry.content)}
            </Text>

            {/* Map Pin Button - only shown when onSelectOnMap is provided (MapScreen) */}
            {onSelectOnMap && (
              <TouchableOpacity
                style={styles.mapPinButton}
                onPress={(e) => {
                  e.stopPropagation();
                  onSelectOnMap(entry.entry_id);
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                    stroke={theme.colors.text.tertiary}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Circle cx={12} cy={10} r={3} stroke={theme.colors.text.tertiary} strokeWidth={2} />
                </Svg>
              </TouchableOpacity>
            )}

            {/* Menu Button - fixed width reserved area */}
            <TouchableOpacity
              style={styles.menuButton}
              onPress={handleMenuPress}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={6} r={showMenu ? 2 : 1.5} fill={showMenu ? theme.colors.text.primary : theme.colors.text.tertiary} />
                <Circle cx={12} cy={12} r={showMenu ? 2 : 1.5} fill={showMenu ? theme.colors.text.primary : theme.colors.text.tertiary} />
                <Circle cx={12} cy={18} r={showMenu ? 2 : 1.5} fill={showMenu ? theme.colors.text.primary : theme.colors.text.tertiary} />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Dropdown menu modal */}
          <DropdownMenu
            visible={showMenu}
            onClose={() => onMenuToggle?.()}
            items={menuItems}
            anchorPosition={menuPosition}
          />

          {/* Rest of content - full width */}
          {entry.title ? (
            /* Has title - show remaining content */
            <>
              {displayMode === 'flow' && (
                <View style={styles.flowDateRow}>
                  <Text style={[styles.dateSmall, { color: theme.colors.text.tertiary }]}>{entryDateStr}</Text>
                  {entry.status !== "none" && (
                    <View style={styles.statusBadge}>
                      <StatusIcon status={entry.status} size={12} />
                      <Text style={[styles.statusText, { color: getStatusColor(entry.status) }]}>
                        {getStatusLabel(entry.status)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              {displayMode === 'flow' && (
                <PhotoGallery
                  entryId={entry.entry_id}
                  collapsible={true}
                  isCollapsed={photosCollapsed}
                  onCollapsedChange={setPhotosCollapsed}
                  onPhotoCountChange={setPhotoCount}
                />
              )}
              {displayMode === 'flow' ? (
                <WebViewHtmlRenderer
                  html={entry.content || ''}
                  style={[
                    styles.preview,
                    { color: theme.colors.text.secondary },
                    isCompletedStatus(entry.status) && styles.strikethrough
                  ]}
                  strikethrough={isCompletedStatus(entry.status)}
                />
              ) : (
                formattedContent && (
                  <Text style={[
                    styles.preview,
                    { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular },
                    isCompletedStatus(entry.status) && styles.strikethrough
                  ]} numberOfLines={maxLines}>
                    {formattedContent}
                  </Text>
                )
              )}
            </>
          ) : (
            /* No title - show content after first line */
            displayMode === 'flow' ? (
              <>
                <View style={styles.flowDateRow}>
                  <Text style={[styles.dateSmall, { color: theme.colors.text.tertiary }]}>{entryDateStr}</Text>
                  {entry.status !== "none" && (
                    <View style={styles.statusBadge}>
                      <StatusIcon status={entry.status} size={12} />
                      <Text style={[styles.statusText, { color: getStatusColor(entry.status) }]}>
                        {getStatusLabel(entry.status)}
                      </Text>
                    </View>
                  )}
                </View>
                <PhotoGallery
                  entryId={entry.entry_id}
                  collapsible={true}
                  isCollapsed={photosCollapsed}
                  onCollapsedChange={setPhotosCollapsed}
                  onPhotoCountChange={setPhotoCount}
                />
                <WebViewHtmlRenderer
                  html={entry.content || ''}
                  style={[
                    styles.content,
                    { color: theme.colors.text.primary },
                    isCompletedStatus(entry.status) && styles.strikethrough
                  ]}
                  strikethrough={isCompletedStatus(entry.status)}
                />
              </>
            ) : (
              /* Show remaining lines after first line was shown above */
              formattedContent && formattedContent.includes('\n') && (
                <Text style={[
                  styles.content,
                  { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular },
                  isCompletedStatus(entry.status) && styles.strikethrough
                ]} numberOfLines={maxLines ? maxLines - 1 : undefined}>
                  {formattedContent.substring(formattedContent.indexOf('\n') + 1)}
                </Text>
              )
            )
          )}

          {/* Metadata */}
          <View style={styles.metadata}>
              <Text style={[styles.date, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>Updated {updatedDateStr}</Text>

              {/* Photo Count Badge (when collapsed) */}
              {displayMode === 'flow' && photosCollapsed && photoCount > 0 && (
                <TouchableOpacity
                  style={[styles.photoBadge, { backgroundColor: theme.colors.background.tertiary }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setPhotosCollapsed(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.photoBadgeText, { color: theme.colors.text.tertiary }]}>
                    {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Location Badge - only show if stream supports location */}
              {showLocation && (locationName || (entry.entry_latitude !== null && entry.entry_latitude !== undefined && entry.entry_longitude !== null && entry.entry_longitude !== undefined)) && (
                <View style={[styles.locationBadge, { backgroundColor: theme.colors.background.tertiary }]}>
                  {/* Pin icon for saved locations (has location_id) or named places (has place_name)
                      Crosshairs for dropped pins (only coordinates + geocoded data) */}
                  {(entry.location_id || entry.place_name) ? (
                    // Pin icon for saved locations or named places
                    <Svg width={10} height={10} viewBox="0 0 24 24" fill={theme.colors.text.tertiary} stroke="none">
                      <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </Svg>
                  ) : (
                    // Crosshairs icon for dropped pins (coordinates + geocoded data but no location_id/name)
                    <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2.5}>
                      <Circle cx={12} cy={12} r={10} strokeLinecap="round" strokeLinejoin="round" />
                      <Circle cx={12} cy={12} r={3} fill={theme.colors.text.tertiary} stroke="none" />
                      <Line x1={12} y1={2} x2={12} y2={6} strokeLinecap="round" />
                      <Line x1={12} y1={18} x2={12} y2={22} strokeLinecap="round" />
                      <Line x1={2} y1={12} x2={6} y2={12} strokeLinecap="round" />
                      <Line x1={18} y1={12} x2={22} y2={12} strokeLinecap="round" />
                    </Svg>
                  )}
                  <Text style={[styles.locationText, { color: theme.colors.text.tertiary }]}>{locationName || getLocationLabel({ name: entry.place_name, city: entry.city, neighborhood: entry.neighborhood, region: entry.region, country: entry.country })}</Text>
                </View>
              )}

              {/* Stream Badge */}
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
                <Svg width={10} height={10} viewBox="0 0 24 24" fill={theme.colors.text.secondary} stroke="none">
                  <Path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                </Svg>
                <Text style={[styles.streamText, { color: theme.colors.text.tertiary }]}>{streamName || "Unassigned"}</Text>
              </TouchableOpacity>

              {/* Type Badge - only show if stream supports type */}
              {showType && entry.type && (
                <View style={[styles.typeBadge, { backgroundColor: theme.colors.background.tertiary }]}>
                  <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.secondary} strokeWidth={2}>
                    <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={[styles.typeText, { color: theme.colors.text.tertiary }]}>{entry.type}</Text>
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

              {/* Tags */}
              {entry.tags && entry.tags.length > 0 && (
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

              {/* Mentions */}
              {entry.mentions && entry.mentions.length > 0 && (
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
          </View>
        </>
      )}
    </TouchableOpacity>
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
  containerOverdue: {
    // Dynamic color applied inline
  },
  titleOnlyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.sm,
  },
  titleOnlyStatusIcon: {
    flexShrink: 0,
  },
  titleOnlyPinIcon: {
    flexShrink: 0,
  },
  titleOnlyMetadata: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.sm,
    marginTop: themeBase.spacing.xs,
    flexWrap: "wrap",
  },
  firstLineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.sm,
  },
  firstLinePinIcon: {
    flexShrink: 0,
  },
  firstLineText: {
    flex: 1,
  },
  menuButton: {
    flexShrink: 0,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: themeBase.spacing.xs,
  },
  mapPinButton: {
    flexShrink: 0,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: themeBase.spacing.xs,
  },
  statusIcon: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  contentFirstLine: {
    fontSize: themeBase.typography.fontSize.base,
    // Note: fontWeight removed - use fontFamily with weight variant instead
    lineHeight: themeBase.typography.fontSize.base * themeBase.typography.lineHeight.tight,
  },
  titleOnlyText: {
    flex: 1,
    fontSize: themeBase.typography.fontSize.base,
    // Note: fontWeight removed - use fontFamily with weight variant instead
    lineHeight: themeBase.typography.fontSize.base * themeBase.typography.lineHeight.tight,
  },
  title: {
    fontSize: themeBase.typography.fontSize.lg,
    // Note: fontWeight removed - use fontFamily with weight variant instead
    lineHeight: themeBase.typography.fontSize.lg * themeBase.typography.lineHeight.tight,
  },
  dateSmall: {
    fontSize: themeBase.typography.fontSize.xs,
  },
  flowDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.md,
    marginTop: themeBase.spacing.sm,
    marginBottom: themeBase.spacing.md,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusText: {
    fontSize: themeBase.typography.fontSize.xs,
  },
  strikethrough: {
    textDecorationLine: "line-through",
    opacity: 0.5,
  },
  preview: {
    fontSize: themeBase.typography.fontSize.sm,
    lineHeight: themeBase.typography.fontSize.sm * themeBase.typography.lineHeight.relaxed,
    marginTop: themeBase.spacing.sm,
  },
  content: {
    fontSize: themeBase.typography.fontSize.base,
    lineHeight: themeBase.typography.fontSize.base * themeBase.typography.lineHeight.relaxed,
    marginTop: themeBase.spacing.sm,
  },
  metadata: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.sm,
    marginTop: themeBase.spacing.lg,
    flexWrap: "wrap",
  },
  date: {
    fontSize: themeBase.typography.fontSize.xs,
  },
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
  location: {
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
  dueDateOverdue: {
    // Dynamic color applied inline
  },
  dueDateTextOverdue: {
    // Dynamic color applied inline
  },
  dueDateToday: {
    // Dynamic color applied inline
  },
  dueDateTextToday: {
    // Dynamic color applied inline
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
});
