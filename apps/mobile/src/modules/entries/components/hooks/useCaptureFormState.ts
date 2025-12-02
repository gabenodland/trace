/**
 * useCaptureFormState - Manages form data state for CaptureForm
 *
 * Consolidates 12 individual useState calls into a single formData object
 * per CLAUDE.md Form Component Pattern.
 *
 * This hook ONLY manages state - no side effects, no data fetching.
 */

import { useState, useCallback } from "react";
import type { Location as LocationType } from "@trace/core";

export interface PendingPhoto {
  photoId: string;
  localPath: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  position: number;
}

export interface CaptureFormData {
  title: string;
  content: string;
  categoryId: string | null;
  categoryName: string | null;
  status: "none" | "incomplete" | "in_progress" | "complete";
  dueDate: string | null;
  rating: number;
  priority: number;
  entryDate: string;
  includeTime: boolean;
  captureLocation: boolean;
  locationData: LocationType | null;
  pendingPhotos: PendingPhoto[];
}

interface UseCaptureFormStateOptions {
  isEditing: boolean;
  initialCategoryId?: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "people";
  initialCategoryName?: string;
  initialContent?: string;
  initialDate?: string;
  initialLocation?: LocationType;
  captureGpsLocationSetting: boolean;
}

/**
 * Helper to determine initial category ID
 * Filters out non-category values like "all", "tasks", "tag:xyz", etc.
 */
function getInitialCategoryId(
  isEditing: boolean,
  initialCategoryId?: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "people"
): string | null {
  if (isEditing) return null; // Will be loaded from entry

  // For new entries, use initialCategoryId if it's a real category (not a filter)
  if (
    !initialCategoryId ||
    typeof initialCategoryId !== "string" ||
    initialCategoryId === "all" ||
    initialCategoryId === "tasks" ||
    initialCategoryId === "events" ||
    initialCategoryId === "categories" ||
    initialCategoryId === "tags" ||
    initialCategoryId === "people" ||
    initialCategoryId.startsWith("tag:") ||
    initialCategoryId.startsWith("mention:") ||
    initialCategoryId.startsWith("location:")
  ) {
    return null; // Default to Uncategorized for filters
  }

  return initialCategoryId;
}

/**
 * Helper to calculate initial entry date
 */
function getInitialEntryDate(initialDate?: string): string {
  // If initialDate is provided (from calendar), use it with current time + 100ms to hide time
  if (initialDate) {
    // Parse YYYY-MM-DD in local timezone to avoid UTC conversion issues
    const [year, month, day] = initialDate.split("-").map(Number);
    const selectedDate = new Date(year, month - 1, day); // month is 0-indexed
    const now = new Date();
    // Set the time to current time but on the selected date
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 100); // 100ms to hide time
    return selectedDate.toISOString();
  }

  // Default to current date and time (with 0 milliseconds to show time)
  const now = new Date();
  now.setMilliseconds(0);
  return now.toISOString();
}

export function useCaptureFormState(options: UseCaptureFormStateOptions) {
  const {
    isEditing,
    initialCategoryId,
    initialCategoryName,
    initialContent,
    initialDate,
    initialLocation,
    captureGpsLocationSetting,
  } = options;

  // Calculate initial values
  const initialCatId = getInitialCategoryId(isEditing, initialCategoryId);
  const initialEntryDate = getInitialEntryDate(initialDate);

  // SINGLE STATE OBJECT - per CLAUDE.md pattern
  const [formData, setFormData] = useState<CaptureFormData>({
    title: "",
    content: initialContent || "",
    categoryId: initialCatId,
    categoryName:
      !isEditing && initialCategoryName && initialCatId !== null
        ? initialCategoryName
        : null,
    status: "none",
    dueDate: null,
    rating: 0,
    priority: 0,
    entryDate: initialEntryDate,
    includeTime: !initialDate, // If initialDate provided, hide time initially
    captureLocation: isEditing
      ? !!initialLocation
      : captureGpsLocationSetting,
    locationData: initialLocation || null,
    pendingPhotos: [],
  });

  // Generic update field helper - per CLAUDE.md pattern
  const updateField = useCallback(
    <K extends keyof CaptureFormData>(
      field: K,
      value: CaptureFormData[K]
    ) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Batch update multiple fields at once (for loading from entry)
  const updateMultipleFields = useCallback(
    (updates: Partial<CaptureFormData>) => {
      setFormData((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  // Add a pending photo
  const addPendingPhoto = useCallback((photo: PendingPhoto) => {
    setFormData((prev) => ({
      ...prev,
      pendingPhotos: [...prev.pendingPhotos, photo],
    }));
  }, []);

  // Remove a pending photo by ID
  const removePendingPhoto = useCallback((photoId: string) => {
    setFormData((prev) => ({
      ...prev,
      pendingPhotos: prev.pendingPhotos.filter((p) => p.photoId !== photoId),
    }));
  }, []);

  // Reset form to initial state
  const resetForm = useCallback(() => {
    setFormData({
      title: "",
      content: initialContent || "",
      categoryId: initialCatId,
      categoryName:
        !isEditing && initialCategoryName && initialCatId !== null
          ? initialCategoryName
          : null,
      status: "none",
      dueDate: null,
      rating: 0,
      priority: 0,
      entryDate: initialEntryDate,
      includeTime: !initialDate,
      captureLocation: isEditing
        ? !!initialLocation
        : captureGpsLocationSetting,
      locationData: initialLocation || null,
      pendingPhotos: [],
    });
  }, [
    initialContent,
    initialCatId,
    isEditing,
    initialCategoryName,
    initialDate,
    initialLocation,
    captureGpsLocationSetting,
    initialEntryDate,
  ]);

  return {
    formData,
    updateField,
    updateMultipleFields,
    setFormData,
    resetForm,
    addPendingPhoto,
    removePendingPhoto,
  };
}
