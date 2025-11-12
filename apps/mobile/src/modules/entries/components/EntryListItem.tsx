import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useState } from "react";
import type { Entry } from "@trace/core";
import { formatEntryDateTime, formatRelativeTime, isTask, formatDueDate, isTaskOverdue } from "@trace/core";
import { getFormattedContent, getDisplayModeLines } from "../helpers/entryDisplayHelpers";
import type { EntryDisplayMode } from "../types/EntryDisplayMode";
import { HtmlRenderer } from "../helpers/htmlRenderer";
import { theme } from "../../../shared/theme/theme";

interface EntryListItemProps {
  entry: Entry;
  onPress: () => void;
  onTagPress?: (tag: string) => void;
  onMentionPress?: (mention: string) => void;
  onCategoryPress?: (categoryId: string | null, categoryName: string) => void;
  onToggleComplete?: (entryId: string, currentStatus: "incomplete" | "complete") => void;
  onMove?: (entryId: string) => void;
  onDelete?: (entryId: string) => void;
  categoryName?: string | null; // Category name to display
  displayMode?: EntryDisplayMode; // Display mode for content rendering
}

export function EntryListItem({ entry, onPress, onTagPress, onMentionPress, onCategoryPress, onToggleComplete, onMove, onDelete, categoryName, displayMode = 'smashed' }: EntryListItemProps) {
  const [showMenu, setShowMenu] = useState(false);

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
    if (onToggleComplete && (entry.status === "incomplete" || entry.status === "complete")) {
      onToggleComplete(entry.entry_id, entry.status);
    }
  };

  const handleMenuPress = (e: any) => {
    e.stopPropagation();
    setShowMenu(true);
  };

  const handleMovePress = () => {
    setShowMenu(false);
    if (onMove) {
      onMove(entry.entry_id);
    }
  };

  const handleDeletePress = () => {
    setShowMenu(false);
    if (onDelete) {
      onDelete(entry.entry_id);
    }
  };

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
          {/* Menu Button - Upper Right */}
          <TouchableOpacity
            style={styles.menuButton}
            onPress={handleMenuPress}
            activeOpacity={0.7}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={6} r={1.5} fill={theme.colors.text.tertiary} />
              <Circle cx={12} cy={12} r={1.5} fill={theme.colors.text.tertiary} />
              <Circle cx={12} cy={18} r={1.5} fill={theme.colors.text.tertiary} />
            </Svg>
          </TouchableOpacity>
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
                <Text style={styles.dateSmall}>{entryDateStr}</Text>
              )}
              {displayMode === 'flow' ? (
                <HtmlRenderer
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
                  <Text style={styles.dateSmall}>{entryDateStr}</Text>
                )}
                <HtmlRenderer
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

            {/* Location indicator */}
            {entry.location_lat && entry.location_lng && (
              <Text style={styles.location}>GPS</Text>
            )}
          </View>
        </View>
      </View>

      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleMovePress}
              activeOpacity={0.7}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
                <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.menuItemText}>Move</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleDeletePress}
              activeOpacity={0.7}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
                <Path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.menuItemText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
    lineHeight: theme.typography.fontSize.lg * theme.typography.lineHeight.normal,
  },
  dateSmall: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    marginBottom: theme.spacing.md,
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
  category: {
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
  menuButton: {
    position: "absolute",
    top: 0,
    right: 0,
    padding: theme.spacing.xs,
    zIndex: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuContainer: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    minWidth: 180,
    ...theme.shadows.md,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  menuItemText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  menuDivider: {
    height: 1,
    backgroundColor: theme.colors.border.light,
    marginVertical: theme.spacing.xs,
  },
});
