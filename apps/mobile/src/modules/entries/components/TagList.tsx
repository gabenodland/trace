import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Icon } from "../../../shared/components";

interface TagListProps {
  tags: Array<{ tag: string; count: number }>;
  onTagPress?: (tag: string) => void;
  selectedTag?: string | null;
}

export function TagList({ tags, onTagPress, selectedTag }: TagListProps) {
  if (tags.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No tags yet</Text>
        <Text style={styles.emptySubtext}>Use #hashtags in your entries to create tags</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {tags.map((item) => {
        const isSelected = selectedTag === item.tag;

        return (
          <TouchableOpacity
            key={item.tag}
            style={[
              styles.tagItem,
              isSelected && styles.tagItemSelected,
            ]}
            onPress={() => onTagPress?.(item.tag)}
          >
            <View style={styles.tagContent}>
              {/* Hash Icon */}
              <Icon name="Hash" size={20} color={isSelected ? "#111827" : "#6b7280"} />

              {/* Tag name with # prefix */}
              <Text style={[styles.tagName, isSelected && styles.tagNameSelected]}>
                #{item.tag}
              </Text>
            </View>

            {/* Entry count badge */}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.count}</Text>
            </View>

            {/* Divider */}
            <View style={styles.tagItemDivider} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#9ca3af",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
  tagItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingLeft: 20, // Indent tags inside section
  },
  tagItemSelected: {
    backgroundColor: "#f3f4f6",
  },
  tagItemDivider: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 28,
    height: 1,
    backgroundColor: "#f3f4f6",
  },
  tagContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  tagName: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
    flex: 1,
  },
  tagNameSelected: {
    color: "#111827",
    fontWeight: "600",
  },
  badge: {
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 32,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
});
