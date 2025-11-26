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

  // Template fields for auto-populating new entries
  entry_title_template?: string | null;
  entry_content_template?: string | null;

  // Feature toggles - enable/disable features per category
  entry_use_rating?: boolean;
  entry_use_priority?: boolean;
  entry_use_status?: boolean;
  entry_use_duedates?: boolean;
  entry_use_location?: boolean;
  entry_use_photos?: boolean;
  entry_content_type?: string; // 'text' | 'list' | 'richformat' | 'bullet'

  // Privacy and sync controls
  is_private?: boolean;
  is_localonly?: boolean;
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

  // Template fields
  entry_title_template?: string | null;
  entry_content_template?: string | null;

  // Feature toggles
  entry_use_rating?: boolean;
  entry_use_priority?: boolean;
  entry_use_status?: boolean;
  entry_use_duedates?: boolean;
  entry_use_location?: boolean;
  entry_use_photos?: boolean;
  entry_content_type?: string;

  // Privacy and sync controls
  is_private?: boolean;
  is_localonly?: boolean;
}
