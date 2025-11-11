import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import type { Entry } from "@trace/core";
import { EntryListItem } from "./EntryListItem";

interface EntryListProps {
  entries: Entry[];
  isLoading: boolean;
  onEntryPress: (entryId: string) => void;
  onTagPress?: (tag: string) => void;
  onMentionPress?: (mention: string) => void;
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
}

export function EntryList({ entries, isLoading, onEntryPress, onTagPress, onMentionPress, ListHeaderComponent }: EntryListProps) {
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // If we have a header component, always render FlatList (even with no entries)
  if (ListHeaderComponent) {
    return (
      <FlatList
        data={entries}
        keyExtractor={(item) => item.entry_id}
        renderItem={({ item }) => (
          <EntryListItem
            entry={item}
            onPress={() => onEntryPress(item.entry_id)}
            onTagPress={onTagPress}
            onMentionPress={onMentionPress}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No entries for this date</Text>
          </View>
        }
      />
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No entries yet</Text>
        <Text style={styles.emptySubtitle}>
          Capture your first thought, idea, or task!
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.entry_id}
      renderItem={({ item }) => (
        <EntryListItem
          entry={item}
          onPress={() => onEntryPress(item.entry_id)}
          onTagPress={onTagPress}
          onMentionPress={onMentionPress}
        />
      )}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={ListHeaderComponent}
    />
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyContainer: {
    alignItems: "center",
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    color: "#6b7280",
    fontWeight: "500",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
    textAlign: "center",
  },
  listContent: {
    padding: 16,
  },
});
