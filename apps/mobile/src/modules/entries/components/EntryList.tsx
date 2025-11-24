import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useState } from "react";
import type { Entry } from "@trace/core";
import { EntryListItem } from "./EntryListItem";

interface Category {
  category_id: string;
  name: string;
  full_path: string;
}

interface Location {
  location_id: string;
  name: string;
}

import type { EntryDisplayMode } from '../types/EntryDisplayMode';

interface EntryListProps {
  entries: Entry[];
  isLoading: boolean;
  onEntryPress: (entryId: string) => void;
  onTagPress?: (tag: string) => void;
  onMentionPress?: (mention: string) => void;
  onCategoryPress?: (categoryId: string | null, categoryName: string) => void;
  onMove?: (entryId: string) => void;
  onDelete?: (entryId: string) => void;
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  categories?: Category[]; // Optional categories for displaying category names
  locations?: Location[]; // Optional locations for displaying location names
  displayMode?: EntryDisplayMode; // Display mode for entry items
}

export function EntryList({ entries, isLoading, onEntryPress, onTagPress, onMentionPress, onCategoryPress, onMove, onDelete, ListHeaderComponent, categories, locations, displayMode }: EntryListProps) {
  const [openMenuEntryId, setOpenMenuEntryId] = useState<string | null>(null);

  // Create a lookup map for categories (using full_path)
  const categoryMap = categories?.reduce((map, cat) => {
    map[cat.category_id] = cat.full_path;
    return map;
  }, {} as Record<string, string>);

  // Create a lookup map for locations
  const locationMap = locations?.reduce((map, loc) => {
    map[loc.location_id] = loc.name;
    return map;
  }, {} as Record<string, string>);
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
            onCategoryPress={onCategoryPress}
            onMove={onMove}
            onDelete={onDelete}
            categoryName={item.category_id && categoryMap ? categoryMap[item.category_id] : null}
            locationName={item.location_id && locationMap ? locationMap[item.location_id] : null}
            displayMode={displayMode}
            showMenu={openMenuEntryId === item.entry_id}
            onMenuToggle={() => setOpenMenuEntryId(openMenuEntryId === item.entry_id ? null : item.entry_id)}
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
          onCategoryPress={onCategoryPress}
          onMove={onMove}
          onDelete={onDelete}
          categoryName={item.category_id && categoryMap ? categoryMap[item.category_id] : null}
          locationName={item.location_id && locationMap ? locationMap[item.location_id] : null}
          displayMode={displayMode}
          showMenu={openMenuEntryId === item.entry_id}
          onMenuToggle={() => setOpenMenuEntryId(openMenuEntryId === item.entry_id ? null : item.entry_id)}
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
