/**
 * Mobile-specific category hooks
 * Uses SQLite local database instead of direct Supabase calls
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCategories,
  getCategoryTree,
  createCategory,
  updateCategory,
  deleteCategory,
} from './mobileCategoryApi';
import type { UpdateCategoryInput, CategoryTree } from '@trace/core';
import * as categoryHelpers from '@trace/core/src/modules/categories/categoryHelpers';

/**
 * Get all child category IDs recursively from a category tree
 */
export function getAllChildCategoryIds(tree: CategoryTree[], categoryId: string): string[] {
  const childIds: string[] = [];

  function traverse(nodes: CategoryTree[]) {
    for (const node of nodes) {
      if (node.category.category_id === categoryId) {
        // Found the target category, collect all its children
        collectChildren(node.children);
        return;
      }
      // Keep searching in children
      traverse(node.children);
    }
  }

  function collectChildren(children: CategoryTree[]) {
    for (const child of children) {
      childIds.push(child.category.category_id);
      collectChildren(child.children);
    }
  }

  traverse(tree);
  return childIds;
}

/**
 * Internal: Query hook for fetching categories from local SQLite
 */
function useCategoriesQuery() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });
}

/**
 * Internal: Query hook for fetching category tree
 */
function useCategoryTreeQuery() {
  return useQuery({
    queryKey: ['categoryTree'],
    queryFn: getCategoryTree,
  });
}

/**
 * Internal: Mutation hook for creating a category (offline-first)
 */
function useCreateCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, parentId, color, icon }: {
      name: string;
      parentId?: string | null;
      color?: string | null;
      icon?: string | null;
    }) => createCategory({ name, parent_category_id: parentId, color, icon }),
    onSuccess: () => {
      // Invalidate queries to trigger refresh
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['categoryTree'] });
      queryClient.invalidateQueries({ queryKey: ['unsyncedCount'] });
    },
  });
}

/**
 * Internal: Mutation hook for updating a category
 */
function useUpdateCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryInput }) =>
      updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['categoryTree'] });
      queryClient.invalidateQueries({ queryKey: ['unsyncedCount'] });
    },
  });
}

/**
 * Internal: Mutation hook for deleting a category
 */
function useDeleteCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['categoryTree'] });
      queryClient.invalidateQueries({ queryKey: ['entries'] }); // Entries may be affected
      queryClient.invalidateQueries({ queryKey: ['unsyncedCount'] });
    },
  });
}

/**
 * SINGLE SOURCE OF TRUTH: Main hook for category operations (mobile version)
 * Uses local SQLite database for offline-first functionality
 */
export function useCategories() {
  const categoriesQuery = useCategoriesQuery();
  const categoryTreeQuery = useCategoryTreeQuery();
  const createMutation = useCreateCategoryMutation();
  const updateMutation = useUpdateCategoryMutation();
  const deleteMutation = useDeleteCategoryMutation();

  return {
    // Data
    categories: categoriesQuery.data || [],
    categoryTree: categoryTreeQuery.data || [],
    isLoading: categoriesQuery.isLoading || categoryTreeQuery.isLoading,
    error: categoriesQuery.error || categoryTreeQuery.error,

    // Mutations (offline-capable)
    categoryMutations: {
      createCategory: async (
        name: string,
        parentId: string | null = null,
        color?: string | null,
        icon?: string | null
      ) => {
        return createMutation.mutateAsync({ name, parentId, color, icon });
      },

      updateCategory: async (id: string, data: UpdateCategoryInput) => {
        return updateMutation.mutateAsync({ id, data });
      },

      deleteCategory: async (id: string) => {
        return deleteMutation.mutateAsync(id);
      },
    },

    // Helpers (pure functions)
    categoryHelpers,
  };
}
