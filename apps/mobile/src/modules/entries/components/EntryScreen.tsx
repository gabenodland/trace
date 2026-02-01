import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, Platform, Keyboard, Animated, PanResponder } from "react-native";
import { extractTagsAndMentions, generateAttachmentPath, type Location as LocationType, locationToCreateInput, type EntryStatus, applyTitleTemplate, applyContentTemplate } from "@trace/core";
import { createLocation } from '../../locations/mobileLocationApi';
import { useEntries, useEntry } from "../mobileEntryHooks";
import { useStreams } from "../../streams/mobileStreamHooks";
import { useLocations } from "../../locations/mobileLocationHooks";
import { useAttachments } from "../../attachments/mobileAttachmentHooks";
import { useNavigation } from "../../../shared/contexts/NavigationContext";
import { useDrawer } from "../../../shared/contexts/DrawerContext";
import { useSettings } from "../../../shared/contexts/SettingsContext";
import { useAuth } from "../../../shared/contexts/AuthContext";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { RichTextEditor } from "../../../components/editor/RichTextEditor";
import { BottomBar } from "../../../components/layout/BottomBar";
import { PhotoCapture, type PhotoCaptureRef } from "../../photos/components/PhotoCapture";
import { PhotoGallery } from "../../photos/components/PhotoGallery";
import { compressAttachment, saveAttachmentToLocalStorage, deleteAttachment, createAttachment, getAttachmentsForEntry } from "../../attachments/mobileAttachmentApi";
import * as Crypto from "expo-crypto";
import { useCaptureFormState, type GeocodeStatus } from "./hooks/useCaptureFormState";
import { useAutosave } from "./hooks/useAutosave";
import { useGpsCapture } from "./hooks/useGpsCapture";
import { usePhotoTracking } from "./hooks/usePhotoTracking";
import { useVersionConflict } from "./hooks/useVersionConflict";
import { useAutoGeocode } from "./hooks/useAutoGeocode";
import { styles } from "./EntryScreen.styles";
import { MetadataBar } from "./MetadataBar";
import { EditorToolbar } from "./EditorToolbar";
import { EntryHeader } from "./EntryHeader";
import { EntryPickers, type ActivePicker } from "./EntryPickers";

// =============================================================================
// SCROLL SYSTEM CONSTANTS
// =============================================================================
// These thresholds control the unified scroll system behavior.
// Centralizing them here prevents inconsistencies across the codebase.

/** Content is considered "at top" when scrollTop <= this value (px) */
const SCROLL_AT_TOP_THRESHOLD = 5;

/** CL enforcement triggers when content scrolls past this value (px) */
const SCROLL_CL_ENFORCE_THRESHOLD = 2;

/** Title appears in header when progress drops below this (0-1 scale, 0.15 = 85% collapsed) */
const TITLE_VISIBILITY_PROGRESS = 0.15;

/** Minimum velocity (px/ms) to trigger momentum reveal (negative = scrolling up) */
const REVEAL_VELOCITY_THRESHOLD = -0.5;

/** Multiplier for converting gesture velocity to momentum scroll distance */
const MOMENTUM_MULTIPLIER = 300;

/** Minimum drag distance before gesture is captured (prevents micro-swipes) */
const DRAG_THRESHOLD = 15;

/** Time window (ms) for velocity calculation - older events are stale */
const VELOCITY_TIME_WINDOW = 150;

/** Animation duration range for momentum reveal (ms) */
const REVEAL_ANIMATION_MIN_DURATION = 150;
const REVEAL_ANIMATION_MAX_DURATION = 300;

interface EntryScreenProps {
  entryId?: string | null;
  initialStreamId?: string | null | "all" | "events" | "streams" | "tags" | "people";
  initialStreamName?: string;
  initialContent?: string;
  initialDate?: string;
}

export function EntryScreen({ entryId, initialStreamId, initialStreamName, initialContent, initialDate }: EntryScreenProps = {}) {
  // Profiling: Log when component mounts
  console.log(`⏱️ EntryScreen: render (entryId=${entryId})`);

  const theme = useTheme();

  // Track when a new entry has been saved (for autosave transition from create to update)
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  // Determine if we're editing an existing entry or creating a new one
  // - entryId: passed in when editing an existing entry
  // - savedEntryId: set after autosave creates a new entry (transitions to editing mode)
  const isEditing = !!entryId || !!savedEntryId;

  // The effective entry ID to use for updates (savedEntryId takes precedence for new entries that have been autosaved)
  const effectiveEntryId = savedEntryId || entryId;

  // Get user settings for default GPS capture behavior
  const { settings } = useSettings();

  // IMPORTANT: Fetch entry and streams BEFORE useCaptureFormState
  // This allows the form state to initialize directly from cached entry data
  // avoiding the Loading flash when navigating from entry list
  const { streams } = useStreams();
  const { data: savedLocations = [] } = useLocations(); // For location snapping
  const { entry, isLoading: isLoadingEntry, entryMutations: singleEntryMutations } = useEntry(
    effectiveEntryId || null
  );
  // Profiling: Log when entry data is available
  console.log(`⏱️ EntryScreen: useEntry returned (entry=${!!entry}, isLoading=${isLoadingEntry})`);

  // Single form data state hook (consolidates form field state + pending photos)
  // When editing and entry is cached, form initializes directly from entry
  const { formData, updateField, updateMultipleFields, addPendingPhoto, removePendingPhoto, isDirty, setBaseline, markClean } = useCaptureFormState({
    isEditing,
    initialStreamId,
    initialStreamName,
    initialContent,
    initialDate,
    captureGpsSetting: settings.captureGpsLocation,
    entry: isEditing ? entry : null,
    streams,
  });

  // UI State (NOT form data - keep as individual useState)
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Separate state for save indicator - tracks both manual and autosave (isSubmitting only tracks manual)
  const [isSaving, setIsSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Consolidated picker visibility state - only one picker can be open at a time
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);

  // Tracks when form data is fully loaded and ready for baseline
  // Ready immediately when:
  // - New entry (not editing)
  // - Editing AND entry cached AND no location_id (form initialized from entry, no async fetch needed)
  // Not ready when:
  // - Editing but entry not cached yet
  // - Editing with location_id (need to fetch location data)
  const [isFormReady, setIsFormReady] = useState(() => {
    if (!isEditing) return true; // New entry
    if (isEditing && entry && !entry.location_id) return true; // Cached entry, no location fetch
    return false; // Need to wait for entry or location
  });

  const [isTitleExpanded, setIsTitleExpanded] = useState(true);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const snackbarOpacity = useRef(new Animated.Value(0)).current;
  const editorRef = useRef<any>(null);
  const titleInputRef = useRef<TextInput>(null);
  const photoCaptureRef = useRef<PhotoCaptureRef>(null);
  const isInitialLoad = useRef(true); // Track if this is first load
  const [baselinePhotoCount, setBaselinePhotoCount] = useState<number | null>(null); // Baseline for dirty tracking (null = not yet initialized)
  const [photosCollapsed, setPhotosCollapsed] = useState(false); // Start expanded
  // For new entries, generate a temp ID. For editing, use the existing entryId.
  const [tempEntryId] = useState(() => entryId || Crypto.randomUUID());

  const { entryMutations } = useEntries();
  const { user } = useAuth();
  // Use React Query for photos to detect external sync changes
  const { attachments: queryAttachments } = useAttachments(effectiveEntryId || null);

  // Photo tracking hook - handles external detection and photo count for ordering
  const { photoCount, setPhotoCount, externalRefreshKey, syncPhotoCount } = usePhotoTracking({
    entryId: effectiveEntryId || null,
    isEditing,
    isFormReady,
    baselinePhotoCount,
    queryPhotoCount: queryAttachments.length,
  });

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

  // Stream data readiness - used by useGpsCapture to prevent race condition
  // Ready if: no stream selected OR stream data is loaded
  const streamReady = !formData.streamId || !!currentStream;

  // Unsupported flags - attribute not supported by stream BUT entry has a value
  // Used to show strikethrough in MetadataBar with option to remove
  const unsupportedStatus = !showStatus && formData.status !== "none";
  const unsupportedType = !showType && !!formData.type;
  const unsupportedDueDate = !showDueDate && !!formData.dueDate;
  const unsupportedRating = !showRating && formData.rating > 0;
  const unsupportedPriority = !showPriority && formData.priority > 0;
  const unsupportedLocation = !showLocation && !!formData.locationData;

  // Version conflict detection hook
  const {
    getKnownVersion,
    initializeVersion,
    updateKnownVersion,
    incrementKnownVersion,
    checkForConflict,
    isExternalUpdate,
  } = useVersionConflict({ isEditing });

  // Edit mode: new entries start in edit mode, existing entries start in read-only
  const [isEditMode, setIsEditMode] = useState(!isEditing);

  // ==========================================================================
  // DRAWER STATE - Collapsible Header Section
  // ==========================================================================
  // The EntryScreen has two main sections:
  // 1. Fixed header bar (90px) - always visible at top
  // 2. Collapsible section - metadata, photos, title - slides under fixed header
  //
  // The collapsible section is controlled by drawerAnim (0=collapsed, 1=expanded).
  // When collapsed, the section is translated up by -collapsibleHeight, sliding
  // under the fixed header and revealing more space for the editor.
  //
  // Key state variables:
  //   drawerAnim: Animated.Value controlling translateY of collapsible section
  //   drawerProgressRef: Current progress (1=expanded, 0=collapsed) for gesture logic
  //   showTitleInHeader: When true, title appears in fixed header (collapsed state)
  //   isHeaderCollapsed: When true, content scroll is unlocked (HL reached)
  //   isAtTopRef: Tracks if WebView content is at scroll position 0
  //   collapsibleHeight: Measured height of collapsible section (H in formulas)
  // ==========================================================================

  // Track if scroll is at top (for pull-to-reveal gesture detection)
  const isAtTopRef = useRef(true);

  // Animated value for drawer position (0 = collapsed, 1 = expanded)
  // No discrete "modes" - position is continuous for smooth gestures
  const drawerAnim = useRef(new Animated.Value(1)).current;
  const drawerProgressRef = useRef(1); // Track current progress for gesture logic

  // Title opacity interpolated from drawer position - smooth fade instead of pop
  // Fades in during final portion of collapse (controlled by TITLE_VISIBILITY_PROGRESS)
  const titleOpacity = drawerAnim.interpolate({
    inputRange: [0, TITLE_VISIBILITY_PROGRESS, 1],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });

  // Show title in header when collapsed (for conditional rendering)
  // Opacity handles the visual transition, this controls whether to render
  const [showTitleInHeader, setShowTitleInHeader] = useState(false);

  // Track if header is fully collapsed (controls CL/HL via scrollLocked prop)
  // Separate from showTitleInHeader: title appears at 85% collapsed, but
  // scroll only unlocks at ~98% collapsed to prevent jitter
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  // Measured height of the collapsible section (this is H in the formulas)
  // Updated via onLayout when section mounts or content changes
  const [collapsibleHeight, setCollapsibleHeight] = useState(160); // Default fallback

  // Minimum drag distance before gesture is captured (prevents micro-swipes)
  // Note: Using module-level constant DRAG_THRESHOLD

  // ============================================================================
  // UNIFIED SCROLL SYSTEM - CRITICAL ARCHITECTURE
  // ============================================================================
  //
  // This implements coordinated scrolling between a collapsible header (metadata,
  // photos, title) and a WebView-based rich text editor. The goal is seamless
  // "unified scroll" where swiping up first collapses the header, then scrolls
  // the content - as if they were one continuous scroll view.
  //
  // KEY CONCEPTS:
  //
  // 1. UNIFIED SCROLL SPACE: Think of the entire scrollable area as ONE
  //    continuous scroll space from position 0 to infinity:
  //      - Position 0 to H (collapsibleHeight): "Header zone" - header collapses
  //      - Position H to ∞: "Content zone" - WebView scrolls
  //
  // 2. CONTENT LOCK (CL): When header is NOT fully collapsed (position < H),
  //    the WebView content MUST stay at scroll position 0. The header "absorbs"
  //    any scroll gestures. This is enforced by:
  //      - scrollLocked={true} prop on RichTextEditor
  //      - CSS overflow:hidden in WebView
  //      - JS scroll event handler resetting to 0
  //
  // 3. HEADER LOCK (HL): When header IS fully collapsed (position >= H),
  //    the header is "locked" in place and content can scroll freely.
  //    scrollLocked={false} unlocks the WebView.
  //
  // 4. CROSSOVER: The transition from CL to HL (or vice versa) is the tricky
  //    part. See RichTextEditor.tsx scrollBy() comments for critical details
  //    about why immediate unlock via JS injection is necessary.
  //
  // STATE VARIABLES:
  //   unifiedScrollPos: Current position in unified scroll space
  //   drawerProgressRef: Header collapse progress (1=expanded, 0=collapsed)
  //   isHeaderCollapsed: True when at HL (controls scrollLocked prop)
  //   isAtTopRef: True when WebView content is at scroll position 0
  //
  // GESTURE FLOW:
  //   1. User starts swiping up
  //   2. PanResponder captures gesture (if in header zone)
  //   3. Header collapses as gesture moves
  //   4. At HL (position = H), scrollLocked becomes false
  //   5. PanResponder calls scrollBy() to scroll content
  //   6. Eventually PanResponder releases, WebView handles natively
  //
  // MOMENTUM TRANSFER:
  //   When user scrolls content to top with velocity (swiping down quickly),
  //   the momentum should continue to reveal the header. This is handled in
  //   the onScroll callback by detecting velocity and animating header reveal.
  //
  // FAILED APPROACHES (don't try again):
  //   - Single ScrollView wrapping everything: WebView doesn't work inside
  //   - CSS-only scroll lock: Content could drift
  //   - scrollEnabled-only: Blocked programmatic scrollBy()
  //   - Discrete modes (EXPANDED/COLLAPSED): Jarring transitions, lost scroll
  //   - Snapping on release: Not smooth enough, user lost control
  // ============================================================================

  // Track unified scroll position (0 = expanded, H = HL, >H = content scrolling)
  const unifiedScrollPos = useRef(0);
  // Track where gesture started in unified scroll space
  const gestureStartScroll = useRef(0);
  // Track last content scroll we applied (for delta calculations during gesture)
  const lastContentScrollApplied = useRef(0);

  // Velocity tracking for momentum transfer from WebView content scroll to header reveal
  // When user scrolls content to top with velocity, momentum should continue to reveal header
  const lastScrollTopRef = useRef(0);
  const lastScrollTimeRef = useRef(Date.now());
  const scrollVelocityRef = useRef(0); // px/ms (negative = scrolling toward top)

  /**
   * Helper to update visual state from unified scroll position.
   *
   * This is the "render" function for the unified scroll system - it takes
   * a scroll position and updates all the visual state accordingly:
   *   - drawerAnim: Controls the collapsible section translateY
   *   - drawerProgressRef: Tracks current progress for gesture logic
   *   - showTitleInHeader: Shows title in fixed header when collapsed
   *   - isHeaderCollapsed: Controls CL/HL (scrollLocked prop on editor)
   *
   * Called from:
   *   - PanResponder.onPanResponderMove: During gesture
   *   - onScroll callback: When absorbing content scroll into header
   */
  const updateFromUnifiedScroll = useCallback((scrollPos: number) => {
    const H = collapsibleHeight;

    if (scrollPos <= 0) {
      // Fully expanded
      drawerAnim.setValue(1);
      drawerProgressRef.current = 1;
      setShowTitleInHeader(false);
      setIsHeaderCollapsed(false);
    } else if (scrollPos < H) {
      // Header collapsing (between expanded and HL)
      const progress = 1 - (scrollPos / H);
      drawerAnim.setValue(progress);
      drawerProgressRef.current = progress;
      // Title appears when nearly collapsed
      setShowTitleInHeader(progress < TITLE_VISIBILITY_PROGRESS);
      setIsHeaderCollapsed(false);
    } else {
      // At or past HL - header locked collapsed, content scrolls
      drawerAnim.setValue(0);
      drawerProgressRef.current = 0;
      setShowTitleInHeader(true);
      setIsHeaderCollapsed(true);
    }
  }, [collapsibleHeight, drawerAnim]);

  /**
   * ==========================================================================
   * PANRESPONDER - Unified Scroll Gesture Handling
   * ==========================================================================
   *
   * This PanResponder implements the gesture handling for the unified scroll
   * system. It coordinates between header collapse and WebView content scroll.
   *
   * GESTURE CAPTURE LOGIC:
   *   - Never capture on initial touch (let taps through to children)
   *   - Capture during move based on scroll position and direction:
   *     Case 1: Header not at HL → capture any vertical drag to collapse/expand
   *     Case 2: At HL + content at top + pulling down → capture to reveal header
   *     Case 3: At HL + swiping up → DON'T capture, let WebView scroll natively
   *
   * CRITICAL TIMING in onPanResponderMove:
   *   When scrollPos crosses H (CL→HL transition), we call scrollBy() on the
   *   editor. At that moment, React state hasn't updated yet, so scrollLocked
   *   is still true. scrollBy() MUST immediately unlock via JS injection.
   *   See RichTextEditor.tsx scrollBy() for details.
   *
   * NO SNAPPING:
   *   Earlier versions snapped to fully expanded or collapsed on release.
   *   This felt janky. Current version: header stays exactly where user
   *   releases. This feels more natural and gives user full control.
   * ==========================================================================
   */
  const drawerPanResponder = useMemo(() => PanResponder.create({
    // Never capture on initial touch - let children handle taps
    // This is critical: users need to tap on metadata chips, photos, title input
    onStartShouldSetPanResponderCapture: () => false,

    /**
     * Capture during move based on scroll position and direction.
     *
     * The key insight: we need to know WHERE we are in the unified scroll
     * space and WHICH DIRECTION the user is swiping to decide whether to
     * capture the gesture or let WebView handle it.
     */
    onMoveShouldSetPanResponderCapture: (_, gestureState) => {
      const currentScroll = unifiedScrollPos.current;
      const H = collapsibleHeight;
      const atHL = currentScroll >= H; // At or past Header Lock
      const atContentTop = isAtTopRef.current;

      // Case 1: Header NOT at HL - capture any vertical drag to move header
      // User is in "header zone" - all scroll gestures should collapse/expand header
      if (!atHL) {
        return Math.abs(gestureState.dy) > DRAG_THRESHOLD;
      }

      // Case 2: At HL + content at top + pulling DOWN - capture to reveal header
      // This is the "pull-to-reveal" gesture - user at top of content, wants header back
      if (atHL && atContentTop && gestureState.dy > DRAG_THRESHOLD) {
        return true;
      }

      // Case 3: At HL + swiping UP - let WebView handle content scroll natively
      // Header is locked, user wants to scroll content - WebView does this better
      // (smoother momentum, native scroll indicators, etc.)
      return false;
    },

    onPanResponderGrant: () => {
      // Stop any running animation (e.g., momentum reveal from scroll)
      drawerAnim.stopAnimation();
      // Record starting position in unified scroll space
      gestureStartScroll.current = unifiedScrollPos.current;
      lastContentScrollApplied.current = 0;
    },

    /**
     * Handle gesture movement - the core of the unified scroll system.
     *
     * Maps touch movement to unified scroll position, then updates visuals
     * and scrolls content if past HL.
     */
    onPanResponderMove: (_, gestureState) => {
      // dy < 0 = swiping UP = scrolling DOWN = increasing scroll position
      // dy > 0 = swiping DOWN = scrolling UP = decreasing scroll position
      const newScrollPos = Math.max(0, gestureStartScroll.current - gestureState.dy);
      const H = collapsibleHeight;

      // Update unified scroll position
      unifiedScrollPos.current = newScrollPos;

      // Update header visual state (translateY, progress, title visibility)
      updateFromUnifiedScroll(newScrollPos);

      // If past HL, scroll content by the overflow amount
      // CRITICAL: scrollBy() handles the immediate unlock needed at crossover
      if (newScrollPos > H) {
        const contentScrollTarget = newScrollPos - H;
        const scrollDelta = contentScrollTarget - lastContentScrollApplied.current;

        if (Math.abs(scrollDelta) > 0.5) {
          editorRef.current?.scrollBy?.(scrollDelta);
          lastContentScrollApplied.current = contentScrollTarget;
        }
      } else {
        // Entering header zone from past HL - enforce CL (content must be at 0)
        if (lastContentScrollApplied.current > 0) {
          editorRef.current?.resetScroll?.();
        }
        lastContentScrollApplied.current = 0;
      }
    },

    /**
     * Handle gesture release.
     *
     * NO SNAPPING - header stays exactly where user left it.
     * Only action: transfer momentum to WebView if past HL with upward velocity.
     */
    onPanResponderRelease: (_, gestureState) => {
      const currentScroll = unifiedScrollPos.current;
      const H = collapsibleHeight;
      const velocity = -gestureState.vy; // Convert: vy<0 (up) = positive scroll velocity

      // Transfer momentum to WebView if past HL with upward velocity
      // This makes the gesture feel continuous - swipe up to collapse header,
      // and content continues scrolling with momentum
      if (currentScroll >= H && velocity > 0.5) {
        const momentumPx = velocity * MOMENTUM_MULTIPLIER;
        editorRef.current?.scrollBy?.(momentumPx);
      }
      // Otherwise: do nothing - header stays in place, no snapping
    },

    onPanResponderTerminate: () => {
      // Gesture interrupted (e.g., by system alert) - leave header where it is
      // NO SNAPPING - user can continue from current position
    },
  }), [collapsibleHeight, drawerAnim, updateFromUnifiedScroll]);

  // Interpolate translateY for collapsible section
  // When collapsed (0): slides up by collapsibleHeight (goes under fixed header)
  // When expanded (1): at normal position
  const collapsibleTranslateY = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-collapsibleHeight, 0],
  });

  // Interpolate marginBottom for layout collapse (so editor fills space)
  const collapsibleMarginBottom = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-collapsibleHeight, 0],
  });

  /**
   * Collapse header and scroll cursor into view.
   *
   * Used when keyboard appears or when typing would push cursor off-screen.
   * This function coordinates the CL→HL transition before scrolling content.
   *
   * CRITICAL SEQUENCE:
   *   1. Animate header collapse (drawerAnim → 0)
   *   2. Wait for animation to complete
   *   3. Sync unified scroll state (set isHeaderCollapsed = true)
   *   4. Wait for React re-render (scrollLocked prop propagates to WebView)
   *   5. THEN scroll to cursor
   *
   * If we skip step 4, scrollToCursor() will try to scroll while CL is still
   * active (scrollLocked=true) and nothing will happen.
   */
  const ensureCursorVisible = useCallback(() => {
    // If header is not fully collapsed, collapse it first
    if (drawerProgressRef.current > 0) {
      Animated.timing(drawerAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }).start(() => {
        // Sync unified scroll system - now at HL (Header Lock)
        unifiedScrollPos.current = collapsibleHeight;
        drawerProgressRef.current = 0;
        setShowTitleInHeader(true);
        setIsHeaderCollapsed(true); // This unlocks CL via scrollLocked prop
        // Wait for React to re-render and scrollLocked to propagate to WebView
        // before attempting to scroll to cursor
        setTimeout(() => {
          editorRef.current?.scrollToCursor();
        }, 150);
      });
    } else {
      // Header already collapsed (at HL), content is unlocked, just scroll
      editorRef.current?.scrollToCursor();
    }
  }, [collapsibleHeight, drawerAnim]);

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

  // Initialize baseline for new entries
  useEffect(() => {
    if (!isEditing && baselinePhotoCount === null) {
      // Set baseline in hook for dirty tracking
      setBaseline(formData);
      // For new entries, photos use pendingPhotos so baseline starts at 0
      setBaselinePhotoCount(0);
    }
  }, []);

  // Memoized check for actual content (for autosave: don't save empty new entries)
  const hasContent = useMemo(() =>
    formData.title.trim() !== '' ||
    formData.content.replace(/<[^>]*>/g, '').trim() !== '' ||
    formData.pendingPhotos.length > 0,
    [formData.title, formData.content, formData.pendingPhotos.length]
  );

  // Autosave callback ref - updated on each render but doesn't cause re-renders
  const handleAutosaveRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Stable callback for autosave - wraps the ref so it doesn't trigger effect re-runs
  const stableOnSave = useCallback(async () => {
    await handleAutosaveRef.current();
  }, []); // Empty deps - ref access is stable

  // AUTOSAVE: Uses extracted hook for debounced saving
  // Triggers 2s after last change, only when dirty and in edit mode
  useAutosave({
    isEditMode,
    isEditing,
    isFormDirty,
    isFormReady,
    isSubmitting,
    isSaving,
    hasContent,
    onSave: stableOnSave,
  });

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
  const enterEditMode = useCallback(() => {
    setIsEditMode(true);
  }, []);

  // GPS capture hook - handles loading, pending state, and auto-capture
  const {
    isGpsLoading,
    isNewGpsCapture,
    setIsNewGpsCapture,
    pendingLocationData,
    captureGps,
    clearPendingGps,
    savePendingGps,
  } = useGpsCapture({
    isEditing,
    captureGpsSetting: settings.captureGpsLocation,
    streamReady,
    locationEnabled: showLocation,
    currentLocationData: formData.locationData,
    onLocationChange: (location) => updateField("locationData", location),
    onBaselineUpdate: (locationData) => setBaseline({ ...formData, locationData }),
    isEditMode,
    enterEditMode,
  });

  // Auto-geocode GPS coordinates when captured (async, non-blocking)
  // First tries to snap to a saved location within 100ft, then falls back to geocode API
  // Only runs if location is enabled for the current stream
  useAutoGeocode({
    locationData: formData.locationData,
    geocodeStatus: formData.geocodeStatus,
    savedLocations: savedLocations,
    locationEnabled: showLocation,
    onLocationFieldsChange: (fields) => {
      // Update locationData with geocoded fields from Mapbox or snapped location
      const updatedLocationData: LocationType | null = formData.locationData
        ? { ...formData.locationData, ...fields }
        : null;
      updateField("locationData", updatedLocationData);
    },
    onGeocodeStatusChange: (status) => updateField("geocodeStatus", status),
    onLocationIdChange: (snappedLocation) => {
      // When snapping to a saved location, use ALL fields from the saved location
      if (snappedLocation && formData.locationData) {
        const snappedLocationData: LocationType = {
          // Keep original coordinates and locationRadius from captured location
          latitude: formData.locationData.latitude,
          longitude: formData.locationData.longitude,
          locationRadius: formData.locationData.locationRadius,
          // Copy ALL geo fields from the saved location
          location_id: snappedLocation.location_id,
          name: snappedLocation.name,
          source: 'user_custom', // Snapped to user's saved location
          address: snappedLocation.address || null,
          neighborhood: snappedLocation.neighborhood || null,
          postalCode: snappedLocation.postal_code || null,
          city: snappedLocation.city || null,
          subdivision: snappedLocation.subdivision || null,
          region: snappedLocation.region || null,
          country: snappedLocation.country || null,
        };
        updateField("locationData", snappedLocationData);
      }
    },
    isInitialCapture: !isEditing,
    onBaselineLocationFieldsUpdate: !isEditing
      ? (fields) => {
          const updatedLocationData: LocationType | null = formData.locationData
            ? { ...formData.locationData, ...fields }
            : null;
          setBaseline({
            ...formData,
            locationData: updatedLocationData,
            geocodeStatus: (fields.geocode_status as GeocodeStatus) ?? null,
          });
        }
      : undefined,
  });

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
    const knownVersion = getKnownVersion();
    const externalCheck = isExternalUpdate(entry);

    // First load - just record the version
    if (knownVersion === null) {
      initializeVersion(entryVersion);
      return;
    }

    // Version didn't change - nothing to do
    if (entryVersion <= knownVersion) return;

    // Version increased - check if it's from another device
    const isExternal = externalCheck?.isExternal ?? false;
    const editingDevice = externalCheck?.device || '';

    // Update known version
    updateKnownVersion(entryVersion);

    // If change is from THIS device (our own save), don't update form
    if (!isExternal) {
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
      // Keep current locationData - location_id changes are rare and would need async fetch
      locationData: formData.locationData,
      geocodeStatus: formData.geocodeStatus,
      pendingPhotos: formData.pendingPhotos,
    };

    // Set baseline FIRST with the exact data we're loading
    // This prevents any dirty state since baseline === formData
    setBaseline(newFormData);
    setBaselinePhotoCount(photoCount);

    // Then update form to same data
    updateMultipleFields(newFormData);

    // Note: PhotoGallery refresh is handled by usePhotoTracking hook
    // which detects external photo changes via queryAttachments

    showSnackbar(`Entry updated by ${editingDevice}`);
  }, [entry, isEditing, isFormDirty, streams, updateMultipleFields, setBaseline, photoCount, formData.entryDate, formData.includeTime, formData.locationData, formData.pendingPhotos, getKnownVersion, initializeVersion, updateKnownVersion, isExternalUpdate]);

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

  // Location picker mode: 'view' if already has location data (saved or GPS-captured), 'select' to pick/create
  // Even unnamed GPS-captured locations should open in view mode to show "Dropped Pin"
  const locationPickerMode: 'select' | 'view' =
    (formData.locationData?.latitude && formData.locationData?.longitude) ? 'view' : 'select';

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
        locationData,
        geocodeStatus: (entry.geocode_status as GeocodeStatus) ?? null,
        pendingPhotos: [], // Existing entries don't use pendingPhotos
      };

      // Set baseline FIRST, then form data - ensures they're identical
      setBaseline(newFormData);
      updateMultipleFields(newFormData);
      // Mark load complete
      isInitialLoad.current = false;
      setIsFormReady(true);
    };

    // Build locationData from entry's inline location fields
    // All location data is cached on the entry itself - no need to fetch from locations table
    const hasLocationData = entry.place_name || entry.address || entry.city || entry.region || entry.country ||
      (entry.entry_latitude != null && entry.entry_longitude != null);
    const locationData: LocationType | null = hasLocationData ? {
      location_id: entry.location_id ?? undefined,
      latitude: entry.entry_latitude ?? 0,
      longitude: entry.entry_longitude ?? 0,
      name: entry.place_name,
      source: 'user_custom',
      address: entry.address,
      neighborhood: entry.neighborhood,
      postalCode: entry.postal_code,
      city: entry.city,
      subdivision: entry.subdivision,
      region: entry.region,
      country: entry.country,
      locationRadius: entry.location_radius ?? undefined,
    } : null;
    finalizeLoad(locationData);
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
      setBaselinePhotoCount(actualPhotoCount);
      // Also sync photoCount via hook if it differs
      if (photoCount !== actualPhotoCount) {
        syncPhotoCount(actualPhotoCount);
      }
    }
  }, [isEditing, isFormReady, baselinePhotoCount, queryAttachments.length, photoCount, syncPhotoCount]);

  // Apply default status for new entries with an initial stream
  // This handles the case when navigating directly to capture form with a stream preset
  useEffect(() => {
    // Only for new entries (not editing)
    if (isEditing) return;

    // Only if we have an initial stream and streams are loaded
    if (!formData.streamId || streams.length === 0) return;

    // Only if status is still "none" (hasn't been set yet)
    if (formData.status !== "none") return;

    // Find the stream and apply its default status if enabled
    const stream = streams.find(s => s.stream_id === formData.streamId);
    if (stream?.entry_use_status && stream?.entry_default_status) {
      updateField("status", stream.entry_default_status);
    }
  }, [isEditing, formData.streamId, formData.status, streams, updateField]);

  // Apply templates when form loads with an initial stream
  // This handles the case where user navigates from a stream view and clicks "new"
  const hasAppliedInitialTemplateRef = useRef(false);
  useEffect(() => {
    // Only for new entries (not editing)
    if (isEditing) return;

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

    // Apply default status if stream has status enabled and a default set
    if (selectedStream.entry_use_status && selectedStream.entry_default_status && selectedStream.entry_default_status !== "none") {
      updateField("status", selectedStream.entry_default_status);
    }
  }, [isEditing, streams, initialStreamId, formData.title, formData.content, updateField]);

  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);

        // Ensure cursor is visible when keyboard appears
        // This collapses header if needed, then scrolls to cursor
        // IMPORTANT: Only scroll if:
        // 1. Title is NOT focused - scrollToCursor calls editor.focus() which would steal focus
        // 2. No picker is open - picker inputs (like search) need to keep their focus
        if (editorRef.current && !titleInputRef.current?.isFocused() && !activePicker) {
          setTimeout(() => {
            ensureCursorVisible();
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
  }, [isEditMode, activePicker, ensureCursorVisible]); // Re-register when edit mode or picker changes

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
    const conflictResult = checkForConflict(entry);
    if (entry && conflictResult?.hasConflict) {
      const { currentVersion, conflictDevice: lastDevice } = conflictResult;

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
                    // locationData is already loaded in baseline - keep current value
                  });
                  // Update known version to current
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
                  // Create a new entry with current form data
                  try {
                    const { tags, mentions } = extractTagsAndMentions(formData.content);

                    // Build GPS fields from location data
                    let gpsFields: { entry_latitude: number | null; entry_longitude: number | null; location_radius: number | null };
                    if (formData.locationData) {
                      gpsFields = {
                        entry_latitude: formData.locationData.latitude,
                        entry_longitude: formData.locationData.longitude,
                        location_radius: formData.locationData.locationRadius ?? null,
                      };
                    } else {
                      gpsFields = { entry_latitude: null, entry_longitude: null, location_radius: null };
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
  };

  // Update autosave ref so the useAutosave hook can call handleSave(true)
  handleAutosaveRef.current = () => handleSave(true);

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

      // Build GPS fields from location data
      // Location data includes coordinates and privacy radius for the entry
      let gpsFields: { entry_latitude: number | null; entry_longitude: number | null; location_radius: number | null };
      if (formData.locationData) {
        // Use location coordinates and privacy radius
        gpsFields = {
          entry_latitude: formData.locationData.latitude,
          entry_longitude: formData.locationData.longitude,
          location_radius: formData.locationData.locationRadius ?? null,
        };
      } else {
        // No location data at all
        gpsFields = {
          entry_latitude: null,
          entry_longitude: null,
          location_radius: null,
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
          // Update form state with new location_id so subsequent LocationPicker opens
          // show "Edit Name" option (requires location_id to be set)
          updateField("locationData", { ...formData.locationData, location_id });
        }
      }

      // Build location hierarchy fields from locationData
      // These are copied directly to the entry (entry-owned data model)
      const locationHierarchyFields = formData.locationData ? {
        place_name: formData.locationData.name || null,
        address: formData.locationData.address || null,
        neighborhood: formData.locationData.neighborhood || null,
        postal_code: formData.locationData.postalCode || null,
        city: formData.locationData.city || null,
        subdivision: formData.locationData.subdivision || null,
        region: formData.locationData.region || null,
        country: formData.locationData.country || null,
        geocode_status: formData.geocodeStatus,
      } : {
        place_name: null,
        address: null,
        neighborhood: null,
        postal_code: null,
        city: null,
        subdivision: null,
        region: null,
        country: null,
        geocode_status: formData.geocodeStatus,
      };

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
          ...locationHierarchyFields,
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
          ...locationHierarchyFields,
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
        initializeVersion(1);
      }

      // Note: Sync is triggered automatically in mobileEntryApi after save

      // For all saves (new and existing): stay on screen
      markClean(); // Mark form as clean after successful save
      setBaselinePhotoCount(photoCount); // Update photo baseline
      // Update known version - we just created a new version with this save
      // This prevents false conflict detection on subsequent saves
      if (isEditing) {
        incrementKnownVersion();
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

  // Show loading when editing and form is not fully ready
  // This blocks rendering until entry AND location are both loaded
  if (isEditing && !isFormReady) {
    console.log(`⏱️ EntryScreen: showing Loading... (isEditing=${isEditing}, isFormReady=${isFormReady})`);
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background.primary }]}>
        <Text style={[styles.loadingText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Loading...</Text>
      </View>
    );
  }

  console.log('⏱️ EntryScreen: rendering full form UI');

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
      {/* FIXED Header Bar - always visible at top, never moves */}
      {/* Shows date/time normally, shows title when header is collapsed */}
      <EntryHeader
        isEditMode={isEditMode}
        showTitleInHeader={showTitleInHeader}
        titleOpacity={titleOpacity}
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
        onRevealHeader={() => {
          // Scroll content to top, then expand header
          editorRef.current?.scrollToTop?.();
          Animated.timing(drawerAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }).start(() => {
            // Sync unified scroll system
            unifiedScrollPos.current = 0;
            drawerProgressRef.current = 1;
            setShowTitleInHeader(false);
            setIsHeaderCollapsed(false);
          });
        }}
        editorRef={editorRef}
      />

      {/* COLLAPSIBLE Section - metadata + photos + title */}
      {/* Slides under the fixed header via PanResponder drag gesture */}
      <Animated.View
        onLayout={(event) => {
          const { height } = event.nativeEvent.layout;
          // Only update if significantly different to avoid re-render loops
          if (Math.abs(height - collapsibleHeight) > 10) {
            setCollapsibleHeight(height);
          }
        }}
        style={[
          styles.collapsibleSection,
          {
            transform: [{ translateY: collapsibleTranslateY }],
            marginBottom: collapsibleMarginBottom,
            backgroundColor: theme.colors.background.primary,
          },
        ]}
        {...drawerPanResponder.panHandlers}
      >

        {/* Metadata Bar - Only shows SET values */}
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
          enterEditMode={enterEditMode}
          onStreamPress={() => setActivePicker(activePicker === 'stream' ? null : 'stream')}
          onLocationPress={() => unsupportedLocation ? setActivePicker('unsupportedLocation') : setActivePicker(activePicker === 'location' ? null : 'location')}
          onStatusPress={() => unsupportedStatus ? setActivePicker('unsupportedStatus') : setActivePicker(activePicker === 'status' ? null : 'status')}
          onTypePress={() => unsupportedType ? setActivePicker('unsupportedType') : setActivePicker(activePicker === 'type' ? null : 'type')}
          onDueDatePress={() => unsupportedDueDate ? setActivePicker('unsupportedDueDate') : setActivePicker(activePicker === 'dueDate' ? null : 'dueDate')}
          onRatingPress={() => unsupportedRating ? setActivePicker('unsupportedRating') : setActivePicker('rating')}
          onPriorityPress={() => unsupportedPriority ? setActivePicker('unsupportedPriority') : setActivePicker('priority')}
          onPhotosPress={() => setPhotosCollapsed(false)}
          editorRef={editorRef}
        />

        {/* Photo Gallery */}
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

        {/* Title Row - Below photos */}
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
          {/* Document-style underline */}
          <View style={[styles.titleRowBorder, { backgroundColor: theme.colors.border.medium }]} />
        </View>

      </Animated.View>

      {/* Content Area */}
      <View style={[
        styles.contentContainer,
        // Dynamic padding: edit mode has bottom bar (~60px), view mode has breathing room (~40px)
        isEditMode ? { paddingBottom: 60 } : { paddingBottom: 40 },
        keyboardHeight > 0 && { paddingBottom: keyboardHeight + 80 }
      ]}>

        {/* Editor - PanResponder on wrapper for pull-to-reveal */}
        <View
          style={styles.editorContainer}
          {...drawerPanResponder.panHandlers}
        >
          <RichTextEditor
            ref={editorRef}
            value={formData.content}
            onChange={(text) => updateField("content", text)}
            placeholder="What's on your mind? Use #tags and @mentions..."
            editable={isEditMode}
            onPress={enterEditMode}
            onReady={handleEditorReady}
            scrollLocked={!isHeaderCollapsed}
            /**
             * ================================================================
             * onScroll - Content Lock Enforcement & Momentum Transfer
             * ================================================================
             *
             * This callback receives scroll position updates from the WebView
             * editor. It has two critical responsibilities:
             *
             * 1. CONTENT LOCK (CL) ENFORCEMENT:
             *    If header is NOT at HL (isHeaderCollapsed=false) and content
             *    somehow scrolled past 0 (e.g., from typing, soft keyboard
             *    pushing content), we must:
             *      a) Absorb the scroll into header collapse
             *      b) Reset content scroll to 0
             *    This maintains the invariant: CL active → content at 0.
             *
             * 2. MOMENTUM TRANSFER (Pull-to-Reveal):
             *    When user scrolls content to top with velocity (swiping down
             *    quickly), the momentum should continue to reveal the header.
             *    We detect this by tracking velocity and animating header
             *    reveal when content hits top with upward momentum.
             *
             * The velocity tracking uses timestamps and scroll deltas to
             * calculate approximate scroll velocity. Negative velocity means
             * scrolling toward top (user swiping down).
             * ================================================================
             */
            onScroll={(scrollTop) => {
              console.log('[CL-DEBUG] onScroll received:', { scrollTop, isHeaderCollapsed, threshold: SCROLL_CL_ENFORCE_THRESHOLD });

              // Track if at top for PanResponder gesture detection (pull-to-reveal)
              isAtTopRef.current = scrollTop <= SCROLL_AT_TOP_THRESHOLD;

              const H = collapsibleHeight;

              // ============================================================
              // CONTENT LOCK (CL) ENFORCEMENT
              // ============================================================
              // When header is showing (CL active) and content scrolls past 0,
              // it's usually because:
              //   - Typing pushed cursor off-screen, editor auto-scrolled
              //   - Soft keyboard pushed content up
              //   - Some other programmatic scroll
              //
              // BEHAVIOR: Collapse header fully, then scroll to cursor.
              // This ensures the cursor remains visible after typing.
              //
              // HISTORY: Previous approach tried to "absorb" partial scroll
              // into header collapse and reset content to 0, but this left
              // the cursor invisible below the keyboard.
              // ============================================================
              if (!isHeaderCollapsed && scrollTop > SCROLL_CL_ENFORCE_THRESHOLD) {
                console.log('[CL-DEBUG] CL ENFORCEMENT TRIGGERED! Collapsing header and scrolling to cursor');
                drawerAnim.setValue(0);
                drawerProgressRef.current = 0;
                unifiedScrollPos.current = H;
                setShowTitleInHeader(true);
                setIsHeaderCollapsed(true);

                // Now that header is collapsed (HL), scroll to cursor
                // Use setTimeout to wait for scrollLocked prop to propagate
                setTimeout(() => {
                  console.log('[CL-DEBUG] Calling scrollToCursor after 100ms delay');
                  editorRef.current?.scrollToCursor?.();
                }, 100);

                return; // Skip velocity tracking when enforcing CL
              } else {
                console.log('[CL-DEBUG] CL enforcement NOT triggered:', { isHeaderCollapsed, scrollTop, meetsThreshold: scrollTop > SCROLL_CL_ENFORCE_THRESHOLD });
              }

              // ============================================================
              // VELOCITY TRACKING FOR MOMENTUM TRANSFER
              // ============================================================
              // Track scroll velocity to detect when user scrolls content to
              // top with momentum (for pull-to-reveal animation).
              //
              // We calculate velocity as: (scrollDelta) / (timeDelta)
              // Negative velocity = scrollTop decreasing = user swiping down
              const now = Date.now();
              const timeDelta = now - lastScrollTimeRef.current;

              if (timeDelta > 0 && timeDelta < VELOCITY_TIME_WINDOW) {
                // Only calculate velocity for recent events (< 150ms)
                // Older events would give stale/inaccurate velocity
                const scrollDelta = scrollTop - lastScrollTopRef.current;
                scrollVelocityRef.current = scrollDelta / timeDelta; // px/ms
              }

              lastScrollTopRef.current = scrollTop;
              lastScrollTimeRef.current = now;

              // ============================================================
              // MOMENTUM TRANSFER: Pull-to-Reveal Animation
              // ============================================================
              // When content hits top (scrollTop ≤ 2) with upward velocity
              // (negative = user was swiping down), animate header reveal.
              //
              // This creates the "overscroll reveals header" effect:
              // User scrolls content to top → content bounces → header reveals
              //
              // Conditions:
              // - scrollTop near 0 (content at top)
              // - Negative velocity (scrolling toward top)
              // - Header is collapsed (at HL) - otherwise nothing to reveal
              if (scrollTop <= SCROLL_CL_ENFORCE_THRESHOLD && scrollVelocityRef.current < REVEAL_VELOCITY_THRESHOLD && isHeaderCollapsed) {
                // Convert velocity to animation duration
                // Faster velocity = shorter duration = snappier reveal
                const absVelocity = Math.abs(scrollVelocityRef.current);
                const duration = Math.max(REVEAL_ANIMATION_MIN_DURATION, Math.min(REVEAL_ANIMATION_MAX_DURATION, REVEAL_ANIMATION_MIN_DURATION / absVelocity));

                // Animate header reveal with momentum
                Animated.timing(drawerAnim, {
                  toValue: 1, // Fully expanded
                  duration,
                  useNativeDriver: false, // Can't use native driver for layout props
                }).start(() => {
                  // Animation complete - sync unified scroll system
                  // Now at position 0 (fully expanded), CL becomes active
                  unifiedScrollPos.current = 0;
                  drawerProgressRef.current = 1;
                  setShowTitleInHeader(false);
                  setIsHeaderCollapsed(false); // This re-enables CL via scrollLocked prop
                  // Reset content to 0 since CL is now active
                  editorRef.current?.resetScroll?.();
                });

                // Clear velocity to prevent multiple triggers from same scroll event
                scrollVelocityRef.current = 0;
              }
            }}
          />
        </View>

      </View>

      {/* Bottom Bar - only shown when in edit mode */}
      {isEditMode && (
        <BottomBar keyboardOffset={keyboardHeight}>
          <EditorToolbar
            editorRef={editorRef}
          />
        </BottomBar>
      )}

      {/* All Pickers - extracted to separate component for maintainability */}
      <EntryPickers
        activePicker={activePicker}
        setActivePicker={setActivePicker}
        formData={formData}
        updateField={updateField}
        isEditing={isEditing}
        isEditMode={isEditMode}
        enterEditMode={enterEditMode}
        streams={streams}
        currentStream={currentStream ?? null}
        showLocation={showLocation}
        showStatus={showStatus}
        showType={showType}
        showDueDate={showDueDate}
        showRating={showRating}
        showPriority={showPriority}
        showPhotos={showPhotos}
        photoCount={photoCount}
        locationPickerMode={locationPickerMode}
        showSnackbar={showSnackbar}
        handleDelete={handleDelete}
        onAddPhoto={() => photoCaptureRef.current?.openMenu()}
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
