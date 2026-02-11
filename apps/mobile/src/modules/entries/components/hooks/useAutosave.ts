/**
 * @deprecated This hook uses EntryFormContext which is being replaced.
 * Do not use for new code. Will be deleted once EntryScreen.tsx is removed.
 *
 * For EntryManagementScreen, autosave logic is in useEntryManagement.ts
 * using refs pattern instead of Context.
 *
 * ---
 * Original description:
 * useAutosave - Debounced autosave hook for EntryScreen
 *
 * Handles automatic saving of entries after a configurable delay.
 * - For new entries: creates the entry and transitions to "editing" mode
 * - For existing entries: updates the entry
 *
 * Two timers work together:
 * 1. Debounce timer (2s default): Resets on every keystroke, fires after pause
 * 2. Max wait timer (30s default): Forces save even during continuous typing
 *
 * Uses EntryFormContext for all state access.
 */

import { useEffect, useRef, useMemo, useCallback } from "react";
import { useEntryForm } from "../context/EntryFormContext";

const DEFAULT_AUTOSAVE_DELAY_MS = 2000;
const DEFAULT_MAX_WAIT_MS = 30000; // Force save after 30 seconds of continuous typing

export interface UseAutosaveOptions {
  /** Optional debounce delay in milliseconds (default: 2000) */
  delayMs?: number;
  /** Optional max wait before forced save in milliseconds (default: 30000) */
  maxWaitMs?: number;
}

/**
 * Manages autosave with debouncing for the entry screen.
 * Calls onSave after the specified delay when conditions are met.
 *
 * Uses two timers:
 * 1. Debounce timer: Resets on every keystroke, fires 2s after last change
 * 2. Max wait timer: Forces save after 30s even during continuous typing
 */
export function useAutosave(options: UseAutosaveOptions = {}): void {
  const { delayMs = DEFAULT_AUTOSAVE_DELAY_MS, maxWaitMs = DEFAULT_MAX_WAIT_MS } = options;

  // Get state from context
  const {
    isEditing,
    isFormDirty,
    isSubmitting,
    isSaving,
    formData,
    handleAutosaveRef,
  } = useEntryForm();

  // Compute hasContent from formData
  const hasContent = useMemo(() =>
    formData.title.trim() !== '' ||
    formData.content.replace(/<[^>]*>/g, '').trim() !== '' ||
    formData.pendingPhotos.length > 0,
    [formData.title, formData.content, formData.pendingPhotos.length]
  );

  // Stable callback for autosave
  const stableOnSave = useCallback(async () => {
    await handleAutosaveRef.current();
  }, [handleAutosaveRef]);

  // Debounce timer - resets on every keystroke
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Max wait timer - doesn't reset, forces save after maxWaitMs
  const maxWaitTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Track if max wait timer is active (prevents re-starting)
  const maxWaitActiveRef = useRef(false);

  // Track content changes for debounce - these change on every keystroke
  const contentForDebounce = formData.title + formData.content;

  // Clear all timers helper
  const clearAllTimers = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (maxWaitTimerRef.current) {
      clearTimeout(maxWaitTimerRef.current);
      maxWaitTimerRef.current = null;
    }
    maxWaitActiveRef.current = false;
  }, []);

  useEffect(() => {
    // Autosave conditions:
    // 1. Form is dirty (has changes compared to baseline - also false when loading since baseline is null)
    // 2. Not currently submitting or saving (prevents re-entry during save)
    // 3. Either editing existing entry OR new entry with actual content
    // Note: isEditMode is NOT required - attribute changes in view mode should also save
    const shouldAutosave = isFormDirty && !isSubmitting && !isSaving && (isEditing || hasContent);

    if (!shouldAutosave) {
      // Clear all timers if conditions no longer met
      clearAllTimers();
      return;
    }

    // Clear debounce timer (resets on every content change)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set debounce timer - resets on every keystroke
    debounceTimerRef.current = setTimeout(() => {
      stableOnSave();
      // Clear max wait timer since we just saved
      if (maxWaitTimerRef.current) {
        clearTimeout(maxWaitTimerRef.current);
        maxWaitTimerRef.current = null;
      }
      maxWaitActiveRef.current = false;
    }, delayMs);

    // Start max wait timer if not already running
    // This timer does NOT reset on keystrokes - it's a hard limit
    if (!maxWaitActiveRef.current) {
      maxWaitActiveRef.current = true;
      maxWaitTimerRef.current = setTimeout(() => {
        // Force save after max wait, regardless of typing
        stableOnSave();
        // Clear debounce timer since we just saved
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        maxWaitActiveRef.current = false;
      }, maxWaitMs);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // Note: Don't clear max wait timer on content change - that's the point
    };
  }, [isEditing, isFormDirty, isSubmitting, isSaving, hasContent, contentForDebounce, stableOnSave, delayMs, maxWaitMs, clearAllTimers]);

  // Cleanup max wait timer on unmount
  useEffect(() => {
    return () => {
      if (maxWaitTimerRef.current) {
        clearTimeout(maxWaitTimerRef.current);
        maxWaitTimerRef.current = null;
      }
    };
  }, []);
}
