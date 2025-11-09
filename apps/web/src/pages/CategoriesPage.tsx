export function CategoriesPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Categories</h1>
      <p className="text-gray-600 mb-8">
        Browse your entries by category hierarchy
      </p>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500 text-center py-8">
          No categories created yet
        </p>
      </div>
    </div>
  );
}
