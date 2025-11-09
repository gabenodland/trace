import { useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useEntries, useCategories } from "@trace/core";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { ScreenHeader } from "../components/navigation/ScreenHeader";
import { EntryList } from "../modules/entries/components/EntryList";
import { InboxCategoryDropdown } from "../components/navigation/InboxCategoryDropdown";

export function InboxScreen() {
  const { navigate } = useNavigation();
  const { categories } = useCategories();
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null | "all">(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("Inbox");

  console.log("InboxScreen - selectedCategoryName:", selectedCategoryName);

  // Determine filter based on selected category
  let categoryFilter: { category_id?: string | null } = {};

  if (selectedCategoryId === "all") {
    // Don't set category_id - will fetch all entries
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

  const handleCategorySelect = (categoryId: string | null | "all", categoryName: string) => {
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
          <InboxCategoryDropdown
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
