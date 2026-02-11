/**
 * @deprecated This context has been replaced by direct state in EntryManagementScreen.
 * Do not use for new code. This file will be removed once EntryScreen.tsx is deleted.
 *
 * EntryManagementScreen uses:
 * - Direct useState in the component (simpler, easier to debug)
 * - Refs for cross-component communication (avoids re-render cascade)
 * - Props/parameters pattern for extracted hooks
 *
 * ---
 * Original description:
 * EntryFormContext - Unified state management for EntryScreen
 *
 * Consolidates ALL entry editing state into a single context:
 * - Form data (title, content, stream, location, etc.)
 * - Edit mode state (isEditMode, isFullScreen)
 * - Save state (isSubmitting, isSaving, savedEntryId)
 * - Photo tracking (photoCount, baselinePhotoCount)
 * - Version conflict detection
 * - UI state (activePicker, photosCollapsed)
 *
 * This eliminates the 50+ parameters passed between hooks by allowing
 * all hooks and components to access state via useEntryForm().
 */

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
  type RefObject,
} from "react";
import { Animated, Alert } from "react-native";
import * as Crypto from "expo-crypto";
import type {
  Location as LocationType,
  EntryStatus,
  Entry,
  Stream,
} from "@trace/core";
import { getDeviceName } from "../../../../shared/utils/deviceUtils";
import { createScopedLogger } from "../../../../shared/utils/logger";
import type { PhotoCaptureRef } from "../../../photos/components/PhotoCapture";
import type { ActivePicker } from "../EntryPickers";

const log = createScopedLogger('EntryForm', '📝');

// Timing tracker for debugging load performance
let loadStartTime: number | null = null;
const logTiming = (step: string) => {
  if (loadStartTime === null) return;
  const elapsed = Math.round(performance.now() - loadStartTime);
  log.info(`⏱️ ${step}`, { elapsedMs: elapsed });
};

// ============================================================================
// Types
// ============================================================================

/** Geocode status for tracking how location hierarchy data was obtained */
export type GeocodeStatus =
  | "pending"
  | "success"
  | "snapped"
  | "no_data"
  | "error"
  | "manual"
  | null;

/** Photo pending upload (for new entries before first save) */
export interface PendingPhoto {
  photoId: string;
  localPath: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  position: number;
}

/** Consolidated form data for entry editing */
export interface CaptureFormData {
  title: string;
  content: string;
  streamId: string | null;
  streamName: string | null;
  status: EntryStatus;
  type: string | null;
  dueDate: string | null;
  rating: number;
  priority: number;
  entryDate: string;
  includeTime: boolean;
  locationData: LocationType | null;
  geocodeStatus: GeocodeStatus;
  pendingPhotos: PendingPhoto[];
}

/** Version conflict check result */
export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictDevice: string | null;
  currentVersion: number;
  baseVersion: number;
}

/** Props for EntryFormProvider */
export interface EntryFormProviderProps {
  children: ReactNode;
  /** Streams list */
  streams: Stream[];
  /** Settings */
  settings: {
    captureGpsLocation: boolean;
    imageQuality: "full" | "high" | "standard" | "small";
  };
  /** Current user ID */
  userId: string | null;
}

/** Options for creating a new entry */
export interface NewEntryOptions {
  streamId?: string | null;
  streamName?: string;
  content?: string;
  date?: string;
}

/** Context value shape */
export interface EntryFormContextValue {
  // === Entry Identity ===
  /** Whether editing existing entry vs creating new */
  isEditing: boolean;
  /** Original entry ID from props */
  entryId: string | null;
  /** Entry ID after autosave creates new entry */
  savedEntryId: string | null;
  /** Effective entry ID (savedEntryId || entryId) */
  effectiveEntryId: string | null;
  /** Temporary ID for new entries (before first save) */
  tempEntryId: string;
  /** Entry data from React Query */
  entry: Entry | null | undefined;

  // === Singleton Pattern ===
  /**
   * Set entry for editing (or null for new entry) - singleton pattern
   * @param entryId - Entry ID to edit (will fetch via useEntry), or null for new entry
   * @param options - Options for new entry (streamId, content, date)
   */
  setEntry: (entryId: string | null, options?: NewEntryOptions) => void;
  /** Called when entry data is loaded (from useEntry in EntryScreenContent) */
  onEntryLoaded: (entry: Entry) => void;
  /** Clear the form - called when navigating away from capture screen */
  clearEntry: () => void;

  // === Form Data ===
  formData: CaptureFormData;
  updateField: <K extends keyof CaptureFormData>(
    field: K,
    value: CaptureFormData[K]
  ) => void;
  updateMultipleFields: (updates: Partial<CaptureFormData>) => void;
  addPendingPhoto: (photo: PendingPhoto) => void;
  removePendingPhoto: (photoId: string) => void;

  // === Dirty Tracking ===
  /** Whether form data differs from baseline */
  isDirty: boolean;
  /** Combined dirty: form dirty OR photo count changed */
  isFormDirty: boolean;
  /** Set baseline (after load or save) */
  setBaseline: (data: CaptureFormData) => void;
  /** Mark form as clean after save */
  markClean: () => void;

  // === Edit Mode ===
  /** Whether form is in edit mode (can be edited) */
  isEditMode: boolean;
  setIsEditMode: (value: boolean) => void;
  /** Whether in full-screen editor mode */
  isFullScreen: boolean;
  setIsFullScreen: (value: boolean) => void;
  /** Enter edit mode (captures initial content for cursor stability) */
  enterEditMode: () => void;
  /** Ref to stable initial content for edit session */
  editModeInitialContent: RefObject<string | null>;

  // === Save State ===
  /** Whether manual submit is in progress */
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  /** Whether any save (manual or auto) is in progress */
  isSaving: boolean;
  setIsSaving: (value: boolean) => void;
  /** Set savedEntryId after creating new entry */
  setSavedEntryId: (id: string | null) => void;

  // === Photo Tracking ===
  /** Current photo count */
  photoCount: number;
  setPhotoCount: (count: number | ((prev: number) => number)) => void;
  /** Baseline photo count for dirty tracking */
  baselinePhotoCount: number | null;
  setBaselinePhotoCount: (count: number | null) => void;
  /** Key to force PhotoGallery refresh on external changes */
  externalRefreshKey: number;
  /** Sync photo count from query */
  syncPhotoCount: (count: number) => void;
  /** Whether photos are collapsed */
  photosCollapsed: boolean;
  setPhotosCollapsed: (value: boolean) => void;

  // === Version Conflict ===
  /** Get current known version */
  getKnownVersion: () => number | null;
  /** Initialize known version (on first load) */
  initializeVersion: (version: number) => void;
  /** Update known version (after detecting external update) */
  updateKnownVersion: (version: number) => void;
  /** Increment known version (after successful save) */
  incrementKnownVersion: () => void;
  /** Record when this device saved (for overwrite detection) */
  recordSaveTime: () => void;
  /** Check if entry has conflict with our known version */
  checkForConflict: (entry: Entry | null) => ConflictCheckResult | null;
  /** Check if version change is from external device */
  isExternalUpdate: (
    entry: Entry | null
  ) => { isExternal: boolean; device: string; thisDevice: string } | null;

  // === UI State ===
  /** Currently active picker */
  activePicker: ActivePicker;
  setActivePicker: (picker: ActivePicker) => void;

  // === Snackbar ===
  snackbarMessage: string | null;
  snackbarOpacity: Animated.Value;
  showSnackbar: (message: string) => void;

  // === Refs ===
  editorRef: RefObject<any>;
  photoCaptureRef: RefObject<PhotoCaptureRef | null>;
  /** Ref to autosave handler (avoids circular deps) */
  handleAutosaveRef: RefObject<() => Promise<void>>;
  /** Ref to save handler for navigation (avoids circular deps) */
  handleSaveRef: RefObject<() => Promise<void>>;

  // === Settings ===
  settings: {
    captureGpsLocation: boolean;
    imageQuality: "full" | "high" | "standard" | "small";
  };
  userId: string | null;
  streams: Stream[];
}

// ============================================================================
// Context
// ============================================================================

const EntryFormContext = createContext<EntryFormContextValue | null>(null);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to determine initial stream ID
 * Filters out non-stream values like "all", "tag:xyz", etc.
 */
function getInitialStreamId(
  isEditing: boolean,
  initialStreamId?: string | null
): string | null {
  if (isEditing) return null; // Will be loaded from entry

  if (
    !initialStreamId ||
    typeof initialStreamId !== "string" ||
    initialStreamId === "all" ||
    initialStreamId === "events" ||
    initialStreamId === "streams" ||
    initialStreamId === "tags" ||
    initialStreamId === "people" ||
    initialStreamId.startsWith("tag:") ||
    initialStreamId.startsWith("mention:") ||
    initialStreamId.startsWith("location:")
  ) {
    return null;
  }

  return initialStreamId;
}

/**
 * Helper to calculate initial entry date
 */
function getInitialEntryDate(initialDate?: string): string {
  if (initialDate) {
    const [year, month, day] = initialDate.split("-").map(Number);
    const selectedDate = new Date(year, month - 1, day);
    const now = new Date();
    selectedDate.setHours(
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      100
    ); // 100ms to hide time
    return selectedDate.toISOString();
  }

  const now = new Date();
  now.setMilliseconds(0);
  return now.toISOString();
}

/**
 * Build form data from an entry object.
 */
function buildFormDataFromEntry(
  entry: Entry,
  streams: Stream[] | undefined,
  defaultEntryDate: string
): CaptureFormData {
  const entryDate = entry.entry_date || entry.created_at || defaultEntryDate;
  const includeTime = entryDate
    ? new Date(entryDate).getMilliseconds() !== 100
    : true;
  const streamName =
    entry.stream_id && streams?.length
      ? streams.find((s) => s.stream_id === entry.stream_id)?.name || null
      : null;

  const hasLocationData =
    entry.place_name ||
    entry.address ||
    entry.city ||
    entry.region ||
    entry.country ||
    (entry.entry_latitude != null && entry.entry_longitude != null);

  const locationData: LocationType | null = hasLocationData
    ? {
        location_id: entry.location_id ?? undefined,
        latitude: entry.entry_latitude ?? 0,
        longitude: entry.entry_longitude ?? 0,
        name: entry.place_name,
        source: "user_custom",
        address: entry.address,
        neighborhood: entry.neighborhood,
        postalCode: entry.postal_code,
        city: entry.city,
        subdivision: entry.subdivision,
        region: entry.region,
        country: entry.country,
        locationRadius: entry.location_radius ?? undefined,
      }
    : null;

  return {
    title: entry.title || "",
    content: entry.content || "",
    streamId: entry.stream_id || null,
    streamName,
    status: (entry.status as EntryStatus) || "none",
    type: entry.type || null,
    dueDate: entry.due_date || null,
    rating: entry.rating ?? 0,
    priority: entry.priority ?? 0,
    entryDate,
    includeTime,
    locationData,
    geocodeStatus: (entry.geocode_status as GeocodeStatus) ?? null,
    pendingPhotos: [],
  };
}

/**
 * Compare two ISO date strings by their actual timestamp value.
 */
function areDatesEqual(date1: string | null, date2: string | null): boolean {
  if (date1 === date2) return true;
  if (!date1 || !date2) return false;
  return new Date(date1).getTime() === new Date(date2).getTime();
}

// ============================================================================
// Provider Component
// ============================================================================

export function EntryFormProvider({
  children,
  streams,
  settings,
  userId,
}: EntryFormProviderProps) {
  // === Internal Entry State (singleton pattern) ===
  // Entry is managed internally via setEntry() instead of props
  const [entry, setEntryState] = useState<Entry | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  // New entry options (streamId, content, date for new entries)
  const [newEntryOptions, setNewEntryOptions] = useState<NewEntryOptions>({});

  // Determine if editing
  const isEditing = !!entryId || !!savedEntryId;
  const effectiveEntryId = savedEntryId || entryId || null;

  // Temp ID for new entries
  const [tempEntryId, setTempEntryId] = useState(() => Crypto.randomUUID());

  // Calculate initial values based on newEntryOptions
  const initialStrId = getInitialStreamId(isEditing, newEntryOptions.streamId);
  const initialEntryDate = getInitialEntryDate(newEntryOptions.date);

  // Build initial form data for new entries
  const buildInitialFormData = useCallback((): CaptureFormData => {
    return {
      title: "",
      content: newEntryOptions.content || "",
      streamId: initialStrId,
      streamName:
        !isEditing && newEntryOptions.streamName && initialStrId !== null
          ? newEntryOptions.streamName
          : null,
      status: "none",
      type: null,
      dueDate: null,
      rating: 0,
      priority: 0,
      entryDate: initialEntryDate,
      includeTime: !newEntryOptions.date,
      locationData: null,
      geocodeStatus: null,
      pendingPhotos: [],
    };
  }, [isEditing, initialStrId, initialEntryDate, newEntryOptions]);

  // === Form Data State ===
  const [formData, setFormData] = useState<CaptureFormData>(buildInitialFormData);

  // Baseline for dirty tracking
  const baselineRef = useRef<CaptureFormData | null>(null);
  const [baselineVersion, setBaselineVersion] = useState(0);

  // === Edit Mode State ===
  const [isEditMode, setIsEditMode] = useState(!isEditing);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const editModeInitialContent = useRef<string | null>(null);

  // === Save State ===
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // === Photo State ===
  const [photoCount, setPhotoCount] = useState(0);
  const [baselinePhotoCount, setBaselinePhotoCount] = useState<number | null>(
    null
  );
  const [externalRefreshKey, setExternalRefreshKey] = useState(0);
  const [photosCollapsed, setPhotosCollapsed] = useState(false);
  const knownPhotoCountRef = useRef<number | null>(null);

  // === Version Tracking ===
  const knownVersionRef = useRef<number | null>(null);
  // Track when this device last saved (for overwrite detection)
  const lastSaveTimeRef = useRef<number>(0);

  // === UI State ===
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);

  // === Snackbar ===
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const snackbarOpacity = useRef(new Animated.Value(0)).current;

  // === Refs ===
  const editorRef = useRef<any>(null);
  const photoCaptureRef = useRef<PhotoCaptureRef>(null);
  const handleAutosaveRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const handleSaveRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // ============================================================================
  // Form Data Actions
  // ============================================================================

  const updateField = useCallback(
    <K extends keyof CaptureFormData>(field: K, value: CaptureFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const updateMultipleFields = useCallback(
    (updates: Partial<CaptureFormData>) => {
      setFormData((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const addPendingPhoto = useCallback((photo: PendingPhoto) => {
    setFormData((prev) => ({
      ...prev,
      pendingPhotos: [...prev.pendingPhotos, photo],
    }));
  }, []);

  const removePendingPhoto = useCallback((photoId: string) => {
    setFormData((prev) => ({
      ...prev,
      pendingPhotos: prev.pendingPhotos.filter((p) => p.photoId !== photoId),
    }));
  }, []);

  const setBaseline = useCallback((data: CaptureFormData) => {
    baselineRef.current = JSON.parse(JSON.stringify(data));
    setBaselineVersion((v) => v + 1);
  }, []);

  const markClean = useCallback(() => {
    baselineRef.current = JSON.parse(JSON.stringify(formData));
    setBaselineVersion((v) => v + 1);
  }, [formData]);

  // ============================================================================
  // Edit Mode Actions
  // ============================================================================

  const enterEditMode = useCallback(() => {
    editModeInitialContent.current = formData.content;
    setIsEditMode(true);
    setIsFullScreen(true);
  }, [formData.content]);

  // ============================================================================
  // Photo Actions
  // ============================================================================

  const syncPhotoCount = useCallback((count: number) => {
    setPhotoCount(count);
  }, []);

  // ============================================================================
  // Version Conflict Actions
  // ============================================================================

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

  const recordSaveTime = useCallback(() => {
    lastSaveTimeRef.current = Date.now();
  }, []);

  const checkForConflict = useCallback(
    (entryToCheck: Entry | null): ConflictCheckResult | null => {
      if (!isEditing || !entryToCheck || knownVersionRef.current === null) {
        return null;
      }

      const currentVersion = entryToCheck.version || 1;
      const baseVersion = knownVersionRef.current;

      if (currentVersion > baseVersion) {
        const lastDevice =
          entryToCheck.last_edited_device || "another device";
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
    },
    [isEditing]
  );

  const isExternalUpdate = useCallback(
    (
      entryToCheck: Entry | null
    ): { isExternal: boolean; device: string; thisDevice: string } | null => {
      if (!entryToCheck) return null;

      let thisDevice = "Unknown Device";
      try {
        if (typeof getDeviceName === "function") {
          thisDevice = getDeviceName();
        }
      } catch (err) {
        log.error("getDeviceName threw", err);
      }
      const editingDevice = entryToCheck.last_edited_device || "";

      return {
        isExternal: editingDevice !== thisDevice,
        device: editingDevice,
        thisDevice,
      };
    },
    []
  );

  // ============================================================================
  // Snackbar
  // ============================================================================

  const showSnackbar = useCallback(
    (message: string) => {
      setSnackbarMessage(message);
      snackbarOpacity.setValue(1);

      Animated.sequence([
        Animated.delay(2500),
        Animated.timing(snackbarOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setSnackbarMessage(null);
      });
    },
    [snackbarOpacity]
  );

  // ============================================================================
  // Singleton Pattern: setEntry
  // ============================================================================

  /**
   * Set entry for editing (or null for new entry).
   * This is the main API for the singleton pattern - called by navigation.
   * For editing: pass entryId, form will be populated when onEntryLoaded is called.
   * For new: pass null with options, form is ready immediately.
   */
  const setEntry = useCallback((newEntryId: string | null, options?: NewEntryOptions) => {
    // Start timing for this load
    loadStartTime = performance.now();
    log.info('⏱️ setEntry START', {
      entryId: newEntryId?.substring(0, 8) || 'new',
      hasOptions: !!options,
    });

    // Reset all state
    setIsFullScreen(false);

    // Reset photo state
    setPhotoCount(0);
    setBaselinePhotoCount(null);
    knownPhotoCountRef.current = null;
    setExternalRefreshKey(0);
    setPhotosCollapsed(false);

    // Reset version tracking
    knownVersionRef.current = null;
    lastSaveTimeRef.current = 0;

    // Reset save state
    setIsSubmitting(false);
    setIsSaving(false);
    setSavedEntryId(null);

    // Reset UI state
    setActivePicker(null);

    // Reset baseline
    baselineRef.current = null;
    setBaselineVersion(0);

    // Clear previous entry state
    setEntryState(null);

    if (newEntryId) {
      // Editing existing entry - set entryId, wait for onEntryLoaded
      setEntryId(newEntryId);
      setNewEntryOptions({});
      setIsEditMode(false); // Start in view mode for existing entries

      // Clear form data immediately to avoid dirty state from previous entry
      // New content will be set when onEntryLoaded is called
      // Note: We don't clear the editor here - the content swap effect handles that
      // when the new entry's content arrives (prevents race conditions)
      const emptyFormData: CaptureFormData = {
        title: "",
        content: "",
        streamId: null,
        streamName: null,
        status: "none",
        type: null,
        dueDate: null,
        rating: 0,
        priority: 0,
        entryDate: new Date().toISOString(),
        includeTime: true,
        locationData: null,
        geocodeStatus: null,
        pendingPhotos: [],
      };
      setFormData(emptyFormData);

      log.debug('Waiting for entry to load', { entryId: newEntryId.substring(0, 8) });
    } else {
      // Creating new entry - form is ready immediately
      setEntryId(null);
      setNewEntryOptions(options || {});
      setTempEntryId(Crypto.randomUUID());
      setIsEditMode(true); // Start in edit mode for new entries

      // Build form data for new entry
      const initialStrId = getInitialStreamId(false, options?.streamId);
      const initialEntryDate = getInitialEntryDate(options?.date);
      const newFormData: CaptureFormData = {
        title: "",
        content: options?.content || "",
        streamId: initialStrId,
        streamName: options?.streamName && initialStrId !== null ? options.streamName : null,
        status: "none",
        type: null,
        dueDate: null,
        rating: 0,
        priority: 0,
        entryDate: initialEntryDate,
        includeTime: !options?.date,
        locationData: null,
        geocodeStatus: null,
        pendingPhotos: [],
      };
      setFormData(newFormData);
      baselineRef.current = JSON.parse(JSON.stringify(newFormData));
      setBaselineVersion(1);
      editModeInitialContent.current = newFormData.content;
      setBaselinePhotoCount(0);

      // Set editor content for new entry (singleton pattern)
      const { combineTitleAndBody } = require('@trace/core');
      const editorContent = combineTitleAndBody(newFormData.title, newFormData.content);
      log.info('Setting editor content for new entry', {
        contentLength: editorContent.length,
        hasInitialContent: !!options?.content,
      });
      editorRef.current?.setContent(editorContent);
    }
  }, []);

  /**
   * Called when entry data is loaded from useEntry hook.
   * Populates the form with the entry data.
   */
  const onEntryLoaded = useCallback((loadedEntry: Entry) => {
    // Only process if we're waiting for this entry
    if (!entryId || loadedEntry.entry_id !== entryId) {
      log.debug('Ignoring entry load - not the expected entry', {
        expected: entryId?.substring(0, 8),
        received: loadedEntry.entry_id.substring(0, 8),
      });
      return;
    }

    // Already loaded this entry (check by comparing entry object)
    if (entry?.entry_id === loadedEntry.entry_id) {
      return;
    }

    logTiming('onEntryLoaded START');
    log.info('Entry loaded, populating form', {
      entryId: loadedEntry.entry_id.substring(0, 8),
      title: loadedEntry.title?.substring(0, 20) || '(no title)',
      contentLength: loadedEntry.content?.length || 0,
    });

    // Store entry
    setEntryState(loadedEntry);

    // Build form data from entry
    const newFormData = buildFormDataFromEntry(loadedEntry, streams, new Date().toISOString());
    log.debug('Built form data from entry', {
      formTitle: newFormData.title?.substring(0, 20) || '(empty)',
      formContentLength: newFormData.content?.length || 0,
      formContentPreview: newFormData.content?.substring(0, 50) || '(empty)',
    });
    setFormData(newFormData);
    baselineRef.current = JSON.parse(JSON.stringify(newFormData));
    setBaselineVersion(1);
    editModeInitialContent.current = newFormData.content;

    // Set editor content directly (singleton pattern - no remounting)
    // Import combineTitleAndBody here to avoid circular deps
    logTiming('setFormData done, building editor content');
    const { combineTitleAndBody } = require('@trace/core');
    const editorContent = combineTitleAndBody(newFormData.title, newFormData.content);
    log.info('Setting editor content from onEntryLoaded', {
      contentLength: editorContent.length,
      contentPreview: editorContent.substring(0, 50),
    });
    logTiming('calling editorRef.setContent');
    editorRef.current?.setContent(editorContent);
    logTiming('editorRef.setContent returned');

    // Initialize version tracking
    if (loadedEntry.version) {
      knownVersionRef.current = loadedEntry.version;
    }
  }, [entryId, entry, streams]);

  /**
   * Clear the form - called when navigating away from capture screen.
   * Resets all state and clears the editor.
   */
  const clearEntry = useCallback(() => {
    log.info('clearEntry called - resetting form');

    // Clear editor content immediately
    editorRef.current?.setContent('');

    // Reset entry identity
    setEntryId(null);
    setEntryState(null);
    setSavedEntryId(null);
    setNewEntryOptions({});
    setTempEntryId(Crypto.randomUUID());

    // Reset form data
    const emptyFormData: CaptureFormData = {
      title: "",
      content: "",
      streamId: null,
      streamName: null,
      status: "none",
      type: null,
      dueDate: null,
      rating: 0,
      priority: 0,
      entryDate: new Date().toISOString(),
      includeTime: true,
      locationData: null,
      geocodeStatus: null,
      pendingPhotos: [],
    };
    setFormData(emptyFormData);

    // Reset baseline
    baselineRef.current = null;
    setBaselineVersion(0);

    // Reset edit mode
    setIsEditMode(false);
    setIsFullScreen(false);
    editModeInitialContent.current = null;

    // Reset save state
    setIsSubmitting(false);
    setIsSaving(false);

    // Reset photo state
    setPhotoCount(0);
    setBaselinePhotoCount(null);
    knownPhotoCountRef.current = null;
    setExternalRefreshKey(0);
    setPhotosCollapsed(false);

    // Reset version tracking
    knownVersionRef.current = null;
    lastSaveTimeRef.current = 0;

    // Reset UI state
    setActivePicker(null);
  }, []);

  // ============================================================================
  // Derived Values
  // ============================================================================

  // isDirty - compare formData to baseline
  const isDirty = useMemo(() => {
    if (!baselineRef.current) {
      if (isEditing) {
        return false;
      }
      return (
        formData.title.trim() !== "" ||
        formData.content.trim() !== "" ||
        formData.pendingPhotos.length > 0
      );
    }

    const baseline = baselineRef.current;
    const changes = {
      title: formData.title !== baseline.title,
      content: formData.content !== baseline.content,
      streamId: formData.streamId !== baseline.streamId,
      status: formData.status !== baseline.status,
      type: formData.type !== baseline.type,
      dueDate: !areDatesEqual(formData.dueDate, baseline.dueDate),
      rating: formData.rating !== baseline.rating,
      priority: formData.priority !== baseline.priority,
      entryDate: !areDatesEqual(formData.entryDate, baseline.entryDate),
      locationData:
        JSON.stringify(formData.locationData) !==
        JSON.stringify(baseline.locationData),
      pendingPhotos:
        formData.pendingPhotos.length !== baseline.pendingPhotos.length,
    };

    return Object.values(changes).some((v) => v);
  }, [formData, baselineVersion, isEditing]);

  // Combined dirty: form dirty OR photo count changed
  const isFormDirty = useMemo(() => {
    if (isDirty) return true;
    if (
      isEditing &&
      baselinePhotoCount !== null &&
      photoCount !== baselinePhotoCount
    ) {
      return true;
    }
    return false;
  }, [isDirty, isEditing, photoCount, baselinePhotoCount]);

  // ============================================================================
  // Effects
  // ============================================================================

  // Note: Entry initialization is now handled by setEntry() (singleton pattern)
  // No prop-based initialization effects needed
  // External photo detection is handled by syncPhotoCount() called from EntryScreenContent

  // External sync detection - handles entry updates from other devices
  useEffect(() => {
    if (!entry || !isEditing) return;

    // CRITICAL: Skip sync processing while save is in-flight
    // This prevents race condition where realtime sync arrives before save response
    // Scenario: A saves, B saves, B receives A's sync before B's save response
    // Without this guard, B would accept A's old content
    if (isSaving) {
      log.debug('Skipping sync while save in progress');
      return;
    }

    const entryVersion = entry.version || 1;
    const knownVersion = knownVersionRef.current;
    const externalCheck = isExternalUpdate(entry);

    // First load - just record the version
    if (knownVersion === null) {
      initializeVersion(entryVersion);
      return;
    }

    // Version didn't change - nothing to do
    if (entryVersion <= knownVersion) return;

    // Version increased - check if from another device
    const isExternal = externalCheck?.isExternal ?? false;
    const editingDevice = externalCheck?.device || "";

    // Update known version
    updateKnownVersion(entryVersion);

    // If change is from THIS device, don't update form
    if (!isExternal) {
      return;
    }

    // External update - if user has unsaved changes, warn them
    if (isDirty) {
      showSnackbar(`Entry updated by ${editingDevice} - you have unsaved changes`);
      return;
    }

    // No local changes - reload form data
    const streamName =
      entry.stream_id && streams.length > 0
        ? streams.find((s) => s.stream_id === entry.stream_id)?.name || null
        : null;

    const newFormData = {
      title: entry.title || "",
      content: entry.content || "",
      streamId: entry.stream_id || null,
      streamName,
      status: (entry.status || "none") as EntryStatus,
      type: entry.type || null,
      dueDate: entry.due_date || null,
      rating: entry.rating || 0,
      priority: entry.priority || 0,
      entryDate: entry.entry_date || formData.entryDate,
      includeTime:
        entry.entry_date
          ? new Date(entry.entry_date).getMilliseconds() !== 100
          : formData.includeTime,
      locationData: formData.locationData,
      geocodeStatus: formData.geocodeStatus,
      pendingPhotos: formData.pendingPhotos,
    };

    // Set baseline FIRST, then update form
    setBaseline(newFormData);
    setBaselinePhotoCount(photoCount);
    updateMultipleFields(newFormData);

    // Make sync more jarring - exit edit mode and hide keyboard
    // This discourages thrashing between devices
    setIsEditMode(false);
    editorRef.current?.blur?.();

    // Check if we recently saved - if so, our changes may have been overwritten
    const timeSinceLastSave = Date.now() - lastSaveTimeRef.current;
    const recentlySaved = lastSaveTimeRef.current > 0 && timeSinceLastSave < 30000;

    if (recentlySaved) {
      // Clear the save timer immediately - prevents spam if other device saves multiple times
      // User won't see another conflict alert until they save again themselves
      lastSaveTimeRef.current = 0;

      // Use Alert dialog for overwrite warning - requires user acknowledgment
      Alert.alert(
        "Sync Conflict",
        `Your recent changes may have been overwritten by ${editingDevice}.`,
        [{ text: "OK" }]
      );
    } else {
      showSnackbar(`Entry updated by ${editingDevice}`);
    }
  }, [
    entry,
    isEditing,
    isSaving,
    isDirty,
    streams,
    photoCount,
    formData.entryDate,
    formData.includeTime,
    formData.locationData,
    formData.geocodeStatus,
    formData.pendingPhotos,
    isExternalUpdate,
    initializeVersion,
    updateKnownVersion,
    setBaseline,
    setBaselinePhotoCount,
    updateMultipleFields,
    showSnackbar,
  ]);

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: EntryFormContextValue = useMemo(
    () => ({
      // Entry Identity
      isEditing,
      entryId: entryId || null,
      savedEntryId,
      effectiveEntryId,
      tempEntryId,
      entry,

      // Singleton Pattern
      setEntry,
      onEntryLoaded,
      clearEntry,

      // Form Data
      formData,
      updateField,
      updateMultipleFields,
      addPendingPhoto,
      removePendingPhoto,

      // Dirty Tracking
      isDirty,
      isFormDirty,
      setBaseline,
      markClean,

      // Edit Mode
      isEditMode,
      setIsEditMode,
      isFullScreen,
      setIsFullScreen,
      enterEditMode,
      editModeInitialContent,

      // Save State
      isSubmitting,
      setIsSubmitting,
      isSaving,
      setIsSaving,
      setSavedEntryId,

      // Photo Tracking
      photoCount,
      setPhotoCount,
      baselinePhotoCount,
      setBaselinePhotoCount,
      externalRefreshKey,
      syncPhotoCount,
      photosCollapsed,
      setPhotosCollapsed,

      // Version Conflict
      getKnownVersion,
      initializeVersion,
      updateKnownVersion,
      incrementKnownVersion,
      recordSaveTime,
      checkForConflict,
      isExternalUpdate,

      // UI State
      activePicker,
      setActivePicker,

      // Snackbar
      snackbarMessage,
      snackbarOpacity,
      showSnackbar,

      // Refs
      editorRef,
      photoCaptureRef,
      handleAutosaveRef,
      handleSaveRef,

      // Settings
      settings,
      userId,
      streams,
    }),
    [
      isEditing,
      entryId,
      savedEntryId,
      effectiveEntryId,
      tempEntryId,
      entry,
      setEntry,
      onEntryLoaded,
      clearEntry,
      formData,
      updateField,
      updateMultipleFields,
      addPendingPhoto,
      removePendingPhoto,
      isDirty,
      isFormDirty,
      setBaseline,
      markClean,
      isEditMode,
      isFullScreen,
      enterEditMode,
      isSubmitting,
      isSaving,
      photoCount,
      baselinePhotoCount,
      externalRefreshKey,
      syncPhotoCount,
      photosCollapsed,
      getKnownVersion,
      initializeVersion,
      updateKnownVersion,
      incrementKnownVersion,
      recordSaveTime,
      checkForConflict,
      isExternalUpdate,
      activePicker,
      snackbarMessage,
      snackbarOpacity,
      showSnackbar,
      settings,
      userId,
      streams,
    ]
  );

  return (
    <EntryFormContext.Provider value={value}>
      {children}
    </EntryFormContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Access entry form state from any component within EntryFormProvider.
 * Throws if used outside provider.
 */
export function useEntryForm(): EntryFormContextValue {
  const context = useContext(EntryFormContext);
  if (!context) {
    throw new Error("useEntryForm must be used within EntryFormProvider");
  }
  return context;
}
