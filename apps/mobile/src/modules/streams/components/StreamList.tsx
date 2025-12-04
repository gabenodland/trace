import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { Stream } from "@trace/core";
import Svg, { Path } from "react-native-svg";

interface StreamListProps {
  streams: Stream[];
  onStreamPress?: (streamId: string) => void;
  selectedId?: string | null;
}

export function StreamList({ streams, onStreamPress, selectedId }: StreamListProps) {
  if (streams.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No streams yet</Text>
        <Text style={styles.emptySubtext}>Create your first stream to get started</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {streams.map((stream) => (
        <StreamItem
          key={stream.stream_id}
          stream={stream}
          onPress={onStreamPress}
          isSelected={selectedId === stream.stream_id}
        />
      ))}
    </View>
  );
}

interface StreamItemProps {
  stream: Stream;
  onPress?: (streamId: string) => void;
  isSelected?: boolean;
}

function StreamItem({ stream, onPress, isSelected }: StreamItemProps) {
  const handlePress = () => {
    onPress?.(stream.stream_id);
  };

  return (
    <TouchableOpacity
      style={[
        styles.itemContainer,
        isSelected && styles.itemContainerSelected,
      ]}
      onPress={handlePress}
    >
      <View style={styles.itemContent}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={isSelected ? "#2563eb" : "#6b7280"} strokeWidth={2}>
          <Path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={[styles.itemName, isSelected && styles.itemNameSelected]}>
          {stream.name}
        </Text>
        {stream.entry_count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{stream.entry_count}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
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
    fontSize: 18,
    fontWeight: "600",
    color: "#9ca3af",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
  itemContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  itemContainerSelected: {
    backgroundColor: "#dbeafe",
  },
  itemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemName: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
    flex: 1,
  },
  itemNameSelected: {
    color: "#1e40af",
    fontWeight: "600",
  },
  badge: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
  },
});
