import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useEntries, useCategories, useAuthState } from "@trace/core";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { TopBar } from "../components/layout/TopBar";
import { TopBarDropdownContainer } from "../components/layout/TopBarDropdownContainer";
import { EntryList } from "../modules/entries/components/EntryList";
import { EntryNavigator } from "../components/navigation/EntryNavigator";
import Svg, { Path } from "react-native-svg";

export function EntryListScreen() {
  const { navigate } = useNavigation();
  const { categories } = useCategories();
  const { user, signOut } = useAuthState();
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null | "all" | "tasks" | "events" | "categories" | "tags" | "ats">(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("Inbox");

  const menuItems = [
    {
      label: "Inbox",
      onPress: () => navigate("inbox"),
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
          <Path d="M22 12h-6l-2 3h-4l-2-3H2" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
    {
      label: "Categories",
      onPress: () => navigate("categories"),
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
          <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
    {
      label: "Calendar",
      onPress: () => navigate("calendar"),
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
          <Path d="M3 9h18M7 3v2m10-2v2" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
    {
      label: "Tasks",
      onPress: () => navigate("tasks"),
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
          <Path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
    { isDivider: true },
    {
      label: "Sign Out",
      onPress: signOut,
      isSignOut: true,
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2}>
          <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
  ];

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
      <TopBar
        title={selectedCategoryName}
        badge={entries.length}
        onTitlePress={() => setShowCategoryDropdown(true)}
        showDropdownArrow={true}
        menuItems={menuItems}
        userEmail={user?.email}
      />

      <EntryList
        entries={entries}
        isLoading={isLoading}
        onEntryPress={handleEntryPress}
      />

      {/* Category Navigator Dropdown */}
      <TopBarDropdownContainer
        visible={showCategoryDropdown}
        onClose={() => setShowCategoryDropdown(false)}
      >
        <EntryNavigator
          visible={showCategoryDropdown}
          onClose={() => setShowCategoryDropdown(false)}
          onSelect={handleCategorySelect}
          selectedCategoryId={selectedCategoryId}
        />
      </TopBarDropdownContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
});
