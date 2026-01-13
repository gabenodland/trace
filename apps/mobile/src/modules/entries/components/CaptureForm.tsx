import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, Platform, Keyboard, Animated } from "react-native";
import * as Location from "expo-location";
import { extractTagsAndMentions, useAuthState, generateAttachmentPath, type Location as LocationType, locationToCreateInput, type EntryStatus, applyTitleTemplate, applyContentTemplate } from "@trace/core";
import { getDeviceName } from "../mobileEntryApi";
import { createLocation, getLocation as getLocationById } from '../../locations/mobileLocationApi';
import { useEntries, useEntry } from "../mobileEntryHooks";
import { useStreams } from "../../streams/mobileStreamHooks";
import { useAttachments } from "../../attachments/mobileAttachmentHooks";
import { useNavigation } from "../../../shared/contexts/NavigationContext";
import { useDrawer } from "../../../shared/contexts/DrawerContext";
import { useSettings } from "../../../shared/contexts/SettingsContext";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { RichTextEditor } from "../../../components/editor/RichTextEditor";
import { StreamPicker } from "../../streams/components/StreamPicker";
import { BottomBar } from "../../../components/layout/BottomBar";
import { TopBarDropdownContainer } from "../../../components/layout/TopBarDropdownContainer";
import { PhotoCapture, type PhotoCaptureRef } from "../../photos/components/PhotoCapture";
import { PhotoGallery } from "../../photos/components/PhotoGallery";
import { LocationPicker } from "../../locations/components/LocationPicker";
import { compressAttachment, saveAttachmentToLocalStorage, deleteAttachment, createAttachment, getAttachmentsForEntry } from "../../attachments/mobileAttachmentApi";
import * as Crypto from "expo-crypto";
import { useCaptureFormState } from "./hooks/useCaptureFormState";
import { styles } from "./CaptureForm.styles";
import { RatingPicker, WholeNumberRatingPicker, DecimalRatingPicker, PriorityPicker, TimePicker, AttributesPicker, GpsPicker, StatusPicker, DueDatePicker, EntryDatePicker, TypePicker, UnsupportedAttributePicker } from "./pickers";
import type { GpsData } from "./hooks/useCaptureFormState";
import { MetadataBar } from "./MetadataBar";
import { EditorToolbar } from "./EditorToolbar";
import { CaptureFormHeader } from "./CaptureFormHeader";

interface CaptureFormProps {
  entryId?: string | null;
  initialStreamId?: string | null | "all" | "events" | "streams" | "tags" | "people";
  initialStreamName?: string;
  initialContent?: string;
  initialDate?: string;
  /** Copied entry data - when provided, opens form with pre-filled data (not saved to DB yet) */
  copiedEntryData?: {
    entry: import('@trace/core').Entry;
    pendingPhotos: import('./hooks/useCaptureFormState').PendingPhoto[];
    hasTime: boolean;
  };
}

export function CaptureForm({ entryId, initialStreamId, initialStreamName, initialContent, initialDate, copiedEntryData }: CaptureFormProps = {}) {
  const theme = useTheme();

  // Track when a new entry has been saved (for autosave transition from create to update)
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  // Determine if we're editing an existing entry or creating a new one
  // - entryId: passed in when editing an existing entry
  // - savedEntryId: set after autosave creates a new entry (transitions to editing mode)
  // Note: copied entries start as "not editing" but transition to editing after first save
  const isEditing = !!entryId || !!savedEntryId;
  const isCopiedEntry = !!copiedEntryData;

  // The effective entry ID to use for updates (savedEntryId takes precedence for new entries that have been autosaved)
  const effectiveEntryId = savedEntryId || entryId;

  // Get user settings for default GPS capture behavior
  const { settings } = useSettings();

  // Single form data state hook (consolidates form field state + pending photos)
  const { formData, updateField, updateMultipleFields, addPendingPhoto, removePendingPhoto, isDirty, setBaseline, markClean } = useCaptureFormState({
    isEditing,
    initialStreamId,
    initialStreamName,
    initialContent,
    initialDate,
    captureGpsSetting: settings.captureGpsLocation,
  });

  // UI State (NOT form data - keep as individual useState)
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Separate state for save indicator - tracks both manual and autosave (isSubmitting only tracks manual)
  const [isSaving, setIsSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Consolidated picker visibility state - only one picker can be open at a time
  type ActivePicker = 'stream' | 'gps' | 'location' | 'dueDate' | 'rating' | 'priority' | 'status' | 'type' | 'attributes' | 'entryDate' | 'time' | 'unsupportedStatus' | 'unsupportedType' | 'unsupportedDueDate' | 'unsupportedRating' | 'unsupportedPriority' | 'unsupportedLocation' | null;
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);

  // GPS loading state (for capturing/reloading GPS)
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  // Tracks when form data is fully loaded and ready for baseline
  // New entries are ready immediately, editing/copying need to wait for data
  const [isFormReady, setIsFormReady] = useState(!isEditing && !isCopiedEntry);
  // Track if we're capturing GPS from a cleared state (shows Save button instead of Remove)
  const [isNewGpsCapture, setIsNewGpsCapture] = useState(false);
  // Pending GPS data - holds captured GPS before user confirms with Save button
  const [pendingGpsData, setPendingGpsData] = useState<GpsData | null>(null);

  const [isTitleExpanded, setIsTitleExpanded] = useState(true);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const snackbarOpacity = useRef(new Animated.Value(0)).current;
  const editorRef = useRef<any>(null);
  const titleInputRef = useRef<TextInput>(null);
  const photoCaptureRef = useRef<PhotoCaptureRef>(null);
  const isInitialLoad = useRef(true); // Track if this is first load
  const [photoCount, setPhotoCount] = useState(0); // Track photo position for ordering
  const [baselinePhotoCount, setBaselinePhotoCount] = useState<number | null>(null); // Baseline for dirty tracking (null = not yet initialized)
  const [photosCollapsed, setPhotosCollapsed] = useState(false); // Start expanded
  const [externalRefreshKey, setExternalRefreshKey] = useState(0); // Increment on external updates to force PhotoGallery reload
  // For copied entries, use the pre-generated entry_id from copiedEntryData
  // For new entries, generate a temp ID. For editing, use the existing entryId.
  const [tempEntryId] = useState(() => copiedEntryData?.entry.entry_id || entryId || Crypto.randomUUID());

  const { entryMutations } = useEntries();
  // When editing, refresh from server first to get latest version
  // Use effectiveEntryId to handle autosaved new entries that transition to editing mode
  const { entry, isLoading: isLoadingEntry, entryMutations: singleEntryMutations } = useEntry(
    effectiveEntryId || null,
    { refreshFirst: !!entryId } // Only refresh if opened with an existing entryId
  );
  const { user } = useAuthState();
  const { streams } = useStreams();
  // Use React Query for photos to detect external sync changes
  const { attachments: queryAttachments } = useAttachments(effectiveEntryId || null);
  const { navigate, setBeforeBackHandler } = useNavigation();

  // Get current stream for visibility controls
  const currentStream = streams.find(s => s.stream_id === formData.streamId);

  // Stream-based visibility
  // If no stream: show all fields (default true)
  // If stream set: only show if field is true (database converts 0/1 to false/true)
  const showRating = !currentStream || currentStream.entry_use_rating === true;
  const showPriority = !currentStream || currentStream.entry_use_priority === true;
  const showStatus = !currentStream || currentStream.entry_use_status !== false;
  const showType = currentStream?.entry_use_type === true && (currentStream?.entry_types?.length ?? 0) > 0;
  const showDueDate = !currentStream || currentStream.entry_use_duedates === true;
  const showLocation = !currentStream || currentStream.entry_use_location !== false;
  const showPhotos = !currentStream || currentStream.entry_use_photos !== false;

  // Unsupported flags - attribute not supported by stream BUT entry has a value
  // Used to show strikethrough in MetadataBar with option to remove
  const unsupportedStatus = !showStatus && formData.status !== "none";
  const unsupportedType = !showType && !!formData.type;
  const unsupportedDueDate = !showDueDate && !!formData.dueDate;
  const unsupportedRating = !showRating && formData.rating > 0;
  const unsupportedPriority = !showPriority && formData.priority > 0;
  const unsupportedLocation = !showLocation && !!formData.locationData;

  // Track known version to detect external updates from the entry object
  // This allows us to detect when another device has updated the entry via global sync
  const knownVersionRef = useRef<number | null>(null);

  // Track known photo count from React Query to detect external photo additions
  // Photo syncs don't change entry.version, so we need separate detection
  const knownPhotoCountRef = useRef<number | null>(null);

  // Autosave timer ref - only for editing existing entries
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const AUTOSAVE_DELAY_MS = 2000;

  // Edit mode: new entries start in edit mode, existing entries start in read-only
  const [isEditMode, setIsEditMode] = useState(!isEditing);

  // Full-screen edit mode (hides all metadata, shows only formData.title + body + toolbar)
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Combined dirty state: hook's isDirty + photo count comparison for existing entries
  // For editing existing entries, photos are saved directly to LocalDB (not pendingPhotos),
  // so we need to compare photoCount against the baseline stored as state
  const isFormDirty = useMemo(() => {
    // If hook says dirty, it's dirty
    if (isDirty) return true;

    // For editing existing entries, check if photo count changed from baseline
    // Only compare if baseline has been initialized (not null)
    if (isEditing && baselinePhotoCount !== null && photoCount !== baselinePhotoCount) {
      return true;
    }

    return false;
  }, [isDirty, isEditing, photoCount, baselinePhotoCount]);

  // Initialize baseline for new entries (NOT copied entries - those have async data loading)
  useEffect(() => {
    if (!isEditing && !isCopiedEntry && baselinePhotoCount === null) {
      // Set baseline in hook for dirty tracking
      setBaseline(formData);
      // For new entries, photos use pendingPhotos so baseline starts at 0
      setBaselinePhotoCount(0);
    }
  }, []);

  // AUTOSAVE: Debounced save for ALL entries (new and existing)
  // Triggers 2s after last change, only when dirty and in edit mode
  // For new entries: creates the entry and transitions to "editing" mode
  // For existing entries: updates the entry
  useEffect(() => {
    // For new entries, only autosave if there's actual content (not just auto-captured GPS)
    const hasContent = formData.title.trim() !== '' ||
                       formData.content.replace(/<[^>]*>/g, '').trim() !== '' ||
                       formData.pendingPhotos.length > 0;

    // Debug: Log autosave state on every evaluation
    console.log('🔍 [Autosave] Evaluating:', {
      isEditMode,
      isEditing,
      isFormDirty,
      isFormReady,
      isSubmitting,
      hasContent,
      streamId: formData.streamId,
      willTrigger: isFormDirty && isEditMode && isFormReady && !isSubmitting && (isEditing || hasContent),
    });

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
        console.log('🔍 [Autosave] Timer cleared - conditions not met');
      }
      return;
    }

    // Clear previous timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      console.log('🔍 [Autosave] Previous timer cleared, resetting debounce');
    }

    // Set new timer
    console.log('🔍 [Autosave] Starting 2s debounce timer...');
    autosaveTimerRef.current = setTimeout(() => {
      console.log('🔄 [Autosave] Triggering autosave after 2s debounce');
      handleSave(true); // Pass isAutosave=true for seamless background save
    }, AUTOSAVE_DELAY_MS);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [isEditing, isFormDirty, isEditMode, isFormReady, isSubmitting, isSaving, formData, photoCount]);

  // Register beforeBack handler for gesture/hardware back interception
  // Always saves if dirty, no prompts
  useEffect(() => {
    const beforeBackHandler = async (): Promise<boolean> => {
      // For NEW entries: check if there's actual user content worth saving
      // (title, text, or photos - not just metadata like stream/GPS)
      // If no user content, just discard and proceed with back
      if (!isEditing) {
        const editorContent = editorRef.current?.getHTML?.() ?? formData.content ?? '';
        const hasUserContent =
          formData.title.trim().length > 0 ||
          (typeof editorContent === 'string' && editorContent.replace(/<[^>]*>/g, '').trim().length > 0) ||
          formData.pendingPhotos.length > 0;

        if (!hasUserContent) {
          console.log('⬅️ [beforeBackHandler] New entry with no user content, discarding');
          return true; // Proceed with back, no save
        }
      }

      // Check if there are unsaved changes
      if (!hasUnsavedChanges()) {
        return true; // No changes, proceed with back
      }

      // Auto-save and proceed
      await handleSave();
      return true;
    };

    // Register the handler
    setBeforeBackHandler(beforeBackHandler);

    // Cleanup: unregister handler when component unmounts
    return () => {
      setBeforeBackHandler(null);
    };
  }, [formData.title, formData.content, formData.streamId, formData.status, formData.dueDate, formData.entryDate, formData.locationData, photoCount, formData.pendingPhotos, isEditMode, isEditing]);

  // Check if there are unsaved changes - combines edit mode check with dirty tracking
  // Also checks editor content directly to handle race condition where user types
  // and quickly hits back before RichTextEditor's polling syncs to formData
  const hasUnsavedChanges = (): boolean => {
    console.log('🔍 [hasUnsavedChanges] Checking...', { isEditMode, isFormDirty });

    // If not in edit mode, no changes are possible
    if (!isEditMode) {
      console.log('🔍 [hasUnsavedChanges] Not in edit mode, returning false');
      return false;
    }

    // First check the hook's dirty state (covers title, date, stream, etc.)
    if (isFormDirty) {
      console.log('🔍 [hasUnsavedChanges] isFormDirty=true, returning true');
      return true;
    }

    // Also check if editor content differs from formData (race condition fix)
    // This catches the case where user typed but polling hasn't synced yet
    const editorContent = editorRef.current?.getHTML?.();
    if (typeof editorContent === 'string' && editorContent !== formData.content) {
      console.log('🔍 [hasUnsavedChanges] Editor content differs from formData, returning true');
      return true;
    }

    console.log('🔍 [hasUnsavedChanges] No changes detected, returning false');
    return false;
  };

  // Back button handler - saves if dirty, then navigates
  // Not memoized to always use latest hasUnsavedChanges/handleSave
  const handleBack = () => {
    console.log('⬅️ [handleBack] Called, checking for unsaved changes...');

    // For NEW entries: check if there's actual user content worth saving
    // (title, text, or photos - not just metadata like stream/GPS)
    // If no user content, just discard and go back
    if (!isEditing) {
      const editorContent = editorRef.current?.getHTML?.() ?? formData.content ?? '';
      const hasUserContent =
        formData.title.trim().length > 0 ||
        (typeof editorContent === 'string' && editorContent.replace(/<[^>]*>/g, '').trim().length > 0) ||
        formData.pendingPhotos.length > 0;

      if (!hasUserContent) {
        console.log('⬅️ [handleBack] New entry with no user content, discarding');
        navigateBack();
        return;
      }
    }

    if (!hasUnsavedChanges()) {
      console.log('⬅️ [handleBack] No unsaved changes, navigating back');
      navigateBack();
      return;
    }

    console.log('⬅️ [handleBack] Has unsaved changes, saving first...');
    // Auto-save and then navigate
    handleSave().then(() => {
      console.log('⬅️ [handleBack] Save complete, navigating back');
      navigateBack();
    });
  };

  // Enter edit mode - RichTextEditor handles focus automatically
  // when editor receives focus while in read-only UI mode
  const enterEditMode = () => {
    setIsEditMode(true);
  };

  // Show snackbar notification
  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    Animated.sequence([
      Animated.timing(snackbarOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(snackbarOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setSnackbarMessage(null));
  };

  // Detect external updates by watching entry.version via global sync
  // Simple logic: If version increased AND it's from a different device, update the form
  useEffect(() => {
    if (!entry || !isEditing) return;

    const entryVersion = entry.version || 1;
    const thisDevice = getDeviceName();
    const editingDevice = entry.last_edited_device || '';

    // First load - just record the version
    if (knownVersionRef.current === null) {
      knownVersionRef.current = entryVersion;
      return;
    }

    // Version didn't change - nothing to do
    if (entryVersion <= knownVersionRef.current) return;

    // Version increased - check if it's from another device
    const isExternalUpdate = editingDevice !== thisDevice;

    console.log('🔄 [CaptureForm] Version change detected', {
      thisDevice,
      editingDevice,
      isExternalUpdate,
      previousVersion: knownVersionRef.current,
      newVersion: entryVersion,
      willUpdateForm: isExternalUpdate && !isFormDirty,
    });

    // Update known version
    knownVersionRef.current = entryVersion;

    // If change is from THIS device (our own save), don't update form
    if (!isExternalUpdate) {
      console.log('🔄 [CaptureForm] Skipping form update - change from this device');
      return;
    }

    // External update - if user has unsaved changes, warn them
    if (isFormDirty) {
      showSnackbar(`Entry updated by ${editingDevice} - you have unsaved changes`);
      return;
    }

    // No local changes - build complete new form data and set both form and baseline atomically
    const streamName = entry.stream_id && streams.length > 0
      ? streams.find(s => s.stream_id === entry.stream_id)?.name || null
      : null;

    const newFormData = {
      title: entry.title || '',
      content: entry.content || '',
      streamId: entry.stream_id || null,
      streamName,
      status: (entry.status || 'none') as EntryStatus,
      type: entry.type || null,
      dueDate: entry.due_date || null,
      rating: entry.rating || 0,
      priority: entry.priority || 0,
      entryDate: entry.entry_date || formData.entryDate,
      includeTime: entry.entry_date ? new Date(entry.entry_date).getMilliseconds() !== 100 : formData.includeTime,
      gpsData: entry.entry_latitude && entry.entry_longitude ? {
        latitude: entry.entry_latitude,
        longitude: entry.entry_longitude,
        accuracy: entry.location_accuracy || null,
      } : null,
      // Keep current locationData - location_id changes are rare and would need async fetch
      locationData: formData.locationData,
      pendingPhotos: formData.pendingPhotos,
    };

    // Set baseline FIRST with the exact data we're loading
    // This prevents any dirty state since baseline === formData
    setBaseline(newFormData);
    setBaselinePhotoCount(photoCount);

    // Then update form to same data
    updateMultipleFields(newFormData);

    // Increment externalRefreshKey to force PhotoGallery to reload
    // This ensures external photo additions are displayed
    setExternalRefreshKey(prev => prev + 1);

    showSnackbar(`Entry updated by ${editingDevice}`);
  }, [entry, isEditing, isFormDirty, streams, updateMultipleFields, setBaseline, photoCount, formData.entryDate, formData.includeTime, formData.locationData, formData.pendingPhotos]);

  // Detect external photo additions via React Query
  // Photo syncs don't change entry.version, so we need separate detection using usePhotos hook
  // IMPORTANT: Only detect external changes AFTER:
  // 1. Form is ready (baseline set)
  // 2. baselinePhotoCount has been established (ensures we're past initial load)
  // Otherwise we treat initial data load as "external" and mark form dirty
  useEffect(() => {
    // Gate: Must be editing, form ready, AND baseline photo count established
    if (!isEditing || !entryId || !isFormReady || baselinePhotoCount === null) return;

    const queryPhotoCount = queryAttachments.length;

    // First time this effect runs after all gates pass - initialize known count
    if (knownPhotoCountRef.current === null) {
      knownPhotoCountRef.current = queryPhotoCount;
      console.log('📸 [CaptureForm] Photo tracking initialized (form + baseline ready):', queryPhotoCount);
      return;
    }

    // Photo count increased - external photo addition detected
    if (queryPhotoCount > knownPhotoCountRef.current) {
      console.log('📸 [CaptureForm] External photo addition detected', {
        previous: knownPhotoCountRef.current,
        current: queryPhotoCount,
      });

      // Update known count
      knownPhotoCountRef.current = queryPhotoCount;

      // Increment externalRefreshKey to force PhotoGallery to reload
      setExternalRefreshKey(prev => prev + 1);

      // Update photoCount state so it's in sync
      setPhotoCount(queryPhotoCount);
    } else if (queryPhotoCount < knownPhotoCountRef.current) {
      // Photo was deleted externally - also update
      console.log('📸 [CaptureForm] External photo deletion detected', {
        previous: knownPhotoCountRef.current,
        current: queryPhotoCount,
      });
      knownPhotoCountRef.current = queryPhotoCount;
      setExternalRefreshKey(prev => prev + 1);
      setPhotoCount(queryPhotoCount);
    }
  }, [queryAttachments.length, isEditing, entryId, isFormReady, baselinePhotoCount]);

  // Handle tap on title to enter edit mode
  const handleTitlePress = () => {
    if (!isEditMode) {
      // Clear any pending body focus - we're focusing the title instead
      editorRef.current?.clearPendingFocus?.();
      enterEditMode();
      // Focus the title input after a short delay to ensure edit mode is active
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
    setIsTitleExpanded(true);
  };

  // Determine if formData.title should be collapsed
  const shouldCollapse = !formData.title.trim() && formData.content.trim().length > 0 && !isTitleExpanded;

  // Location picker mode: 'view' if already has named location, 'select' to pick/create
  const locationPickerMode: 'select' | 'view' = formData.locationData?.name ? 'view' : 'select';

  // Get viewMode from DrawerContext for back navigation
  const { viewMode } = useDrawer();

  // Helper to navigate back - uses viewMode from DrawerContext
  // Main view state (stream selection, map region, calendar date) is already preserved in context
  const navigateBack = useCallback(() => {
    // Map viewMode to screen name
    const screenMap: Record<string, string> = {
      list: "inbox",
      map: "map",
      calendar: "calendar",
    };
    navigate(screenMap[viewMode] || "inbox");
  }, [viewMode, navigate]);

  // Auto-collapse formData.title when user starts typing in body without a formData.title
  // Don't collapse while title is focused (prevents keyboard dismissal while typing)
  useEffect(() => {
    if (!formData.title.trim() && formData.content.trim().length > 0 && !isTitleFocused) {
      setIsTitleExpanded(false);
    } else if (formData.title.trim()) {
      setIsTitleExpanded(true);
    }
  }, [formData.title, formData.content, isTitleFocused]);

  // Load entry data when editing (INITIAL LOAD ONLY)
  // Pattern: Build complete form data object, set baseline AND form atomically, then mark ready
  // IMPORTANT: Only runs once on initial load - subsequent entry changes are handled by version detection
  useEffect(() => {
    if (!entry || !isEditing) return;
    // Guard: Don't reload form if already loaded - version change handler deals with updates
    if (isFormReady) return;

    // Build base form data synchronously
    const entryDate = entry.entry_date || entry.created_at || formData.entryDate;
    const includeTime = entryDate ? new Date(entryDate).getMilliseconds() !== 100 : formData.includeTime;

    // Look up stream name
    const streamName = entry.stream_id && streams.length > 0
      ? streams.find(s => s.stream_id === entry.stream_id)?.name || null
      : null;

    // Build GPS data
    const gpsData: GpsData | null = entry.entry_latitude && entry.entry_longitude
      ? {
          latitude: entry.entry_latitude,
          longitude: entry.entry_longitude,
          accuracy: entry.location_accuracy || null,
        }
      : null;

    // Helper to finalize loading - sets baseline and form atomically
    const finalizeLoad = (locationData: LocationType | null) => {
      const newFormData = {
        title: entry.title || '',
        content: entry.content || '',
        streamId: entry.stream_id || null,
        streamName,
        status: (entry.status || 'none') as EntryStatus,
        type: entry.type || null,
        dueDate: entry.due_date || null,
        rating: entry.rating || 0,
        priority: entry.priority || 0,
        entryDate,
        includeTime,
        gpsData,
        locationData,
        pendingPhotos: [], // Existing entries don't use pendingPhotos
      };

      // Set baseline FIRST, then form data - ensures they're identical
      // Note: Editor may normalize content slightly, but this is close enough for dirty tracking
      setBaseline(newFormData);
      updateMultipleFields(newFormData);
      // Mark load complete
      isInitialLoad.current = false;
      setIsFormReady(true);
    };

    // Load location if needed, then finalize
    if (entry.location_id) {
      getLocationById(entry.location_id)
        .then(locationEntity => {
          if (locationEntity) {
            const location: LocationType = {
              location_id: locationEntity.location_id,
              latitude: locationEntity.latitude,
              longitude: locationEntity.longitude,
              name: locationEntity.name,
              source: (locationEntity.source as any) || 'user_custom',
              address: locationEntity.address || null,
              neighborhood: locationEntity.neighborhood || null,
              postalCode: locationEntity.postal_code || null,
              city: locationEntity.city || null,
              subdivision: locationEntity.subdivision || null,
              region: locationEntity.region || null,
              country: locationEntity.country || null,
            };
            finalizeLoad(location);
          } else {
            finalizeLoad(null);
          }
        })
        .catch(err => {
          console.error('Failed to load location:', err);
          finalizeLoad(null);
        });
    } else {
      // No location to load - finalize immediately
      finalizeLoad(null);
    }
  }, [entry, isEditing, streams, setBaseline, updateMultipleFields, isFormReady]);

  // Called when RichTextEditor is ready with its actual content (possibly normalized)
  // This syncs formData AND baseline to the editor's real content if normalization changed it
  const handleEditorReady = useCallback((editorContent: string) => {
    if (!isEditing || !isFormReady) return;

    // Only sync if editor normalized the content differently
    if (formData.content !== editorContent) {
      console.log('📝 [handleEditorReady] Editor normalized content, syncing baseline', {
        formContentLen: formData.content?.length,
        editorContentLen: editorContent?.length,
      });
      // Update formData to match editor's actual content
      updateField("content", editorContent);
      // Also update baseline so this doesn't mark as dirty
      const syncedData = { ...formData, content: editorContent };
      setBaseline(syncedData);
    }
  }, [isEditing, isFormReady, formData, setBaseline, updateField]);

  // Set baseline photo count for editing after initial load
  // Use queryAttachments.length directly to avoid race with photoCount state
  // The form data baseline is set atomically in the load effect above
  useEffect(() => {
    if (isEditing && isFormReady && baselinePhotoCount === null) {
      const actualPhotoCount = queryAttachments.length;
      console.log('📸 [CaptureForm] Setting baseline photo count:', actualPhotoCount);
      setBaselinePhotoCount(actualPhotoCount);
      // Also sync photoCount if it differs
      if (photoCount !== actualPhotoCount) {
        setPhotoCount(actualPhotoCount);
      }
    }
  }, [isEditing, isFormReady, baselinePhotoCount, queryAttachments.length, photoCount]);

  // Load copied entry data (for copy workflow - entry is NOT saved to DB yet)
  // Pattern: Build complete form data object, set baseline AND form atomically, then mark ready
  useEffect(() => {
    if (!isCopiedEntry || !copiedEntryData) return;

    const { entry: copiedEntry, pendingPhotos, hasTime } = copiedEntryData;

    // Look up stream name
    const streamName = copiedEntry.stream_id && streams.length > 0
      ? streams.find(s => s.stream_id === copiedEntry.stream_id)?.name || null
      : null;

    // Build GPS data
    const gpsData: GpsData | null = copiedEntry.entry_latitude && copiedEntry.entry_longitude
      ? {
          latitude: copiedEntry.entry_latitude,
          longitude: copiedEntry.entry_longitude,
          accuracy: copiedEntry.location_accuracy || null,
        }
      : null;

    // Helper to finalize loading - sets baseline and form atomically
    const finalizeLoad = (locationData: LocationType | null) => {
      const newFormData = {
        title: copiedEntry.title || '',
        content: copiedEntry.content || '',
        streamId: copiedEntry.stream_id || null,
        streamName,
        status: (copiedEntry.status || 'none') as EntryStatus,
        type: copiedEntry.type || null,
        dueDate: copiedEntry.due_date || null,
        rating: copiedEntry.rating || 0,
        priority: copiedEntry.priority || 0,
        entryDate: copiedEntry.entry_date || new Date().toISOString(),
        includeTime: hasTime,
        gpsData,
        locationData,
        pendingPhotos, // Copied entries use pendingPhotos
      };

      console.log('🔍 [Load Copied] Setting baseline and form atomically', {
        streamId: newFormData.streamId,
        title: newFormData.title?.substring(0, 30),
        pendingPhotos: pendingPhotos.length,
      });

      // Set baseline FIRST with the exact data we're loading
      setBaseline(newFormData);
      setBaselinePhotoCount(pendingPhotos.length);
      // Then update form to same data - they're identical so isDirty = false
      updateMultipleFields(newFormData);
      // Update photo count
      setPhotoCount(pendingPhotos.length);
      // Mark load complete
      isInitialLoad.current = false;
      setIsFormReady(true);
    };

    // Load location if needed, then finalize
    if (copiedEntry.location_id) {
      getLocationById(copiedEntry.location_id)
        .then(locationEntity => {
          if (locationEntity) {
            const location: LocationType = {
              location_id: locationEntity.location_id,
              latitude: locationEntity.latitude,
              longitude: locationEntity.longitude,
              name: locationEntity.name,
              source: (locationEntity.source as any) || 'user_custom',
              address: locationEntity.address || null,
              neighborhood: locationEntity.neighborhood || null,
              postalCode: locationEntity.postal_code || null,
              city: locationEntity.city || null,
              subdivision: locationEntity.subdivision || null,
              region: locationEntity.region || null,
              country: locationEntity.country || null,
            };
            finalizeLoad(location);
          } else {
            finalizeLoad(null);
          }
        })
        .catch(err => {
          console.error('Failed to load location for copied entry:', err);
          finalizeLoad(null);
        });
    } else {
      // No location to load - finalize immediately
      finalizeLoad(null);
    }
  }, [isCopiedEntry, copiedEntryData, streams]);

  // Apply default status for new entries with an initial stream
  // This handles the case when navigating directly to capture form with a stream preset
  useEffect(() => {
    // Only for new entries (not editing, not copied)
    if (isEditing || isCopiedEntry) return;

    // Only if we have an initial stream and streams are loaded
    if (!formData.streamId || streams.length === 0) return;

    // Only if status is still "none" (hasn't been set yet)
    if (formData.status !== "none") return;

    // Find the stream and apply its default status if enabled
    const stream = streams.find(s => s.stream_id === formData.streamId);
    if (stream?.entry_use_status && stream?.entry_default_status) {
      updateField("status", stream.entry_default_status);
    }
  }, [isEditing, isCopiedEntry, formData.streamId, formData.status, streams, updateField]);

  // Capture GPS coordinates for new entries when setting is enabled
  // GPS is separate from named Location - GPS captures where entry was created
  useEffect(() => {
    // Only auto-capture GPS for new entries (not editing)
    if (isEditing) {
      return;
    }

    // Skip if GPS capture setting is disabled
    if (!settings.captureGpsLocation) {
      return;
    }

    // Skip if we already have GPS data
    if (formData.gpsData) {
      return;
    }

    // Capture GPS - pass isInitialCapture=true so baseline is updated
    captureGps(false, false, true);
  }, [isEditing, settings.captureGpsLocation]);

  // Apply templates when form loads with an initial stream
  // This handles the case where user navigates from a stream view and clicks "new"
  const hasAppliedInitialTemplateRef = useRef(false);
  useEffect(() => {
    // Only for new entries (not editing, not copied)
    if (isEditing || isCopiedEntry) return;

    // Only run once
    if (hasAppliedInitialTemplateRef.current) return;

    // Only if streams are loaded
    if (streams.length === 0) return;

    // Only if we have an initial stream ID that's a valid stream (not a filter)
    const specialStreamValues = ["all", "events", "streams", "tags", "people", null, undefined];
    const hasValidStreamFromView = initialStreamId && !specialStreamValues.includes(initialStreamId as any);
    if (!hasValidStreamFromView) return;

    // Find the stream
    const selectedStream = streams.find(s => s.stream_id === initialStreamId);
    if (!selectedStream) return;

    // Mark as applied
    hasAppliedInitialTemplateRef.current = true;

    const templateDate = new Date();
    const titleIsBlank = !formData.title.trim();
    const contentIsBlank = !formData.content.trim();

    // Apply title template if title is blank (independent of content)
    if (titleIsBlank && selectedStream.entry_title_template) {
      const newTitle = applyTitleTemplate(selectedStream.entry_title_template, {
        date: templateDate,
        streamName: selectedStream.name,
      });
      if (newTitle) {
        updateField("title", newTitle);
      }
    }

    // Apply content template if content is blank (independent of title)
    if (contentIsBlank && selectedStream.entry_content_template) {
      const newContent = applyContentTemplate(selectedStream.entry_content_template, {
        date: templateDate,
        streamName: selectedStream.name,
      });
      if (newContent) {
        updateField("content", newContent);
      }
    }

    // Apply default status if stream has one
    if (selectedStream.entry_default_status && selectedStream.entry_default_status !== "none") {
      updateField("status", selectedStream.entry_default_status);
    }
  }, [isEditing, isCopiedEntry, streams, initialStreamId, formData.title, formData.content, updateField]);

  // Helper function to capture GPS coordinates (used for initial capture and reload)
  // forceRefresh: if true, skip cache and get fresh GPS reading with high accuracy
  // toPending: if true, store in pendingGpsData instead of formData (for new capture flow)
  // isInitialCapture: if true, this is the initial auto-capture for new entries - update baseline to avoid dirty state
  const captureGps = async (forceRefresh = false, toPending = false, isInitialCapture = false) => {
    setIsGpsLoading(true);

    let timeoutId: NodeJS.Timeout;
    let hasGps = false;

    try {
      const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
      if (permissionStatus !== "granted") {
        Alert.alert(
          "Permission Denied",
          "GPS permission is required to capture location.",
          [{ text: "OK" }]
        );
        setIsGpsLoading(false);
        return;
      }

      // Set timeout to give up after 15 seconds
      timeoutId = setTimeout(() => {
        if (!hasGps) {
          setIsGpsLoading(false);
          Alert.alert(
            "GPS Unavailable",
            "Could not get your location. Please check that GPS is enabled.",
            [{ text: "OK" }]
          );
        }
      }, 15000);

      let location: Location.LocationObject | null = null;

      if (forceRefresh) {
        // Force fresh GPS reading with high accuracy (for reload button)
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
      } else {
        // For initial capture, try cached first for speed, then fall back to fresh
        location = await Location.getLastKnownPositionAsync();

        if (!location) {
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        }
      }

      if (location) {
        hasGps = true;
        clearTimeout(timeoutId);
        const gpsData: GpsData = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
        };
        if (toPending) {
          // Store in pending state - user must click Save to commit
          setPendingGpsData(gpsData);
        } else {
          // Store directly in form data (for auto-capture on new entry)
          updateField("gpsData", gpsData);

          // For initial auto-capture, also update baseline so form doesn't show as dirty
          if (isInitialCapture) {
            // Get current formData and update baseline with new GPS
            setBaseline({ ...formData, gpsData });
          }
        }
        setIsGpsLoading(false);
        if (!isEditMode) enterEditMode();
      }
    } catch (geoError) {
      clearTimeout(timeoutId!);
      setIsGpsLoading(false);
      Alert.alert(
        "GPS Error",
        "Could not access your location. Please check that GPS is enabled and permissions are granted.",
        [{ text: "OK" }]
      );
    }
  };

  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);

        // Scroll cursor into view when keyboard appears
        // Use a longer delay to ensure edit mode transition is complete
        // IMPORTANT: Only scroll if:
        // 1. Title is NOT focused - scrollToCursor calls editor.focus() which would steal focus
        // 2. No picker is open - picker inputs (like search) need to keep their focus
        if (editorRef.current && !titleInputRef.current?.isFocused() && !activePicker) {
          setTimeout(() => {
            editorRef.current?.scrollToCursor();
          }, 300);
        }
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [isEditMode, activePicker]); // Re-register when edit mode or picker changes

  // Save handler
  // isAutosave: when true, don't set isSubmitting to keep inputs editable (seamless background save)
  const handleSave = async (isAutosave = false) => {
    // Prevent multiple simultaneous saves
    if (isSubmitting || isSaving) {
      return;
    }

    // Always set isSaving for the indicator (tracks both manual and autosave)
    setIsSaving(true);

    // Only set isSubmitting for manual saves - autosave should be seamless (keeps inputs editable)
    if (!isAutosave) {
      setIsSubmitting(true);
    }

    // CONFLICT DETECTION (Option 5 from ENTRY_EDITING_DATAFLOW.md)
    // Check if another device updated this entry while we were editing
    if (isEditing && entry && knownVersionRef.current !== null) {
      const currentVersion = entry.version || 1;
      const baseVersion = knownVersionRef.current;

      if (currentVersion > baseVersion) {
        // Conflict detected - another device updated this entry
        const lastDevice = entry.last_edited_device || 'another device';

        setIsSubmitting(false);
        setIsSaving(false);

        // Show conflict resolution dialog
        return new Promise<void>((resolve) => {
          Alert.alert(
            'Entry Modified',
            `This entry was updated by ${lastDevice} while you were editing. How would you like to proceed?`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => resolve(),
              },
              {
                text: 'Discard My Changes',
                style: 'destructive',
                onPress: () => {
                  // Reload form from entry (server version)
                  updateMultipleFields({
                    title: entry.title || '',
                    content: entry.content || '',
                    streamId: entry.stream_id || null,
                    status: entry.status || 'none' as EntryStatus,
                    type: entry.type || null,
                    dueDate: entry.due_date || null,
                    rating: entry.rating || 0,
                    priority: entry.priority || 0,
                    entryDate: entry.entry_date || formData.entryDate,
                    gpsData: entry.entry_latitude && entry.entry_longitude ? {
                      latitude: entry.entry_latitude,
                      longitude: entry.entry_longitude,
                      accuracy: entry.location_accuracy || null,
                    } : null,
                  });
                  // Update known version to current
                  knownVersionRef.current = currentVersion;
                  markClean();
                  setBaselinePhotoCount(photoCount);
                  showSnackbar('Discarded your changes, loaded latest version');
                  resolve();
                },
              },
              {
                text: 'Save as Copy',
                onPress: async () => {
                  // Create a new entry with current form data
                  try {
                    const { tags, mentions } = extractTagsAndMentions(formData.content);

                    // Build GPS fields
                    let gpsFields: { entry_latitude: number | null; entry_longitude: number | null; location_accuracy: number | null };
                    if (formData.gpsData) {
                      gpsFields = {
                        entry_latitude: formData.gpsData.latitude,
                        entry_longitude: formData.gpsData.longitude,
                        location_accuracy: formData.gpsData.accuracy,
                      };
                    } else if (formData.locationData) {
                      gpsFields = {
                        entry_latitude: formData.locationData.latitude,
                        entry_longitude: formData.locationData.longitude,
                        location_accuracy: null,
                      };
                    } else {
                      gpsFields = { entry_latitude: null, entry_longitude: null, location_accuracy: null };
                    }

                    // Get or create location
                    let location_id: string | null = null;
                    if (formData.locationData && formData.locationData.name) {
                      if (formData.locationData.location_id) {
                        location_id = formData.locationData.location_id;
                      } else {
                        const locationInput = locationToCreateInput(formData.locationData);
                        const savedLocation = await createLocation(locationInput);
                        location_id = savedLocation.location_id;
                      }
                    }

                    // Create new entry with "Copy of" title
                    const copyTitle = formData.title.trim()
                      ? `Copy of ${formData.title.trim()}`
                      : 'Copy of Untitled';

                    await entryMutations.createEntry({
                      title: copyTitle,
                      content: formData.content,
                      tags,
                      mentions,
                      entry_date: formData.entryDate,
                      stream_id: formData.streamId,
                      status: formData.status,
                      type: formData.type,
                      due_date: formData.dueDate,
                      rating: formData.rating || 0,
                      priority: formData.priority || 0,
                      location_id,
                      ...gpsFields,
                    });

                    showSnackbar('Saved as new entry');
                    navigateBack();
                  } catch (error) {
                    console.error('Failed to save as copy:', error);
                    Alert.alert('Error', `Failed to save copy: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                  resolve();
                },
              },
              {
                text: 'Keep My Changes',
                style: 'default',
                onPress: async () => {
                  // Proceed with save - this will overwrite the remote version
                  // Update known version so we don't detect conflict again
                  knownVersionRef.current = currentVersion;
                  setIsSubmitting(true);
                  await performSave();
                  resolve();
                },
              },
            ]
          );
        });
      }
    }

    await performSave(isAutosave);
  };

  // Actual save logic extracted for reuse in conflict resolution
  // isAutosave: when true, skip setting isSubmitting and don't show empty entry alert
  const performSave = async (isAutosave = false) => {
    // Get the actual editor content directly - handles race condition where user
    // types quickly and hits back/save before RichTextEditor's polling syncs
    const editorContent = editorRef.current?.getHTML?.();
    // Use editor content if it's a valid string, otherwise fall back to formData
    const contentToSave = (typeof editorContent === 'string') ? editorContent : formData.content;
    if (typeof editorContent === 'string' && editorContent !== formData.content) {
      console.log('💾 [performSave] Using editor content directly (not yet synced to formData)');
      // Also sync to formData for consistency
      updateField("content", editorContent);
    }

    // Check if there's something to save
    // For NEW entries: only save if there's user-provided content (title, text, photos)
    // GPS and named location alone aren't enough - they're metadata that can be auto-captured
    // For EXISTING entries: any change is valid (entry already exists in DB)
    const textContent = contentToSave.replace(/<[^>]*>/g, '').trim();
    const hasTitle = formData.title.trim().length > 0;
    const hasTextContent = textContent.length > 0;
    const hasPhotos = isEditing ? photoCount > 0 : formData.pendingPhotos.length > 0;

    // For new entries, require actual user content (title, text, or photos)
    // Once entry exists (isEditing), we save any changes including metadata-only updates
    const hasUserContent = hasTitle || hasTextContent || hasPhotos;

    if (!isEditing && !hasUserContent) {
      if (!isAutosave) {
        setIsSubmitting(false);
        setIsSaving(false);
        Alert.alert("Empty Entry", "Please add a title, content, or photo before saving");
      } else {
        // For autosave, silently skip - nothing to save yet
        setIsSaving(false);
      }
      return;
    }

    try {
      const { tags, mentions } = extractTagsAndMentions(contentToSave);

      // Build GPS fields - use GPS data if available, otherwise use location coordinates
      // When a Location is set, it supersedes GPS, but we still save coords to entry_latitude/longitude
      let gpsFields: { entry_latitude: number | null; entry_longitude: number | null; location_accuracy: number | null };
      if (formData.gpsData) {
        // Use captured GPS coordinates
        gpsFields = {
          entry_latitude: formData.gpsData.latitude,
          entry_longitude: formData.gpsData.longitude,
          location_accuracy: formData.gpsData.accuracy,
        };
      } else if (formData.locationData) {
        // Use location coordinates (when Location supersedes GPS)
        gpsFields = {
          entry_latitude: formData.locationData.latitude,
          entry_longitude: formData.locationData.longitude,
          location_accuracy: null,
        };
      } else {
        // No location data at all
        gpsFields = {
          entry_latitude: null,
          entry_longitude: null,
          location_accuracy: null,
        };
      }

      // Get or create location if we have location data
      let location_id: string | null = null;
      if (formData.locationData && formData.locationData.name) {
        // Check if this is a saved location (has existing location_id)
        if (formData.locationData.location_id) {
          // Reuse existing location
          location_id = formData.locationData.location_id;
        } else {
          // Create a new location in the locations table
          const locationInput = locationToCreateInput(formData.locationData);
          const savedLocation = await createLocation(locationInput);
          location_id = savedLocation.location_id;
        }
      }

      if (isEditing) {
        // Update existing entry
        await singleEntryMutations.updateEntry({
          title: formData.title.trim() || null,
          content: contentToSave,
          tags,
          mentions,
          stream_id: formData.streamId,
          entry_date: formData.entryDate,
          status: formData.status,
          type: formData.type,
          due_date: formData.dueDate,
          rating: formData.rating || 0,
          priority: formData.priority || 0,
          location_id,
          ...gpsFields,
        });
      } else {
        // Create new entry
        const newEntry = await entryMutations.createEntry({
          title: formData.title.trim() || null,
          content: contentToSave,
          tags,
          mentions,
          entry_date: formData.entryDate,
          stream_id: formData.streamId,
          status: formData.status,
          type: formData.type,
          due_date: formData.dueDate,
          rating: formData.rating || 0,
          priority: formData.priority || 0,
          location_id,
          ...gpsFields,
        });

        // CRITICAL: Save all pending photos to DB with the real entry_id
        if (formData.pendingPhotos.length > 0) {
          for (const photo of formData.pendingPhotos) {
            // Update file path and local path to use real entry_id
            const newFilePath = photo.filePath.replace(tempEntryId, newEntry.entry_id);
            const newLocalPath = photo.localPath.replace(tempEntryId, newEntry.entry_id);

            // Move file from temp directory to real directory
            const FileSystem = await import('expo-file-system/legacy');
            const newDir = newLocalPath.substring(0, newLocalPath.lastIndexOf('/'));
            await FileSystem.makeDirectoryAsync(newDir, { intermediates: true });
            await FileSystem.moveAsync({
              from: photo.localPath,
              to: newLocalPath,
            });

            // Save to DB with real entry_id using proper API
            await createAttachment({
              attachment_id: photo.photoId,
              entry_id: newEntry.entry_id,
              user_id: user!.id,
              file_path: newFilePath,
              local_path: newLocalPath,
              mime_type: photo.mimeType,
              file_size: photo.fileSize,
              width: photo.width,
              height: photo.height,
              position: photo.position,
              uploaded: false,
            });
          }

          updateField("pendingPhotos", []); // Clear pending photos
        }

        // Transition to "editing" mode - subsequent saves will update instead of create
        setSavedEntryId(newEntry.entry_id);
        // Initialize the known version for the new entry
        knownVersionRef.current = 1;
      }

      // Note: Sync is triggered automatically in mobileEntryApi after save

      // For all saves (new and existing): stay on screen
      markClean(); // Mark form as clean after successful save
      setBaselinePhotoCount(photoCount); // Update photo baseline
      // Update known version - we just created a new version with this save
      // This prevents false conflict detection on subsequent saves
      if (knownVersionRef.current !== null && isEditing) {
        knownVersionRef.current = (knownVersionRef.current || 1) + 1;
      }
    } catch (error) {
      console.error(`Failed to ${isEditing ? 'update' : 'create'} entry:`, error);
      // Only show error alert for manual saves - autosave failures are silent
      if (!isAutosave) {
        Alert.alert("Error", `Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    } finally {
      // Always reset isSaving (tracks both manual and autosave)
      setIsSaving(false);
      // Only reset isSubmitting for manual saves (autosave never set it to true)
      if (!isAutosave) {
        setIsSubmitting(false);
      }
    }
  };

  // Delete handler (only for editing)
  const handleDelete = () => {
    if (!isEditing) return;

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
              await singleEntryMutations.deleteEntry();
              navigate("inbox");
            } catch (error) {
              console.error("Failed to delete entry:", error);
              Alert.alert("Error", `Failed to delete: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
          },
        },
      ]
    );
  };

  // Photo handler
  const handlePhotoSelected = async (uri: string, width: number, height: number) => {
    try {
      // Check if user is logged in
      if (!user) {
        Alert.alert("Error", "You must be logged in to add photos");
        return;
      }

      // Compress photo using quality setting
      const compressed = await compressAttachment(uri, settings.imageQuality);

      // Generate IDs
      const photoId = Crypto.randomUUID();
      const userId = user.id;

      if (isEditing) {
        // EXISTING ENTRY: Save photo to DB immediately using proper API
        // Use effectiveEntryId (handles autosaved new entries where savedEntryId is set but entryId prop is null)
        const localPath = await saveAttachmentToLocalStorage(compressed.uri, photoId, userId, effectiveEntryId!);

        await createAttachment({
          attachment_id: photoId,
          entry_id: effectiveEntryId!,
          user_id: userId,
          file_path: generateAttachmentPath(userId, effectiveEntryId!, photoId, 'jpg'),
          local_path: localPath,
          mime_type: 'image/jpeg',
          file_size: compressed.file_size,
          width: compressed.width,
          height: compressed.height,
          position: photoCount,
          uploaded: false,
        });

        setPhotoCount(photoCount + 1);
      } else {
        // NEW ENTRY: Store photo in state only (don't save to DB until entry is saved)
        const localPath = await saveAttachmentToLocalStorage(compressed.uri, photoId, userId, tempEntryId);

        addPendingPhoto({
          photoId,
          localPath,
          filePath: generateAttachmentPath(userId, tempEntryId, photoId, 'jpg'),
          mimeType: 'image/jpeg',
          fileSize: compressed.file_size,
          width: compressed.width,
          height: compressed.height,
          position: photoCount,
        });

        setPhotoCount(photoCount + 1);
      }

      // Enter edit mode if not already in it
      if (!isEditMode) {
        enterEditMode();
      }
    } catch (error) {
      console.error('Error adding photo:', error);
      Alert.alert('Error', 'Failed to add photo');
    }
  };

  // Multiple photos handler (for gallery multi-select)
  const handleMultiplePhotosSelected = async (photos: { uri: string; width: number; height: number }[]) => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to add photos");
      return;
    }

    try {
      let currentPosition = photoCount;

      for (const photo of photos) {
        // Compress photo using quality setting
        const compressed = await compressAttachment(photo.uri, settings.imageQuality);

        // Generate IDs
        const photoId = Crypto.randomUUID();
        const userId = user.id;

        if (isEditing) {
          // EXISTING ENTRY: Save photo to DB immediately using proper API
          // Use effectiveEntryId (handles autosaved new entries where savedEntryId is set but entryId prop is null)
          const localPath = await saveAttachmentToLocalStorage(compressed.uri, photoId, userId, effectiveEntryId!);

          await createAttachment({
            attachment_id: photoId,
            entry_id: effectiveEntryId!,
            user_id: userId,
            file_path: generateAttachmentPath(userId, effectiveEntryId!, photoId, 'jpg'),
            local_path: localPath,
            mime_type: 'image/jpeg',
            file_size: compressed.file_size,
            width: compressed.width,
            height: compressed.height,
            position: currentPosition,
            uploaded: false,
          });
        } else {
          // NEW ENTRY: Store photo in state only
          const localPath = await saveAttachmentToLocalStorage(compressed.uri, photoId, userId, tempEntryId);

          addPendingPhoto({
            photoId,
            localPath,
            filePath: generateAttachmentPath(userId, tempEntryId, photoId, 'jpg'),
            mimeType: 'image/jpeg',
            fileSize: compressed.file_size,
            width: compressed.width,
            height: compressed.height,
            position: currentPosition,
          });
        }

        currentPosition++;
      }

      // Update photo count once at the end with total
      setPhotoCount(currentPosition);

      // Enter edit mode if not already in it
      if (!isEditMode) {
        enterEditMode();
      }
    } catch (error) {
      console.error('Error adding photos:', error);
      Alert.alert('Error', 'Failed to add some photos');
    }
  };

  // Photo deletion handler
  const handlePhotoDelete = async (photoId: string) => {
    try {
      // Enter edit mode if not already (deletion is an edit action)
      if (!isEditMode) {
        enterEditMode();
      }

      if (isEditing) {
        // EXISTING ENTRY: Delete from DB
        await deleteAttachment(photoId);
      } else {
        // NEW ENTRY: Remove from pending photos state
        removePendingPhoto(photoId);
      }

      // Decrement photo count
      setPhotoCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error deleting photo:', error);
      Alert.alert('Error', 'Failed to delete photo');
    }
  };

  // Show loading when editing/copying and form is not fully ready
  // This blocks rendering until entry AND location are both loaded
  if ((isEditing || isCopiedEntry) && !isFormReady) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background.primary }]}>
        <Text style={[styles.loadingText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Loading...</Text>
      </View>
    );
  }

  // Show error if editing an EXISTING entry (opened via entryId) and entry not found
  // Don't show error if we just created the entry via autosave (savedEntryId is set)
  // because we know it exists - React Query just hasn't cached it yet
  if (isEditing && !entry && !savedEntryId) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background.primary }]}>
        <Text style={[styles.errorText, { color: theme.colors.functional.overdue, fontFamily: theme.typography.fontFamily.medium }]}>Entry not found</Text>
        <TouchableOpacity onPress={() => navigate("inbox")} style={[styles.backButton, { backgroundColor: theme.colors.functional.accent }]}>
          <Text style={[styles.backButtonText, { color: "#ffffff", fontFamily: theme.typography.fontFamily.semibold }]}>Back to Uncategorized</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      {/* Header Bar with Back/Date/Save buttons */}
      <CaptureFormHeader
        isEditMode={isEditMode}
        isFullScreen={isFullScreen}
        isSubmitting={isSubmitting}
        isSaving={isSaving}
        isEditing={isEditing}
        isDirty={isFormDirty}
        title={formData.title}
        entryDate={formData.entryDate}
        includeTime={formData.includeTime}
        onTitleChange={(text) => updateField("title", text)}
        onBack={handleBack}
        onDatePress={() => setActivePicker('entryDate')}
        onTimePress={() => setActivePicker('time')}
        onAddTime={() => {
          updateField("includeTime", true);
          const date = new Date(formData.entryDate);
          date.setMilliseconds(0);
          updateField("entryDate", date.toISOString());
        }}
        onAttributesPress={() => setActivePicker('attributes')}
        enterEditMode={enterEditMode}
        editorRef={editorRef}
      />

      {/* Metadata Bar - Only shows SET values (hidden in full-screen mode) */}
      {!isFullScreen && (
        <MetadataBar
          streamName={formData.streamName}
          gpsData={formData.gpsData}
          locationData={formData.locationData}
          status={formData.status}
          type={formData.type}
          dueDate={formData.dueDate}
          rating={formData.rating}
          priority={formData.priority}
          photoCount={photoCount}
          photosCollapsed={photosCollapsed}
          showLocation={showLocation}
          showStatus={showStatus}
          showType={showType}
          showDueDate={showDueDate}
          showRating={showRating}
          showPriority={showPriority}
          showPhotos={showPhotos}
          unsupportedStatus={unsupportedStatus}
          unsupportedType={unsupportedType}
          unsupportedDueDate={unsupportedDueDate}
          unsupportedRating={unsupportedRating}
          unsupportedPriority={unsupportedPriority}
          unsupportedLocation={unsupportedLocation}
          availableTypes={currentStream?.entry_types ?? []}
          ratingType={currentStream?.entry_rating_type || 'stars'}
          isEditMode={isEditMode}
          enterEditMode={enterEditMode}
          onStreamPress={() => setActivePicker(activePicker === 'stream' ? null : 'stream')}
          onGpsPress={() => setActivePicker(activePicker === 'gps' ? null : 'gps')}
          onLocationPress={() => unsupportedLocation ? setActivePicker('unsupportedLocation') : setActivePicker(activePicker === 'location' ? null : 'location')}
          onStatusPress={() => unsupportedStatus ? setActivePicker('unsupportedStatus') : setActivePicker(activePicker === 'status' ? null : 'status')}
          onTypePress={() => unsupportedType ? setActivePicker('unsupportedType') : setActivePicker(activePicker === 'type' ? null : 'type')}
          onDueDatePress={() => unsupportedDueDate ? setActivePicker('unsupportedDueDate') : setActivePicker(activePicker === 'dueDate' ? null : 'dueDate')}
          onRatingPress={() => unsupportedRating ? setActivePicker('unsupportedRating') : setActivePicker('rating')}
          onPriorityPress={() => unsupportedPriority ? setActivePicker('unsupportedPriority') : setActivePicker('priority')}
          onPhotosPress={() => setPhotosCollapsed(false)}
          editorRef={editorRef}
        />
      )}

      {/* Title Row - Full width below metadata (hidden in fullscreen - formData.title shows in header) */}
      {!isFullScreen && (
        <View style={styles.titleRow}>
          {shouldCollapse ? (
            <TouchableOpacity
              style={styles.titleCollapsed}
              onPress={() => {
                if (isEditMode) {
                  setIsTitleExpanded(true);
                  setTimeout(() => titleInputRef.current?.focus(), 100);
                } else {
                  enterEditMode();
                  setIsTitleExpanded(true);
                  setTimeout(() => titleInputRef.current?.focus(), 100);
                }
              }}
            >
              <Text style={[styles.titlePlaceholder, { color: theme.colors.text.disabled, fontFamily: theme.typography.fontFamily.regular }]}>
                {isEditMode ? "Add Title" : "Untitled"}
              </Text>
            </TouchableOpacity>
          ) : !isEditMode ? (
            // View mode: use Text in TouchableOpacity (TextInput with editable=false doesn't capture taps)
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleTitlePress}
              style={styles.titleTouchable}
            >
              <Text style={[styles.titleText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]}>
                {formData.title || "Title"}
              </Text>
            </TouchableOpacity>
          ) : (
            // Edit mode: direct TextInput for keyboard interaction
            <TextInput
              ref={titleInputRef}
              value={formData.title}
              onChangeText={(text) => updateField("title", text.replace(/\n/g, ' '))}
              placeholder={isTitleFocused ? "" : "Add Title"}
              placeholderTextColor={theme.colors.text.disabled}
              style={[styles.titleInputFullWidth, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]}
              editable={!isSubmitting}
              multiline={true}
              blurOnSubmit={true}
              returnKeyType="done"
              onFocus={() => {
                setIsTitleFocused(true);
                setIsTitleExpanded(true);
                // Clear any pending body focus - title is being focused instead
                editorRef.current?.clearPendingFocus?.();
                // Also blur the editor to ensure keyboard shows for title, not body
                editorRef.current?.blur?.();
              }}
              onBlur={() => setIsTitleFocused(false)}
              onPressIn={handleTitlePress}
            />
          )}
        </View>
      )}

      {/* Content Area */}
      <View style={[
        styles.contentContainer,
        // Dynamic padding to account for bottom bar height (~60px)
        isEditMode ? { paddingBottom: 60 } : { paddingBottom: 0 },
        keyboardHeight > 0 && { paddingBottom: keyboardHeight + 80 }
      ]}>

        {/* Photo Gallery (hidden in full-screen mode) */}
        {!isFullScreen && (
          <PhotoGallery
            entryId={effectiveEntryId || tempEntryId}
            refreshKey={photoCount + externalRefreshKey}
            onPhotoCountChange={setPhotoCount}
            onPhotoDelete={handlePhotoDelete}
            pendingPhotos={isEditing ? undefined : formData.pendingPhotos}
            collapsible={true}
            isCollapsed={photosCollapsed}
            onCollapsedChange={setPhotosCollapsed}
            onAddPhoto={() => {
              if (!isEditMode) enterEditMode();
              photoCaptureRef.current?.openMenu();
            }}
          />
        )}

        {/* Editor */}
        <View style={[
          styles.editorContainer,
          isFullScreen && styles.fullScreenEditor
        ]}>
          <RichTextEditor
            ref={editorRef}
            value={formData.content}
            onChange={(text) => updateField("content", text)}
            placeholder="What's on your mind? Use #tags and @mentions..."
            editable={isEditMode}
            onPress={enterEditMode}
            onReady={handleEditorReady}
          />
        </View>

      </View>

      {/* Bottom Bar - only shown when in edit mode */}
      {isEditMode && (
        <BottomBar keyboardOffset={keyboardHeight}>
          <EditorToolbar
            editorRef={editorRef}
            isFullScreen={isFullScreen}
            onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
          />
        </BottomBar>
      )}

      {/* Stream Picker Dropdown - only render when active to avoid unnecessary hook calls */}
      {activePicker === 'stream' && (
        <TopBarDropdownContainer
          visible={true}
          onClose={() => setActivePicker(null)}
          fullHeight={true}
        >
          <StreamPicker
            visible={true}
            onClose={() => setActivePicker(null)}
            isNewEntry={!isEditing}
            onSelect={(id, name) => {
              const hadStream = !!formData.streamId;
              const isRemoving = !id;
              updateField("streamId", id);
              updateField("streamName", name);

              // Apply templates when stream is selected (not removed)
              if (id) {
                const selectedStream = streams.find(s => s.stream_id === id);

                if (selectedStream) {
                  const templateDate = new Date();
                  const titleIsBlank = !formData.title.trim();
                  const contentIsBlank = !formData.content.trim();

                  // Apply title template if title is blank (independent of content)
                  if (titleIsBlank && selectedStream.entry_title_template) {
                    const newTitle = applyTitleTemplate(selectedStream.entry_title_template, {
                      date: templateDate,
                      streamName: selectedStream.name,
                    });
                    if (newTitle) {
                      updateField("title", newTitle);
                    }
                  }

                  // Apply content template if content is blank (independent of title)
                  if (contentIsBlank && selectedStream.entry_content_template) {
                    const newContent = applyContentTemplate(selectedStream.entry_content_template, {
                      date: templateDate,
                      streamName: selectedStream.name,
                    });
                    if (newContent) {
                      updateField("content", newContent);
                    }
                  }

                  // Apply default status if current status is "none"
                  if (formData.status === "none" && selectedStream.entry_use_status && selectedStream.entry_default_status) {
                    updateField("status", selectedStream.entry_default_status);
                  }
                }
              }

              if (isRemoving && hadStream) {
                showSnackbar('You removed the stream');
              } else if (hadStream) {
                showSnackbar('Success! You updated the stream.');
              } else {
                showSnackbar('Success! You added the stream.');
              }
              if (!isEditMode) {
                enterEditMode();
              }
            }}
            selectedStreamId={formData.streamId}
          />
        </TopBarDropdownContainer>
      )}

      {/* GPS Picker - Read-only display with remove/reload options */}
      <GpsPicker
        visible={activePicker === 'gps'}
        onClose={() => {
          setActivePicker(null);
          setIsNewGpsCapture(false);
          setPendingGpsData(null); // Clear pending GPS when closing without saving
        }}
        gpsData={isNewGpsCapture ? pendingGpsData : formData.gpsData}
        onRemove={() => {
          updateField("gpsData", null);
          setActivePicker(null);
          setIsNewGpsCapture(false);
          setPendingGpsData(null);
          if (!isEditMode) enterEditMode();
        }}
        onReload={() => {
          // Don't close the picker - reload in place with high accuracy
          // When in new capture mode, reload to pending; otherwise reload to formData
          captureGps(true, isNewGpsCapture);
        }}
        onUseLocation={() => {
          // Switch to Location picker - GPS will be cleared when location is selected
          // If in new capture mode with pending GPS, commit it first so location picker can use it
          if (isNewGpsCapture && pendingGpsData) {
            updateField("gpsData", pendingGpsData);
          }
          setIsNewGpsCapture(false);
          setPendingGpsData(null);
          setTimeout(() => setActivePicker('location'), 100);
        }}
        onSave={(location) => {
          // Save the GPS location (either from map tap or GPS reload)
          updateField("gpsData", location);
          setPendingGpsData(null);
          setIsNewGpsCapture(false);
          if (!isEditMode) enterEditMode();
        }}
        isLoading={isGpsLoading}
        units={settings.units}
        onSnackbar={showSnackbar}
      />

      {/* Location Picker (fullscreen modal) - only render when active to avoid unnecessary hook calls */}
      {activePicker === 'location' && (
        <LocationPicker
          visible={true}
          onClose={() => setActivePicker(null)}
          mode={locationPickerMode}
          onSelect={(location: LocationType | null) => {
            // If location is null (user selected "None"), clear location data
            if (location === null) {
              updateField("locationData", null);
              setActivePicker(null);
              showSnackbar('You removed the location');
              if (!isEditMode) {
                enterEditMode();
              }
              return;
            }

            // Show snackbar based on whether we're adding or updating
            const isUpdating = !!formData.locationData?.name;

            // When a Location is selected:
            // 1. Set the location data
            // 2. Clear GPS data (Location supersedes GPS in the UI)
            // Note: entry_latitude/longitude will be set from locationData on save
            updateField("locationData", location);
            updateField("gpsData", null); // Location replaces GPS

            setActivePicker(null);
            showSnackbar(isUpdating ? 'Success! You updated the location.' : 'Success! You added the location.');
            if (!isEditMode) {
              enterEditMode();
            }
          }}
          initialLocation={formData.locationData ? {
            latitude: formData.locationData.latitude,
            longitude: formData.locationData.longitude,
            name: formData.locationData.name,
            source: 'user_custom',
          } : formData.gpsData ? {
            latitude: formData.gpsData.latitude,
            longitude: formData.gpsData.longitude,
            name: null,
            source: 'user_custom',
          } : null}
        />
      )}

      {/* Due Date Picker Modal */}
      <DueDatePicker
        visible={activePicker === 'dueDate'}
        onClose={() => setActivePicker(null)}
        dueDate={formData.dueDate}
        onDueDateChange={(date) => updateField("dueDate", date)}
        onSnackbar={showSnackbar}
      />

      {/* Entry Date Picker */}
      <EntryDatePicker
        visible={activePicker === 'entryDate'}
        onClose={() => setActivePicker(null)}
        entryDate={formData.entryDate}
        onEntryDateChange={(date) => updateField("entryDate", date)}
        onSnackbar={showSnackbar}
      />

      {/* Time Picker Modal */}
      <TimePicker
        visible={activePicker === 'time'}
        onClose={() => setActivePicker(null)}
        entryDate={formData.entryDate}
        onEntryDateChange={(date) => updateField("entryDate", date)}
        onIncludeTimeChange={(include) => updateField("includeTime", include)}
        onSnackbar={showSnackbar}
        includeTime={formData.includeTime}
      />

      {/* Rating Picker Modal - switch between stars, decimal_whole, and decimal based on stream config */}
      {currentStream?.entry_rating_type === 'decimal' ? (
        <DecimalRatingPicker
          visible={activePicker === 'rating'}
          onClose={() => setActivePicker(null)}
          rating={formData.rating}
          onRatingChange={(value) => updateField("rating", value)}
          onSnackbar={showSnackbar}
        />
      ) : currentStream?.entry_rating_type === 'decimal_whole' ? (
        <WholeNumberRatingPicker
          visible={activePicker === 'rating'}
          onClose={() => setActivePicker(null)}
          rating={formData.rating}
          onRatingChange={(value) => updateField("rating", value)}
          onSnackbar={showSnackbar}
        />
      ) : (
        <RatingPicker
          visible={activePicker === 'rating'}
          onClose={() => setActivePicker(null)}
          rating={formData.rating}
          onRatingChange={(value) => updateField("rating", value)}
          onSnackbar={showSnackbar}
        />
      )}

      {/* Priority Picker Modal */}
      <PriorityPicker
        visible={activePicker === 'priority'}
        onClose={() => setActivePicker(null)}
        priority={formData.priority}
        onPriorityChange={(value) => updateField("priority", value)}
        onSnackbar={showSnackbar}
      />

      {/* Status Picker Modal */}
      <StatusPicker
        visible={activePicker === 'status'}
        onClose={() => setActivePicker(null)}
        status={formData.status}
        onStatusChange={(value) => {
          updateField("status", value);
          if (!isEditMode) enterEditMode();
        }}
        onSnackbar={showSnackbar}
        allowedStatuses={currentStream?.entry_statuses}
      />

      {/* Type Picker Modal */}
      <TypePicker
        visible={activePicker === 'type'}
        onClose={() => setActivePicker(null)}
        type={formData.type}
        onTypeChange={(value) => {
          updateField("type", value);
          if (!isEditMode) enterEditMode();
        }}
        onSnackbar={showSnackbar}
        availableTypes={currentStream?.entry_types ?? []}
      />

      {/* Unsupported Attribute Pickers - show when attribute has value but stream doesn't support it */}
      <UnsupportedAttributePicker
        visible={activePicker === 'unsupportedStatus'}
        onClose={() => setActivePicker(null)}
        attributeName="Status"
        currentValue={formData.status === 'none' ? 'None' : formData.status.charAt(0).toUpperCase() + formData.status.slice(1)}
        onRemove={() => {
          updateField("status", "none");
          if (!isEditMode) enterEditMode();
        }}
        onSnackbar={showSnackbar}
      />

      <UnsupportedAttributePicker
        visible={activePicker === 'unsupportedType'}
        onClose={() => setActivePicker(null)}
        attributeName="Type"
        currentValue={formData.type || ''}
        onRemove={() => {
          updateField("type", null);
          if (!isEditMode) enterEditMode();
        }}
        onSnackbar={showSnackbar}
      />

      <UnsupportedAttributePicker
        visible={activePicker === 'unsupportedDueDate'}
        onClose={() => setActivePicker(null)}
        attributeName="Due Date"
        currentValue={formData.dueDate ? new Date(formData.dueDate).toLocaleDateString() : ''}
        onRemove={() => {
          updateField("dueDate", null);
          if (!isEditMode) enterEditMode();
        }}
        onSnackbar={showSnackbar}
      />

      <UnsupportedAttributePicker
        visible={activePicker === 'unsupportedRating'}
        onClose={() => setActivePicker(null)}
        attributeName="Rating"
        currentValue={`${formData.rating} star${formData.rating !== 1 ? 's' : ''}`}
        onRemove={() => {
          updateField("rating", 0);
          if (!isEditMode) enterEditMode();
        }}
        onSnackbar={showSnackbar}
      />

      <UnsupportedAttributePicker
        visible={activePicker === 'unsupportedPriority'}
        onClose={() => setActivePicker(null)}
        attributeName="Priority"
        currentValue={formData.priority === 1 ? 'Low' : formData.priority === 2 ? 'Medium' : 'High'}
        onRemove={() => {
          updateField("priority", 0);
          if (!isEditMode) enterEditMode();
        }}
        onSnackbar={showSnackbar}
      />

      <UnsupportedAttributePicker
        visible={activePicker === 'unsupportedLocation'}
        onClose={() => setActivePicker(null)}
        attributeName="Location"
        currentValue={formData.locationData?.name || 'Unknown Location'}
        onRemove={() => {
          updateField("locationData", null);
          if (!isEditMode) enterEditMode();
        }}
        onSnackbar={showSnackbar}
      />

      {/* Entry Menu */}
      <AttributesPicker
        visible={activePicker === 'attributes'}
        onClose={() => setActivePicker(null)}
        isEditing={isEditing}
        isEditMode={isEditMode}
        enterEditMode={enterEditMode}
        showLocation={showLocation}
        showStatus={showStatus}
        showType={showType}
        showDueDate={showDueDate}
        showRating={showRating}
        showPriority={showPriority}
        showPhotos={showPhotos}
        hasGpsData={!!formData.gpsData}
        hasLocationData={!!formData.locationData?.name}
        status={formData.status}
        type={formData.type}
        dueDate={formData.dueDate}
        rating={formData.rating}
        priority={formData.priority}
        photoCount={photoCount}
        onAddGps={() => {
          setIsNewGpsCapture(true);
          setActivePicker('gps');
          captureGps(false, true); // Capture to pending state
        }}
        onShowLocationPicker={() => setActivePicker('location')}
        onShowStatusPicker={() => setActivePicker('status')}
        onShowTypePicker={() => setActivePicker('type')}
        onShowDatePicker={() => setActivePicker('dueDate')}
        onShowRatingPicker={() => setActivePicker('rating')}
        onShowPriorityPicker={() => setActivePicker('priority')}
        onAddPhoto={() => photoCaptureRef.current?.openMenu()}
        onDelete={handleDelete}
        onSnackbar={showSnackbar}
      />

      {/* Photo Capture (hidden, triggered via ref) */}
      <PhotoCapture
        ref={photoCaptureRef}
        showButton={false}
        onPhotoSelected={handlePhotoSelected}
        onMultiplePhotosSelected={handleMultiplePhotosSelected}
        onSnackbar={showSnackbar}
      />

      {/* Snackbar */}
      {snackbarMessage && (
        <Animated.View style={[styles.snackbar, { opacity: snackbarOpacity }]}>
          <Text style={[styles.snackbarText, { fontFamily: theme.typography.fontFamily.medium }]}>{snackbarMessage}</Text>
        </Animated.View>
      )}
    </View>
  );
}
