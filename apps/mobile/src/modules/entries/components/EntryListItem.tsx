import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import type { Entry } from "@trace/core";
import { getPreviewText, formatEntryDate, isTask, formatDueDate, isTaskOverdue } from "@trace/core";

interface EntryListItemProps {
  entry: Entry;
  onPress: () => void;
  onTagPress?: (tag: string) => void;
  onMentionPress?: (mention: string) => void;
  onToggleComplete?: (entryId: string, currentStatus: "incomplete" | "complete") => void;
}

export function EntryListItem({ entry, onPress, onTagPress, onMentionPress, onToggleComplete }: EntryListItemProps) {
  const preview = getPreviewText(entry.content, 100);
  const dateStr = formatEntryDate(entry.entry_date || entry.updated_at);
  const isATask = isTask(entry.status);
  const isOverdue = isTaskOverdue(entry.status, entry.due_date);
  const dueDateStr = formatDueDate(entry.due_date, entry.status);

  const handleCheckboxPress = (e: any) => {
    e.stopPropagation();
    if (onToggleComplete && (entry.status === "incomplete" || entry.status === "complete")) {
      onToggleComplete(entry.entry_id, entry.status);
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
          {/* Title or Preview */}
          {entry.title ? (
            <>
              <Text style={[
                styles.title,
                entry.status === "complete" && styles.strikethrough
              ]}>
                {entry.title}
              </Text>
              <Text style={[
                styles.preview,
                entry.status === "complete" && styles.strikethrough
              ]} numberOfLines={2}>
                {preview}
              </Text>
            </>
          ) : (
            <Text style={[
              styles.content,
              entry.status === "complete" && styles.strikethrough
            ]} numberOfLines={3}>
              {preview}
            </Text>
          )}

          {/* Metadata */}
          <View style={styles.metadata}>
            <Text style={styles.date}>{dateStr}</Text>

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
                  📅 {dueDateStr}
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
              <Text style={styles.location}>📍 GPS</Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  containerOverdue: {
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#9ca3af",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxComplete: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  contentWrapper: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  strikethrough: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  preview: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  content: {
    fontSize: 15,
    color: "#111827",
    lineHeight: 22,
  },
  metadata: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    flexWrap: "wrap",
  },
  date: {
    fontSize: 12,
    color: "#9ca3af",
  },
  tags: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tag: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 11,
    color: "#1d4ed8",
    fontWeight: "500",
  },
  mentions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  mention: {
    backgroundColor: "#ede9fe",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  mentionText: {
    fontSize: 11,
    color: "#7c3aed",
    fontWeight: "500",
  },
  moreText: {
    fontSize: 11,
    color: "#9ca3af",
  },
  location: {
    fontSize: 11,
    color: "#9ca3af",
  },
  dueDate: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  dueDateText: {
    fontSize: 11,
    color: "#1d4ed8",
    fontWeight: "500",
  },
  dueDateOverdue: {
    backgroundColor: "#fee2e2",
  },
  dueDateTextOverdue: {
    color: "#dc2626",
  },
  dueDateToday: {
    backgroundColor: "#ffedd5",
  },
  dueDateTextToday: {
    color: "#f97316",
  },
});
