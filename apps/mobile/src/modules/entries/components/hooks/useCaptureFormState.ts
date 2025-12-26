/**
 * useCaptureFormState - Manages form data state for CaptureForm
 *
 * Consolidates 12 individual useState calls into a single formData object
 * per CLAUDE.md Form Component Pattern.
 *
 * This hook ONLY manages state - no side effects, no data fetching.
 */

import { useState, useCallback, useRef, useMemo } from "react";
import type { Location as LocationType, EntryStatus } from "@trace/core";

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

/** GPS coordinates captured at entry creation time */
export interface GpsData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export interface CaptureFormData {
  title: string;
  content: string;
  streamId: string | null;
  streamName: string | null;
  status: EntryStatus;
  type: string | null;
  dueDate: string | null;
  rating: number;
  priority: number;
  entryDate: string;
  includeTime: boolean;
  /** GPS coordinates - where the entry was created (device location) */
  gpsData: GpsData | null;
  /** Named location - where the entry "lives" in the world */
  locationData: LocationType | null;
  pendingPhotos: PendingPhoto[];
}

interface UseCaptureFormStateOptions {
  isEditing: boolean;
  initialStreamId?: string | null | "all" | "events" | "streams" | "tags" | "people";
  initialStreamName?: string;
  initialContent?: string;
  initialDate?: string;
  /** Whether to auto-capture GPS on new entries */
  captureGpsSetting: boolean;
}

/**
 * Helper to determine initial stream ID
 * Filters out non-stream values like "all", "tag:xyz", etc.
 */
function getInitialStreamId(
  isEditing: boolean,
  initialStreamId?: string | null | "all" | "events" | "streams" | "tags" | "people"
): string | null {
  if (isEditing) return null; // Will be loaded from entry

  // For new entries, use initialStreamId if it's a real stream (not a filter)
  if (
    !initialStreamId ||
    typeof initialStreamId !== "string" ||
    initialStreamId === "all" ||
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
 * Compare two ISO date strings by their actual timestamp value.
 * Handles format differences like ".000Z" vs "+00:00" which represent the same moment.
 */
function areDatesEqual(date1: string | null, date2: string | null): boolean {
  if (date1 === date2) return true;
  if (!date1 || !date2) return false;
  // Compare as timestamps to ignore format differences
  return new Date(date1).getTime() === new Date(date2).getTime();
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
    captureGpsSetting,
  } = options;

  // Calculate initial values
  const initialStrId = getInitialStreamId(isEditing, initialStreamId);
  const initialEntryDate = getInitialEntryDate(initialDate);

  // SINGLE STATE OBJECT - per CLAUDE.md pattern
  // GPS: auto-captured on new entries if setting enabled (will be populated by CaptureForm)
  // Location: never auto-set, user must explicitly add
  const [formData, setFormData] = useState<CaptureFormData>({
    title: "",
    content: initialContent || "",
    streamId: initialStrId,
    streamName:
      !isEditing && initialStreamName && initialStrId !== null
        ? initialStreamName
        : null,
    status: "none",
    type: null,
    dueDate: null,
    rating: 0,
    priority: 0,
    entryDate: initialEntryDate,
    includeTime: !initialDate, // If initialDate provided, hide time initially
    gpsData: null, // GPS will be captured by CaptureForm if setting enabled
    locationData: null, // Location is never auto-set
    pendingPhotos: [],
  });

  // Baseline for dirty tracking - stores the "clean" state after load or save
  // We use a ref to avoid re-renders when setting baseline
  const baselineRef = useRef<CaptureFormData | null>(null);
  // Counter to force isDirty to re-compute when baseline changes
  // (refs don't trigger re-renders, so we need this for useMemo dependency)
  const [baselineVersion, setBaselineVersion] = useState(0);

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
      type: null,
      dueDate: null,
      rating: 0,
      priority: 0,
      entryDate: initialEntryDate,
      includeTime: !initialDate,
      gpsData: null, // GPS will be re-captured by CaptureForm if setting enabled
      locationData: null,
      pendingPhotos: [],
    });
    baselineRef.current = null;
  }, [
    initialContent,
    initialStrId,
    isEditing,
    initialStreamName,
    initialDate,
    initialEntryDate,
  ]);

  // Set the baseline (called when entry is loaded or after save)
  const setBaseline = useCallback((data: CaptureFormData) => {
    // Deep clone to avoid reference issues
    baselineRef.current = JSON.parse(JSON.stringify(data));
    // Increment version to force isDirty useMemo to re-compute
    setBaselineVersion(v => v + 1);
    console.log('🧹 [setBaseline] Baseline set:', {
      title: data.title?.substring(0, 20),
      contentLen: data.content?.length,
      streamId: data.streamId?.substring(0, 8),
    });
  }, []);

  // Mark current state as clean (call after successful save)
  const markClean = useCallback(() => {
    baselineRef.current = JSON.parse(JSON.stringify(formData));
    // Increment version to force isDirty useMemo to re-compute
    setBaselineVersion(v => v + 1);
  }, [formData]);

  // Compute isDirty by comparing formData to baseline
  const isDirty = useMemo(() => {
    // No baseline set yet
    if (!baselineRef.current) {
      // If editing, baseline is still loading - not dirty
      if (isEditing) {
        console.log('🧹 [isDirty] No baseline + editing = false');
        return false;
      }
      // For new entries, consider dirty if there's any content
      const dirty = formData.title.trim() !== "" ||
             formData.content.trim() !== "" ||
             formData.pendingPhotos.length > 0;
      console.log('🧹 [isDirty] No baseline + new entry =', dirty);
      return dirty;
    }

    const baseline = baselineRef.current;

    // Compare relevant fields (excluding includeTime as it's UI-only)
    const changes = {
      title: formData.title !== baseline.title,
      content: formData.content !== baseline.content,
      streamId: formData.streamId !== baseline.streamId,
      status: formData.status !== baseline.status,
      type: formData.type !== baseline.type,
      dueDate: !areDatesEqual(formData.dueDate, baseline.dueDate),
      rating: formData.rating !== baseline.rating,
      priority: formData.priority !== baseline.priority,
      entryDate: !areDatesEqual(formData.entryDate, baseline.entryDate),
      gpsData: JSON.stringify(formData.gpsData) !== JSON.stringify(baseline.gpsData),
      locationData: (formData.locationData?.location_id || null) !== (baseline.locationData?.location_id || null),
      pendingPhotos: formData.pendingPhotos.length !== baseline.pendingPhotos.length,
    };

    const isDirtyResult = Object.values(changes).some(v => v);

    // Only log when something changed to reduce noise
    if (isDirtyResult) {
      const changedFields = Object.entries(changes).filter(([_, v]) => v).map(([k]) => k);
      console.log('🧹 [isDirty] DIRTY! Changed fields:', changedFields.join(', '));
    }

    return isDirtyResult;
  }, [formData, baselineVersion, isEditing]);

  return {
    formData,
    updateField,
    updateMultipleFields,
    setFormData,
    resetForm,
    addPendingPhoto,
    removePendingPhoto,
    // Dirty tracking
    isDirty,
    setBaseline,
    markClean,
  };
}
