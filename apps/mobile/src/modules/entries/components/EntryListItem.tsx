import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { Entry } from "@trace/core";
import { getPreviewText, formatEntryDate } from "@trace/core";

interface EntryListItemProps {
  entry: Entry;
  onPress: () => void;
  onTagPress?: (tag: string) => void;
  onMentionPress?: (mention: string) => void;
}

export function EntryListItem({ entry, onPress, onTagPress, onMentionPress }: EntryListItemProps) {
  const preview = getPreviewText(entry.content, 100);
  const dateStr = formatEntryDate(entry.updated_at);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      {/* Title or Preview */}
      {entry.title ? (
        <>
          <Text style={styles.title}>{entry.title}</Text>
          <Text style={styles.preview} numberOfLines={2}>
            {preview}
          </Text>
        </>
      ) : (
        <Text style={styles.content} numberOfLines={3}>
          {preview}
        </Text>
      )}

      {/* Metadata */}
      <View style={styles.metadata}>
        <Text style={styles.date}>{dateStr}</Text>

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
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
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
});
