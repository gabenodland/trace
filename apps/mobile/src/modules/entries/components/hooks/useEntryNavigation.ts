/**
 * useEntryNavigation - Manages back navigation with auto-save behavior
 *
 * Handles:
 * - Back button press (handleBack)
 * - Gesture/hardware back interception (beforeBackHandler)
 * - Determines navigation target based on viewMode
 * - Auto-saves dirty changes before navigating
 * - Discards empty new entries without saving
 *
 * Uses EntryFormContext for all state access - no parameters needed.
 */

import { useEffect, useRef, useCallback } from "react";
import { useNavigation } from "../../../../shared/contexts/NavigationContext";
import { useDrawer } from "../../../../shared/contexts/DrawerContext";
import { useEntryForm } from "../context/EntryFormContext";
import { createScopedLogger } from "../../../../shared/utils/logger";

const log = createScopedLogger('EntryNav', '⬅️');

/**
 * Manages back navigation with auto-save behavior.
 */
export function useEntryNavigation() {
  const { navigate, setBeforeBackHandler } = useNavigation();
  const { viewMode } = useDrawer();

  // Get state from context
  const {
    isEditing,
    isEditMode,
    isFormDirty,
    formData,
    editorRef,
    handleSaveRef,
  } = useEntryForm();

  // Store mutable values in refs for stable access in callbacks
  const stateRef = useRef({ isEditMode, isFormDirty, isEditing, formData });
  useEffect(() => {
    stateRef.current = { isEditMode, isFormDirty, isEditing, formData };
  });

  /**
   * Navigate back to the appropriate screen based on viewMode.
   * Maps viewMode to screen name (list→inbox, map→map, calendar→calendar).
   */
  const navigateBack = useCallback(() => {
    const screenMap: Record<string, string> = {
      list: "inbox",
      map: "map",
      calendar: "calendar",
    };
    navigate(screenMap[viewMode] || "inbox");
  }, [viewMode, navigate]);

  /**
   * Check if there are unsaved changes.
   * Also checks editor content directly to handle race condition where user types
   * and quickly hits back before RichTextEditor's polling syncs to formData.
   */
  const hasUnsavedChanges = useCallback((): boolean => {
    const { isEditMode: editMode, isFormDirty: dirty, formData: fd } = stateRef.current;

    log.debug('hasUnsavedChanges checking', { isEditMode: editMode, isFormDirty: dirty });

    // If not in edit mode, no changes are possible
    if (!editMode) {
      log.debug('Not in edit mode, returning false');
      return false;
    }

    // First check the hook's dirty state (covers title, date, stream, etc.)
    if (dirty) {
      log.debug('isFormDirty=true, returning true');
      return true;
    }

    // Also check if editor content differs from formData (race condition fix)
    const editorContent = editorRef.current?.getHTML?.();
    if (typeof editorContent === 'string' && editorContent !== fd.content) {
      log.debug('Editor content differs from formData, returning true');
      return true;
    }

    log.debug('No changes detected, returning false');
    return false;
  }, [editorRef]);

  /**
   * Check if a new entry has actual user content worth saving.
   * Empty metadata (stream, GPS) is not enough - need title, text, or photos.
   */
  const hasUserContent = useCallback((): boolean => {
    const { formData: fd } = stateRef.current;
    const editorContent = editorRef.current?.getHTML?.() ?? fd.content ?? '';

    return (
      fd.title.trim().length > 0 ||
      (typeof editorContent === 'string' && editorContent.replace(/<[^>]*>/g, '').trim().length > 0) ||
      fd.pendingPhotos.length > 0
    );
  }, [editorRef]);

  /**
   * Back button handler - saves if dirty, then navigates.
   * For new entries without user content, discards and navigates immediately.
   */
  const handleBack = useCallback(() => {
    const { isEditing: editing } = stateRef.current;

    log.debug('handleBack called, checking for unsaved changes');

    // For NEW entries: discard if no user content
    if (!editing && !hasUserContent()) {
      log.debug('New entry with no user content, discarding');
      navigateBack();
      return;
    }

    // No unsaved changes: navigate immediately
    if (!hasUnsavedChanges()) {
      log.debug('No unsaved changes, navigating back');
      navigateBack();
      return;
    }

    // Has unsaved changes: save first, then navigate
    log.debug('Has unsaved changes, saving first');
    handleSaveRef.current().then(() => {
      log.debug('Save complete, navigating back');
      navigateBack();
    });
  }, [navigateBack, hasUnsavedChanges, hasUserContent, handleSaveRef]);

  // Register beforeBack handler for gesture/hardware back interception
  useEffect(() => {
    const beforeBackHandler = async (): Promise<boolean> => {
      const { isEditing: editing } = stateRef.current;

      // For NEW entries: discard if no user content
      if (!editing && !hasUserContent()) {
        return true; // Proceed with back, no save
      }

      // Check if there are unsaved changes
      if (!hasUnsavedChanges()) {
        return true; // No changes, proceed with back
      }

      // Auto-save and proceed
      await handleSaveRef.current();
      return true;
    };

    setBeforeBackHandler(beforeBackHandler);

    return () => {
      setBeforeBackHandler(null);
    };
  }, [setBeforeBackHandler, hasUnsavedChanges, hasUserContent, handleSaveRef]);

  return {
    /** Call this when back button is pressed */
    handleBack,
    /** Navigate to previous screen (list/map/calendar based on viewMode) */
    navigateBack,
    /** Check if form has unsaved changes */
    hasUnsavedChanges,
  };
}
