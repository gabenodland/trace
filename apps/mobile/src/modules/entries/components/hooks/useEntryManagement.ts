/**
 * useEntryManagement - Unified hook for entry save, autosave, and sync
 *
 * Handles:
 * - Save logic (create/update with attachment path swap)
 * - Version tracking for conflict detection
 * - Dual-timer autosave (2s debounce + 30s max wait)
 * - External sync update detection from other devices
 *
 * Uses props pattern (NOT Context) per CLAUDE.md architecture.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { splitTitleAndBody, combineTitleAndBody, type Entry } from '@trace/core';
import { createEntry, updateEntry } from '../../mobileEntryApi';
import { useEntry } from '../../mobileEntryHooks';
import { createAttachment } from '../../../attachments/mobileAttachmentApi';
import {
  buildGpsFields,
  buildLocationHierarchyFields,
  getLocationId,
  extractContentMetadata,
  hasUserContent,
} from '../helpers/entrySaveHelpers';
import { buildLocationFromEntry } from '../helpers/entryLocationHelpers';
import { useAuth } from '../../../../shared/contexts/AuthContext';
import { getDeviceName } from '../../../../shared/utils/deviceUtils';
import { createScopedLogger } from '../../../../shared/utils/logger';
import type { EntryWithRelations } from '../../EntryWithRelationsTypes';
import type { RichTextEditorV2Ref } from '../../../../components/editor/RichTextEditorV2';

const log = createScopedLogger('EntryManagement', '💾');

// Autosave timings
const AUTOSAVE_DEBOUNCE_MS = 2000;   // Wait 2s after last change before saving
const AUTOSAVE_MAX_WAIT_MS = 30000;  // Force save after 30s of continuous editing

interface UseEntryManagementProps {
  entry: EntryWithRelations | null;
  setEntry: React.Dispatch<React.SetStateAction<EntryWithRelations | null>>;
  setOriginalEntry: React.Dispatch<React.SetStateAction<EntryWithRelations | null>>;
  entryId: string | null;
  isNewEntry: boolean;
  setIsNewEntry: React.Dispatch<React.SetStateAction<boolean>>;
  isDirty: boolean;
  editorRef: React.RefObject<RichTextEditorV2Ref | null>;
  showSnackbar: (message: string) => void;
  exitEditMode: () => void;
}

interface SaveResult {
  success: boolean;
  entryId?: string;
  error?: string;
}

/**
 * Check if an entry update is from another device
 */
function isExternalUpdate(entry: Entry | null): { isExternal: boolean; device: string } | null {
  if (!entry) return null;

  let thisDevice = 'Unknown Device';
  try {
    thisDevice = getDeviceName();
  } catch (err) {
    log.error('getDeviceName threw', err);
  }

  const editingDevice = entry.last_edited_device || '';

  return {
    isExternal: editingDevice !== thisDevice && editingDevice !== '',
    device: editingDevice || 'another device',
  };
}

/**
 * Unified hook for entry management (save, autosave, sync)
 */
export function useEntryManagement({
  entry,
  setEntry,
  setOriginalEntry,
  entryId,
  isNewEntry,
  setIsNewEntry,
  isDirty,
  editorRef,
  showSnackbar,
  exitEditMode,
}: UseEntryManagementProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // === Save State ===
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false); // Synchronous guard — React state is batched and can't prevent concurrent saves
  const [isSubmitting, setIsSubmitting] = useState(false);
  const entryRef = useRef(entry); // Always-current entry — avoids stale closure in timer callbacks
  entryRef.current = entry;

  // === Version Tracking ===
  const knownVersionRef = useRef<number | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  // === Autosave Timers ===
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxWaitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxWaitActiveRef = useRef(false);

  // === Subscribe to React Query cache for sync updates ===
  const { entry: cachedEntry } = useEntry(isNewEntry ? null : entryId);

  // === Version Management ===
  const initializeVersion = useCallback((version: number) => {
    if (knownVersionRef.current === null) {
      knownVersionRef.current = version;
      log.debug('Initialized version tracking', { version });
    }
  }, []);

  const recordSaveTime = useCallback(() => {
    lastSaveTimeRef.current = Date.now();
  }, []);

  // Initialize version when entry loads
  useEffect(() => {
    if (entry && knownVersionRef.current === null) {
      knownVersionRef.current = entry.version || 1;
      log.debug('Auto-initialized version', { version: knownVersionRef.current });
    }
  }, [entry]);

  // Reset version when entry changes
  useEffect(() => {
    if (!entryId) {
      knownVersionRef.current = null;
    }
  }, [entryId]);

  // === Save Logic ===
  const performSave = useCallback(async (isAutosave = false): Promise<SaveResult> => {
    const currentEntry = entryRef.current; // Read latest entry from ref, not stale closure
    if (!currentEntry || !user?.id) {
      return { success: false, error: 'Entry or user not available' };
    }

    if (isSavingRef.current) {
      log.debug('Save already in progress, skipping');
      return { success: false, error: 'Save already in progress' };
    }

    isSavingRef.current = true;
    setIsSaving(true);
    if (!isAutosave) {
      setIsSubmitting(true);
    }

    try {
      // Get latest content from editor
      const editorHtml = await editorRef.current?.getHTML();
      const { title, body } = splitTitleAndBody(editorHtml || '');
      const contentToSave = body;
      const titleToSave = title || currentEntry.title || null;

      // Check if entry has content worth saving - silently skip empty new entries
      const photoCount = currentEntry.attachments?.length || 0;
      if (isNewEntry && !hasUserContent(titleToSave || '', contentToSave, photoCount)) {
        // No dialog - just return failure, caller will handle navigation
        log.debug('Skipping save for empty new entry');
        return { success: false, error: 'Empty entry' };
      }

      // Extract tags and mentions from content
      const { tags, mentions } = extractContentMetadata(contentToSave);

      // Build location fields
      const locationData = buildLocationFromEntry(currentEntry);
      const gpsFields = buildGpsFields(locationData);
      const geocodeStatus = currentEntry.geocode_status ?? null;
      const locationHierarchyFields = buildLocationHierarchyFields(locationData, geocodeStatus);

      // Use location_id from picker (only set when "Save to My Places" was on)
      const location_id = getLocationId(locationData);

      if (isNewEntry) {
        // === CREATE new entry ===
        log.info('Creating new entry', { hasTitle: !!titleToSave, contentLength: contentToSave.length });

        const newEntry = await createEntry({
          title: titleToSave?.trim() || null,
          content: contentToSave,
          tags,
          mentions,
          entry_date: currentEntry.entry_date,
          stream_id: currentEntry.stream_id,
          status: currentEntry.status,
          type: currentEntry.type,
          due_date: currentEntry.due_date,
          rating: currentEntry.rating || 0,
          priority: currentEntry.priority || 0,
          location_id,
          ...gpsFields,
          ...locationHierarchyFields,
        });

        // Process pending attachments - move files and create DB records
        const pendingAttachments = currentEntry.attachments || [];
        if (pendingAttachments.length > 0) {
          log.debug('Processing pending attachments', { count: pendingAttachments.length });

          const FileSystem = await import('expo-file-system/legacy');

          for (const attachment of pendingAttachments) {
            const oldEntryId = currentEntry.entry_id;
            const newFilePath = attachment.file_path.replace(oldEntryId, newEntry.entry_id);
            const newLocalPath = attachment.local_path?.replace(oldEntryId, newEntry.entry_id);

            if (newLocalPath && attachment.local_path) {
              const newDir = newLocalPath.substring(0, newLocalPath.lastIndexOf('/'));
              await FileSystem.makeDirectoryAsync(newDir, { intermediates: true });
              await FileSystem.moveAsync({
                from: attachment.local_path,
                to: newLocalPath,
              });
            }

            await createAttachment({
              attachment_id: attachment.attachment_id,
              entry_id: newEntry.entry_id,
              user_id: user.id,
              file_path: newFilePath,
              local_path: newLocalPath || attachment.local_path || '',
              mime_type: attachment.mime_type,
              file_size: attachment.file_size ?? 0,
              width: attachment.width ?? 0,
              height: attachment.height ?? 0,
              position: attachment.position,
              uploaded: false,
            });
          }
        }

        // Update entry state
        const updatedEntry: EntryWithRelations = {
          ...currentEntry,
          entry_id: newEntry.entry_id,
          title: titleToSave?.trim() || null,
          content: contentToSave,
          tags,
          mentions,
          local_only: 1,
          synced: 0,
          sync_action: 'create',
          version: 1,
        };
        setEntry(updatedEntry);
        setOriginalEntry(updatedEntry);

        // CRITICAL: Mark as no longer new to prevent duplicate creates on subsequent saves
        setIsNewEntry(false);

        // Update version tracking
        knownVersionRef.current = 1;
        recordSaveTime();

        // Invalidate React Query caches
        queryClient.invalidateQueries({ queryKey: ['entries'] });
        queryClient.invalidateQueries({ queryKey: ['entryCounts'] });
        queryClient.invalidateQueries({ queryKey: ['streams'] });
        queryClient.invalidateQueries({ queryKey: ['unsyncedCount'] });
        queryClient.invalidateQueries({ queryKey: ['tags'] });
        queryClient.invalidateQueries({ queryKey: ['mentions'] });
        queryClient.invalidateQueries({ queryKey: ['locationHierarchy'] });
        queryClient.invalidateQueries({ queryKey: ['locations'] });

        log.info('Entry created successfully', { entryId: newEntry.entry_id });
        if (!isAutosave) {
          showSnackbar('Entry saved');
        }

        return { success: true, entryId: newEntry.entry_id };

      } else {
        // === UPDATE existing entry ===
        log.info('Updating existing entry', { entryId: currentEntry.entry_id });

        await updateEntry(currentEntry.entry_id, {
          title: titleToSave?.trim() || null,
          content: contentToSave,
          tags,
          mentions,
          stream_id: currentEntry.stream_id,
          entry_date: currentEntry.entry_date,
          status: currentEntry.status,
          type: currentEntry.type,
          due_date: currentEntry.due_date,
          rating: currentEntry.rating || 0,
          priority: currentEntry.priority || 0,
          is_pinned: currentEntry.is_pinned,
          is_archived: currentEntry.is_archived,
          location_id,
          ...gpsFields,
          ...locationHierarchyFields,
        });

        // Update local state
        const updatedEntry: EntryWithRelations = {
          ...currentEntry,
          title: titleToSave?.trim() || null,
          content: contentToSave,
          tags,
          mentions,
          version: (currentEntry.version || 1) + 1,
        };
        setEntry(updatedEntry);
        setOriginalEntry(updatedEntry);

        // Update version tracking
        if (knownVersionRef.current !== null) {
          knownVersionRef.current = knownVersionRef.current + 1;
        }
        recordSaveTime();

        // Patch React Query caches
        queryClient.setQueryData(['entry', currentEntry.entry_id], updatedEntry);

        queryClient.setQueriesData(
          { queryKey: ['entries'] },
          (oldData: EntryWithRelations[] | undefined) => {
            if (!oldData) return oldData;
            const index = oldData.findIndex(e => e.entry_id === currentEntry.entry_id);
            if (index === -1) return oldData;
            const newData = [...oldData];
            // updatedEntry already has correct attachments from entry state
            newData[index] = updatedEntry;
            return newData;
          }
        );

        queryClient.invalidateQueries({ queryKey: ['unsyncedCount'] });
        queryClient.invalidateQueries({ queryKey: ['tags'] });
        queryClient.invalidateQueries({ queryKey: ['mentions'] });
        queryClient.invalidateQueries({ queryKey: ['locationHierarchy'] });
        queryClient.invalidateQueries({ queryKey: ['streams'] });
        queryClient.invalidateQueries({ queryKey: ['entryCounts'] });
        queryClient.invalidateQueries({ queryKey: ['locations'] });

        log.info('Entry updated successfully', { entryId: currentEntry.entry_id });
        if (!isAutosave) {
          showSnackbar('Changes saved');
        }

        return { success: true, entryId: currentEntry.entry_id };
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Save failed', error);

      if (!isAutosave) {
        Alert.alert('Error', `Failed to save: ${message}`);
      }

      return { success: false, error: message };

    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
      if (!isAutosave) {
        setIsSubmitting(false);
      }
    }
  }, [user?.id, isNewEntry, setIsNewEntry, editorRef, setEntry, setOriginalEntry, showSnackbar, recordSaveTime, queryClient]);

  const handleSave = useCallback(async (): Promise<SaveResult> => {
    return performSave(false);
  }, [performSave]);

  const handleAutosave = useCallback(async (): Promise<SaveResult> => {
    return performSave(true);
  }, [performSave]);

  // ==========================================================================
  // AUTOSAVE LOGIC (merged from useEntryAutosave)
  // ==========================================================================

  // Check if entry has content worth saving
  const hasContent = (() => {
    if (!entry) return false;
    const titleContent = (entry.title || '').trim();
    const bodyContent = (entry.content || '').replace(/<[^>]*>/g, '').trim();
    const photoCount = entry.attachments?.length || 0;
    return titleContent.length > 0 || bodyContent.length > 0 || photoCount > 0;
  })();

  // Content key for detecting changes (triggers effect re-run)
  const contentKey = `${entry?.title || ''}-${entry?.content || ''}-${entry?.attachments?.length || 0}`;

  // Clear all autosave timers
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

  // Autosave effect - dual timer (debounce + max wait)
  useEffect(() => {
    const shouldAutosave = isDirty && !isSaving && hasContent;

    if (!shouldAutosave) {
      clearAllTimers();
      return;
    }

    // Clear debounce timer (resets on content change)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set debounce timer
    debounceTimerRef.current = setTimeout(async () => {
      log.debug('Autosave: debounce timer fired');
      await handleAutosave();
      if (maxWaitTimerRef.current) {
        clearTimeout(maxWaitTimerRef.current);
        maxWaitTimerRef.current = null;
      }
      maxWaitActiveRef.current = false;
    }, AUTOSAVE_DEBOUNCE_MS);

    // Start max wait timer if not active
    if (!maxWaitActiveRef.current) {
      maxWaitActiveRef.current = true;
      maxWaitTimerRef.current = setTimeout(async () => {
        log.debug('Autosave: max wait timer fired');
        await handleAutosave();
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        maxWaitActiveRef.current = false;
      }, AUTOSAVE_MAX_WAIT_MS);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [isDirty, isSaving, hasContent, contentKey, handleAutosave, clearAllTimers]);

  // Cleanup max wait timer on unmount
  useEffect(() => {
    return () => {
      if (maxWaitTimerRef.current) {
        clearTimeout(maxWaitTimerRef.current);
        maxWaitTimerRef.current = null;
      }
    };
  }, []);

  // ==========================================================================
  // SYNC SUBSCRIPTION LOGIC (merged from useEntrySyncSubscription)
  // ==========================================================================

  useEffect(() => {
    // Skip for new entries
    if (isNewEntry || !entryId) return;

    // Skip if no cached entry
    if (!cachedEntry) return;

    // CRITICAL: Skip sync processing while save is in-flight
    if (isSaving) {
      log.debug('Sync: skipping check while save in progress');
      return;
    }

    const cachedVersion = cachedEntry.version || 1;
    const knownVersion = knownVersionRef.current;

    // Version not initialized
    if (knownVersion === null) {
      knownVersionRef.current = cachedVersion;
      return;
    }

    // Version didn't increase
    if (cachedVersion <= knownVersion) return;

    // Version increased - check if external
    const externalCheck = isExternalUpdate(cachedEntry);
    const isExternal = externalCheck?.isExternal ?? false;
    const editingDevice = externalCheck?.device || 'another device';

    log.debug('Sync: version change detected', {
      knownVersion,
      cachedVersion,
      isExternal,
      device: editingDevice,
    });

    // Update known version
    knownVersionRef.current = cachedVersion;

    // If change is from THIS device, ignore
    if (!isExternal) {
      log.debug('Sync: update from this device, ignoring');
      return;
    }

    // External update!
    log.info('Sync: external update detected', { device: editingDevice });

    // If dirty, warn but don't overwrite
    if (isDirty) {
      showSnackbar(`Entry updated by ${editingDevice} - you have unsaved changes`);
      return;
    }

    // Not dirty - update local state from cache
    const updateFields = {
      title: cachedEntry.title,
      content: cachedEntry.content,
      stream_id: cachedEntry.stream_id,
      status: cachedEntry.status,
      type: cachedEntry.type,
      entry_date: cachedEntry.entry_date,
      rating: cachedEntry.rating,
      priority: cachedEntry.priority,
      due_date: cachedEntry.due_date,
      is_pinned: cachedEntry.is_pinned,
      is_archived: cachedEntry.is_archived,
      entry_latitude: cachedEntry.entry_latitude,
      entry_longitude: cachedEntry.entry_longitude,
      location_id: cachedEntry.location_id,
      place_name: cachedEntry.place_name,
      address: cachedEntry.address,
      neighborhood: cachedEntry.neighborhood,
      city: cachedEntry.city,
      region: cachedEntry.region,
      country: cachedEntry.country,
      version: cachedEntry.version,
      synced: cachedEntry.synced,
      sync_action: cachedEntry.sync_action,
      last_edited_by: cachedEntry.last_edited_by,
      last_edited_device: cachedEntry.last_edited_device,
    };

    setEntry(prev => prev ? { ...prev, ...updateFields } : prev);
    setOriginalEntry(prev => prev ? { ...prev, ...updateFields } : prev);

    // CRITICAL: Push new content to editor (it's a WebView with its own state)
    const newEditorContent = combineTitleAndBody(cachedEntry.title || '', cachedEntry.content || '');
    log.debug('Sync: pushing content to editor', { contentLength: newEditorContent.length });
    editorRef.current?.setContent(newEditorContent);

    // Exit edit mode
    exitEditMode();

    // Check if recently saved
    const timeSinceLastSave = Date.now() - lastSaveTimeRef.current;
    const recentlySaved = lastSaveTimeRef.current > 0 && timeSinceLastSave < 30000;

    if (recentlySaved) {
      lastSaveTimeRef.current = 0; // Prevent spam
      Alert.alert(
        'Sync Conflict',
        `Your recent changes may have been overwritten by ${editingDevice}.\n\nTip: You may be able to use Undo to restore your last change.`,
        [{ text: 'OK' }]
      );
    } else {
      showSnackbar(`Entry updated by ${editingDevice}`);
    }
  }, [
    entryId,
    isNewEntry,
    isSaving,
    isDirty,
    cachedEntry,
    setEntry,
    setOriginalEntry,
    editorRef,
    exitEditMode,
    showSnackbar,
  ]);

  return {
    // Save state
    isSaving,
    isSubmitting,
    // Save handlers
    handleSave,
    handleAutosave,
    // Version info (for debugging)
    initializeVersion,
  };
}
