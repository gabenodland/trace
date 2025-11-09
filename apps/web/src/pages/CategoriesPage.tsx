import { useState } from "react";
import { useCategories } from "@trace/core";
import { CategoryTree } from "../modules/categories/components/CategoryTree";
import { AddCategoryModal } from "../modules/categories/components/AddCategoryModal";

export function CategoriesPage() {
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
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Categories</h1>
          <p className="text-gray-600">
            Organize your entries with hierarchical categories
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Category
        </button>
      </div>

      {/* Category Count */}
      {categories.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-500">
            {categories.length} {categories.length === 1 ? "category" : "categories"}
          </p>
        </div>
      )}

      {/* Category Tree */}
      <div className="bg-white rounded-lg shadow">
        <CategoryTree
          tree={categoryTree}
          onCategoryPress={handleCategoryPress}
          selectedId={selectedCategoryId}
        />
      </div>

      {/* Add Category Modal */}
      <AddCategoryModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleCreateCategory}
        categories={categories}
      />
    </div>
  );
}
