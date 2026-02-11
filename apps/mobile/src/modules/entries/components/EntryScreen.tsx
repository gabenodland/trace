/**
 * @deprecated This screen has been replaced by EntryManagementScreen.
 * Use EntryManagementScreen for all new code. This file will be removed once
 * the migration is complete and EntryManagementScreen is stable.
 *
 * EntryManagementScreen uses:
 * - Direct useState instead of EntryFormContext (simpler, easier to debug)
 * - Refs for cross-component communication instead of Context
 * - Props/parameters pattern for extracted hooks
 *
 * This screen uses the old pattern:
 * - EntryFormContext for all state (heavy indirection)
 * - Context-based hooks (useGpsCapture, useAutoGeocode, useAutosave)
 */
import { useRef, useMemo, useCallback, useEffect, useLayoutEffect, forwardRef, useImperativeHandle } from "react";
import { View, Text, TouchableOpacity, Alert, Animated } from "react-native";
import { extractTagsAndMentions, locationToCreateInput, type EntryStatus, applyTitleTemplate, applyContentTemplate, splitTitleAndBody } from "@trace/core";
import { createLocation } from '../../locations/mobileLocationApi';
import { useEntries, useEntry } from "../mobileEntryHooks";
import { useStreams } from "../../streams/mobileStreamHooks";
import { useLocations } from "../../locations/mobileLocationHooks";
import { useAttachments } from "../../attachments/mobileAttachmentHooks";
import { useNavigate } from "../../../shared/navigation";
import { useSettings } from "../../../shared/contexts/SettingsContext";
import { useAuth } from "../../../shared/contexts/AuthContext";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { RichTextEditorV2 } from "../../../components/editor/RichTextEditorV2";
import { BottomBar } from "../../../components/layout/BottomBar";
import { PhotoCapture, type PhotoCaptureRef } from "../../photos/components/PhotoCapture";
import { PhotoGallery } from "../../photos/components/PhotoGallery";
import { createAttachment } from "../../attachments/mobileAttachmentApi";
import { EntryFormProvider, useEntryForm, type NewEntryOptions } from "./context/EntryFormContext";
import { useAutosave } from "./hooks/useAutosave";
import { useGpsCapture } from "./hooks/useGpsCapture";
import { useAutoGeocode } from "./hooks/useAutoGeocode";
import { useKeyboardHeight } from "./hooks/useKeyboardHeight";
import { useEntryNavigation } from "./hooks/useEntryNavigation";
import { useEntryPhotos } from "./hooks/useEntryPhotos";
import { getEntryFieldVisibility, getUnsupportedFieldFlags } from "./helpers/entryVisibility";
import { buildGpsFields, buildLocationHierarchyFields, getOrCreateLocationId, extractContentMetadata, hasUserContent } from "./helpers/entrySaveHelpers";
import { styles } from "./EntryScreen.styles";
import { MetadataBar } from "./MetadataBar";
import { EditorToolbar } from "./EditorToolbar";
import { EntryHeader } from "./EntryHeader";
import { EntryPickers } from "./EntryPickers";
import { createScopedLogger } from "../../../shared/utils/logger";

const log = createScopedLogger('EntryScreen', '📄');

/**
 * Ref interface for EntryScreen singleton pattern
 * Navigation calls setEntry() to populate the form instead of passing props
 */
export interface EntryScreenRef {
  /** Set entry for editing by ID (or null with options for new entry) */
  setEntry: (entryId: string | null, options?: NewEntryOptions) => void;
  /** Clear the form - call when navigating away from capture screen */
  clearEntry: () => void;
}

interface EntryScreenProps {
  /** Whether this screen is currently visible */
  isVisible?: boolean;
}

/**
 * EntryScreen - Persistent entry editor
 *
 * PERSISTENT SCREEN PATTERN:
 * - Mounts once at app start and stays mounted (like main screens)
 * - Navigation calls ref.setEntry(entryId) to load an entry
 * - Screen fetches entry data itself via useEntry hook
 * - No entry-related props that change - avoids remounts
 *
 * Usage from navigation:
 *   entryScreenRef.current?.setEntry(entryId)  // Edit existing
 *   entryScreenRef.current?.setEntry(null, { streamId })  // Create new
 */
export const EntryScreen = forwardRef<EntryScreenRef, EntryScreenProps>(({ isVisible = true }, ref) => {
  // Fetch data needed by the provider (these don't cause remounts)
  const { streams } = useStreams();
  const { data: savedLocations = [] } = useLocations();
  const { settings } = useSettings();
  const { user } = useAuth();

  // Refs to pass setEntry and clearEntry from context to parent
  const setEntryRef = useRef<((entryId: string | null, options?: NewEntryOptions) => void) | null>(null);
  const clearEntryRef = useRef<(() => void) | null>(null);

  // Expose setEntry and clearEntry via ref for navigation to call
  useImperativeHandle(ref, () => ({
    setEntry: (entryId: string | null, options?: NewEntryOptions) => {
      log.info('EntryScreen.setEntry called via ref', {
        entryId: entryId?.substring(0, 8) || 'new',
        hasOptions: !!options,
      });
      setEntryRef.current?.(entryId, options);
    },
    clearEntry: () => {
      log.info('EntryScreen.clearEntry called via ref');
      clearEntryRef.current?.();
    },
  }), []);

  return (
    <EntryFormProvider
      streams={streams}
      settings={{
        captureGpsLocation: settings.captureGpsLocation,
        imageQuality: settings.imageQuality,
      }}
      userId={user?.id ?? null}
    >
      <EntryScreenContent
        streams={streams}
        savedLocations={savedLocations}
        setEntryRef={setEntryRef}
        clearEntryRef={clearEntryRef}
      />
    </EntryFormProvider>
  );
});

interface EntryScreenContentProps {
  streams: ReturnType<typeof useStreams>['streams'];
  savedLocations: ReturnType<typeof useLocations>['data'];
  /** Ref to expose setEntry from context to parent */
  setEntryRef: React.RefObject<((entryId: string | null, options?: NewEntryOptions) => void) | null>;
  /** Ref to expose clearEntry from context to parent */
  clearEntryRef: React.RefObject<(() => void) | null>;
}

/**
 * EntryScreenContent - Main content using context
 * All state comes from useEntryForm()
 */
function EntryScreenContent({ streams, savedLocations, setEntryRef, clearEntryRef }: EntryScreenContentProps) {
  const theme = useTheme();
  const navigate = useNavigate();

  // Get ALL state from context
  const {
    // User and settings
    userId,
    // Form data
    formData,
    updateField,
    updateMultipleFields,
    setBaseline,
    markClean,
    isFormDirty,
    // Editing state
    isEditing,
    effectiveEntryId,
    tempEntryId,
    savedEntryId,
    setSavedEntryId,
    entry,
    // Save state
    isSubmitting,
    setIsSubmitting,
    isSaving,
    setIsSaving,
    // Edit mode
    isEditMode,
    setIsEditMode,
    isFullScreen,
    setIsFullScreen,
    enterEditMode,
    editModeInitialContent,
    // Photo tracking
    photoCount,
    setPhotoCount,
    baselinePhotoCount,
    setBaselinePhotoCount,
    syncPhotoCount,
    externalRefreshKey,
    // UI state
    activePicker,
    setActivePicker,
    photosCollapsed,
    setPhotosCollapsed,
    // Snackbar
    snackbarMessage,
    snackbarOpacity,
    showSnackbar,
    // Refs
    editorRef,
    handleSaveRef,
    handleAutosaveRef,
    // Version conflict
    checkForConflict,
    initializeVersion,
    updateKnownVersion,
    incrementKnownVersion,
    recordSaveTime,
    // Singleton pattern
    setEntry,
    onEntryLoaded,
    clearEntry,
  } = useEntryForm();

  // Connect refs to context functions (allows parent to call setEntry/clearEntry)
  useEffect(() => {
    setEntryRef.current = setEntry;
  }, [setEntry, setEntryRef]);

  useEffect(() => {
    clearEntryRef.current = clearEntry;
  }, [clearEntry, clearEntryRef]);

  // Fetch entry data - this is the source of truth for editing
  const { entry: fetchedEntry, isLoading: isLoadingEntry, entryMutations: singleEntryMutations } = useEntry(effectiveEntryId || null);

  // Debug: Log immediately after useEntry to see if placeholderData works
  if (effectiveEntryId) {
    log.info('⏱️ useEntry returned', {
      entryId: effectiveEntryId.substring(0, 8),
      hasFetchedEntry: !!fetchedEntry,
      isLoading: isLoadingEntry,
      title: fetchedEntry?.title?.substring(0, 20) || '(none)',
    });
  }

  // Use ref for onEntryLoaded to avoid effect re-triggering when callback changes
  // (onEntryLoaded depends on `entry`, which changes when it's called - causing double invocation)
  const onEntryLoadedRef = useRef(onEntryLoaded);
  onEntryLoadedRef.current = onEntryLoaded;

  // When entry is fetched, notify context to populate form
  // useLayoutEffect runs synchronously before paint - reduces perceived load time
  useLayoutEffect(() => {
    if (fetchedEntry && effectiveEntryId) {
      log.info('⏱️ fetchedEntry arrived in effect', {
        entryId: fetchedEntry.entry_id?.substring(0, 8),
        title: fetchedEntry.title?.substring(0, 20) || '(no title)',
        contentLength: fetchedEntry.content?.length || 0,
      });
      onEntryLoadedRef.current(fetchedEntry);
    }
  }, [fetchedEntry, effectiveEntryId]);
  const { entryMutations } = useEntries();
  const { attachments: queryAttachments } = useAttachments(effectiveEntryId || null);

  const photoCaptureRef = useRef<PhotoCaptureRef>(null);

  // Keyboard height tracking - also detects when user taps into editor
  // Using keyboard show event because Android WebView needs native touch for keyboard
  const keyboardHeight = useKeyboardHeight({
    onShow: () => {
      if (!isEditMode) {
        enterEditMode();
      }
    },
  });

  // Get current stream for visibility controls
  const currentStream = streams.find(s => s.stream_id === formData.streamId);

  // Stream-based field visibility
  const {
    showRating, showPriority, showStatus, showType,
    showDueDate, showLocation, showPhotos
  } = useMemo(() => getEntryFieldVisibility(currentStream), [currentStream]);

  // Stream data readiness for GPS capture
  const streamReady = !formData.streamId || !!currentStream;

  // Unsupported flags
  const {
    unsupportedStatus, unsupportedType, unsupportedDueDate,
    unsupportedRating, unsupportedPriority, unsupportedLocation
  } = useMemo(() => getUnsupportedFieldFlags(
    { showRating, showPriority, showStatus, showType, showDueDate, showLocation, showPhotos },
    formData
  ), [showRating, showPriority, showStatus, showType, showDueDate, showLocation, showPhotos, formData]);

  // Editor content is now set directly by context (setEntry, onEntryLoaded, clearEntry)
  // No content swap effect needed here - the singleton pattern manages content in one place

  const handleEditorChange = useCallback((html: string) => {
    const { title, body } = splitTitleAndBody(html);
    if (title !== formData.title) updateField("title", title);
    if (body !== formData.content) updateField("content", body);
  }, [formData.title, formData.content, updateField]);

  // Navigation hook - handles back button and auto-save
  const { handleBack, navigateBack } = useEntryNavigation();

  // Autosave hook
  useAutosave();

  // Photo handlers from hook
  const { handlePhotoSelected: onPhotoSelected, handleMultiplePhotosSelected: onMultiplePhotosSelected, handlePhotoDelete } = useEntryPhotos();

  // Adapter functions to match PhotoCapture interface (uri, width, height) to hook interface (PhotoInfo object)
  const handlePhotoSelected = useCallback((uri: string, width: number, height: number) => {
    onPhotoSelected({ uri, width, height });
    // Expand photos if collapsed
    if (photosCollapsed) {
      setPhotosCollapsed(false);
    }
  }, [onPhotoSelected, photosCollapsed]);

  const handleMultiplePhotosSelected = useCallback((photos: { uri: string; width: number; height: number }[]) => {
    onMultiplePhotosSelected(photos);
    // Expand photos if collapsed
    if (photosCollapsed) {
      setPhotosCollapsed(false);
    }
  }, [onMultiplePhotosSelected, photosCollapsed]);

  // GPS capture hook (values used by EntryPickers via context)
  useGpsCapture({
    streamReady,
    locationEnabled: showLocation,
  });

  // Auto-geocode hook
  useAutoGeocode({
    savedLocations: savedLocations || [],
    locationEnabled: showLocation,
  });

  // Location picker mode
  const locationPickerMode: 'select' | 'view' =
    (formData.locationData?.latitude && formData.locationData?.longitude) ? 'view' : 'select';

  // Initialize baseline for new entries
  useEffect(() => {
    if (!isEditing && baselinePhotoCount === null) {
      setBaseline(formData);
      setBaselinePhotoCount(0);
      editModeInitialContent.current = formData.content;
    }
  }, []);

  // Set baseline photo count for editing after entry loads
  useEffect(() => {
    if (isEditing && entry && baselinePhotoCount === null) {
      const actualPhotoCount = queryAttachments.length;
      setBaselinePhotoCount(actualPhotoCount);
      if (photoCount !== actualPhotoCount) {
        syncPhotoCount(actualPhotoCount);
      }
    }
  }, [isEditing, entry, baselinePhotoCount, queryAttachments.length, photoCount, syncPhotoCount]);

  // Apply default status for new entries with initial stream
  useEffect(() => {
    if (isEditing) return;
    if (!formData.streamId || streams.length === 0) return;
    if (formData.status !== "none") return;

    const stream = streams.find(s => s.stream_id === formData.streamId);
    if (stream?.entry_use_status && stream?.entry_default_status) {
      updateField("status", stream.entry_default_status);
    }
  }, [isEditing, formData.streamId, formData.status, streams, updateField]);

  // Apply templates when form loads with initial stream (singleton pattern)
  // Templates are applied once when setEntry creates a new entry with a streamId
  const hasAppliedInitialTemplateRef = useRef(false);
  const lastFormStreamIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isEditing) return;
    if (streams.length === 0) return;
    if (!formData.streamId) return;

    // Reset template tracking when switching to a different stream or new entry
    if (formData.streamId !== lastFormStreamIdRef.current) {
      lastFormStreamIdRef.current = formData.streamId;
      hasAppliedInitialTemplateRef.current = false;
    }

    if (hasAppliedInitialTemplateRef.current) return;

    const selectedStream = streams.find(s => s.stream_id === formData.streamId);
    if (!selectedStream) return;

    hasAppliedInitialTemplateRef.current = true;

    const templateDate = new Date();
    const titleIsBlank = !formData.title.trim();
    const contentIsBlank = !formData.content.trim();

    if (titleIsBlank && selectedStream.entry_title_template) {
      const newTitle = applyTitleTemplate(selectedStream.entry_title_template, {
        date: templateDate,
        streamName: selectedStream.name,
      });
      if (newTitle) {
        updateField("title", newTitle);
      }
    }

    if (contentIsBlank && selectedStream.entry_content_template) {
      const newContent = applyContentTemplate(selectedStream.entry_content_template, {
        date: templateDate,
        streamName: selectedStream.name,
      });
      if (newContent) {
        updateField("content", newContent);
      }
    }

    if (selectedStream.entry_use_status && selectedStream.entry_default_status && selectedStream.entry_default_status !== "none") {
      updateField("status", selectedStream.entry_default_status);
    }
  }, [isEditing, streams, formData.streamId, formData.title, formData.content, updateField]);

  // Called when RichTextEditorV2 is ready
  // Content is set by context (setEntry/onEntryLoaded), so we just log here
  const handleEditorReady = useCallback(() => {
    log.info('handleEditorReady called (V2)', {
      isEditing,
      hasEntry: !!entry,
      effectiveEntryId: effectiveEntryId?.substring(0, 8) || 'new',
    });
  }, [isEditing, entry, effectiveEntryId]);

  // Save handler
  const handleSave = useCallback(async (isAutosave = false) => {
    if (isSubmitting || isSaving) return;

    setIsSaving(true);
    if (!isAutosave) {
      setIsSubmitting(true);
    }

    // Conflict detection
    const conflictResult = checkForConflict(entry ?? null);
    if (entry && conflictResult?.hasConflict) {
      const { currentVersion, conflictDevice: lastDevice } = conflictResult;

      setIsSubmitting(false);
      setIsSaving(false);

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
                });
                updateKnownVersion(currentVersion);
                markClean();
                setBaselinePhotoCount(photoCount);
                showSnackbar('Discarded your changes, loaded latest version');
                resolve();
              },
            },
            {
              text: 'Save as Copy',
              onPress: async () => {
                try {
                  const { tags, mentions } = extractTagsAndMentions(formData.content);
                  const gpsFields = buildGpsFields(formData.locationData);

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
                  log.error('Failed to save as copy', error);
                  Alert.alert('Error', `Failed to save copy: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
                resolve();
              },
            },
            {
              text: 'Keep My Changes',
              style: 'default',
              onPress: async () => {
                updateKnownVersion(currentVersion);
                setIsSubmitting(true);
                await performSave();
                resolve();
              },
            },
          ]
        );
      });
    }

    await performSave(isAutosave);
  }, [isSubmitting, isSaving, entry, checkForConflict, formData, photoCount, entryMutations, navigateBack, showSnackbar, updateMultipleFields, updateKnownVersion, markClean, setBaselinePhotoCount, setIsSaving, setIsSubmitting]);

  // Actual save logic
  const performSave = useCallback(async (isAutosave = false) => {
    const editorContent = editorRef.current?.getHTML?.();
    const contentToSave = (typeof editorContent === 'string') ? editorContent : formData.content;
    // Only sync content to formData for manual saves, not autosave
    // Autosave shouldn't update formData as it causes cursor jump from re-render
    if (!isAutosave && typeof editorContent === 'string' && editorContent !== formData.content) {
      updateField("content", editorContent);
    }

    const effectivePhotoCount = isEditing ? photoCount : formData.pendingPhotos.length;
    if (!isEditing && !hasUserContent(formData.title, contentToSave, effectivePhotoCount)) {
      if (!isAutosave) {
        setIsSubmitting(false);
        setIsSaving(false);
        Alert.alert("Empty Entry", "Please add a title, content, or photo before saving");
      } else {
        setIsSaving(false);
      }
      return;
    }

    try {
      const { tags, mentions } = extractContentMetadata(contentToSave);
      const gpsFields = buildGpsFields(formData.locationData);
      const locationHierarchyFields = buildLocationHierarchyFields(formData.locationData, formData.geocodeStatus);

      let location_id = await getOrCreateLocationId(formData.locationData);
      if (location_id && formData.locationData && !formData.locationData.location_id) {
        updateField("locationData", { ...formData.locationData, location_id });
      }

      if (isEditing) {
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
          ...locationHierarchyFields,
        });
      } else {
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
          ...locationHierarchyFields,
        });

        // Save pending photos to DB with real entry_id
        if (formData.pendingPhotos.length > 0) {
          for (const photo of formData.pendingPhotos) {
            const newFilePath = photo.filePath.replace(tempEntryId, newEntry.entry_id);
            const newLocalPath = photo.localPath.replace(tempEntryId, newEntry.entry_id);

            const FileSystem = await import('expo-file-system/legacy');
            const newDir = newLocalPath.substring(0, newLocalPath.lastIndexOf('/'));
            await FileSystem.makeDirectoryAsync(newDir, { intermediates: true });
            await FileSystem.moveAsync({
              from: photo.localPath,
              to: newLocalPath,
            });

            await createAttachment({
              attachment_id: photo.photoId,
              entry_id: newEntry.entry_id,
              user_id: userId!,
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

          updateField("pendingPhotos", []);
        }

        setSavedEntryId(newEntry.entry_id);
        initializeVersion(1);
      }

      markClean();
      setBaselinePhotoCount(photoCount);
      recordSaveTime();
      if (isEditing) {
        incrementKnownVersion();
      }
    } catch (error) {
      log.error(`Failed to ${isEditing ? 'update' : 'create'} entry`, error);
      if (!isAutosave) {
        Alert.alert("Error", `Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    } finally {
      setIsSaving(false);
      if (!isAutosave) {
        setIsSubmitting(false);
      }
    }
  }, [formData, isEditing, photoCount, tempEntryId, userId, singleEntryMutations, entryMutations, editorRef, updateField, markClean, setBaselinePhotoCount, setSavedEntryId, initializeVersion, incrementKnownVersion, recordSaveTime, setIsSaving, setIsSubmitting]);

  // Update save refs for navigation and autosave
  useEffect(() => {
    handleSaveRef.current = () => handleSave();
    handleAutosaveRef.current = () => handleSave(true);
  }, [handleSave, handleSaveRef, handleAutosaveRef]);

  // Delete handler
  const handleDelete = useCallback(() => {
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
              log.error("Failed to delete entry", error);
              Alert.alert("Error", `Failed to delete: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
          },
        },
      ]
    );
  }, [isEditing, singleEntryMutations, navigate]);

  // REMOVED: Loading state return
  // We no longer return early for loading - this was causing the editor to unmount/remount!
  // The editor stays mounted, and content is set via setContent() when form is ready.
  // The loading state is now handled by keeping the editor rendered but waiting for content.

  // Error state - entry not found (only show after loading completes)
  // IMPORTANT: Use fetchedEntry (from useEntry) NOT entry (from context)
  // Context entry is set asynchronously via onEntryLoaded, but useEntry's
  // cached data is available immediately - so check fetchedEntry to avoid
  // a timing window where we show error before onEntryLoaded runs.
  if (isEditing && !isLoadingEntry && !fetchedEntry && !savedEntryId) {
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
      {/* Header Bar */}
      <EntryHeader
        isEditMode={isEditMode}
        isFullScreen={isFullScreen}
        isSaving={isSaving}
        isDirty={isFormDirty}
        entryDate={formData.entryDate}
        includeTime={formData.includeTime}
        onBack={handleBack}
        onDatePress={() => setActivePicker('entryDate')}
        onTimePress={() => setActivePicker('time')}
        onAddTime={() => {
          updateField("includeTime", true);
          const date = new Date(formData.entryDate);
          date.setMilliseconds(0);
          updateField("entryDate", date.toISOString());
        }}
        onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
        editorRef={editorRef}
      />

      {/* Metadata Bar - below header, hidden in fullscreen */}
      {!isFullScreen && (
        <MetadataBar
          streamName={formData.streamName}
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
          onStreamPress={() => setActivePicker(activePicker === 'stream' ? null : 'stream')}
          onLocationPress={() => unsupportedLocation ? setActivePicker('unsupportedLocation') : setActivePicker(activePicker === 'location' ? null : 'location')}
          onStatusPress={() => unsupportedStatus ? setActivePicker('unsupportedStatus') : setActivePicker(activePicker === 'status' ? null : 'status')}
          onTypePress={() => unsupportedType ? setActivePicker('unsupportedType') : setActivePicker(activePicker === 'type' ? null : 'type')}
          onDueDatePress={() => unsupportedDueDate ? setActivePicker('unsupportedDueDate') : setActivePicker(activePicker === 'dueDate' ? null : 'dueDate')}
          onRatingPress={() => unsupportedRating ? setActivePicker('unsupportedRating') : setActivePicker('rating')}
          onPriorityPress={() => unsupportedPriority ? setActivePicker('unsupportedPriority') : setActivePicker('priority')}
          onPhotosPress={() => setPhotosCollapsed(false)}
          onAttributesPress={() => setActivePicker('attributes')}
          editorRef={editorRef}
        />
      )}

      {/* Content Area */}
      <View style={[
        styles.contentContainer,
        isEditMode ? { paddingBottom: 60 } : { paddingBottom: 0 },
        keyboardHeight > 0 && { paddingBottom: keyboardHeight + 80 }
      ]}>

        {/* Photo Gallery */}
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
            onTakePhoto={() => {
              photoCaptureRef.current?.openCamera();
            }}
            onGallery={() => {
              photoCaptureRef.current?.openGallery();
            }}
          />
        )}

        {/* Editor - Singleton pattern: RichTextEditorV2 stays mounted, content swapped via setContent() */}
        <View style={[
          styles.editorContainer,
          isFullScreen && styles.fullScreenEditor
        ]}>
          <RichTextEditorV2
            ref={editorRef}
            onChange={handleEditorChange}
            editable={isEditMode}
            onReady={handleEditorReady}
          />
        </View>

      </View>

      {/* Bottom Bar - EditorToolbar only in edit mode */}
      {isEditMode && (
        <BottomBar keyboardOffset={keyboardHeight}>
          <EditorToolbar
            editorRef={editorRef}
            onDone={() => {
              editorRef.current?.blur();
              setIsEditMode(false);
              setIsFullScreen(false);
            }}
          />
        </BottomBar>
      )}

      {/* All Pickers */}
      <EntryPickers
        activePicker={activePicker}
        setActivePicker={setActivePicker}
        formData={formData}
        updateField={updateField}
        isEditing={isEditing}
        streams={streams}
        currentStream={currentStream ?? null}
        showLocation={showLocation}
        showStatus={showStatus}
        showType={showType}
        showDueDate={showDueDate}
        showRating={showRating}
        showPriority={showPriority}
        showPhotos={showPhotos}
        locationPickerMode={locationPickerMode}
        showSnackbar={showSnackbar}
        handleDelete={handleDelete}
        onTakePhoto={() => photoCaptureRef.current?.openCamera()}
        onOpenGallery={() => photoCaptureRef.current?.openGallery()}
      />

      {/* Photo Capture - ref-based, no UI */}
      <PhotoCapture
        ref={photoCaptureRef}
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
