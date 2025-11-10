/**
 * Mobile Category API - Offline-first category operations
 * Saves to SQLite immediately, syncs to Supabase in background
 */

import { localDB } from '../../shared/db/localDB';
import { supabase } from '@trace/core/src/shared/supabase';
import type { CategoryWithPath, CategoryTree } from '@trace/core';
import { buildCategoryTree } from '@trace/core/src/modules/categories/categoryHelpers';

/**
 * Get all categories from local SQLite
 */
export async function getCategories(): Promise<CategoryWithPath[]> {
  await localDB.init();

  const categories = await localDB.getAllCategories();

  return categories.map(cat => ({
    ...cat,
    display_path: cat.full_path, // Add display_path for compatibility
  }));
}

/**
 * Create a category (offline-first)
 */
export async function createCategory(data: {
  name: string;
  parent_category_id?: string | null;
  color?: string | null;
  icon?: string | null;
}): Promise<CategoryWithPath> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Generate ID
  const category_id = crypto.randomUUID();

  // Calculate full_path and depth
  let full_path = data.name;
  let depth = 0;

  if (data.parent_category_id) {
    const parent = await localDB.getCategory(data.parent_category_id);
    if (parent) {
      full_path = `${parent.full_path} / ${data.name}`;
      depth = parent.depth + 1;
    }
  }

  const now = new Date().toISOString();

  const category = {
    category_id,
    user_id: user.id,
    name: data.name,
    full_path,
    parent_category_id: data.parent_category_id || null,
    depth,
    entry_count: 0,
    color: data.color || null,
    icon: data.icon || null,
    created_at: now,
    updated_at: now,
  };

  // Save to local SQLite
  await localDB.saveCategory(category);

  return {
    ...category,
    display_path: full_path,
  };
}

/**
 * Update a category (offline-first)
 */
export async function updateCategory(
  categoryId: string,
  data: {
    name?: string;
    color?: string | null;
    icon?: string | null;
  }
): Promise<CategoryWithPath> {
  const existing = await localDB.getCategory(categoryId);
  if (!existing) throw new Error('Category not found');

  const updated = {
    ...existing,
    ...data,
  };

  // If name changed, recalculate full_path
  if (data.name && data.name !== existing.name) {
    if (existing.parent_category_id) {
      const parent = await localDB.getCategory(existing.parent_category_id);
      if (parent) {
        updated.full_path = `${parent.full_path} / ${data.name}`;
      } else {
        updated.full_path = data.name;
      }
    } else {
      updated.full_path = data.name;
    }
  }

  await localDB.updateCategory(categoryId, updated);

  return {
    ...updated,
    display_path: updated.full_path,
  };
}

/**
 * Delete a category (offline-first)
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  await localDB.deleteCategory(categoryId);
}

/**
 * Get category tree (hierarchical structure)
 */
export async function getCategoryTree(): Promise<CategoryTree[]> {
  const categories = await getCategories();

  // Use entry_count from database
  const countMap = new Map<string, number>();
  categories.forEach((cat) => {
    countMap.set(cat.category_id, cat.entry_count);
  });

  return buildCategoryTree(categories, countMap);
}
