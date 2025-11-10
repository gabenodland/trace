import React, { useState, useMemo } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useCategories, useEntries } from "@trace/core";
import Svg, { Path } from "react-native-svg";
import { CategoryTree as CategoryTreeComponent } from "../../modules/categories/components/CategoryTree";

interface EntryNavigatorProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (categoryId: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "ats", categoryName: string) => void;
  selectedCategoryId: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "ats";
}

interface SpecialItem {
  id: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "ats";
  name: string;
  icon: (selected: boolean) => React.ReactElement;
}

export function EntryNavigator({ visible, onClose, onSelect, selectedCategoryId }: EntryNavigatorProps) {
  const { categories, categoryTree, isLoading } = useCategories();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAllCategoriesExpanded, setIsAllCategoriesExpanded] = useState(false);
  const [isAllTagsExpanded, setIsAllTagsExpanded] = useState(false);
  const [isAllAtsExpanded, setIsAllAtsExpanded] = useState(false);

  // Get entry counts
  const { entries: inboxEntries } = useEntries({ category_id: null });
  const { entries: allEntries } = useEntries({});

  const allCount = allEntries.length;
  const inboxCount = inboxEntries.length;
  const categoriesCount = allEntries.filter(e => e.category_id !== null).length;

  // Define special navigation items (Inbox, Tasks, Events) - ordered before All
  const nonAllItems: SpecialItem[] = useMemo(() => [
    {
      id: null,
      name: "Inbox",
      icon: (selected: boolean) => (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={selected ? "#2563eb" : "#6b7280"} strokeWidth={2}>
          <Path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
    {
      id: "tasks",
      name: "Tasks",
      icon: (selected: boolean) => (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={selected ? "#2563eb" : "#6b7280"} strokeWidth={2}>
          <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
    {
      id: "events",
      name: "Events",
      icon: (selected: boolean) => (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={selected ? "#2563eb" : "#6b7280"} strokeWidth={2}>
          <Path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
  ], []);

  // All items for searching (includes: All, Inbox, Tasks, Events, Categories, Tags, Ats)
  const allSpecialItems: SpecialItem[] = useMemo(() => [
    {
      id: "all",
      name: "All",
      icon: (selected: boolean) => (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={selected ? "#2563eb" : "#6b7280"} strokeWidth={2}>
          <Path d="M4 6h16M4 10h16M4 14h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
    ...nonAllItems,
    {
      id: "categories",
      name: "Categories",
      icon: (selected: boolean) => (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={selected ? "#2563eb" : "#6b7280"} strokeWidth={2}>
          <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
    {
      id: "tags",
      name: "Tags",
      icon: (selected: boolean) => (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={selected ? "#2563eb" : "#6b7280"} strokeWidth={2}>
          <Path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
    {
      id: "ats",
      name: "Ats",
      icon: (selected: boolean) => (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={selected ? "#2563eb" : "#6b7280"} strokeWidth={2}>
          <Path d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
  ], [nonAllItems]);

  // Filter special items and categories based on search query
  const filteredSpecialItems = useMemo(() =>
    allSpecialItems.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [allSpecialItems, searchQuery]
  );

  const filteredCategories = useMemo(() =>
    categories.filter((category) =>
      category.display_path.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [categories, searchQuery]
  );

  const handleSelect = (categoryId: string | null | "all" | "tasks" | "events" | "all-tags" | "all-ats", categoryName: string) => {
    onSelect(categoryId, categoryName);
    setSearchQuery("");
    onClose();
  };

  const handleClose = () => {
    setSearchQuery("");
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={styles.dropdownContainer}>
      {/* Search Input */}
          <View style={styles.searchContainer}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2} style={styles.searchIcon}>
              <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search..."
              placeholderTextColor="#9ca3af"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearch}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2}>
                  <Path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          <ScrollView style={styles.content}>
            {searchQuery === "" ? (
              <>
                {/* "All" Item - Top level, shows all entries */}
                <TouchableOpacity
                  style={[
                    styles.categoryItem,
                    selectedCategoryId === "all" && styles.categoryItemSelected,
                  ]}
                  onPress={() => handleSelect("all", "All")}
                >
                  <View style={styles.categoryContent}>
                    {/* Spacer for alignment with collapsible items */}
                    <View style={styles.chevronContainer} />
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={selectedCategoryId === "all" ? "#2563eb" : "#6b7280"} strokeWidth={2}>
                      <Path d="M4 6h16M4 10h16M4 14h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={[styles.categoryName, selectedCategoryId === "all" && styles.categoryNameSelected]}>
                      All
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{allCount}</Text>
                  </View>
                </TouchableOpacity>

                {/* Special Items (Inbox, Tasks, Events) - Indented to align */}
                {nonAllItems.map((item) => {
                  const count = item.id === null ? inboxCount : undefined;
                  return (
                    <TouchableOpacity
                      key={item.id || "inbox"}
                      style={[
                        styles.categoryItem,
                        selectedCategoryId === item.id && styles.categoryItemSelected,
                      ]}
                      onPress={() => handleSelect(item.id, item.name)}
                    >
                      <View style={styles.categoryContent}>
                        {/* Spacer for alignment with collapsible items */}
                        <View style={styles.chevronContainer} />
                        {item.icon(selectedCategoryId === item.id)}
                        <Text style={[styles.categoryName, selectedCategoryId === item.id && styles.categoryNameSelected]}>
                          {item.name}
                        </Text>
                      </View>
                      {count !== undefined && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{count}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* "Categories" Item - Collapsible parent for categories (expand only, not selectable) */}
                <TouchableOpacity
                  style={styles.categoryItem}
                  onPress={() => {
                    if (categoryTree.length > 0) {
                      setIsAllCategoriesExpanded(!isAllCategoriesExpanded);
                    }
                  }}
                  disabled={categoryTree.length === 0}
                >
                  <View style={styles.categoryContent}>
                    {/* Chevron */}
                    <View style={styles.chevronContainer}>
                      {categoryTree.length > 0 && (
                        <Svg
                          width={16}
                          height={16}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#6b7280"
                          strokeWidth={2}
                          style={[styles.chevron, isAllCategoriesExpanded && styles.chevronExpanded]}
                        >
                          <Path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                      )}
                    </View>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                      <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.categoryName}>
                      Categories
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Category Tree - shown when "Categories" is expanded */}
                {isAllCategoriesExpanded && !isLoading && categoryTree.length > 0 && (
                  <View style={styles.categoryTreeWrapper}>
                    <CategoryTreeComponent
                      tree={categoryTree}
                      onCategoryPress={(categoryId) => {
                        const category = categories.find((c) => c.category_id === categoryId);
                        handleSelect(categoryId, category?.name || "Unknown");
                      }}
                      selectedId={selectedCategoryId === "all" || selectedCategoryId === null || selectedCategoryId === "tasks" || selectedCategoryId === "events" || selectedCategoryId === "categories" || selectedCategoryId === "tags" || selectedCategoryId === "ats" ? null : selectedCategoryId}
                    />
                  </View>
                )}

                {/* "Tags" Item - Collapsible (expand only, not selectable) */}
                <TouchableOpacity
                  style={styles.categoryItem}
                  onPress={() => {
                    // No tags yet, but set up for future
                    setIsAllTagsExpanded(!isAllTagsExpanded);
                  }}
                  disabled={true}
                >
                  <View style={styles.categoryContent}>
                    {/* Chevron (will show when tags are implemented) */}
                    <View style={styles.chevronContainer}>
                      {/* No chevron shown since no tags yet */}
                    </View>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                      <Path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.categoryName}>
                      Tags
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Tags list - shown when "Tags" is expanded (placeholder for future) */}
                {isAllTagsExpanded && (
                  <View style={styles.categoryTreeWrapper}>
                    {/* Tags will be rendered here in the future */}
                  </View>
                )}

                {/* "Ats" Item - Collapsible (expand only, not selectable) */}
                <TouchableOpacity
                  style={styles.categoryItem}
                  onPress={() => {
                    // No @s yet, but set up for future
                    setIsAllAtsExpanded(!isAllAtsExpanded);
                  }}
                  disabled={true}
                >
                  <View style={styles.categoryContent}>
                    {/* Chevron (will show when @s are implemented) */}
                    <View style={styles.chevronContainer}>
                      {/* No chevron shown since no @s yet */}
                    </View>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                      <Path d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.categoryName}>
                      Ats
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* @s list - shown when "Ats" is expanded (placeholder for future) */}
                {isAllAtsExpanded && (
                  <View style={styles.categoryTreeWrapper}>
                    {/* @s will be rendered here in the future */}
                  </View>
                )}
              </>
            ) : (
              <>
                {/* Filtered Special Items when searching */}
                {filteredSpecialItems.map((item) => (
                  <TouchableOpacity
                    key={item.id || "inbox"}
                    style={[
                      styles.categoryItem,
                      selectedCategoryId === item.id && styles.categoryItemSelected,
                    ]}
                    onPress={() => handleSelect(item.id, item.name)}
                  >
                    <View style={styles.categoryContent}>
                      {item.icon(selectedCategoryId === item.id)}
                      <Text style={[styles.categoryName, selectedCategoryId === item.id && styles.categoryNameSelected]}>
                        {item.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}

                {/* Filtered Categories when searching */}
                {filteredCategories.length > 0 && filteredCategories.map((category) => (
                  <TouchableOpacity
                    key={category.category_id}
                    style={[
                      styles.categoryItem,
                      selectedCategoryId === category.category_id && styles.categoryItemSelected,
                    ]}
                    onPress={() => handleSelect(category.category_id, category.name)}
                  >
                    <View style={styles.categoryContent}>
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={selectedCategoryId === category.category_id ? "#2563eb" : "#6b7280"} strokeWidth={2}>
                        <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <View style={styles.categoryTextContainer}>
                        <Text style={[styles.categoryPath, selectedCategoryId === category.category_id && styles.categoryPathSelected]}>
                          {category.display_path}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dropdownContainer: {
    position: "absolute",
    top: 120,
    left: 16,
    right: 16,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    maxHeight: 500,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    padding: 0,
  },
  clearSearch: {
    padding: 4,
  },
  content: {
    maxHeight: 400,
  },
  categoryTreeWrapper: {
    paddingLeft: 20,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  indentedItem: {
    paddingLeft: 36,
  },
  categoryItemSelected: {
    backgroundColor: "#dbeafe",
  },
  categoryContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  chevronContainer: {
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },
  chevron: {
    transform: [{ rotate: "0deg" }],
  },
  chevronExpanded: {
    transform: [{ rotate: "90deg" }],
  },
  selectableContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  categoryTextContainer: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
  },
  categoryNameSelected: {
    color: "#1e40af",
    fontWeight: "600",
  },
  badge: {
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 32,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  categoryPath: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
  },
  categoryPathSelected: {
    color: "#1e40af",
    fontWeight: "600",
  },
  divider: {
    height: 8,
    backgroundColor: "#f9fafb",
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#9ca3af",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
  },
});
