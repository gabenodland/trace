import { useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useEntries, useCategories } from "@trace/core";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { ScreenHeader } from "../components/navigation/ScreenHeader";
import { EntryList } from "../modules/entries/components/EntryList";
import { EntryNavigator } from "../components/navigation/EntryNavigator";

export function EntryListScreen() {
  const { navigate } = useNavigation();
  const { categories } = useCategories();
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null | "all" | "tasks" | "events" | "categories" | "tags" | "ats">(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("Inbox");

  console.log("EntryListScreen - selectedCategoryName:", selectedCategoryName);

  // Determine filter based on selected category
  let categoryFilter: { category_id?: string | null } = {};

  if (selectedCategoryId === "all") {
    // "All" - fetch all entries (inbox + categorized)
    // Don't set category_id filter
  } else if (selectedCategoryId === "categories") {
    // "Categories" - show all categorized entries
    // Don't set category_id filter (will show all, but "categories" is just a nav item)
    // Actually, this should probably not be used as a filter - it's just the collapsible section
    // For now, treat it like "all"
  } else if (selectedCategoryId === "tasks" || selectedCategoryId === "events") {
    // TODO: Filter by tasks or events when those are implemented
    // For now, show all entries
  } else if (selectedCategoryId === "tags") {
    // TODO: Filter by tags when those are implemented
    // For now, show all entries (noop)
  } else if (selectedCategoryId === "ats") {
    // TODO: Filter by @s when those are implemented
    // For now, show all entries (noop)
  } else if (selectedCategoryId !== null) {
    // Specific category ID
    categoryFilter = { category_id: selectedCategoryId };
  } else {
    // Default: Inbox (uncategorized entries)
    categoryFilter = { category_id: null };
  }

  const { entries, isLoading } = useEntries(categoryFilter);

  const handleEntryPress = (entryId: string) => {
    navigate("capture", { entryId });
  };

  const handleCategorySelect = (categoryId: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "ats", categoryName: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedCategoryName(categoryName);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={selectedCategoryName}
        badge={entries.length}
        onTitlePress={() => setShowCategoryDropdown(true)}
        showDropdownArrow={true}
      />

      <EntryList
        entries={entries}
        isLoading={isLoading}
        onEntryPress={handleEntryPress}
      />

      {/* Category Picker Dropdown */}
      {showCategoryDropdown && (
        <>
          {/* Backdrop overlay */}
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setShowCategoryDropdown(false)}
          />
          <EntryNavigator
            visible={showCategoryDropdown}
            onClose={() => setShowCategoryDropdown(false)}
            onSelect={handleCategorySelect}
            selectedCategoryId={selectedCategoryId}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    zIndex: 999,
  },
});
