/**
 * useEntryActions - Entry action handlers (delete, pin, archive, copy, move)
 * Shared across EntryListScreen, MapScreen, and CalendarScreen
 */

import { useState } from 'react';
import { Alert } from 'react-native';
import type { Entry } from '@trace/core';
import type { EntryWithRelations } from '../../modules/entries/EntryWithRelationsTypes';
import { startPushAnimation, isPushAnimating } from '../../shared/hooks/useSwipeBackGesture';
import { createScopedLogger, LogScopes } from '../../shared/utils/logger';

const log = createScopedLogger(LogScopes.Entry);

interface EntryMutations {
  updateEntry: (entryId: string, data: Partial<Entry>) => Promise<Entry>;
  deleteEntry: (entryId: string) => Promise<void>;
  archiveEntry: (entryId: string, archived: boolean) => Promise<Entry>;
  copyEntry: (entryId: string) => Promise<string>;
}

interface UseEntryActionsOptions {
  entryMutations: EntryMutations;
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  entries: EntryWithRelations[];
  showSnackbar?: (message: string) => void;
}

export function useEntryActions({ entryMutations, navigate, entries, showSnackbar }: UseEntryActionsOptions) {
  const [showMoveStreamPicker, setShowMoveStreamPicker] = useState(false);
  const [entryToMove, setEntryToMove] = useState<string | null>(null);

  const handleEntryPress = (entryId: string) => {
    // Guard against double-tap during animation window
    if (isPushAnimating()) return;

    // Start slide animation immediately on press (native thread, no JS overhead).
    // Navigate fires 100ms in — the main view is already ~60% off-screen by then
    // (due to ease curve), so any frame drop from React's layout work is less visible.
    // This overlaps React's render pipeline with the tail of the animation,
    // so content appears almost immediately when the animation completes.
    startPushAnimation();
    setTimeout(() => {
      navigate("entryManagement", { entryId });
    }, 100);
  };

  const handleMoveEntry = (entryId: string) => {
    setEntryToMove(entryId);
    setShowMoveStreamPicker(true);
  };

  const handleMoveStreamSelect = async (streamId: string | null, _streamName: string | null) => {
    if (!entryToMove) return;

    try {
      await entryMutations.updateEntry(entryToMove, {
        stream_id: streamId,
      });

      setShowMoveStreamPicker(false);
      setEntryToMove(null);
      showSnackbar?.("Entry moved");
    } catch (error) {
      log.error("Failed to move entry", error);
      Alert.alert("Error", "Failed to move entry");
    }
  };

  const handleCloseMoveStreamPicker = () => {
    setShowMoveStreamPicker(false);
    setEntryToMove(null);
  };

  const handleDeleteEntry = (entryId: string) => {
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await entryMutations.deleteEntry(entryId);
            } catch (error) {
              log.error("Failed to delete entry", error);
              Alert.alert("Error", "Failed to delete entry");
            }
          },
        },
      ]
    );
  };

  const handlePinEntry = async (entryId: string, currentPinned: boolean) => {
    try {
      await entryMutations.updateEntry(entryId, {
        is_pinned: !currentPinned,
      });
      showSnackbar?.(currentPinned ? "Entry unpinned" : "Entry pinned");
    } catch (error) {
      log.error("Failed to pin/unpin entry", error);
      Alert.alert("Error", "Failed to pin/unpin entry");
    }
  };

  const handleArchiveEntry = async (entryId: string, currentArchived: boolean) => {
    try {
      await entryMutations.archiveEntry(entryId, !currentArchived);
      showSnackbar?.(currentArchived ? "Entry unarchived" : "Entry archived");
    } catch (error) {
      log.error("Failed to archive/unarchive entry", error);
      Alert.alert("Error", "Failed to archive/unarchive entry");
    }
  };

  const handleCopyEntry = async (entryId: string) => {
    try {
      const newEntryId = await entryMutations.copyEntry(entryId);
      navigate("entryManagement", { entryId: newEntryId });
    } catch (error) {
      log.error("Failed to copy entry", error);
      Alert.alert("Error", "Failed to copy entry");
    }
  };

  // Get current stream of entry being moved
  const entryToMoveData = entryToMove ? entries.find(e => e.entry_id === entryToMove) : null;
  const entryToMoveStreamId = entryToMoveData?.stream_id || null;

  return {
    // State
    showMoveStreamPicker,
    entryToMoveStreamId,
    // Handlers
    handleEntryPress,
    handleMoveEntry,
    handleMoveStreamSelect,
    handleCloseMoveStreamPicker,
    handleDeleteEntry,
    handlePinEntry,
    handleArchiveEntry,
    handleCopyEntry,
  };
}
