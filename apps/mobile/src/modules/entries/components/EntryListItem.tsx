import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import type { Entry } from "@trace/core";
import { formatEntryDateTime, formatRelativeTime, isTask, formatDueDate, isTaskOverdue } from "@trace/core";
import { getFormattedContent, getDisplayModeLines } from "../helpers/entryDisplayHelpers";
import type { EntryDisplayMode } from "../types/EntryDisplayMode";
import { HtmlRenderer } from "../helpers/htmlRenderer";
import { WebViewHtmlRenderer } from "../helpers/webViewHtmlRenderer";
import { PhotoGallery } from "../../photos/components/PhotoGallery";
import { theme } from "../../../shared/theme/theme";
import { DropdownMenu, type DropdownMenuItem } from "../../../components/layout/DropdownMenu";

interface EntryListItemProps {
  entry: Entry;
  onPress: () => void;
  onTagPress?: (tag: string) => void;
  onMentionPress?: (mention: string) => void;
  onCategoryPress?: (categoryId: string | null, categoryName: string) => void;
  onToggleComplete?: (entryId: string, currentStatus: "incomplete" | "in_progress" | "complete") => void;
  onMove?: (entryId: string) => void;
  onCopy?: (entryId: string) => void;
  onDelete?: (entryId: string) => void;
  onPin?: (entryId: string, currentPinned: boolean) => void;
  onResolveConflict?: (entryId: string) => void; // Dismiss conflict banner
  categoryName?: string | null; // Category name to display
  locationName?: string | null; // Location name to display
  displayMode?: EntryDisplayMode; // Display mode for content rendering
  showMenu?: boolean; // Whether menu is shown for this entry
  onMenuToggle?: () => void; // Toggle menu visibility
}

export function EntryListItem({ entry, onPress, onTagPress, onMentionPress, onCategoryPress, onToggleComplete, onMove, onCopy, onDelete, onPin, onResolveConflict, categoryName, locationName, displayMode = 'smashed', showMenu = false, onMenuToggle }: EntryListItemProps) {
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

  const handleCheckboxPress = (e: any) => {
    e.stopPropagation();
    if (onToggleComplete && (entry.status === "incomplete" || entry.status === "in_progress" || entry.status === "complete")) {
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
        isOverdue && styles.containerOverdue
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.contentRow}>
        {/* Task Checkbox */}
        {isATask && (
          <TouchableOpacity
            style={[
              styles.checkbox,
              entry.status === "complete" && styles.checkboxComplete
            ]}
            onPress={handleCheckboxPress}
            activeOpacity={0.7}
          >
            {entry.status === "complete" && (
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M5 13l4 4L19 7" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}
          </TouchableOpacity>
        )}

        {/* Content */}
        <View style={styles.contentWrapper}>
          {/* Pin Icon - Upper Right (if pinned) */}
          {entry.is_pinned && (
            <View style={styles.pinIcon}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"
                  fill="#3b82f6"
                />
              </Svg>
            </View>
          )}

          {/* Menu Button - Upper Right */}
          <TouchableOpacity
            style={styles.menuButton}
            onPress={handleMenuPress}
            activeOpacity={0.7}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={6} r={showMenu ? 2 : 1.5} fill={showMenu ? theme.colors.text.primary : theme.colors.text.tertiary} />
              <Circle cx={12} cy={12} r={showMenu ? 2 : 1.5} fill={showMenu ? theme.colors.text.primary : theme.colors.text.tertiary} />
              <Circle cx={12} cy={18} r={showMenu ? 2 : 1.5} fill={showMenu ? theme.colors.text.primary : theme.colors.text.tertiary} />
            </Svg>
          </TouchableOpacity>

          {/* Dropdown menu modal */}
          <DropdownMenu
            visible={showMenu}
            onClose={() => onMenuToggle?.()}
            items={menuItems}
            anchorPosition={menuPosition}
          />
          {/* Conflict Warning Banner */}
          {entry.conflict_status === 'conflicted' && (
            <TouchableOpacity
              style={styles.conflictBanner}
              onPress={(e) => {
                e.stopPropagation();
                onResolveConflict?.(entry.entry_id);
              }}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M12 2L2 7l10 5 10-5-10-5z" fill="#f59e0b" />
                <Path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
              <Text style={styles.conflictText}>
                Changes merged - tap to dismiss
              </Text>
            </TouchableOpacity>
          )}

          {/* Title or Preview based on display mode */}
          {entry.title ? (
            <>
              <Text style={[
                styles.title,
                entry.status === "complete" && styles.strikethrough
              ]}>
                {entry.title}
              </Text>
              {displayMode === 'flow' && (
                <View style={styles.flowDateRow}>
                  <Text style={styles.dateSmall}>{entryDateStr}</Text>
                  {entry.status !== "none" && (
                    <View style={styles.statusBadge}>
                      <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                        <Circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke={entry.status === "complete" ? theme.colors.text.primary : theme.colors.text.tertiary}
                          strokeWidth={2}
                          fill={entry.status === "complete" ? theme.colors.text.primary : "none"}
                        />
                        {entry.status === "complete" && (
                          <Path d="M7 12l3 3 7-7" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        )}
                        {entry.status === "in_progress" && (
                          <Circle cx="12" cy="12" r="4" fill={theme.colors.text.tertiary} />
                        )}
                      </Svg>
                      <Text style={styles.statusText}>
                        {entry.status === "incomplete" ? "Not Started" :
                         entry.status === "in_progress" ? "In Progress" :
                         "Completed"}
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
                    entry.status === "complete" && styles.strikethrough
                  ]}
                  strikethrough={entry.status === "complete"}
                />
              ) : (
                <Text style={[
                  styles.preview,
                  entry.status === "complete" && styles.strikethrough
                ]} numberOfLines={maxLines}>
                  {formattedContent}
                </Text>
              )}
            </>
          ) : (
            displayMode === 'flow' ? (
              <>
                {displayMode === 'flow' && (
                  <View style={styles.flowDateRow}>
                    <Text style={styles.dateSmall}>{entryDateStr}</Text>
                    {entry.status !== "none" && (
                      <View style={styles.statusBadge}>
                        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                          <Circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke={entry.status === "complete" ? theme.colors.text.primary : theme.colors.text.tertiary}
                            strokeWidth={2}
                            fill={entry.status === "complete" ? theme.colors.text.primary : "none"}
                          />
                          {entry.status === "complete" && (
                            <Path d="M7 12l3 3 7-7" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          )}
                          {entry.status === "in_progress" && (
                            <Circle cx="12" cy="12" r="4" fill={theme.colors.text.tertiary} />
                          )}
                        </Svg>
                        <Text style={styles.statusText}>
                          {entry.status === "incomplete" ? "Not Started" :
                           entry.status === "in_progress" ? "In Progress" :
                           "Completed"}
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
                <WebViewHtmlRenderer
                  html={entry.content || ''}
                  style={[
                    styles.content,
                    entry.status === "complete" && styles.strikethrough
                  ]}
                  strikethrough={entry.status === "complete"}
                />
              </>
            ) : (
              <Text style={[
                styles.content,
                entry.status === "complete" && styles.strikethrough
              ]} numberOfLines={maxLines}>
                {formattedContent}
              </Text>
            )
          )}

          {/* Metadata */}
          <View style={styles.metadata}>
            <Text style={styles.date}>Updated {updatedDateStr}</Text>

            {/* Photo Count Badge (when collapsed) */}
            {displayMode === 'flow' && photosCollapsed && photoCount > 0 && (
              <TouchableOpacity
                style={styles.photoBadge}
                onPress={(e) => {
                  e.stopPropagation();
                  setPhotosCollapsed(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.photoBadgeText}>
                  {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Location Badge */}
            {(locationName || (entry.entry_latitude !== null && entry.entry_latitude !== undefined && entry.entry_longitude !== null && entry.entry_longitude !== undefined)) && (
              <View style={styles.locationBadge}>
                <Svg width={10} height={10} viewBox="0 0 24 24" fill={theme.colors.text.secondary} stroke="none">
                  <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </Svg>
                <Text style={styles.locationText}>{locationName || "GPS"}</Text>
              </View>
            )}

            {/* Category Badge */}
            <TouchableOpacity
              style={styles.category}
              onPress={(e) => {
                e.stopPropagation();
                if (onCategoryPress) {
                  // If entry has a category, use it; otherwise navigate to Uncategorized
                  const categoryId = entry.category_id || null;
                  // Extract just the node name (last segment of path) for title bar
                  let displayName = "Uncategorized";
                  if (categoryName) {
                    const segments = categoryName.split("/");
                    displayName = segments[segments.length - 1];
                  }
                  onCategoryPress(categoryId, displayName);
                }
              }}
              activeOpacity={0.7}
            >
              <Svg width={10} height={10} viewBox="0 0 24 24" fill={theme.colors.text.secondary} stroke="none">
                <Path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
              </Svg>
              <Text style={styles.categoryText}>{categoryName || "Uncategorized"}</Text>
            </TouchableOpacity>

            {/* Due Date Badge */}
            {dueDateStr && (
              <View style={[
                styles.dueDate,
                isOverdue && styles.dueDateOverdue,
                dueDateStr === "Today" && styles.dueDateToday
              ]}>
                <Text style={[
                  styles.dueDateText,
                  isOverdue && styles.dueDateTextOverdue,
                  dueDateStr === "Today" && styles.dueDateTextToday
                ]}>
                  {dueDateStr}
                </Text>
              </View>
            )}

            {/* Priority Badge */}
            {(entry.priority !== null && entry.priority !== undefined && entry.priority > 0) && (
              <View style={styles.priorityBadge}>
                <Svg width={10} height={10} viewBox="0 0 24 24" fill={theme.colors.text.secondary} stroke="none">
                  <Path d="M5 3v18" strokeWidth="2" stroke={theme.colors.text.secondary} />
                  <Path d="M5 3h13l-4 5 4 5H5z" />
                </Svg>
                <Text style={styles.priorityText}>{entry.priority}</Text>
              </View>
            )}

            {/* Rating Badge */}
            {(entry.rating !== null && entry.rating !== undefined && entry.rating > 0) && (
              <View style={styles.ratingBadge}>
                <Svg width={10} height={10} viewBox="0 0 24 24" fill={theme.colors.text.secondary} stroke="none">
                  <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </Svg>
                <Text style={styles.ratingText}>{entry.rating}/5</Text>
              </View>
            )}

        {/* Tags */}
        {entry.tags && entry.tags.length > 0 && (
          <View style={styles.tags}>
            {entry.tags.slice(0, 3).map((tag) => (
              <TouchableOpacity
                key={tag}
                style={styles.tag}
                onPress={(e) => {
                  e.stopPropagation();
                  onTagPress?.(tag);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.tagText}>#{tag}</Text>
              </TouchableOpacity>
            ))}
            {entry.tags.length > 3 && (
              <Text style={styles.moreText}>+{entry.tags.length - 3}</Text>
            )}
          </View>
        )}

        {/* Mentions */}
        {entry.mentions && entry.mentions.length > 0 && (
          <View style={styles.mentions}>
            {entry.mentions.slice(0, 3).map((mention) => (
              <TouchableOpacity
                key={mention}
                style={styles.mention}
                onPress={(e) => {
                  e.stopPropagation();
                  onMentionPress?.(mention);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.mentionText}>@{mention}</Text>
              </TouchableOpacity>
            ))}
            {entry.mentions.length > 3 && (
              <Text style={styles.moreText}>+{entry.mentions.length - 3}</Text>
            )}
          </View>
        )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.xs,
  },
  containerOverdue: {
    backgroundColor: theme.colors.background.secondary,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.border.dark,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxComplete: {
    backgroundColor: theme.colors.text.primary,
    borderColor: theme.colors.text.primary,
  },
  contentWrapper: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
    lineHeight: theme.typography.fontSize.xxl * theme.typography.lineHeight.tight,
  },
  dateSmall: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
  },
  flowDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
  },
  strikethrough: {
    textDecorationLine: "line-through",
    opacity: 0.5,
  },
  preview: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    lineHeight: theme.typography.fontSize.sm * theme.typography.lineHeight.relaxed,
  },
  content: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.primary,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
  },
  metadata: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    flexWrap: "wrap",
  },
  date: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
  },
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: theme.colors.background.tertiary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs - 2,
    borderRadius: theme.borderRadius.full,
  },
  locationText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  category: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: theme.colors.background.tertiary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs - 2,
    borderRadius: theme.borderRadius.full,
  },
  categoryText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  photoBadge: {
    backgroundColor: theme.colors.background.tertiary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs - 2,
    borderRadius: theme.borderRadius.full,
  },
  photoBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  tags: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  tag: {
    backgroundColor: theme.colors.background.tertiary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs - 2,
    borderRadius: theme.borderRadius.full,
  },
  tagText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  mentions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  mention: {
    backgroundColor: theme.colors.background.tertiary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs - 2,
    borderRadius: theme.borderRadius.full,
  },
  mentionText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  moreText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
  },
  location: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
  },
  dueDate: {
    backgroundColor: theme.colors.background.tertiary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs - 2,
    borderRadius: theme.borderRadius.full,
  },
  dueDateText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  dueDateOverdue: {
    backgroundColor: theme.colors.background.secondary,
  },
  dueDateTextOverdue: {
    color: theme.colors.text.secondary,
  },
  dueDateToday: {
    backgroundColor: theme.colors.background.tertiary,
  },
  dueDateTextToday: {
    color: theme.colors.text.secondary,
  },
  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: theme.colors.background.tertiary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs - 2,
    borderRadius: theme.borderRadius.full,
  },
  priorityText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: theme.colors.background.tertiary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs - 2,
    borderRadius: theme.borderRadius.full,
  },
  ratingText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  pinIcon: {
    position: "absolute",
    top: 4,
    right: 32,
    padding: 2,
    zIndex: 9,
  },
  menuButton: {
    position: "absolute",
    top: 0,
    right: 0,
    padding: 6,
    zIndex: 10,
  },
  conflictBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffbeb",
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    gap: theme.spacing.sm,
  },
  conflictText: {
    fontSize: theme.typography.fontSize.xs,
    color: "#92400e",
    fontWeight: theme.typography.fontWeight.medium,
    flex: 1,
  },
});
