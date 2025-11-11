import { useState, useEffect, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useAuthState } from "@trace/core";
import { useEntries } from "../modules/entries/mobileEntryHooks";
import { useCategories } from "../modules/categories/mobileCategoryHooks";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { usePersistedState } from "../shared/hooks/usePersistedState";
import { TopBar } from "../components/layout/TopBar";
import { TopBarDropdownContainer } from "../components/layout/TopBarDropdownContainer";
import { SubBar, SubBarSelector } from "../components/layout/SubBar";
import { EntryList } from "../modules/entries/components/EntryList";
import { EntryNavigator } from "../components/navigation/EntryNavigator";
import { FloatingActionButton } from "../components/buttons/FloatingActionButton";
import { DisplayModeSelector } from "../modules/entries/components/DisplayModeSelector";
import { SortModeSelector } from "../modules/entries/components/SortModeSelector";
import type { EntryDisplayMode } from "../modules/entries/types/EntryDisplayMode";
import { DEFAULT_DISPLAY_MODE, ENTRY_DISPLAY_MODES } from "../modules/entries/types/EntryDisplayMode";
import type { EntrySortMode } from "../modules/entries/types/EntrySortMode";
import { DEFAULT_SORT_MODE, ENTRY_SORT_MODES } from "../modules/entries/types/EntrySortMode";
import { sortEntries } from "../modules/entries/helpers/entrySortHelpers";

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
  const [showDisplayModeSelector, setShowDisplayModeSelector] = useState(false);
  const [showSortModeSelector, setShowSortModeSelector] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null | "all" | "tasks" | "events" | "categories" | "tags" | "people">(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("Inbox");
  const [displayMode, setDisplayMode] = usePersistedState<EntryDisplayMode>('@entryListDisplayMode', DEFAULT_DISPLAY_MODE);
  const [sortMode, setSortMode] = usePersistedState<EntrySortMode>('@entryListSortMode', DEFAULT_SORT_MODE);

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

  // Sort entries based on selected sort mode
  const categoryMap = useMemo(() => {
    return categories.reduce((map, cat) => {
      map[cat.category_id] = cat.full_path;
      return map;
    }, {} as Record<string, string>);
  }, [categories]);

  const sortedEntries = useMemo(() => {
    return sortEntries(entries, sortMode, categoryMap);
  }, [entries, sortMode, categoryMap]);

  // Get display labels
  const displayModeLabel = ENTRY_DISPLAY_MODES.find(m => m.value === displayMode)?.label || 'Smashed';
  const sortModeLabel = ENTRY_SORT_MODES.find(m => m.value === sortMode)?.label || 'Entry Date';

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

  const handleCategoryPress = (categoryId: string | null, categoryName: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedCategoryName(categoryName);
  };

  const handleCategorySelect = (categoryId: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "people", categoryName: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedCategoryName(categoryName);
  };

  return (
    <View style={styles.container}>
      <TopBar
        title={selectedCategoryName}
        badge={sortedEntries.length}
        onTitlePress={() => setShowCategoryDropdown(true)}
        showDropdownArrow={true}
        menuItems={menuItems}
        userEmail={userEmail}
        onProfilePress={onProfilePress}
      />

      <SubBar>
        <SubBarSelector
          label="View"
          value={displayModeLabel}
          onPress={() => setShowDisplayModeSelector(true)}
        />
        <SubBarSelector
          label="Sort"
          value={sortModeLabel}
          onPress={() => setShowSortModeSelector(true)}
        />
      </SubBar>

      <EntryList
        entries={sortedEntries}
        isLoading={isLoading}
        onEntryPress={handleEntryPress}
        onTagPress={handleTagPress}
        onMentionPress={handleMentionPress}
        onCategoryPress={handleCategoryPress}
        categories={categories}
        displayMode={displayMode}
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

      {/* Display Mode Selector */}
      <DisplayModeSelector
        visible={showDisplayModeSelector}
        selectedMode={displayMode}
        onSelect={setDisplayMode}
        onClose={() => setShowDisplayModeSelector(false)}
      />

      {/* Sort Mode Selector */}
      <SortModeSelector
        visible={showSortModeSelector}
        selectedMode={sortMode}
        onSelect={setSortMode}
        onClose={() => setShowSortModeSelector(false)}
      />

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
