import { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useCategories } from "../mobileCategoryHooks";
import Svg, { Path } from "react-native-svg";
import { CategoryTree } from "./CategoryTree";

interface CategoryPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (categoryId: string | null, categoryName: string | null) => void;
  selectedCategoryId: string | null;
}

export function CategoryPicker({ visible, onClose, onSelect, selectedCategoryId }: CategoryPickerProps) {
  const { categories, categoryTree, isLoading } = useCategories();
  const [searchQuery, setSearchQuery] = useState("");

  // Filter categories based on search query
  const filteredCategories = categories.filter((category) =>
    category.display_path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (categoryId: string | null) => {
    const selectedCategory = categories.find(c => c.category_id === categoryId);
    onSelect(categoryId, selectedCategory?.name || null);
    setSearchQuery("");
    onClose();
  };

  const handleClose = () => {
    setSearchQuery("");
    onClose();
  };

  return (
    <View style={styles.container}>
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2} style={styles.searchIcon}>
              <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search categories..."
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
                {/* Inbox Option (No Category) - First item, aligned with categories */}
                <TouchableOpacity
                  style={[
                    styles.categoryItem,
                    selectedCategoryId === null && styles.categoryItemSelected,
                  ]}
                  onPress={() => handleSelect(null)}
                >
                  <View style={styles.categoryContent}>
                    {/* Spacer for alignment with collapsible items */}
                    <View style={styles.chevronContainer} />
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={selectedCategoryId === null ? "#2563eb" : "#6b7280"} strokeWidth={2}>
                      <Path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={[styles.categoryName, selectedCategoryId === null && styles.categoryNameSelected]}>
                      Inbox
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Category Tree - Collapsible, fully expanded by default */}
                {!isLoading && categoryTree.length > 0 && (
                  <CategoryTree
                    tree={categoryTree}
                    onCategoryPress={(categoryId) => {
                      const category = categories.find((c) => c.category_id === categoryId);
                      handleSelect(categoryId);
                    }}
                    selectedId={selectedCategoryId}
                  />
                )}

                {isLoading && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#3b82f6" />
                    <Text style={styles.loadingText}>Loading categories...</Text>
                  </View>
                )}

                {!isLoading && categoryTree.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No categories yet</Text>
                    <Text style={styles.emptySubtext}>Create a category first</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                {/* Filtered Categories when searching */}
                {filteredCategories.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No categories found</Text>
                    <Text style={styles.emptySubtext}>Try a different search</Text>
                  </View>
                ) : (
                  filteredCategories.map((category) => (
                    <TouchableOpacity
                      key={category.category_id}
                      style={[
                        styles.categoryItem,
                        selectedCategoryId === category.category_id && styles.categoryItemSelected,
                      ]}
                      onPress={() => handleSelect(category.category_id)}
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
                  ))
                )}
              </>
            )}
          </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
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
