/**
 * usePhotoTracking - External photo detection for EntryScreen
 *
 * Handles:
 * - Tracking photo count for new photo ordering
 * - Detecting external photo additions/deletions (from sync)
 * - Force-refreshing PhotoGallery when external changes detected
 *
 * Does NOT handle:
 * - baselinePhotoCount (needed for dirty tracking in parent)
 * - Photo selection handlers (need form context)
 */

import { useState, useEffect, useRef, useCallback } from "react";

export interface UsePhotoTrackingOptions {
  /** Entry ID being edited */
  entryId: string | null;
  /** Whether we're editing an existing entry */
  isEditing: boolean;
  /** Whether the form is fully loaded and ready */
  isFormReady: boolean;
  /** Baseline photo count (for gating external detection) */
  baselinePhotoCount: number | null;
  /** Current photo count from query */
  queryPhotoCount: number;
}

export interface UsePhotoTrackingReturn {
  /** Current photo count (for ordering new photos) */
  photoCount: number;
  /** Update photo count (e.g., after adding photo) */
  setPhotoCount: (count: number | ((prev: number) => number)) => void;
  /** Key to force PhotoGallery refresh on external changes */
  externalRefreshKey: number;
  /** Sync photo count with query (for baseline initialization) */
  syncPhotoCount: (count: number) => void;
}

/**
 * Manages photo tracking and external change detection for the entry screen.
 */
export function usePhotoTracking(options: UsePhotoTrackingOptions): UsePhotoTrackingReturn {
  const {
    entryId,
    isEditing,
    isFormReady,
    baselinePhotoCount,
    queryPhotoCount,
  } = options;

  // Photo count state - used for ordering new photos
  const [photoCount, setPhotoCount] = useState(0);

  // Key to force PhotoGallery to reload when external changes detected
  const [externalRefreshKey, setExternalRefreshKey] = useState(0);

  // Track known photo count for external detection
  const knownPhotoCountRef = useRef<number | null>(null);

  // Sync photo count with provided value (used during baseline init)
  const syncPhotoCount = useCallback((count: number) => {
    setPhotoCount(count);
  }, []);

  // External photo detection effect
  // IMPORTANT: Only detect external changes AFTER:
  // 1. Form is ready (baseline set)
  // 2. baselinePhotoCount has been established (ensures we're past initial load)
  // Otherwise we treat initial data load as "external" and mark form dirty
  useEffect(() => {
    // Gate: Must be editing, form ready, AND baseline photo count established
    if (!isEditing || !entryId || !isFormReady || baselinePhotoCount === null) return;

    // First time this effect runs after all gates pass - initialize known count
    if (knownPhotoCountRef.current === null) {
      knownPhotoCountRef.current = queryPhotoCount;
      return;
    }

    // Photo count changed externally - update state and trigger refresh
    if (queryPhotoCount !== knownPhotoCountRef.current) {
      knownPhotoCountRef.current = queryPhotoCount;
      setExternalRefreshKey(prev => prev + 1);
      setPhotoCount(queryPhotoCount);
    }
  }, [queryPhotoCount, isEditing, entryId, isFormReady, baselinePhotoCount]);

  return {
    photoCount,
    setPhotoCount,
    externalRefreshKey,
    syncPhotoCount,
  };
}
