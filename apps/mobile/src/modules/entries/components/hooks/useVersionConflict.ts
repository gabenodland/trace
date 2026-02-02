/**
 * useVersionConflict - Version tracking for conflict detection
 *
 * Handles:
 * - Tracking known version to detect external updates
 * - Checking for conflicts before save
 * - Managing version updates after successful saves
 *
 * Does NOT handle:
 * - Form updates on external change (needs form context)
 * - Conflict resolution UI (handled in save flow)
 */

import { useRef, useCallback } from "react";
import { getDeviceName } from "../../../../shared/utils/deviceUtils";
import type { Entry } from "@trace/core";

export interface UseVersionConflictOptions {
  /** Whether we're editing an existing entry */
  isEditing: boolean;
}

export interface ConflictCheckResult {
  /** Whether there's a conflict */
  hasConflict: boolean;
  /** Device that made the conflicting edit */
  conflictDevice: string | null;
  /** Current version from entry */
  currentVersion: number;
  /** Our known version (what we loaded) */
  baseVersion: number;
}

export interface UseVersionConflictReturn {
  /** Get the current known version */
  getKnownVersion: () => number | null;
  /** Initialize known version (on first load) */
  initializeVersion: (version: number) => void;
  /** Update known version (after detecting external update) */
  updateKnownVersion: (version: number) => void;
  /** Increment known version (after successful save) */
  incrementKnownVersion: () => void;
  /** Check if entry has conflict with our known version */
  checkForConflict: (entry: Entry | null) => ConflictCheckResult | null;
  /** Check if version change is from external device */
  isExternalUpdate: (entry: Entry | null) => { isExternal: boolean; device: string; thisDevice: string } | null;
}

/**
 * Manages version tracking for conflict detection in EntryScreen.
 */
export function useVersionConflict(options: UseVersionConflictOptions): UseVersionConflictReturn {
  const { isEditing } = options;

  // Track known version to detect external updates
  const knownVersionRef = useRef<number | null>(null);

  const getKnownVersion = useCallback(() => {
    return knownVersionRef.current;
  }, []);

  const initializeVersion = useCallback((version: number) => {
    if (knownVersionRef.current === null) {
      knownVersionRef.current = version;
    }
  }, []);

  const updateKnownVersion = useCallback((version: number) => {
    knownVersionRef.current = version;
  }, []);

  const incrementKnownVersion = useCallback(() => {
    if (knownVersionRef.current !== null) {
      knownVersionRef.current = knownVersionRef.current + 1;
    }
  }, []);

  const checkForConflict = useCallback((entry: Entry | null): ConflictCheckResult | null => {
    if (!isEditing || !entry || knownVersionRef.current === null) {
      return null;
    }

    const currentVersion = entry.version || 1;
    const baseVersion = knownVersionRef.current;

    if (currentVersion > baseVersion) {
      const lastDevice = entry.last_edited_device || 'another device';
      return {
        hasConflict: true,
        conflictDevice: lastDevice,
        currentVersion,
        baseVersion,
      };
    }

    return {
      hasConflict: false,
      conflictDevice: null,
      currentVersion,
      baseVersion,
    };
  }, [isEditing]);

  const isExternalUpdate = useCallback((entry: Entry | null): { isExternal: boolean; device: string; thisDevice: string } | null => {
    if (!entry) return null;

    // Defensive check: ensure getDeviceName is defined (debugging release build issue)
    let thisDevice = 'Unknown Device';
    try {
      if (typeof getDeviceName === 'function') {
        thisDevice = getDeviceName();
      } else {
        console.error('🚨 [useVersionConflict] getDeviceName is not a function:', typeof getDeviceName);
      }
    } catch (err) {
      console.error('🚨 [useVersionConflict] getDeviceName threw:', err);
    }
    const editingDevice = entry.last_edited_device || '';

    return {
      isExternal: editingDevice !== thisDevice,
      device: editingDevice,
      thisDevice,
    };
  }, []);

  return {
    getKnownVersion,
    initializeVersion,
    updateKnownVersion,
    incrementKnownVersion,
    checkForConflict,
    isExternalUpdate,
  };
}
