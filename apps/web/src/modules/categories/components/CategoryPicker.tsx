import { useState } from "react";
import { useCategories } from "@trace/core";

interface CategoryPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (categoryId: string | null, categoryName: string | null) => void;
  selectedCategoryId: string | null;
}

export function CategoryPicker({ visible, onClose, onSelect, selectedCategoryId }: CategoryPickerProps) {
  const { categories, isLoading } = useCategories();
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

  if (!visible) return null;

  return (
    <>
      {/* Invisible backdrop - click to close */}
      <div
        className="fixed inset-0 z-40"
        onClick={handleClose}
      />

      {/* Dropdown positioned below button */}
      <div className="absolute left-0 top-full mt-2 z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col max-h-[400px]">
        {/* Header */}
        <div className="flex items-center justify-end px-4 py-2 border-b">
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative px-4 py-3 border-b bg-gray-50">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories..."
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Inbox Option (No Category) - Only when not searching */}
          {searchQuery === "" && (
            <>
              <button
                onClick={() => handleSelect(null)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors mb-2 ${
                  selectedCategoryId === null ? "bg-blue-50 border-2 border-blue-200" : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className={`w-5 h-5 ${selectedCategoryId === null ? "text-blue-600" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 22V12h6v10" />
                  </svg>
                  <span className={`font-medium ${selectedCategoryId === null ? "text-blue-900" : "text-gray-700"}`}>
                    Inbox (No Category)
                  </span>
                </div>
                {selectedCategoryId === null && (
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              <div className="h-px bg-gray-200 my-3" />
            </>
          )}

          {/* Categories - Flat List */}
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-500">Loading categories...</span>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 font-semibold mb-1">
                {searchQuery ? "No categories found" : "No categories yet"}
              </p>
              <p className="text-sm text-gray-400">
                {searchQuery ? "Try a different search" : "Create a category first"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredCategories.map((category) => (
                <button
                  key={category.category_id}
                  onClick={() => handleSelect(category.category_id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                    selectedCategoryId === category.category_id
                      ? "bg-blue-50 border-2 border-blue-200"
                      : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <svg
                      className={`w-5 h-5 flex-shrink-0 ${
                        selectedCategoryId === category.category_id ? "text-blue-600" : "text-gray-500"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                    <span
                      className={`font-medium truncate ${
                        selectedCategoryId === category.category_id ? "text-blue-900" : "text-gray-700"
                      }`}
                      title={category.display_path}
                    >
                      {category.display_path}
                    </span>
                  </div>
                  {selectedCategoryId === category.category_id && (
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
