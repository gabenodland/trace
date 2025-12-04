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
  streamId: string | null;
  streamName: string | null;
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
  initialStreamId?: string | null | "all" | "tasks" | "events" | "streams" | "tags" | "people";
  initialStreamName?: string;
  initialContent?: string;
  initialDate?: string;
  initialLocation?: LocationType;
  captureGpsLocationSetting: boolean;
}

/**
 * Helper to determine initial stream ID
 * Filters out non-stream values like "all", "tasks", "tag:xyz", etc.
 */
function getInitialStreamId(
  isEditing: boolean,
  initialStreamId?: string | null | "all" | "tasks" | "events" | "streams" | "tags" | "people"
): string | null {
  if (isEditing) return null; // Will be loaded from entry

  // For new entries, use initialStreamId if it's a real stream (not a filter)
  if (
    !initialStreamId ||
    typeof initialStreamId !== "string" ||
    initialStreamId === "all" ||
    initialStreamId === "tasks" ||
    initialStreamId === "events" ||
    initialStreamId === "streams" ||
    initialStreamId === "tags" ||
    initialStreamId === "people" ||
    initialStreamId.startsWith("tag:") ||
    initialStreamId.startsWith("mention:") ||
    initialStreamId.startsWith("location:")
  ) {
    return null; // Default to Uncategorized for filters
  }

  return initialStreamId;
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
    initialStreamId,
    initialStreamName,
    initialContent,
    initialDate,
    initialLocation,
    captureGpsLocationSetting,
  } = options;

  // Calculate initial values
  const initialStrId = getInitialStreamId(isEditing, initialStreamId);
  const initialEntryDate = getInitialEntryDate(initialDate);

  // SINGLE STATE OBJECT - per CLAUDE.md pattern
  const [formData, setFormData] = useState<CaptureFormData>({
    title: "",
    content: initialContent || "",
    streamId: initialStrId,
    streamName:
      !isEditing && initialStreamName && initialStrId !== null
        ? initialStreamName
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
      streamId: initialStrId,
      streamName:
        !isEditing && initialStreamName && initialStrId !== null
          ? initialStreamName
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
    initialStrId,
    isEditing,
    initialStreamName,
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
