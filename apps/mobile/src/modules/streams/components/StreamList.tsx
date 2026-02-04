import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { Stream } from "@trace/core";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { Icon } from "../../../shared/components";

interface StreamListProps {
  streams: Stream[];
  onStreamPress?: (streamId: string) => void;
  selectedId?: string | null;
}

export function StreamList({ streams, onStreamPress, selectedId }: StreamListProps) {
  const dynamicTheme = useTheme();

  if (streams.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.tertiary }]}>No streams yet</Text>
        <Text style={[styles.emptySubtext, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.tertiary }]}>Create your first stream to get started</Text>
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
  const dynamicTheme = useTheme();

  const handlePress = () => {
    onPress?.(stream.stream_id);
  };

  return (
    <TouchableOpacity
      style={[
        styles.itemContainer,
        { borderBottomColor: dynamicTheme.colors.border.light },
        isSelected && [styles.itemContainerSelected, { backgroundColor: `${dynamicTheme.colors.functional.accent}20` }],
      ]}
      onPress={handlePress}
    >
      <View style={styles.itemContent}>
        <Icon name="Layers" size={20} color={isSelected ? dynamicTheme.colors.functional.accent : dynamicTheme.colors.text.secondary} />
        <Text style={[
          styles.itemName,
          { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary },
          isSelected && { color: dynamicTheme.colors.functional.accent, fontFamily: dynamicTheme.typography.fontFamily.semibold }
        ]}>
          {stream.name}
        </Text>
        {stream.entry_count > 0 && (
          <View style={[styles.badge, { backgroundColor: dynamicTheme.colors.background.tertiary }]}>
            <Text style={[styles.badgeText, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.secondary }]}>{stream.entry_count}</Text>
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
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  itemContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    // borderBottomColor applied inline
  },
  itemContainerSelected: {
    // backgroundColor applied inline
  },
  itemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemName: {
    fontSize: 16,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    // backgroundColor applied inline
  },
  badgeText: {
    fontSize: 12,
  },
});
