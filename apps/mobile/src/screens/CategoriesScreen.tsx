import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useCategories } from "@trace/core";
import { ScreenHeader } from "../components/navigation/ScreenHeader";
import { CategoryTree } from "../modules/categories/components/CategoryTree";
import { AddCategoryModal } from "../modules/categories/components/AddCategoryModal";
import Svg, { Path } from "react-native-svg";

export function CategoriesScreen() {
  const { categories, categoryTree, isLoading, categoryMutations } = useCategories();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const handleCreateCategory = async (name: string, parentId: string | null) => {
    await categoryMutations.createCategory(name, parentId);
  };

  const handleCategoryPress = (categoryId: string) => {
    setSelectedCategoryId(categoryId === selectedCategoryId ? null : categoryId);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Categories" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading categories...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Categories" badge={categories.length} />

      <View style={styles.content}>
        <CategoryTree
          tree={categoryTree}
          onCategoryPress={handleCategoryPress}
          selectedId={selectedCategoryId}
        />
      </View>

      {/* Add Category Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowAddModal(true)}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5}>
          <Path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>

      {/* Add Category Modal */}
      <AddCategoryModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleCreateCategory}
        categories={categories}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7280",
  },
  content: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  addButton: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
});
