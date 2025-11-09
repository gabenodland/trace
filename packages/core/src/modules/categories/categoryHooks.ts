// React Query hooks for category operations

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCategories,
  getCategoryTree,
  createCategory,
  findOrCreateCategoryByPath,
  updateCategory,
  deleteCategory,
} from "./categoryApi";
import * as categoryHelpers from "./categoryHelpers";
import { UpdateCategoryInput } from "./CategoryTypes";

/**
 * Internal: Query hook for fetching categories
 */
function useCategoriesQuery() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });
}

/**
 * Internal: Query hook for fetching category tree
 */
function useCategoryTreeQuery() {
  return useQuery({
    queryKey: ["categoryTree"],
    queryFn: getCategoryTree,
  });
}

/**
 * Internal: Mutation hook for creating a category
 */
function useCreateCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: string | null }) =>
      createCategory(name, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categoryTree"] });
    },
  });
}

/**
 * Internal: Mutation hook for finding or creating category by path
 */
function useFindOrCreateByPathMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: findOrCreateCategoryByPath,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categoryTree"] });
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
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categoryTree"] });
    },
  });
}

/**
 * Internal: Mutation hook for deleting a category
 */
function useDeleteCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reassignToId }: { id: string; reassignToId?: string }) =>
      deleteCategory(id, reassignToId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categoryTree"] });
      queryClient.invalidateQueries({ queryKey: ["entries"] }); // Entries may be affected
    },
  });
}

/**
 * SINGLE SOURCE OF TRUTH: Main hook for category operations
 *
 * Use this hook in components to access category data and operations.
 * DO NOT use the internal query/mutation hooks directly.
 */
export function useCategories() {
  const categoriesQuery = useCategoriesQuery();
  const categoryTreeQuery = useCategoryTreeQuery();
  const createMutation = useCreateCategoryMutation();
  const findOrCreateMutation = useFindOrCreateByPathMutation();
  const updateMutation = useUpdateCategoryMutation();
  const deleteMutation = useDeleteCategoryMutation();

  return {
    // Data
    categories: categoriesQuery.data || [],
    categoryTree: categoryTreeQuery.data || [],
    isLoading: categoriesQuery.isLoading || categoryTreeQuery.isLoading,
    error: categoriesQuery.error || categoryTreeQuery.error,

    // Mutations
    categoryMutations: {
      createCategory: async (name: string, parentId: string | null = null) => {
        return createMutation.mutateAsync({ name, parentId });
      },

      findOrCreateByPath: async (path: string) => {
        return findOrCreateMutation.mutateAsync(path);
      },

      updateCategory: async (id: string, data: UpdateCategoryInput) => {
        return updateMutation.mutateAsync({ id, data });
      },

      deleteCategory: async (id: string, reassignToId?: string) => {
        return deleteMutation.mutateAsync({ id, reassignToId });
      },
    },

    // Helpers (pure functions)
    categoryHelpers,
  };
}
