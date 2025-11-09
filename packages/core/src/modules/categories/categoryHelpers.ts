// Pure helper functions for category operations

import { Category, CategoryWithPath, CategoryTree } from "./CategoryTypes";

/**
 * Build full path from leaf to root (e.g., "house/furnace/filter")
 * Note: The database already stores full_path, so this is mainly for building display_path
 */
export function buildFullPath(
  category: Category,
  allCategories: Category[]
): string {
  // If full_path is already available, use it
  if (category.full_path) {
    return category.full_path;
  }

  // Otherwise, build it from the hierarchy
  const path: string[] = [category.name];
  let currentParentId = category.parent_category_id;

  while (currentParentId) {
    const parent = allCategories.find((c) => c.category_id === currentParentId);
    if (!parent) break;

    path.unshift(parent.name);
    currentParentId = parent.parent_category_id;
  }

  return path.join("/");
}

/**
 * Convert lowercase path to capitalized display path
 * "house/furnace/filter" → "House/Furnace/Filter"
 */
export function buildDisplayPath(fullPath: string): string {
  return fullPath
    .split("/")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("/");
}

/**
 * Normalize category name to lowercase, trim whitespace
 */
export function normalizeCategoryName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\/+/g, "/"); // Replace multiple slashes with single
}

/**
 * Filter categories by search query (case-insensitive, matches any part of full_path)
 */
export function filterCategoriesByQuery(
  categories: CategoryWithPath[],
  query: string
): CategoryWithPath[] {
  if (!query.trim()) return categories;

  const lowerQuery = query.toLowerCase();

  return categories.filter((cat) =>
    cat.full_path.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Build hierarchical tree structure from flat category list
 */
export function buildCategoryTree(
  categories: CategoryWithPath[],
  entryCounts: Map<string, number>
): CategoryTree[] {
  // Create a map for quick lookup
  const categoryMap = new Map<string, CategoryTree>();

  // Initialize all categories as tree nodes
  categories.forEach((cat) => {
    categoryMap.set(cat.category_id, {
      category: cat,
      children: [],
      entry_count: entryCounts.get(cat.category_id) || 0,
    });
  });

  // Build tree structure
  const rootNodes: CategoryTree[] = [];

  categories.forEach((cat) => {
    const node = categoryMap.get(cat.category_id)!;

    if (cat.parent_category_id === null) {
      // Root level category
      rootNodes.push(node);
    } else {
      // Child category - add to parent's children
      const parent = categoryMap.get(cat.parent_category_id);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found, treat as root
        rootNodes.push(node);
      }
    }
  });

  // Sort alphabetically at each level
  const sortTree = (nodes: CategoryTree[]): CategoryTree[] => {
    return nodes
      .sort((a, b) => a.category.name.localeCompare(b.category.name))
      .map((node) => ({
        ...node,
        children: sortTree(node.children),
      }));
  };

  return sortTree(rootNodes);
}
