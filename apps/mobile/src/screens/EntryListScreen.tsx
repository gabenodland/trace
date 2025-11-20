import { useState, useEffect, useMemo } from "react";
import { View, StyleSheet, Alert } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useAuthState } from "@trace/core";
import { useEntries, useEntry, MobileEntryFilter } from "../modules/entries/mobileEntryHooks";
import { getEntryLocationByName } from "../modules/entries/mobileEntryApi";
import { type Location as LocationType } from "@trace/core";
import { useCategories, getAllChildCategoryIds } from "../modules/categories/mobileCategoryHooks";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { usePersistedState } from "../shared/hooks/usePersistedState";
import { TopBar } from "../components/layout/TopBar";
import type { BreadcrumbSegment } from "../components/layout/Breadcrumb";
import { TopBarDropdownContainer } from "../components/layout/TopBarDropdownContainer";
import { SubBar, SubBarSelector } from "../components/layout/SubBar";
import { EntryList } from "../modules/entries/components/EntryList";
import { EntryNavigator } from "../components/navigation/EntryNavigator";
import { FloatingActionButton } from "../components/buttons/FloatingActionButton";
import { DisplayModeSelector } from "../modules/entries/components/DisplayModeSelector";
import { SortModeSelector } from "../modules/entries/components/SortModeSelector";
import { CategoryPicker } from "../modules/categories/components/CategoryPicker";
import type { EntryDisplayMode } from "../modules/entries/types/EntryDisplayMode";
import { DEFAULT_DISPLAY_MODE, ENTRY_DISPLAY_MODES } from "../modules/entries/types/EntryDisplayMode";
import type { EntrySortMode } from "../modules/entries/types/EntrySortMode";
import { DEFAULT_SORT_MODE, ENTRY_SORT_MODES } from "../modules/entries/types/EntrySortMode";
import type { EntrySortOrder } from "../modules/entries/types/EntrySortOrder";
import { DEFAULT_SORT_ORDER } from "../modules/entries/types/EntrySortOrder";
import { sortEntries } from "../modules/entries/helpers/entrySortHelpers";
import { theme } from "../shared/theme/theme";

interface EntryListScreenProps {
  returnCategoryId?: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "people"; // Also supports "tag:tagname" and "mention:mentionname"
  returnCategoryName?: string;
}

export function EntryListScreen({ returnCategoryId, returnCategoryName }: EntryListScreenProps = {}) {
  const { navigate } = useNavigation();
  const { categories, categoryTree } = useCategories();
  const { user } = useAuthState();
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showDisplayModeSelector, setShowDisplayModeSelector] = useState(false);
  const [showSortModeSelector, setShowSortModeSelector] = useState(false);
  const [showMoveCategoryPicker, setShowMoveCategoryPicker] = useState(false);
  const [entryToMove, setEntryToMove] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null | "all" | "tasks" | "events" | "categories" | "tags" | "people">("all");
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("Home");
  const [displayMode, setDisplayMode] = usePersistedState<EntryDisplayMode>('@entryListDisplayMode', DEFAULT_DISPLAY_MODE);
  const [sortMode, setSortMode] = usePersistedState<EntrySortMode>('@entryListSortMode', DEFAULT_SORT_MODE);
  const [orderMode, setOrderMode] = usePersistedState<EntrySortOrder>('@entryListOrderMode', DEFAULT_SORT_ORDER);

  // Update category when returning from entry screen
  useEffect(() => {
    if (returnCategoryId !== undefined && returnCategoryName !== undefined) {
      setSelectedCategoryId(returnCategoryId);
      setSelectedCategoryName(returnCategoryName);
    }
  }, [returnCategoryId, returnCategoryName]);

  console.log("EntryListScreen - selectedCategoryName:", selectedCategoryName);

  // Build breadcrumbs from selected category
  const breadcrumbs = useMemo((): BreadcrumbSegment[] => {
    // If a category is selected, walk up the parent tree
    if (selectedCategoryId && typeof selectedCategoryId === 'string' && !selectedCategoryId.startsWith("tag:") && !selectedCategoryId.startsWith("mention:") && !selectedCategoryId.startsWith("location:") && selectedCategoryId !== "all") {
      // Start with Home
      const crumbs: BreadcrumbSegment[] = [{ id: "all", label: "Home" }];

      const categoryPath: BreadcrumbSegment[] = [];
      let currentCategory = categories.find(c => c.category_id === selectedCategoryId);

      // Walk up the parent chain
      while (currentCategory) {
        categoryPath.unshift({
          id: currentCategory.category_id,
          label: currentCategory.name
        });

        // Move to parent
        if (currentCategory.parent_category_id) {
          currentCategory = categories.find(c => c.category_id === currentCategory!.parent_category_id);
        } else {
          currentCategory = undefined;
        }
      }

      // Add all categories to breadcrumb
      crumbs.push(...categoryPath);
      return crumbs;
    } else if (selectedCategoryId === "all") {
      // "All" as the only segment
      return [{ id: "all", label: "All" }];
    } else if (selectedCategoryId === null) {
      // Uncategorized - only segment
      return [{ id: null, label: "Uncategorized" }];
    } else if (typeof selectedCategoryId === 'string' && selectedCategoryId.startsWith("tag:")) {
      // Tag filter - show tag in breadcrumb
      const tag = selectedCategoryId.substring(4);
      return [{ id: "all", label: "Home" }, { id: selectedCategoryId, label: `#${tag}` }];
    } else if (typeof selectedCategoryId === 'string' && selectedCategoryId.startsWith("mention:")) {
      // Mention filter - show mention in breadcrumb
      const mention = selectedCategoryId.substring(8);
      return [{ id: "all", label: "Home" }, { id: selectedCategoryId, label: `@${mention}` }];
    } else if (typeof selectedCategoryId === 'string' && selectedCategoryId.startsWith("location:")) {
      // Location filter - show location in breadcrumb with icon
      const locationName = selectedCategoryId.substring(9);
      return [
        { id: "all", label: "Home" },
        {
          id: selectedCategoryId,
          label: locationName,
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth={2}>
              <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={12} cy={10} r={3} />
            </Svg>
          )
        }
      ];
    }

    // Default: just All
    return [{ id: "all", label: "All" }];
  }, [selectedCategoryId, categories]);

  // Get child category IDs for hierarchical filtering
  const childCategoryIds = useMemo(() => {
    if (selectedCategoryId && typeof selectedCategoryId === 'string' && !selectedCategoryId.startsWith("tag:") && !selectedCategoryId.startsWith("mention:") && !selectedCategoryId.startsWith("location:") && selectedCategoryId !== "all") {
      return getAllChildCategoryIds(categoryTree, selectedCategoryId);
    }
    return [];
  }, [selectedCategoryId, categoryTree]);

  // Determine filter based on selected category
  let categoryFilter: MobileEntryFilter = {};

  if (selectedCategoryId === "all") {
    // "All" / "Home" - fetch all entries (inbox + categorized)
    // Don't set any category_id filter to show everything
    // categoryFilter stays empty
  } else if (selectedCategoryId === null) {
    // Uncategorized - show only entries without a category
    categoryFilter = { category_id: null };
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
  } else if (typeof selectedCategoryId === 'string' && selectedCategoryId.startsWith('location:')) {
    // Filter by specific location
    const locationName = selectedCategoryId.substring(9); // Remove "location:" prefix
    categoryFilter = { location_name: locationName };
  } else if (selectedCategoryId !== null) {
    // Specific category ID - include all children hierarchically
    categoryFilter = {
      category_id: selectedCategoryId,
      includeChildren: true,
      childCategoryIds: childCategoryIds
    };
  } else {
    // Default: Uncategorized (uncategorized entries only, no children)
    categoryFilter = { category_id: null };
  }

  const { entries, isLoading, entryMutations } = useEntries(categoryFilter);

  // Sort entries based on selected sort mode
  const categoryMap = useMemo(() => {
    return categories.reduce((map, cat) => {
      map[cat.category_id] = cat.full_path;
      return map;
    }, {} as Record<string, string>);
  }, [categories]);

  const sortedEntries = useMemo(() => {
    return sortEntries(entries, sortMode, categoryMap, orderMode);
  }, [entries, sortMode, categoryMap, orderMode]);

  // Get display labels
  const displayModeLabel = ENTRY_DISPLAY_MODES.find(m => m.value === displayMode)?.label || 'Smashed';
  const baseSortLabel = ENTRY_SORT_MODES.find(m => m.value === sortMode)?.label || 'Entry Date';
  const sortModeLabel = orderMode === 'desc' ? `${baseSortLabel} (desc)` : baseSortLabel;

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

  const handleAddEntry = async () => {
    // Auto-insert tag or mention into body if viewing a tag/mention filter
    let initialContent = "";
    let initialLocation: LocationType | undefined = undefined;

    if (typeof selectedCategoryId === 'string') {
      if (selectedCategoryId.startsWith('tag:')) {
        const tag = selectedCategoryId.substring(4);
        initialContent = `#${tag} `;
      } else if (selectedCategoryId.startsWith('mention:')) {
        const mention = selectedCategoryId.substring(8);
        initialContent = `@${mention} `;
      } else if (selectedCategoryId.startsWith('location:')) {
        // Get location data from an existing entry with this location name
        const locationName = selectedCategoryId.substring(9);
        const locationData = await getEntryLocationByName(locationName);
        if (locationData && locationData.location_latitude !== null && locationData.location_longitude !== null) {
          initialLocation = {
            name: locationData.location_name,
            latitude: locationData.location_latitude,
            longitude: locationData.location_longitude,
            accuracy: locationData.location_accuracy,
            source: locationData.location_name_source as LocationType['source'] || 'user_custom',
            address: locationData.location_address,
            neighborhood: locationData.location_neighborhood,
            postalCode: locationData.location_postal_code,
            city: locationData.location_city,
            subdivision: locationData.location_subdivision,
            region: locationData.location_region,
            country: locationData.location_country,
          };
        }
      }
    }

    navigate("capture", {
      initialCategoryId: selectedCategoryId,
      initialCategoryName: selectedCategoryName,
      initialContent,
      initialLocation,
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

  const handleBreadcrumbPress = (segment: BreadcrumbSegment) => {
    // Navigate to the clicked breadcrumb level
    if (segment.id === "all") {
      // Home - show all entries
      setSelectedCategoryId("all");
      setSelectedCategoryName("Home");
    } else if (segment.id === null) {
      // Uncategorized
      setSelectedCategoryId(null);
      setSelectedCategoryName("Uncategorized");
    } else if (typeof segment.id === 'string' && segment.id.startsWith("tag:")) {
      // Tag segment
      setSelectedCategoryId(segment.id);
      setSelectedCategoryName(segment.label);
    } else if (typeof segment.id === 'string' && segment.id.startsWith("mention:")) {
      // Mention segment
      setSelectedCategoryId(segment.id);
      setSelectedCategoryName(segment.label);
    } else if (typeof segment.id === 'string' && segment.id.startsWith("location:")) {
      // Location segment
      setSelectedCategoryId(segment.id);
      setSelectedCategoryName(segment.label);
    } else {
      // Category segment - has valid category_id
      setSelectedCategoryId(segment.id);
      setSelectedCategoryName(segment.label);
    }
  };

  const handleMoveEntry = (entryId: string) => {
    setEntryToMove(entryId);
    setShowMoveCategoryPicker(true);
  };

  const handleMoveCategorySelect = async (categoryId: string | null, categoryName: string) => {
    if (!entryToMove) return;

    try {
      // Find the entry to get its current data
      const entry = entries.find(e => e.entry_id === entryToMove);
      if (!entry) return;

      // Update the entry with the new category
      await entryMutations.updateEntry(entryToMove, {
        category_id: categoryId,
      });

      setShowMoveCategoryPicker(false);
      setEntryToMove(null);
    } catch (error) {
      console.error("Failed to move entry:", error);
      Alert.alert("Error", "Failed to move entry");
    }
  };

  const handleDeleteEntry = (entryId: string) => {
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await entryMutations.deleteEntry(entryId);
            } catch (error) {
              console.error("Failed to delete entry:", error);
              Alert.alert("Error", "Failed to delete entry");
            }
          },
        },
      ]
    );
  };

  // Get current category of entry being moved
  const entryToMoveData = entryToMove ? entries.find(e => e.entry_id === entryToMove) : null;
  const entryToMoveCategoryId = entryToMoveData?.category_id || null;

  return (
    <View style={styles.container}>
      <TopBar
        breadcrumbs={breadcrumbs}
        onBreadcrumbPress={handleBreadcrumbPress}
        onBreadcrumbDropdownPress={() => setShowCategoryDropdown(true)}
        badge={sortedEntries.length}
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
        onMove={handleMoveEntry}
        onDelete={handleDeleteEntry}
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
        sortOrder={orderMode}
        onSortOrderChange={setOrderMode}
      />

      {/* Move Category Picker */}
      <TopBarDropdownContainer
        visible={showMoveCategoryPicker}
        onClose={() => {
          setShowMoveCategoryPicker(false);
          setEntryToMove(null);
        }}
      >
        <CategoryPicker
          visible={showMoveCategoryPicker}
          onClose={() => {
            setShowMoveCategoryPicker(false);
            setEntryToMove(null);
          }}
          onSelect={handleMoveCategorySelect}
          selectedCategoryId={entryToMoveCategoryId}
        />
      </TopBarDropdownContainer>

      <FloatingActionButton onPress={handleAddEntry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
  },
});
