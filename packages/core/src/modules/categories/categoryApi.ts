// Database operations for categories (NOT exported - internal use only)

import { supabase } from "../../shared/supabase";
import {
  Category,
  CategoryWithPath,
  CategoryTree,
  UpdateCategoryInput,
} from "./CategoryTypes";
import { buildDisplayPath, normalizeCategoryName, buildCategoryTree } from "./categoryHelpers";

/**
 * Get all categories for current user with display paths
 */
export async function getCategories(): Promise<CategoryWithPath[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", user.id)
    .order("full_path");

  if (error) throw error;

  const categories = data as Category[];

  // Add display_path to each category
  const categoriesWithPath: CategoryWithPath[] = categories.map((cat) => ({
    ...cat,
    display_path: buildDisplayPath(cat.full_path),
  }));

  return categoriesWithPath;
}

/**
 * Get category tree (already built from database entry_count field)
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

/**
 * Find or create category by path (e.g., "house/furnace/filter")
 * Returns the ID of the final leaf category
 */
export async function findOrCreateCategoryByPath(path: string): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const normalizedPath = path
    .split("/")
    .map((s) => normalizeCategoryName(s))
    .filter((s) => s.length > 0)
    .join("/");

  if (!normalizedPath) {
    throw new Error("Invalid category path");
  }

  // Check if category with this full path already exists
  const { data: existing, error: searchError } = await supabase
    .from("categories")
    .select("category_id")
    .eq("user_id", user.id)
    .eq("full_path", normalizedPath)
    .maybeSingle();

  if (searchError) throw searchError;

  if (existing) {
    return existing.category_id;
  }

  // Need to create the path - split and create each segment
  const segments = normalizedPath.split("/");
  let currentParentId: string | null = null;
  let currentPath = "";
  let currentDepth = 0;

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    currentDepth++;

    // Check if this level exists
    const { data: levelExists } = await supabase
      .from("categories")
      .select("category_id")
      .eq("user_id", user.id)
      .eq("full_path", currentPath)
      .maybeSingle();

    if (levelExists) {
      currentParentId = levelExists.category_id;
    } else {
      // Create this level - store current parent before creating
      const parentToUse: string | null = currentParentId;
      const catResponse: any = await supabase
        .from("categories")
        .insert({
          user_id: user.id,
          name: segment,
          full_path: currentPath,
          parent_category_id: parentToUse,
          depth: currentDepth,
        })
        .select("category_id")
        .single();

      if (catResponse.error) throw catResponse.error;
      if (!catResponse.data) throw new Error("Failed to create category");
      currentParentId = catResponse.data.category_id;
    }
  }

  if (!currentParentId) throw new Error("Failed to create category");
  return currentParentId;
}

/**
 * Create a new category
 */
export async function createCategory(
  name: string,
  parentId: string | null = null
): Promise<Category> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const normalizedName = normalizeCategoryName(name);

  // Build full path
  let fullPath = normalizedName;
  let depth = 1;

  if (parentId) {
    const { data: parent } = await supabase
      .from("categories")
      .select("full_path, depth")
      .eq("category_id", parentId)
      .single();

    if (parent) {
      fullPath = `${parent.full_path}/${normalizedName}`;
      depth = parent.depth + 1;
    }
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from("categories")
    .select("category_id")
    .eq("user_id", user.id)
    .eq("full_path", fullPath)
    .maybeSingle();

  if (existing) {
    throw new Error("Category with this name already exists at this level");
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      user_id: user.id,
      name: normalizedName,
      full_path: fullPath,
      parent_category_id: parentId,
      depth,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Category;
}

/**
 * Update a category
 */
export async function updateCategory(
  id: string,
  updates: UpdateCategoryInput
): Promise<Category> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const updateData: Partial<Category> = {};

  if (updates.name !== undefined) {
    updateData.name = normalizeCategoryName(updates.name);
    // Note: Updating name requires updating full_path for this and all children
    // This is complex - for MVP, we'll just update the name
    // TODO: Implement full path update cascade
  }

  if (updates.parent_category_id !== undefined) {
    updateData.parent_category_id = updates.parent_category_id;
    // Note: Moving to different parent requires updating full_path and depth
    // This is complex - for MVP, we'll skip this
    // TODO: Implement parent move with full path update
  }

  const { data, error } = await supabase
    .from("categories")
    .update(updateData)
    .eq("category_id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data as Category;
}

/**
 * Delete a category (optionally reassign entries to another category)
 */
export async function deleteCategory(
  id: string,
  reassignToId?: string
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Check if category has children
  const { data: children } = await supabase
    .from("categories")
    .select("category_id")
    .eq("parent_category_id", id)
    .limit(1);

  if (children && children.length > 0) {
    throw new Error("Cannot delete category with subcategories");
  }

  // Reassign or nullify entries
  if (reassignToId !== undefined) {
    const { error: updateError } = await supabase
      .from("entries")
      .update({ category_id: reassignToId })
      .eq("category_id", id)
      .eq("user_id", user.id);

    if (updateError) throw updateError;
  } else {
    // Move entries to Inbox (null category)
    const { error: updateError } = await supabase
      .from("entries")
      .update({ category_id: null })
      .eq("category_id", id)
      .eq("user_id", user.id);

    if (updateError) throw updateError;
  }

  // Delete the category
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("category_id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}
