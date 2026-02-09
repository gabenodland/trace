/**
 * useEntryActions - Entry action handlers (delete, pin, archive, copy, move)
 * Extracts action handlers from EntryListScreen
 */

import { useState } from 'react';
import { Alert } from 'react-native';
import type { Entry } from '@trace/core';
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
  entries: Entry[];
}

export function useEntryActions({ entryMutations, navigate, entries }: UseEntryActionsOptions) {
  const [showMoveStreamPicker, setShowMoveStreamPicker] = useState(false);
  const [entryToMove, setEntryToMove] = useState<string | null>(null);

  const handleEntryPress = (entryId: string) => {
    // Navigate to new EntryManagementScreen for viewing entry as JSON
    // App.tsx will call entryManagementRef.setEntry(entryId)
    navigate("entryManagement", { entryId });
  };

  const handleMoveEntry = (entryId: string) => {
    setEntryToMove(entryId);
    setShowMoveStreamPicker(true);
  };

  const handleMoveStreamSelect = async (streamId: string | null) => {
    if (!entryToMove) return;

    try {
      await entryMutations.updateEntry(entryToMove, {
        stream_id: streamId,
      });

      setShowMoveStreamPicker(false);
      setEntryToMove(null);
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
    } catch (error) {
      log.error("Failed to pin/unpin entry", error);
      Alert.alert("Error", "Failed to pin/unpin entry");
    }
  };

  const handleArchiveEntry = async (entryId: string, currentArchived: boolean) => {
    try {
      await entryMutations.archiveEntry(entryId, !currentArchived);
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
