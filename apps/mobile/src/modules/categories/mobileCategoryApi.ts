/**
 * Mobile Category API - Offline-first category operations
 *
 * All reads come from local SQLite.
 * Writes go to SQLite first, then sync in background.
 *
 * Architecture:
 * Components → Hooks → API (this file) → LocalDB
 *                                      ↓
 *                                  SyncService (background)
 */

import * as Crypto from 'expo-crypto';
import { localDB } from '../../shared/db/localDB';
import { supabase } from '@trace/core/src/shared/supabase';
import type { CategoryWithPath, CategoryTree } from '@trace/core';
import { buildCategoryTree } from '@trace/core/src/modules/categories/categoryHelpers';
import { triggerPushSync } from '../../shared/sync';
import { createScopedLogger } from '../../shared/utils/logger';

const log = createScopedLogger('CategoryApi');

// ============================================================================
// READ OPERATIONS (always from local SQLite)
// ============================================================================

/**
 * Get all categories from local SQLite
 */
export async function getCategories(): Promise<CategoryWithPath[]> {
  await localDB.init();
  log.debug('Getting categories');

  const categories = await localDB.getAllCategories();

  return categories.map(cat => ({
    ...cat,
    display_path: cat.full_path,
  }));
}

/**
 * Get category tree (hierarchical structure)
 */
export async function getCategoryTree(): Promise<CategoryTree[]> {
  log.debug('Getting category tree');
  const categories = await getCategories();

  // Use entry_count from database
  const countMap = new Map<string, number>();
  categories.forEach((cat) => {
    countMap.set(cat.category_id, cat.entry_count);
  });

  return buildCategoryTree(categories, countMap);
}

// ============================================================================
// WRITE OPERATIONS (local first, then sync)
// ============================================================================

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
  const category_id = Crypto.randomUUID();

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

  log.info('Creating category', { categoryId: category_id, name: data.name });

  // Save to local SQLite
  await localDB.saveCategory(category);

  // Trigger sync in background (non-blocking)
  triggerPushSync();

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
    parent_category_id?: string | null;
    color?: string | null;
    icon?: string | null;
    // Category property fields
    entry_title_template?: string | null;
    entry_content_template?: string | null;
    entry_use_rating?: boolean;
    entry_use_priority?: boolean;
    entry_use_status?: boolean;
    entry_use_duedates?: boolean;
    entry_use_location?: boolean;
    entry_use_photos?: boolean;
    entry_content_type?: string;
    is_private?: boolean;
    is_localonly?: boolean;
  }
): Promise<CategoryWithPath> {
  const existing = await localDB.getCategory(categoryId);
  if (!existing) throw new Error('Category not found');

  const updated = {
    ...existing,
    ...data,
    // Mark as needing sync
    synced: 0,
    sync_action: existing.sync_action === 'create' ? 'create' : 'update',
  };

  // If parent changed or name changed, recalculate full_path and depth
  const parentChanged = data.parent_category_id !== undefined && data.parent_category_id !== existing.parent_category_id;
  const nameChanged = data.name && data.name !== existing.name;

  if (parentChanged || nameChanged) {
    const newParentId = data.parent_category_id !== undefined ? data.parent_category_id : existing.parent_category_id;
    const newName = data.name || existing.name;

    if (newParentId) {
      const parent = await localDB.getCategory(newParentId);
      if (parent) {
        updated.full_path = `${parent.full_path} / ${newName}`;
        updated.depth = parent.depth + 1;
      } else {
        updated.full_path = newName;
        updated.depth = 0;
      }
    } else {
      updated.full_path = newName;
      updated.depth = 0;
    }
  }

  log.info('Updating category', { categoryId, name: updated.name });

  await localDB.updateCategory(categoryId, updated);

  // Trigger sync in background (non-blocking)
  triggerPushSync();

  return {
    ...updated,
    display_path: updated.full_path,
  };
}

/**
 * Delete a category (offline-first)
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  log.info('Deleting category', { categoryId });

  await localDB.deleteCategory(categoryId);

  // Trigger sync in background (non-blocking)
  triggerPushSync();
}
