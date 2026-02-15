/**
 * EntryManagementScreen - Primary entry editor component
 *
 * Architecture:
 * - Direct useState for entry state (no Context)
 * - Refs for cross-component communication
 * - Inline handlers for simple operations (pickers, actions)
 *
 * Delegates to:
 * - useEntryManagement: Save, autosave, sync subscription, version tracking
 * - useEntryManagementPhotos: Photo capture and gallery
 * - useEntryManagementEffects: GPS, geocoding, templates
 */

import { useRef, useImperativeHandle, forwardRef, useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Keyboard, Alert, AppState, AppStateStatus } from 'react-native';
import { EntryHeader } from './EntryHeader';
import { AttributeBar } from './AttributeBar';
import { EditorToolbar } from './EditorToolbar';
import { BottomBar } from '../../../components/layout/BottomBar';
import { useKeyboardHeight } from './hooks/useKeyboardHeight';
import { EntryDatePicker, TimePicker, StatusPicker, RatingPicker, PriorityPicker, DueDatePicker, AttributesPicker, TypePicker } from './pickers';
import { StreamPicker } from '../../streams/components/StreamPicker';
import { LocationPicker } from '../../locations/components/LocationPicker/LocationPicker';
import { PhotoGallery } from '../../photos/components/PhotoGallery';
import { RichTextEditorV2, type RichTextEditorV2Ref } from '../../../components/editor/RichTextEditorV2';
import { Snackbar, useSnackbar } from '../../../shared/components';
import { getEntryWithRelations, copyEntry, deleteEntry } from '../mobileEntryApi';
import { useEntryManagementPhotos } from './hooks/useEntryManagementPhotos';
import { useEntryManagement } from './hooks/useEntryManagement';
import { useEntryManagementEffects } from './hooks/useEntryManagementEffects';
// EntryPickerType - inline type definition (was from useEntryManagementPickers)
type EntryPickerType = 'entryDate' | 'time' | 'stream' | 'status' | 'rating' | 'priority' | 'location' | 'dueDate' | 'entryOptions' | 'type' | null;
import { buildLocationFromEntry } from './helpers/entryLocationHelpers';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { createScopedLogger } from '../../../shared/utils/logger';
import { navigate } from '../../../shared/navigation';
import type { EntryWithRelations } from '../EntryWithRelationsTypes';
import { splitTitleAndBody, combineTitleAndBody } from '@trace/core';
import type { EntryStatus, Location, LocationEntity } from '@trace/core';
import { useSettings } from '../../../shared/contexts/SettingsContext';
import { useStreams } from '../../streams/mobileStreamHooks';
import { useLocations } from '../../locations/mobileLocationHooks';
import { emitToast } from '../../../shared/services/toastService';

const log = createScopedLogger('EntryManagement', '📝');

/**
 * getHTML with timeout — returns null if WebView doesn't respond.
 * Used to detect dead/unready WebViews.
 */
function getHTMLWithTimeout(
  editorRef: React.RefObject<RichTextEditorV2Ref | null>,
  timeoutMs: number
): Promise<string | null> {
  if (!editorRef.current) return Promise.resolve(null);
  return Promise.race([
    editorRef.current.getHTML(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

/**
 * Strip HTML tags and normalize whitespace to get plain text for comparison.
 * Used to verify content was applied despite Tiptap's HTML normalization.
 */
function stripHtmlToText(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Options for creating a new entry
 */
export interface NewEntryOptions {
  streamId?: string | null;
  streamName?: string;
  content?: string;
  date?: string;
}

/**
 * Ref interface for EntryManagementScreen singleton pattern
 * Navigation calls methods to control the screen
 */
export interface EntryManagementScreenRef {
  /** Load and display an existing entry by ID */
  setEntry: (entryId: string) => void;

  /** Create and display a new entry with optional pre-fill values */
  createNewEntry: (options?: NewEntryOptions) => void;

  /** Clear and hide the screen, resetting all state */
  clearEntry: () => void;
}

interface EntryManagementScreenProps {
  isVisible?: boolean;
}

/**
 * Build a new entry object with defaults
 */
function buildNewEntry(options?: NewEntryOptions, userId?: string): EntryWithRelations {
  const d = new Date();
  d.setMilliseconds(0); // Ensure ms=0 (ms=100 is the "hide time" sentinel)
  const now = d.toISOString();

  // Normalize stream_id: "all", "no-stream", and other filter values should be null
  // Only valid UUIDs should be set as stream_id
  const streamId = options?.streamId;
  const isValidStreamId = streamId &&
    streamId !== 'all' &&
    streamId !== 'no-stream' &&
    !streamId.includes(':'); // Exclude filter prefixes like "tag:", "location:", "geo:"

  return {
    entry_id: `temp-${Math.random().toString(36).substring(7)}`,
    user_id: userId || '',
    title: null,
    content: options?.content || '',
    tags: [],
    mentions: [],
    stream_id: isValidStreamId ? streamId : null,
    stream: undefined,
    attachments: [],
    status: 'none',
    type: null,
    entry_date: options?.date || now, // Full ISO with time — new entries default to current date+time
    created_at: now,
    updated_at: now,
    entry_latitude: null,
    entry_longitude: null,
    location_radius: null,
    location_id: null,
    place_name: null,
    address: null,
    neighborhood: null,
    postal_code: null,
    city: null,
    subdivision: null,
    region: null,
    country: null,
    geocode_status: null,
    due_date: null,
    completed_at: null,
    priority: 0,
    rating: 0,
    is_pinned: false,
    is_archived: false,
    local_only: 1,
    synced: 0,
    sync_action: 'create',
    version: 1,
    base_version: 1,
    conflict_status: null,
    conflict_backup: null,
    last_edited_by: null,
    last_edited_device: null,
  } as EntryWithRelations;
}

/**
 * EntryManagementScreen - Persistent entry editor
 *
 * PERSISTENT SCREEN PATTERN:
 * - Mounts once and stays mounted
 * - Navigation calls ref methods to control what's displayed:
 *   - setEntry(entryId) to edit existing entry
 *   - createNewEntry(options) to create new entry
 *   - clearEntry() to hide and reset
 * - Screen fetches entry data itself via getEntryWithRelations
 */
export const EntryManagementScreen = forwardRef<EntryManagementScreenRef, EntryManagementScreenProps>(
  ({ isVisible = true }, ref) => {
    const theme = useTheme();
    const { settings } = useSettings();
    const { streams } = useStreams();
    const locationsQuery = useLocations();
    const savedLocations = locationsQuery.data || [];
    const [entryId, setEntryIdState] = useState<string | null>(null);
    const [isNewEntry, setIsNewEntry] = useState(false);
    const [entry, setEntry] = useState<EntryWithRelations | null>(null);
    const [originalEntry, setOriginalEntry] = useState<EntryWithRelations | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastFetchMs, setLastFetchMs] = useState<number | null>(null);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [activePicker, setActivePicker] = useState<EntryPickerType>(null);

    // Content ready flag - hides content area until data + editor content are confirmed
    // Prevents blocky progressive loading (attributes → photos → editor popping in one by one)
    const [isContentReady, setIsContentReady] = useState(false);

    // Photo gallery collapsed state - when collapsed, photos show in AttributeBar
    const [isGalleryCollapsed, setIsGalleryCollapsed] = useState(false);

    // Ref for RichTextEditorV2
    const editorRef = useRef<RichTextEditorV2Ref>(null);

    // Compute isDirty by comparing current entry to original
    const isDirty = useMemo(() => {
      if (!entry || !originalEntry) return false;
      // Compare fields that users can edit
      const dirty = (
        entry.title !== originalEntry.title ||
        entry.content !== originalEntry.content ||
        entry.stream_id !== originalEntry.stream_id ||
        entry.status !== originalEntry.status ||
        entry.type !== originalEntry.type ||
        entry.entry_date !== originalEntry.entry_date ||
        entry.rating !== originalEntry.rating ||
        entry.priority !== originalEntry.priority ||
        entry.due_date !== originalEntry.due_date ||
        entry.is_pinned !== originalEntry.is_pinned ||
        entry.is_archived !== originalEntry.is_archived ||
        entry.entry_latitude !== originalEntry.entry_latitude ||
        entry.entry_longitude !== originalEntry.entry_longitude ||
        entry.place_name !== originalEntry.place_name ||
        (entry.attachments?.length || 0) !== (originalEntry.attachments?.length || 0)
      );
      if (dirty) {
        log.debug('Entry is dirty', {
          titleChanged: entry.title !== originalEntry.title,
          contentChanged: entry.content !== originalEntry.content,
          streamChanged: entry.stream_id !== originalEntry.stream_id,
          statusChanged: entry.status !== originalEntry.status,
          dateChanged: entry.entry_date !== originalEntry.entry_date,
          locationChanged: entry.entry_latitude !== originalEntry.entry_latitude,
          attachmentsChanged: (entry.attachments?.length || 0) !== (originalEntry.attachments?.length || 0),
        });
      }
      return dirty;
    }, [entry, originalEntry]);

    // Snackbar for notifications
    const { message: snackbarMessage, opacity: snackbarOpacity, showSnackbar } = useSnackbar();

    // Photo handling hook
    const {
      handleTakePhoto,
      handleGallery,
      handleDeletePhoto,
      photoCount,
    } = useEntryManagementPhotos({ entry, setEntry, isNewEntry });

    // Exit edit mode - needs to be defined before unified hook
    const exitEditMode = useCallback(() => {
      log.debug('Exiting edit mode');
      editorRef.current?.blur();
      setIsEditMode(false);
      setIsFullScreen(false);
    }, []);

    // Unified entry management: save, autosave, and sync subscription
    const {
      isSaving,
      isSubmitting,
      handleSave,
      handleAutosave,
      initializeVersion,
    } = useEntryManagement({
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
    });

    // Derive includeTime from milliseconds flag (ms=100 means "hide time")
    // This survives DB round-trips since timestamptz has microsecond precision
    const includeTime = entry?.entry_date
      ? new Date(entry.entry_date).getMilliseconds() !== 100
      : false;

    // Keyboard height tracking - also detects when user taps into editor
    // Using keyboard show event instead of overlay tap because Android WebView
    // requires native touch (not programmatic focus) to show keyboard
    // IMPORTANT: Only enter edit mode if this screen is visible - otherwise we would
    // steal focus from other screens (e.g., CreateApiKeyModal in Settings)
    const keyboardHeight = useKeyboardHeight({
      onShow: () => {
        if (!isEditMode && isVisible) {
          log.debug('Keyboard shown, entering edit mode');
          setIsEditMode(true);
          setIsFullScreen(true);
        }
      },
    });

    // Track visibility in ref for use in callbacks (avoids stale closure issues)
    const isVisibleRef = useRef(isVisible);
    isVisibleRef.current = isVisible;

    // When screen becomes invisible, save if dirty, exit edit mode and dismiss keyboard
    // This prevents keyboard from appearing on the entry list during swipe-back
    // and ensures unsaved changes are persisted
    useEffect(() => {
      if (!isVisible) {
        // If dirty, trigger save (fire-and-forget - save will complete in background)
        if (isDirty && entry) {
          log.info('Screen hidden with unsaved changes, auto-saving');
          handleAutosave(); // Use autosave (silent) rather than handleSave
        }

        if (isEditMode) {
          log.debug('Screen hidden while in edit mode, exiting edit mode');
          Keyboard.dismiss();
          editorRef.current?.blur();
          setIsEditMode(false);
          setIsFullScreen(false);
        }
      }
    }, [isVisible, isEditMode, isDirty, entry, handleAutosave]);

    // Track what to restore after WebView reload (manual reload of new/unsaved entry)
    const pendingResumeRestore = useRef<string | null>(null);

    // Called when editor becomes ready (including after reload)
    const handleEditorReady = useCallback(() => {
      log.info('🔄 handleEditorReady fired', {
        hasPendingResumeRestore: !!pendingResumeRestore.current,
        pendingResumeRestoreLength: pendingResumeRestore.current?.length || 0,
      });

      // New entry or manual reload - restore from React state
      if (pendingResumeRestore.current) {
        log.info('🔄 Editor ready after reload, restoring content from state', { length: pendingResumeRestore.current.length });
        editorRef.current?.setContent(pendingResumeRestore.current);
        pendingResumeRestore.current = null;
        return;
      }

      log.debug('🔄 handleEditorReady: no pending restore (normal startup)');
    }, []);

    // =========================================================================
    // GPS Auto-Capture, Auto-Geocode, and Stream Templates
    // =========================================================================
    useEntryManagementEffects({
      entry,
      setEntry,
      setOriginalEntry,
      isNewEntry,
      entryId,
      settings: { captureGpsLocation: settings.captureGpsLocation },
      streams,
      savedLocations: savedLocations as LocationEntity[],
      editorRef,
    });

    // Load entry by ID - shared between imperative handle and duplicate action
    const loadEntryById = useCallback(async (id: string) => {
      log.debug('loadEntryById: loading entry', { entryId: id.substring(0, 8) });

      // Reset UI state for loading
      Keyboard.dismiss();
      editorRef.current?.blur();
      setIsEditMode(false);
      setIsFullScreen(false);
      setIsLoading(true);
      setError(null);
      setIsNewEntry(false);
      setEntryIdState(id);
      setActivePicker(null);

      // Fetch the entry
      const startTime = performance.now();
      try {
        const data = await getEntryWithRelations(id);
        const fetchTime = Math.round(performance.now() - startTime);

        if (!data) {
          setError('Entry not found');
          setEntry(null);
          log.warn('loadEntryById: entry not found', { entryId: id.substring(0, 8), fetchMs: fetchTime });
          return;
        }

        setEntry(data);
        setOriginalEntry(data);
        setLastFetchMs(fetchTime);

        // Initialize version tracking for conflict detection
        if (data.version) {
          initializeVersion(data.version);
        }

        // Set editor content without adding to undo history
        const editorContent = combineTitleAndBody(data.title || '', data.content || '');
        editorRef.current?.setContentAndClearHistory(editorContent);

        log.debug('loadEntryById: complete', {
          entryId: id.substring(0, 8),
          totalMs: fetchTime,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        log.error('loadEntryById: failed', err);
      } finally {
        setIsLoading(false);
      }
    }, [initializeVersion]);

    // === Entry Actions (inline) ===
    const handlePinToggle = useCallback(() => {
      if (!entry) return;
      log.debug('handlePinToggle', { wasPinned: entry.is_pinned });
      setEntry(prev => prev ? { ...prev, is_pinned: !prev.is_pinned } : prev);
      showSnackbar(entry.is_pinned ? 'Entry unpinned' : 'Entry pinned');
    }, [entry, showSnackbar]);

    const handleArchiveToggle = useCallback(() => {
      if (!entry) return;
      log.debug('handleArchiveToggle', { wasArchived: entry.is_archived });
      setEntry(prev => prev ? { ...prev, is_archived: !prev.is_archived } : prev);
      showSnackbar(entry.is_archived ? 'Entry unarchived' : 'Entry archived');
    }, [entry, showSnackbar]);

    const handleDuplicate = useCallback(async () => {
      if (!entry) return;
      if (isNewEntry) {
        showSnackbar('Save entry first to duplicate');
        return;
      }
      log.info('handleDuplicate: duplicating entry', { entryId: entry.entry_id });
      try {
        if (isDirty) {
          log.debug('handleDuplicate: saving dirty entry first');
          const saveResult = await handleSave();
          if (!saveResult.success) {
            log.warn('handleDuplicate: save failed, aborting duplicate');
            return;
          }
        }
        const newEntryId = await copyEntry(entry.entry_id);
        log.info('handleDuplicate: entry duplicated', { newEntryId });
        showSnackbar('Entry duplicated');
        await loadEntryById(newEntryId);
      } catch (err) {
        log.error('handleDuplicate: failed', err);
        showSnackbar('Failed to duplicate entry');
      }
    }, [entry, isNewEntry, isDirty, handleSave, showSnackbar, loadEntryById]);

    const handleDelete = useCallback(() => {
      if (!entry || isNewEntry) return;
      Alert.alert(
        'Delete Entry',
        'Are you sure you want to delete this entry?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                log.info('Deleting entry', { entryId: entry.entry_id });
                await deleteEntry(entry.entry_id);
                showSnackbar('Entry deleted');
                navigate('back');
              } catch (error) {
                log.error('Failed to delete entry', error);
                Alert.alert(
                  'Error',
                  `Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
              }
            },
          },
        ]
      );
    }, [entry, isNewEntry, showSnackbar]);

    // =========================================================================
    // WebView Recovery - handles dead WebView after app resume
    // =========================================================================

    /**
     * Reload the editor WebView and restore content.
     * - If entry is saved (has real ID): reload from DB (autosave has latest)
     * - If entry is new (temp ID): restore from current React state
     * - If no entry loaded: just reload WebView (ready for next use)
     */
    const handleEditorReload = useCallback(async (source: 'manual' | 'recovery') => {
      log.info(`🔄 handleEditorReload (${source})`, {
        hasEntry: !!entry,
        isNew: isNewEntry,
        entryId: entryId?.substring(0, 8),
        hasEditorRef: !!editorRef.current,
      });

      if (!entry || !entryId) {
        log.info('🔄 No entry loaded, just reloading WebView');
        editorRef.current?.reloadWebView();
        if (source === 'manual') {
          showSnackbar('Editor reloaded');
        }
        return;
      }

      // Store content to restore after reload completes
      const html = combineTitleAndBody(entry.title || '', entry.content || '');
      log.info('🔄 Setting pendingResumeRestore before reload', { length: html.length });
      pendingResumeRestore.current = html;
      editorRef.current?.reloadWebView();
      if (source === 'manual') {
        showSnackbar('Editor reloading...');
      }
    }, [entry, entryId, isNewEntry, showSnackbar]);

    // Manual reload handler (for debug menu)
    const handleReloadEditor = useCallback(() => {
      handleEditorReload('manual');
    }, [handleEditorReload]);

    /**
     * Check if WebView is responsive by calling getHTML with timeout.
     * Returns true if responsive, false if dead/unresponsive.
     */
    const checkWebViewHealth = useCallback(async (): Promise<boolean> => {
      log.info('🏥 Health check: starting', { hasEditorRef: !!editorRef.current });
      if (!editorRef.current) return true; // No editor, nothing to check

      try {
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('timeout')), 500);
        });

        const startMs = performance.now();
        const htmlPromise = editorRef.current.getHTML();
        const result = await Promise.race([htmlPromise, timeoutPromise]);
        const elapsedMs = Math.round(performance.now() - startMs);

        // Check if result is valid (not null/empty from a dead WebView)
        if (result === null || result === undefined) {
          log.warn('🏥 Health check: WebView returned null/undefined - DEAD', { elapsedMs });
          return false;
        }

        log.info('🏥 Health check: WebView ALIVE', { elapsedMs, resultLength: String(result).length });
        return true;
      } catch (error) {
        log.warn('🏥 Health check: FAILED (timeout or error)', {
          error: error instanceof Error ? error.message : 'unknown'
        });
        return false;
      }
    }, []);

    // AppState listener - check WebView health when app resumes
    useEffect(() => {
      const handleAppStateChange = async (nextState: AppStateStatus) => {
        log.info('🔄 AppState changed', { nextState, isVisible: isVisibleRef.current, entryId: entryId?.substring(0, 8) || null });

        if (nextState === 'active' && isVisibleRef.current) {
          log.info('🔄 App resumed on visible entry screen, checking WebView health');

          const isHealthy = await checkWebViewHealth();

          if (!isHealthy) {
            log.warn('🔄 WebView DEAD after resume, triggering recovery', { entryId: entryId?.substring(0, 8) });
            emitToast('Editor recovering...');
            handleEditorReload('recovery');
          } else {
            log.info('🔄 WebView healthy after resume, no action needed');
          }
        }
      };

      const subscription = AppState.addEventListener('change', handleAppStateChange);
      return () => subscription.remove();
    }, [checkWebViewHealth, handleEditorReload, entryId]);

    // Handle editor content changes - split title from body
    const handleContentChange = useCallback((html: string) => {
      const { title, body } = splitTitleAndBody(html);
      log.debug('Content changed', { titleLength: title?.length || 0, bodyLength: body.length });
      setEntry(prev => {
        if (!prev) return prev;
        // Only update if values actually changed
        const newTitle = title || null;
        const newContent = body;
        if (prev.title === newTitle && prev.content === newContent) return prev;
        return { ...prev, title: newTitle, content: newContent };
      });
    }, []);

    /**
     * Verify editor content was applied. Checks:
     * 1. getHTML returns null → WebView dead → reload once, poll until alive, re-set.
     * 2. No visible text expected (empty/image-only entry) → skip verification, done.
     * 3. Editor text length is within tolerance of expected → content loaded, done.
     * 4. Editor empty or wrong content (stale from previous entry) → re-set.
     *
     * Uses length-proximity instead of exact string comparison — Tiptap normalizes
     * HTML (entities, whitespace, Unicode) so roundtripped text may differ by a few
     * chars. Tolerance catches normalization while still detecting stale/missing content.
     */
    const verifyEditorContent = (content: string, onVerified: () => void) => {
      const expectedText = stripHtmlToText(content);

      // No visible text content — nothing to verify
      if (expectedText.length === 0) {
        onVerified();
        return;
      }

      let reloaded = false;
      let resets = 0;
      const MAX_RESETS = 3;
      const MAX_RELOAD_POLLS = 30;
      const tolerance = Math.max(20, Math.round(expectedText.length * 0.1));

      const poll = async (attempt: number) => {
        const html = await getHTMLWithTimeout(editorRef, 80);

        if (html === null) {
          // WebView dead — reload once, then poll until alive
          if (!reloaded) {
            log.warn(`⚡ verify: WebView dead (attempt ${attempt}) — reloading`);
            editorRef.current?.reloadWebView();
            reloaded = true;
          }
          if (attempt < MAX_RELOAD_POLLS) {
            setTimeout(() => poll(attempt + 1), 100);
          } else {
            log.error(`⚡ verify: GAVE UP waiting for WebView after ${attempt} attempts`);
            onVerified();
          }
          return;
        }

        // WebView alive — check text length is within tolerance of expected
        const actualText = stripHtmlToText(html);
        const lenDiff = Math.abs(actualText.length - expectedText.length);

        if (actualText.length > 0 && lenDiff <= tolerance) {
          // Content loaded — length is close enough (Tiptap normalization tolerance)
          if (reloaded || resets > 0) {
            log.info(`⚡ verify: content confirmed (attempt ${attempt}, reloaded=${reloaded}, resets=${resets})`);
          }
          onVerified();
          return;
        }

        // Editor empty or content length too different (stale/wrong content) — re-set
        if (resets < MAX_RESETS) {
          resets++;
          log.warn(`⚡ verify: content mismatch (attempt ${attempt}, reset ${resets}/${MAX_RESETS}), re-setting`, {
            expectedLen: expectedText.length,
            actualLen: actualText.length,
            lenDiff,
            tolerance,
          });
          editorRef.current?.setContentAndClearHistory(content);
          setTimeout(() => poll(attempt + 1), 200);
        } else {
          log.error(`⚡ verify: content still mismatched after ${resets} resets — giving up`, {
            expectedLen: expectedText.length,
            actualLen: actualText.length,
          });
          onVerified();
        }
      };

      setTimeout(() => poll(1), 100);
    };

    // Load entry directly
    const loadEntryDirect = async (id: string) => {
      const startTime = performance.now();
      log.debug('loadEntryDirect started', { entryId: id.substring(0, 8) });

      // Note: isLoading, error, isNewEntry, entryId already set by setEntry caller
      try {
        const data = await getEntryWithRelations(id);
        const fetchTime = Math.round(performance.now() - startTime);

        if (!data) {
          setError('Entry not found');
          setEntry(null);
          log.warn('⏱️ Entry not found', { entryId: id.substring(0, 8), fetchMs: fetchTime });
          return;
        }

        setEntry(data);
        setOriginalEntry(data);
        setLastFetchMs(fetchTime);
        // Initialize version tracking for conflict detection
        if (data.version) {
          initializeVersion(data.version);
        }
        // Set editor content without adding to undo history
        const editorContent = combineTitleAndBody(data.title || '', data.content || '');
        log.debug('Setting editor content (no history)', { length: editorContent.length });
        editorRef.current?.setContentAndClearHistory(editorContent);

        // Verify content was applied — handles dead/fresh WebView recovery
        // Content area stays hidden (isContentReady=false) until verified
        verifyEditorContent(editorContent, () => {
          setIsContentReady(true);
          setIsLoading(false);
        });

        log.debug('loadEntryDirect complete', {
          entryId: id.substring(0, 8),
          totalMs: fetchTime,
          hasStream: !!data.stream,
          attachmentCount: data.attachments?.length || 0,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setIsContentReady(true); // Show error state
        setIsLoading(false);
        log.error('Failed to load entry', err);
      }
    };

    // Expose ref API for navigation
    useImperativeHandle(ref, () => ({
      setEntry: (id: string) => {
        log.debug('setEntry called', { entryId: id.substring(0, 8) });

        // Always start in read-only mode - dismiss keyboard and blur editor
        Keyboard.dismiss();
        editorRef.current?.blur();
        setIsEditMode(false);
        setIsFullScreen(false);

        // Set loading state immediately - content hidden until verified
        setIsLoading(true);
        setIsContentReady(false);
        setError(null);
        setIsNewEntry(false);
        setEntryIdState(id);
        setActivePicker(null);

        // Fetch directly - the query itself is fast (~15ms)
        loadEntryDirect(id);
      },
      createNewEntry: (options?: NewEntryOptions) => {
        log.info('createNewEntry: creating new entry', { streamId: options?.streamId });
        setIsNewEntry(true);
        setIsContentReady(true);
        setEntryIdState(null);
        setError(null);
        const newEntry = buildNewEntry(options);
        setEntry(newEntry);
        setOriginalEntry(newEntry);
        setIsLoading(false);
        // Set editor content without adding to undo history
        const editorContent = combineTitleAndBody(newEntry.title || '', newEntry.content || '');
        log.debug('Setting editor content for new entry (no history)', { length: editorContent.length });
        editorRef.current?.setContentAndClearHistory(editorContent);
      },
      clearEntry: () => {
        setIsContentReady(true);
        // Log stack trace to identify what's calling clearEntry
        log.info('clearEntry called');
        // Dismiss keyboard and blur editor first
        Keyboard.dismiss();
        editorRef.current?.blur();
        // Reset all state
        setEntryIdState(null);
        setIsNewEntry(false);
        setEntry(null);
        setOriginalEntry(null);
        setError(null);
        setActivePicker(null);
        setIsEditMode(false);
        setIsFullScreen(false);
        // Clear editor content and history (editor stays mounted between entries)
        editorRef.current?.setContent('');
        editorRef.current?.clearHistory();
      },
    }));

    // Update a field on the entry
    const updateEntryField = useCallback(<K extends keyof EntryWithRelations>(
      field: K,
      value: EntryWithRelations[K]
    ) => {
      if (!entry) return;
      log.debug('updateEntryField:', { field, value });
      setEntry(prev => prev ? { ...prev, [field]: value } : prev);
    }, [entry]);

    // === Picker Handlers (inline) ===
    // Track when we're removing time (to coordinate with date change callback)


    // Press handlers - open pickers
    const handleDatePress = useCallback(() => {
      Keyboard.dismiss();
      setActivePicker('entryDate');
    }, []);

    const handleTimePress = useCallback(() => {
      Keyboard.dismiss();
      setActivePicker('time');
    }, []);

    const handleAddTime = useCallback(() => {
      Keyboard.dismiss();
      setActivePicker('time');
    }, []);

    const handleStreamPress = useCallback(() => {
      Keyboard.dismiss();
      setActivePicker('stream');
    }, []);

    const handleStatusPress = useCallback(() => {
      Keyboard.dismiss();
      setActivePicker('status');
    }, []);

    const handleRatingPress = useCallback(() => {
      Keyboard.dismiss();
      setActivePicker('rating');
    }, []);

    const handlePriorityPress = useCallback(() => {
      Keyboard.dismiss();
      setActivePicker('priority');
    }, []);

    const handleLocationPress = useCallback(() => {
      Keyboard.dismiss();
      setActivePicker('location');
    }, []);

    const handleDueDatePress = useCallback(() => {
      Keyboard.dismiss();
      setActivePicker('dueDate');
    }, []);

    const handleMorePress = useCallback(() => {
      Keyboard.dismiss();
      setActivePicker('entryOptions');
    }, []);

    // Change handlers - update entry fields
    // TimePicker handles the ms=100 flag directly — just pass through
    const handleEntryDateChange = useCallback((newDate: string) => {
      updateEntryField('entry_date', newDate);
    }, [updateEntryField]);

    const handleIncludeTimeChange = useCallback((_include: boolean) => {
      // No-op: ms=100 flag in the ISO string is the source of truth
    }, []);

    const handleTypeChange = useCallback((type: string | null) => {
      updateEntryField('type', type);
    }, [updateEntryField]);

    const handleStreamChange = useCallback((streamId: string | null, _streamName: string | null) => {
      // Update both stream_id and the stream object for UI display
      const stream = streamId ? streams.find(s => s.stream_id === streamId) : undefined;
      setEntry(prev => prev ? { ...prev, stream_id: streamId, stream } : prev);
    }, [streams]);

    const handleStatusChange = useCallback((status: EntryStatus) => {
      updateEntryField('status', status);
    }, [updateEntryField]);

    const handleRatingChange = useCallback((rating: number) => {
      updateEntryField('rating', rating);
    }, [updateEntryField]);

    const handlePriorityChange = useCallback((priority: number) => {
      updateEntryField('priority', priority);
    }, [updateEntryField]);

    const handleDueDateChange = useCallback((dueDate: string | null) => {
      updateEntryField('due_date', dueDate);
    }, [updateEntryField]);

    const handleLocationSelect = useCallback((location: Location | null) => {
      setEntry(prev => {
        if (!prev) return prev;
        if (location) {
          return {
            ...prev,
            entry_latitude: location.latitude,
            entry_longitude: location.longitude,
            location_radius: location.locationRadius ?? null,
            location_id: location.location_id ?? null,
            place_name: location.name ?? null,
            address: location.address ?? null,
            neighborhood: location.neighborhood ?? null,
            city: location.city ?? null,
            region: location.region ?? null,
            country: location.country ?? null,
          };
        } else {
          return {
            ...prev,
            entry_latitude: null,
            entry_longitude: null,
            location_radius: null,
            location_id: null,
            place_name: null,
            address: null,
            neighborhood: null,
            city: null,
            region: null,
            country: null,
          };
        }
      });
    }, []);

    // Header callbacks
    const handleBack = useCallback(async () => {
      log.debug('handleBack: navigating back', { isDirty, isNewEntry });

      // Dismiss keyboard and blur editor immediately
      Keyboard.dismiss();
      editorRef.current?.blur();

      // If dirty, auto-save before navigating
      if (isDirty && entry) {
        log.info('handleBack: auto-saving dirty entry');
        const result = await handleSave();
        if (!result.success) {
          log.warn('handleBack: save failed, navigating anyway', { error: result.error });
          // If new entry was empty, show toast on entry list
          if (isNewEntry && result.error === 'Empty entry') {
            emitToast('Entry not saved');
          }
        }
      }

      navigate('back');
    }, [isDirty, isNewEntry, entry, handleSave]);

    const handleToggleFullScreen = () => {
      log.debug('handleToggleFullScreen:', { wasFullScreen: isFullScreen });
      Keyboard.dismiss();
      setIsFullScreen(prev => !prev);
    };

    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        <EntryHeader
          isEditMode={!!entry}
          isFullScreen={isFullScreen}
          isSaving={isSaving}
          isDirty={isDirty}
          isPinned={entry?.is_pinned}
          isArchived={entry?.is_archived}
          entryDate={entry?.entry_date || new Date().toISOString()}
          includeTime={includeTime}
          onBack={handleBack}
          onDatePress={handleDatePress}
          onTimePress={handleTimePress}
          onAddTime={handleAddTime}
          onToggleFullScreen={handleToggleFullScreen}
          onUndo={() => editorRef.current?.undo()}
          onRedo={() => editorRef.current?.redo()}
          editorRef={editorRef}
        />

        {/* Content area - hidden until data + editor content verified to prevent blocky loading */}
        <View style={[styles.contentArea, { opacity: isContentReady ? 1 : 0 }]}>
          {/* Attribute Bar - shows stream and attributes */}
          {entry && !isFullScreen && (
            <AttributeBar
              entry={entry}
              onStreamPress={handleStreamPress}
              onStatusPress={handleStatusPress}
              onRatingPress={handleRatingPress}
              onPriorityPress={handlePriorityPress}
              onLocationPress={handleLocationPress}
              onDueDatePress={handleDueDatePress}
              onPhotosPress={() => setIsGalleryCollapsed(false)}
              onMorePress={handleMorePress}
              photoCount={isGalleryCollapsed ? photoCount : undefined}
            />
          )}

          {/* Photo Gallery - shows between attribute bar and editor */}
          {entry && !isFullScreen && (
            <PhotoGallery
              entryId={entry.entry_id}
              attachments={entry.attachments}
              onPhotoDelete={handleDeletePhoto}
              onTakePhoto={handleTakePhoto}
              onGallery={handleGallery}
              collapsible={true}
              isCollapsed={isGalleryCollapsed}
              onCollapsedChange={setIsGalleryCollapsed}
            />
          )}

          {error && (
            <View style={styles.centerContainer}>
              <Text style={[styles.errorText, { color: theme.colors.functional.overdue }]}>{error}</Text>
            </View>
          )}

          {/* Rich Text Editor - ALWAYS MOUNTED for performance */}
          <View style={[
            styles.editorContainer,
            { backgroundColor: theme.colors.background.primary },
            isEditMode ? { paddingBottom: 60 } : { paddingBottom: 0 },
            keyboardHeight > 0 && { paddingBottom: keyboardHeight + 80 }
          ]}>
            <RichTextEditorV2
              ref={editorRef}
              onChange={handleContentChange}
              editable={isEditMode}
              onReady={handleEditorReady}
            />
          </View>
        </View>

        {/* Editor Toolbar - uses BottomBar component (matches EntryScreen pattern) */}
        {entry && isEditMode && (
          <BottomBar keyboardOffset={keyboardHeight}>
            <EditorToolbar
              editorRef={editorRef}
              onDone={exitEditMode}
            />
          </BottomBar>
        )}

        {/* Date/Time Pickers */}
        <EntryDatePicker
          visible={activePicker === 'entryDate'}
          onClose={() => setActivePicker(null)}
          entryDate={entry?.entry_date || new Date().toISOString()}
          onEntryDateChange={handleEntryDateChange}
          onSnackbar={showSnackbar}
        />

        <TimePicker
          visible={activePicker === 'time'}
          onClose={() => setActivePicker(null)}
          entryDate={entry?.entry_date || new Date().toISOString()}
          onEntryDateChange={handleEntryDateChange}
          onIncludeTimeChange={handleIncludeTimeChange}
          onSnackbar={showSnackbar}
          includeTime={includeTime}
        />

        {/* Attribute Pickers */}
        <StreamPicker
          visible={activePicker === 'stream'}
          onClose={() => setActivePicker(null)}
          selectedStreamId={entry?.stream_id ?? null}
          onSelect={handleStreamChange}
        />

        <StatusPicker
          visible={activePicker === 'status'}
          onClose={() => setActivePicker(null)}
          status={(entry?.status as EntryStatus) ?? 'none'}
          onStatusChange={handleStatusChange}
          onSnackbar={showSnackbar}
          allowedStatuses={entry?.stream?.entry_statuses as EntryStatus[] | undefined}
        />

        <RatingPicker
          visible={activePicker === 'rating'}
          onClose={() => setActivePicker(null)}
          rating={entry?.rating ?? 0}
          onRatingChange={handleRatingChange}
          onSnackbar={showSnackbar}
        />

        <PriorityPicker
          visible={activePicker === 'priority'}
          onClose={() => setActivePicker(null)}
          priority={entry?.priority ?? 0}
          onPriorityChange={handlePriorityChange}
          onSnackbar={showSnackbar}
        />

        <DueDatePicker
          visible={activePicker === 'dueDate'}
          onClose={() => setActivePicker(null)}
          dueDate={entry?.due_date ?? null}
          onDueDateChange={handleDueDateChange}
          onSnackbar={showSnackbar}
        />

        <LocationPicker
          visible={activePicker === 'location'}
          onClose={() => setActivePicker(null)}
          initialLocation={buildLocationFromEntry(entry)}
          onSelect={handleLocationSelect}
        />

        {/* Type Picker */}
        <TypePicker
          visible={activePicker === 'type'}
          onClose={() => setActivePicker(null)}
          type={entry?.type ?? null}
          onTypeChange={handleTypeChange}
          onSnackbar={showSnackbar}
          availableTypes={(entry?.stream?.entry_types as string[]) ?? []}
        />

        {/* Entry Options Menu */}
        <AttributesPicker
          visible={activePicker === 'entryOptions'}
          onClose={() => setActivePicker(null)}
          isEditing={!isNewEntry && !!entryId}
          // Visibility flags - default to true when no stream (except type which needs defined types)
          showLocation={entry?.stream?.entry_use_location ?? true}
          showStatus={entry?.stream?.entry_use_status ?? true}
          showType={entry?.stream?.entry_use_type ?? false}
          showDueDate={entry?.stream?.entry_use_duedates ?? true}
          showRating={entry?.stream?.entry_use_rating ?? true}
          showPriority={entry?.stream?.entry_use_priority ?? true}
          showPhotos={entry?.stream?.entry_use_photos ?? true}
          // Current values
          locationData={buildLocationFromEntry(entry)}
          status={(entry?.status as EntryStatus) ?? 'none'}
          type={entry?.type ?? null}
          dueDate={entry?.due_date ?? null}
          rating={entry?.rating ?? 0}
          priority={entry?.priority ?? 0}
          ratingType={(entry?.stream?.entry_rating_type as any) ?? 'stars'}
          isPinned={entry?.is_pinned ?? false}
          isArchived={entry?.is_archived ?? false}
          // Picker callbacks - directly switch to the target picker
          onShowLocationPicker={() => setActivePicker('location')}
          onShowStatusPicker={() => setActivePicker('status')}
          onShowTypePicker={() => setActivePicker('type')}
          onShowDatePicker={() => setActivePicker('dueDate')}
          onShowRatingPicker={() => setActivePicker('rating')}
          onShowPriorityPicker={() => setActivePicker('priority')}
          // Photo callbacks
          onTakePhoto={handleTakePhoto}
          onGallery={handleGallery}
          // Action callbacks
          onPinToggle={handlePinToggle}
          onArchiveToggle={handleArchiveToggle}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          // Developer callbacks
          onReloadEditor={handleReloadEditor}
        />

        {/* Snackbar for notifications */}
        <Snackbar message={snackbarMessage} opacity={snackbarOpacity} />
      </View>
    );
  }
);

EntryManagementScreen.displayName = 'EntryManagementScreen';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
  },
  editorContainer: {
    flex: 1,
    paddingLeft: 24,
    paddingRight: 12,
    // paddingBottom handled dynamically based on edit mode and keyboard
  },
});
