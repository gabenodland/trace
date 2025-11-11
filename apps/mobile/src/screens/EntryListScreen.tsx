import { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useAuthState } from "@trace/core";
import { useEntries } from "../modules/entries/mobileEntryHooks";
import { useCategories } from "../modules/categories/mobileCategoryHooks";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { TopBar } from "../components/layout/TopBar";
import { TopBarDropdownContainer } from "../components/layout/TopBarDropdownContainer";
import { EntryList } from "../modules/entries/components/EntryList";
import { EntryNavigator } from "../components/navigation/EntryNavigator";
import { FloatingActionButton } from "../components/buttons/FloatingActionButton";

interface EntryListScreenProps {
  returnCategoryId?: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "people"; // Also supports "tag:tagname" and "mention:mentionname"
  returnCategoryName?: string;
}

export function EntryListScreen({ returnCategoryId, returnCategoryName }: EntryListScreenProps = {}) {
  const { navigate } = useNavigation();
  const { categories } = useCategories();
  const { user } = useAuthState();
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null | "all" | "tasks" | "events" | "categories" | "tags" | "people">(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("Inbox");

  // Update category when returning from entry screen
  useEffect(() => {
    if (returnCategoryId !== undefined && returnCategoryName !== undefined) {
      setSelectedCategoryId(returnCategoryId);
      setSelectedCategoryName(returnCategoryName);
    }
  }, [returnCategoryId, returnCategoryName]);

  console.log("EntryListScreen - selectedCategoryName:", selectedCategoryName);

  // Determine filter based on selected category
  let categoryFilter: { category_id?: string | null; tag?: string; mention?: string } = {};

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
    // "Tags" - just the collapsible section, not a filter
    // For now, show all entries (noop)
  } else if (selectedCategoryId === "people") {
    // "People" - just the collapsible section, not a filter
    // For now, show all entries (noop)
  } else if (typeof selectedCategoryId === 'string' && selectedCategoryId.startsWith('tag:')) {
    // Filter by specific tag
    const tag = selectedCategoryId.substring(4); // Remove "tag:" prefix
    categoryFilter = { tag };
  } else if (typeof selectedCategoryId === 'string' && selectedCategoryId.startsWith('mention:')) {
    // Filter by specific mention
    const mention = selectedCategoryId.substring(8); // Remove "mention:" prefix
    categoryFilter = { mention };
  } else if (selectedCategoryId !== null) {
    // Specific category ID
    categoryFilter = { category_id: selectedCategoryId };
  } else {
    // Default: Inbox (uncategorized entries)
    categoryFilter = { category_id: null };
  }

  const { entries, isLoading } = useEntries(categoryFilter);

  const handleEntryPress = (entryId: string) => {
    navigate("capture", {
      entryId,
      returnContext: {
        screen: "inbox",
        categoryId: selectedCategoryId,
        categoryName: selectedCategoryName
      }
    });
  };

  const handleAddEntry = () => {
    navigate("capture", {
      initialCategoryId: selectedCategoryId,
      initialCategoryName: selectedCategoryName,
      returnContext: {
        screen: "inbox",
        categoryId: selectedCategoryId,
        categoryName: selectedCategoryName
      }
    });
  };

  const handleTagPress = (tag: string) => {
    const tagId = `tag:${tag}`;
    const tagName = `#${tag}`;
    setSelectedCategoryId(tagId);
    setSelectedCategoryName(tagName);
  };

  const handleMentionPress = (mention: string) => {
    const mentionId = `mention:${mention}`;
    const mentionName = `@${mention}`;
    setSelectedCategoryId(mentionId);
    setSelectedCategoryName(mentionName);
  };

  const handleCategorySelect = (categoryId: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "people", categoryName: string) => {
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
        userEmail={userEmail}
        onProfilePress={onProfilePress}
      />

      <EntryList
        entries={entries}
        isLoading={isLoading}
        onEntryPress={handleEntryPress}
        onTagPress={handleTagPress}
        onMentionPress={handleMentionPress}
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

      <FloatingActionButton onPress={handleAddEntry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
});
