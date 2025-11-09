// Category types for hierarchical organization

export interface Category {
  category_id: string;
  user_id: string;
  name: string;
  full_path: string;
  parent_category_id: string | null;
  depth: number;
  entry_count: number;
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryWithPath extends Category {
  display_path: string; // "House/Furnace/Filter" (capitalized)
}

export interface CategoryTree {
  category: CategoryWithPath;
  children: CategoryTree[];
  entry_count: number;
}

export interface CreateCategoryInput {
  name: string;
  parent_category_id?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  parent_category_id?: string | null;
}
