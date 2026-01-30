/**
 * useAutosave - Debounced autosave hook for EntryScreen
 *
 * Simple event-driven autosave: when onChange fires, we know content changed.
 * Wait for a pause in editing (debounce), then save.
 * - For new entries: only save if there's actual content (title/text/photos)
 * - For existing entries: just save (onChange already told us there's a change)
 *
 * Returns:
 * - onContentChange: call when editor content changes
 * - hasPendingChanges: true when dirty (orange dot), false when clean
 * - markSaveComplete: call after save finishes to clear dirty state (green check)
 */

import { useState, useEffect, useRef, useCallback } from "react";

const DEFAULT_DEBOUNCE_MS = 1500; // Wait 1.5 seconds after last change

export interface UseAutosaveOptions {
  /** Whether the form is in edit mode (can be edited) */
  isEditMode: boolean;
  /** Whether we're editing an existing entry (vs creating new) */
  isEditing: boolean;
  /** Whether the form is fully loaded and ready */
  isFormReady: boolean;
  /** Whether a manual submit is in progress */
  isSubmitting: boolean;
  /** Whether any save (manual or auto) is in progress */
  isSaving: boolean;
  /** Whether the form has actual content worth saving (for new entries only) */
  hasContent: () => boolean;
  /** Callback to trigger the save */
  onSave: () => Promise<void>;
  /** Optional debounce delay in milliseconds (default: 1500) */
  debounceMs?: number;
}

export interface UseAutosaveReturn {
  /** Call this when content changes to trigger debounced save */
  onContentChange: () => void;
  /** True when there are pending changes (show orange dot) */
  hasPendingChanges: boolean;
  /** Call after save completes to clear pending state (triggers green check) */
  markSaveComplete: () => void;
}

/**
 * Manages debounced autosave for the entry screen.
 * Returns callbacks and state for save indicator.
 */
export function useAutosave(options: UseAutosaveOptions): UseAutosaveReturn {
  const {
    isEditMode,
    isEditing,
    isFormReady,
    isSubmitting,
    isSaving,
    hasContent,
    onSave,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options;

  // Track pending changes (dirty state)
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  // Store callbacks in refs to avoid stale closures
  const hasContentRef = useRef(hasContent);
  const onSaveRef = useRef(onSave);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    hasContentRef.current = hasContent;
    onSaveRef.current = onSave;
  }, [hasContent, onSave]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Called after save completes to clear dirty state
  const markSaveComplete = useCallback(() => {
    setHasPendingChanges(false);
  }, []);

  // Called when content changes - starts/resets debounce timer
  const onContentChange = useCallback(() => {
    // Clear existing timer (reset debounce on each keystroke)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Skip if not in edit mode or form not ready
    if (!isEditMode || !isFormReady) {
      return;
    }

    // Mark as dirty immediately (orange dot)
    setHasPendingChanges(true);

    // Start debounce timer
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;

      // Guard: skip if save already in progress
      if (isSubmitting || isSaving) {
        console.log('[Autosave] Skipped: save in progress');
        return;
      }

      // For new entries, require actual content (don't save empty entries)
      if (!isEditing && !hasContentRef.current()) {
        console.log('[Autosave] Skipped: new entry with no content');
        return;
      }

      // onChange fired → content changed → save
      console.log('[Autosave] Saving...');
      onSaveRef.current();
    }, debounceMs);
  }, [isEditMode, isFormReady, isSubmitting, isSaving, isEditing, debounceMs]);

  return { onContentChange, hasPendingChanges, markSaveComplete };
}
