/**
 * useAutosave - Debounced autosave hook for EntryScreen
 *
 * Handles automatic saving of entries after a configurable delay.
 * - For new entries: creates the entry and transitions to "editing" mode
 * - For existing entries: updates the entry
 */

import { useEffect, useRef } from "react";

const DEFAULT_AUTOSAVE_DELAY_MS = 2000;

export interface UseAutosaveOptions {
  /** Whether the form is in edit mode (can be edited) */
  isEditMode: boolean;
  /** Whether we're editing an existing entry (vs creating new) */
  isEditing: boolean;
  /** Whether the form has unsaved changes */
  isFormDirty: boolean;
  /** Whether the form is fully loaded and ready */
  isFormReady: boolean;
  /** Whether a manual submit is in progress */
  isSubmitting: boolean;
  /** Whether any save (manual or auto) is in progress */
  isSaving: boolean;
  /** Whether the form has actual content worth saving (for new entries) */
  hasContent: boolean;
  /** Callback to trigger the save */
  onSave: () => Promise<void>;
  /** Optional delay in milliseconds (default: 2000) */
  delayMs?: number;
}

/**
 * Manages autosave with debouncing for the entry screen.
 * Calls onSave after the specified delay when conditions are met.
 */
export function useAutosave(options: UseAutosaveOptions): void {
  const {
    isEditMode,
    isEditing,
    isFormDirty,
    isFormReady,
    isSubmitting,
    isSaving,
    hasContent,
    onSave,
    delayMs = DEFAULT_AUTOSAVE_DELAY_MS,
  } = options;

  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Autosave conditions:
    // 1. Form is dirty
    // 2. In edit mode
    // 3. Form is fully loaded (prevents autosave during sync reload)
    // 4. Not currently submitting or saving (prevents re-entry during save)
    // 5. Either editing existing entry OR new entry with actual content
    const shouldAutosave = isFormDirty && isEditMode && isFormReady && !isSubmitting && !isSaving && (isEditing || hasContent);

    if (!shouldAutosave) {
      // Clear any pending autosave if conditions no longer met
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      return;
    }

    // Clear previous timer (debounce reset)
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Set new timer
    autosaveTimerRef.current = setTimeout(() => {
      onSave();
    }, delayMs);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [isEditing, isFormDirty, isEditMode, isFormReady, isSubmitting, isSaving, hasContent, onSave, delayMs]);
}
