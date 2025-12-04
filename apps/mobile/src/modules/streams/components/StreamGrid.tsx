import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { Stream } from "@trace/core";
import { theme } from "../../../shared/theme/theme";

interface StreamGridProps {
  streams: Stream[];
  onStreamPress: (streamId: string, streamName: string) => void;
}

export function StreamGrid({ streams, onStreamPress }: StreamGridProps) {
  if (streams.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {streams.map((stream) => (
        <TouchableOpacity
          key={stream.stream_id}
          style={styles.streamCard}
          onPress={() => onStreamPress(stream.stream_id, stream.name)}
          activeOpacity={0.7}
        >
          <View style={styles.cardContent}>
            <Text style={styles.streamName}>{stream.name}</Text>
            {stream.entry_count > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{stream.entry_count}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.background.primary,
  },
  streamCard: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minWidth: 100,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  streamName: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
  },
  badge: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});
