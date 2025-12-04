import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, Platform, Keyboard, Animated } from "react-native";
import * as Location from "expo-location";
import { extractTagsAndMentions, useAuthState, generatePhotoPath, type Location as LocationType, locationToCreateInput, locationToEntryGpsFields } from "@trace/core";
import { createLocation, getLocation as getLocationById } from '../../locations/mobileLocationApi';
import { useEntries, useEntry } from "../mobileEntryHooks";
import { useStreams } from "../../streams/mobileStreamHooks";
import { useNavigation } from "../../../shared/contexts/NavigationContext";
import { useSettings } from "../../../shared/contexts/SettingsContext";
import { RichTextEditor } from "../../../components/editor/RichTextEditor";
import { StreamPicker } from "../../streams/components/StreamPicker";
import { BottomBar } from "../../../components/layout/BottomBar";
import { TopBarDropdownContainer } from "../../../components/layout/TopBarDropdownContainer";
import { useNavigationMenu } from "../../../shared/hooks/useNavigationMenu";
import { SimpleDatePicker } from "./SimpleDatePicker";
import { PhotoCapture, type PhotoCaptureRef } from "../../photos/components/PhotoCapture";
import { PhotoGallery } from "../../photos/components/PhotoGallery";
import { LocationPicker } from "../../locations/components/LocationPicker";
import { compressPhoto, savePhotoToLocalStorage, deletePhoto } from "../../photos/mobilePhotoApi";
import { localDB } from "../../../shared/db/localDB";
import * as Crypto from "expo-crypto";
import { useCaptureFormState } from "./hooks/useCaptureFormState";
import { styles } from "./CaptureForm.styles";
import { RatingPicker, PriorityPicker, TimePicker, AttributesPicker } from "./pickers";
import { MetadataBar } from "./MetadataBar";
import { EditorToolbar } from "./EditorToolbar";
import { CaptureFormHeader } from "./CaptureFormHeader";

export interface ReturnContext {
  screen: "inbox" | "calendar" | "tasks";
  // For inbox
  streamId?: string | null | "all" | "tasks" | "events" | "streams" | "tags" | "people";
  streamName?: string;
  // For calendar
  selectedDate?: string;
  zoomLevel?: "day" | "week" | "month" | "year";
  // For tasks
  taskFilter?: "all" | "incomplete" | "complete";
}

interface CaptureFormProps {
  entryId?: string | null;
  initialStreamId?: string | null | "all" | "tasks" | "events" | "streams" | "tags" | "people";
  initialStreamName?: string;
  initialContent?: string;
  initialDate?: string;
  initialLocation?: LocationType;
  returnContext?: ReturnContext;
  /** Copied entry data - when provided, opens form with pre-filled data (not saved to DB yet) */
  copiedEntryData?: {
    entry: import('@trace/core').Entry;
    pendingPhotos: import('./hooks/useCaptureFormState').PendingPhoto[];
    hasTime: boolean;
  };
}

export function CaptureForm({ entryId, initialStreamId, initialStreamName, initialContent, initialDate, initialLocation, returnContext, copiedEntryData }: CaptureFormProps = {}) {
  // Determine if we're editing an existing entry or creating a new one
  // Note: copied entries are NOT editing - they're new entries with pre-filled data
  const isEditing = !!entryId && !copiedEntryData;
  const isCopiedEntry = !!copiedEntryData;

  // Get user settings for default GPS capture behavior
  const { settings } = useSettings();

  // Single form data state hook (consolidates form field state + pending photos)
  const { formData, updateField, addPendingPhoto, removePendingPhoto } = useCaptureFormState({
    isEditing,
    initialStreamId,
    initialStreamName,
    initialContent,
    initialDate,
    initialLocation,
    captureGpsLocationSetting: settings.captureGpsLocation,
  });

  // UI State (NOT form data - keep as individual useState)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Consolidated picker visibility state - only one picker can be open at a time
  type ActivePicker = 'stream' | 'location' | 'dueDate' | 'rating' | 'priority' | 'attributes' | 'entryDate' | 'time' | null;
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);

  // Original stream for cancel navigation (for edited entries)
  const [originalStreamId, setOriginalStreamId] = useState<string | null>(null);
  const [originalStreamName, setOriginalStreamName] = useState<string | null>(null);
  const [isTitleExpanded, setIsTitleExpanded] = useState(true);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const snackbarOpacity = useRef(new Animated.Value(0)).current;
  const editorRef = useRef<any>(null);
  const titleInputRef = useRef<TextInput>(null);
  const photoCaptureRef = useRef<PhotoCaptureRef>(null);
  const isInitialLoad = useRef(true); // Track if this is first load
  const [photoCount, setPhotoCount] = useState(0); // Track photo position for ordering
  const [photosCollapsed, setPhotosCollapsed] = useState(false); // Start expanded
  // For copied entries, use the pre-generated entry_id from copiedEntryData
  // For new entries, generate a temp ID. For editing, use the existing entryId.
  const [tempEntryId] = useState(() => copiedEntryData?.entry.entry_id || entryId || Crypto.randomUUID());

  const { entryMutations } = useEntries();
  const { entry, isLoading: isLoadingEntry, entryMutations: singleEntryMutations } = useEntry(entryId || null);
  const { user } = useAuthState();
  const { streams } = useStreams();
  const { navigate, setBeforeBackHandler } = useNavigation();
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();
  const [showMenu, setShowMenu] = useState(false);

  // Get current stream for visibility controls
  const currentStream = streams.find(s => s.stream_id === formData.streamId);

  // Stream-based visibility
  // If no stream: show all fields (default true)
  // If stream set: only show if field is true (database converts 0/1 to false/true)
  const showRating = !currentStream || currentStream.entry_use_rating === true;
  const showPriority = !currentStream || currentStream.entry_use_priority === true;
  const showStatus = !currentStream || currentStream.entry_use_status !== false;
  const showDueDate = !currentStream || currentStream.entry_use_duedates === true;
  const showLocation = !currentStream || currentStream.entry_use_location !== false;
  const showPhotos = !currentStream || currentStream.entry_use_photos !== false;

  // Get unsaved changes behavior from settings
  const unsavedChangesBehavior = settings.unsavedChangesBehavior;

  // Track original values for change detection
  const originalValues = useRef<{
    title: string;
    content: string;
    streamId: string | null;
    status: "none" | "incomplete" | "in_progress" | "complete";
    dueDate: string | null;
    rating: number;
    priority: number;
    entryDate: string;
    locationData: LocationType | null;
    photoCount: number;
  } | null>(null);

  // Edit mode: new entries start in edit mode, existing entries start in read-only
  const [isEditMode, setIsEditMode] = useState(!isEditing);

  // Full-screen edit mode (hides all metadata, shows only formData.title + body + toolbar)
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Initialize original values for new entries
  useEffect(() => {
    if (!isEditing && !originalValues.current) {
      originalValues.current = {
        title: formData.title,
        content: formData.content,
        streamId: formData.streamId,
        status: formData.status,
        dueDate: formData.dueDate,
        rating: formData.rating,
        priority: formData.priority,
        entryDate: formData.entryDate,
        locationData: formData.locationData,
        photoCount: 0,
      };
    }
  }, []);

  // Register beforeBack handler for gesture/hardware back interception
  useEffect(() => {
    const beforeBackHandler = async (): Promise<boolean> => {
      // Check if there are unsaved changes
      if (!hasUnsavedChanges()) {
        return true; // No changes, proceed with back
      }

      // Handle based on behavior setting
      switch (unsavedChangesBehavior) {
        case 'save':
          // Automatically save and proceed
          await handleSave();
          return true;

        case 'discard':
          // Discard changes and proceed
          return true;

        case 'ask':
        default:
          // Show confirmation dialog and wait for user response
          return new Promise<boolean>((resolve) => {
            Alert.alert(
              'Unsaved Changes',
              'Do you want to save the changes you made to this entry?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => resolve(false), // Block back navigation
                },
                {
                  text: 'Discard',
                  style: 'destructive',
                  onPress: () => resolve(true), // Allow back navigation
                },
                {
                  text: 'Save',
                  onPress: async () => {
                    await handleSave();
                    resolve(true); // Allow back navigation after save
                  },
                },
              ]
            );
          });
      }
    };

    // Register the handler
    setBeforeBackHandler(beforeBackHandler);

    // Cleanup: unregister handler when component unmounts
    return () => {
      setBeforeBackHandler(null);
    };
  }, [unsavedChangesBehavior, formData.title, formData.content, formData.streamId, formData.status, formData.dueDate, formData.entryDate, formData.locationData, photoCount, formData.pendingPhotos, isEditMode]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = (): boolean => {
    // If not in edit mode, no changes are possible
    if (!isEditMode) return false;

    if (!originalValues.current) return false;

    const orig = originalValues.current;

    // Compare current values with original
    if (formData.title !== orig.title) return true;
    if (formData.content !== orig.content) return true;
    if (formData.streamId !== orig.streamId) return true;
    if (formData.status !== orig.status) return true;
    if (formData.dueDate !== orig.dueDate) return true;
    if (formData.entryDate !== orig.entryDate) return true;

    // Compare photo count
    const currentPhotoCount = isEditing ? photoCount : formData.pendingPhotos.length;
    if (currentPhotoCount !== orig.photoCount) return true;

    // Compare location data
    const origLoc = orig.locationData;
    if (!formData.locationData && !origLoc) {
      // Both null, no change
    } else if (!formData.locationData || !origLoc) {
      return true; // One is null, other is not
    } else {
      // Compare location fields
      if (formData.locationData.name !== origLoc.name) return true;
      if (formData.locationData.latitude !== origLoc.latitude) return true;
      if (formData.locationData.longitude !== origLoc.longitude) return true;
    }

    return false;
  };

  // Handle navigation with unsaved changes check
  // Note: Not memoized to avoid circular dependency with handleSave
  const handleNavigationWithUnsavedCheck = (navigateCallback: () => void) => {
    if (!hasUnsavedChanges()) {
      navigateCallback();
      return;
    }

    // Check the behavior setting
    switch (unsavedChangesBehavior) {
      case 'save':
        // Automatically save and navigate
        handleSave().then(() => {
          // Navigation happens in handleSave
        });
        break;

      case 'discard':
        // Discard changes and navigate
        navigateCallback();
        break;

      case 'ask':
      default:
        // Show confirmation dialog
        Alert.alert(
          'Unsaved Changes',
          'Do you want to save the changes you made to this entry?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: navigateCallback,
            },
            {
              text: 'Save',
              onPress: () => {
                handleSave();
              },
            },
          ]
        );
        break;
    }
  };

  // Wrap menu items to check for unsaved changes before navigation
  const wrappedMenuItems = useMemo(() => menuItems.map(item => {
    if (item.isDivider || !item.onPress) {
      return item; // Don't wrap dividers or items without onPress
    }

    return {
      ...item,
      onPress: () => {
        handleNavigationWithUnsavedCheck(() => {
          item.onPress?.();
        });
      },
    };
  }), [menuItems]);

  // Wrap profile press to check for unsaved changes
  const wrappedOnProfilePress = useCallback(() => {
    if (onProfilePress) {
      handleNavigationWithUnsavedCheck(onProfilePress);
    }
  }, [onProfilePress]);

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

  // Helper to navigate back based on returnContext
  const navigateBack = useCallback((options?: { useCurrentStream?: boolean }) => {
    if (returnContext) {
      if (returnContext.screen === "calendar") {
        navigate("calendar", {
          returnDate: returnContext.selectedDate || formData.entryDate,
          returnZoomLevel: returnContext.zoomLevel
        });
        return;
      } else if (returnContext.screen === "tasks") {
        navigate("tasks");
        return;
      } else if (returnContext.screen === "inbox") {
        navigate("inbox", {
          returnStreamId: returnContext.streamId || null,
          returnStreamName: returnContext.streamName || "Uncategorized"
        });
        return;
      }
    }

    // Default: go to inbox
    if (options?.useCurrentStream) {
      // Use current form stream (after save)
      let returnStreamId: string | null = formData.streamId || null;
      let returnStreamName: string = formData.streamName || "Uncategorized";
      // Edge case: If returning to a filter view, switch to Uncategorized
      if (returnStreamId === "all" || returnStreamId === "tasks" ||
          returnStreamId === "events" || returnStreamId === "streams" ||
          returnStreamId === "tags" || returnStreamId === "people" ||
          (typeof returnStreamId === 'string' && (returnStreamId.startsWith("tag:") || returnStreamId.startsWith("mention:")))) {
        returnStreamId = null;
        returnStreamName = "Uncategorized";
      }
      navigate("inbox", { returnStreamId, returnStreamName });
    } else {
      // Use original stream (for cancel/back)
      const returnStreamId = isEditing ? originalStreamId : (formData.streamId || null);
      const returnStreamName = isEditing ? originalStreamName : (formData.streamName || "Uncategorized");
      navigate("inbox", { returnStreamId, returnStreamName });
    }
  }, [returnContext, navigate, formData.entryDate, formData.streamId, formData.streamName, isEditing, originalStreamId, originalStreamName]);

  // Auto-collapse formData.title when user starts typing in body without a formData.title
  useEffect(() => {
    if (!formData.title.trim() && formData.content.trim().length > 0) {
      setIsTitleExpanded(false);
    } else if (formData.title.trim()) {
      setIsTitleExpanded(true);
    }
  }, [formData.title, formData.content]);

  // Load entry data when editing
  useEffect(() => {
    if (entry && isEditing) {
      updateField("title", entry.title || "");
      updateField("content", entry.content);
      updateField("streamId", entry.stream_id || null);
      updateField("status", entry.status);
      updateField("dueDate", entry.due_date);
      updateField("rating", entry.rating || 0);
      updateField("priority", entry.priority || 0);

      // Load entry_date or default to created_at
      if (entry.entry_date) {
        updateField("entryDate", entry.entry_date);
        // Check milliseconds to determine if time should be shown
        const date = new Date(entry.entry_date);
        updateField("includeTime", date.getMilliseconds() !== 100);
      } else if (entry.created_at) {
        updateField("entryDate", entry.created_at);
        const date = new Date(entry.created_at);
        updateField("includeTime", date.getMilliseconds() !== 100);
      }

      // Load location data if available from locations table
      if (entry.location_id) {
        getLocationById(entry.location_id).then(locationEntity => {
          if (locationEntity) {
            // Convert LocationEntity to Location type for component use
            const location: LocationType = {
              location_id: locationEntity.location_id, // Include ID for reuse and readOnly check
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
            updateField("locationData", location);
            updateField("captureLocation", true);
            // Update original values for change detection
            if (originalValues.current) {
              originalValues.current.locationData = location;
            }
          } else {
            updateField("locationData", null);
            updateField("captureLocation", false);
          }
        }).catch(err => {
          console.error('Failed to load location:', err);
          updateField("locationData", null);
          updateField("captureLocation", false);
        });
      } else if (entry.entry_latitude && entry.entry_longitude) {
        // Entry has GPS coordinates but no location_id (GPS-only entry)
        const gpsLocation: LocationType = {
          latitude: entry.entry_latitude,
          longitude: entry.entry_longitude,
          name: null,
          source: 'user_custom',
        };
        updateField("locationData", gpsLocation);
        updateField("captureLocation", true);
        // Update original values for change detection
        if (originalValues.current) {
          originalValues.current.locationData = gpsLocation;
        }
      } else {
        // No location saved - keep toggle off and clear location data
        updateField("locationData", null);
        updateField("captureLocation", false);
      }

      // Look up stream name from streams list
      if (entry.stream_id && streams.length > 0) {
        const stream = streams.find(s => s.stream_id === entry.stream_id);
        updateField("streamName", stream?.name || null);
        // Store original stream for cancel navigation
        setOriginalStreamId(entry.stream_id);
        setOriginalStreamName(stream?.name || null);
      } else {
        updateField("streamName", null);
        // Store original stream (No Stream) for cancel navigation
        setOriginalStreamId(null);
        setOriginalStreamName(null);
      }

      // Store original values for change detection (after all state is set)
      // Note: formData.locationData will be set asynchronously by the getLocationById call above
      originalValues.current = {
        title: entry.title || "",
        content: entry.content,
        streamId: entry.stream_id || null,
        status: entry.status,
        dueDate: entry.due_date,
        rating: entry.rating || 0,
        priority: entry.priority || 0,
        entryDate: entry.entry_date || entry.created_at || formData.entryDate,
        locationData: null, // Will be updated when location loads
        photoCount: 0, // Will be updated when photos load
      };

      // Mark that initial load is complete
      isInitialLoad.current = false;
    }
  }, [entry, isEditing, streams]);

  // Load copied entry data (for copy workflow - entry is NOT saved to DB yet)
  useEffect(() => {
    if (isCopiedEntry && copiedEntryData) {
      const { entry: copiedEntry, pendingPhotos, hasTime } = copiedEntryData;

      // Load all entry fields
      updateField("title", copiedEntry.title || "");
      updateField("content", copiedEntry.content);
      updateField("streamId", copiedEntry.stream_id || null);
      updateField("status", copiedEntry.status || "none");
      updateField("dueDate", copiedEntry.due_date || null);
      updateField("rating", copiedEntry.rating || 0);
      updateField("priority", copiedEntry.priority || 0);
      updateField("entryDate", copiedEntry.entry_date || new Date().toISOString());
      updateField("includeTime", hasTime);

      // Load location data if available
      if (copiedEntry.location_id) {
        getLocationById(copiedEntry.location_id).then(locationEntity => {
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
            updateField("locationData", location);
            updateField("captureLocation", true);
          }
        }).catch(err => {
          console.error('Failed to load location for copied entry:', err);
        });
      } else if (copiedEntry.entry_latitude && copiedEntry.entry_longitude) {
        // Entry has GPS coordinates but no location_id
        const gpsLocation: LocationType = {
          latitude: copiedEntry.entry_latitude,
          longitude: copiedEntry.entry_longitude,
          name: null,
          source: 'user_custom',
        };
        updateField("locationData", gpsLocation);
        updateField("captureLocation", true);
      }

      // Look up stream name
      if (copiedEntry.stream_id && streams.length > 0) {
        const stream = streams.find(s => s.stream_id === copiedEntry.stream_id);
        updateField("streamName", stream?.name || null);
      }

      // Load the copied photos as pending photos
      if (pendingPhotos.length > 0) {
        // Add each photo to pending photos
        for (const photo of pendingPhotos) {
          addPendingPhoto(photo);
        }
        setPhotoCount(pendingPhotos.length);
      }

      // Mark initial load complete
      isInitialLoad.current = false;
    }
  }, [isCopiedEntry, copiedEntryData, streams]);

  // Update original photo count when photos load
  useEffect(() => {
    if (isEditing && originalValues.current && photoCount > 0 && originalValues.current.photoCount === 0) {
      originalValues.current.photoCount = photoCount;
    }
  }, [photoCount, isEditing]);

  // Fetch GPS location in background when location is enabled
  // Fetches GPS coordinates immediately when creating new entry
  // These coords are used by LocationPicker for POI search and privacy calculations
  useEffect(() => {
    // Skip if location is not enabled for this category
    if (!showLocation) {
      return;
    }

    // Clear location when toggled off
    if (!formData.captureLocation) {
      updateField("locationData", null);
      return;
    }

    // Skip fetching during initial load of edit screen
    if (isEditing && isInitialLoad.current) {
      return;
    }

    // Skip fetching if we already have location data loaded
    if (formData.locationData?.latitude && formData.locationData?.longitude) {
      return;
    }

    let timeoutId: NodeJS.Timeout;
    let isCancelled = false;
    let hasLocation = false;

    const fetchLocation = async () => {
      try {
        const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
        if (permissionStatus === "granted" && !isCancelled) {
          // Set timeout to give up after 15 seconds
          timeoutId = setTimeout(() => {
            if (!isCancelled && !hasLocation) {
              updateField("captureLocation", false);
              Alert.alert(
                "Location Unavailable",
                "Could not get your location. Please check that GPS is enabled.",
                [{ text: "OK" }]
              );
            }
          }, 15000);

          // Try to get last known position first (instant)
          let location = await Location.getLastKnownPositionAsync();

          // If no cached location, get current position with low accuracy (faster)
          if (!location && !isCancelled) {
            location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Low,
            });
          }

          if (location && !isCancelled) {
            hasLocation = true;
            updateField("locationData", {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy,
              name: null,
              source: 'user_custom', // Will be updated when user selects a location
            });
            clearTimeout(timeoutId);
          }
        }
      } catch (geoError) {
        if (!isCancelled) {
          updateField("captureLocation", false);
          Alert.alert(
            "Location Error",
            "Could not access your location. Please check that GPS is enabled and permissions are granted.",
            [{ text: "OK" }]
          );
        }
      }
    };

    fetchLocation();

    return () => {
      isCancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [showLocation, formData.captureLocation, isEditing]);

  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);

        // Scroll cursor into view when keyboard appears
        // Use a longer delay to ensure edit mode transition is complete
        if (editorRef.current) {
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
  }, [isEditMode]); // Re-register when edit mode changes to capture current state

  // Cancel handler
  const handleCancel = () => {
    navigateBack();
  };

  // Save handler
  const handleSave = async () => {
    // Prevent multiple simultaneous saves
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    // Check if there's something to save (formData.title, formData.content, photos, or location)
    const textContent = formData.content.replace(/<[^>]*>/g, '').trim();
    const hasTitle = formData.title.trim().length > 0;
    const hasContent = textContent.length > 0;
    const hasPhotos = isEditing ? photoCount > 0 : formData.pendingPhotos.length > 0;
    const hasLocation = formData.captureLocation && formData.locationData;

    if (!hasTitle && !hasContent && !hasPhotos && !hasLocation) {
      setIsSubmitting(false);
      Alert.alert("Empty Entry", "Please add a formData.title, formData.content, photo, or location before saving");
      return;
    }

    try {
      const { tags, mentions } = extractTagsAndMentions(formData.content);
      const gpsFields = locationToEntryGpsFields(formData.locationData);

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
          content: formData.content,
          tags,
          mentions,
          stream_id: formData.streamId,
          entry_date: formData.entryDate,
          status: formData.status,
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
          content: formData.content,
          tags,
          mentions,
          entry_date: formData.entryDate,
          stream_id: formData.streamId,
          status: formData.status,
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

            // Save to DB with real entry_id
            await localDB.createPhoto({
              photo_id: photo.photoId,
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

        // Clear form only when creating
        updateField("title", "");
        updateField("content", "");
        updateField("streamId", null);
        updateField("streamName", null);
        updateField("locationData", null);
        updateField("status", "none");
        updateField("dueDate", null);
        updateField("rating", 0);
        updateField("priority", 0);
      }

      // Note: Sync is triggered automatically in mobileEntryApi after save

      // Navigate back with current stream
      navigateBack({ useCurrentStream: true });
    } catch (error) {
      console.error(`Failed to ${isEditing ? 'update' : 'create'} entry:`, error);
      Alert.alert("Error", `Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
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
      const compressed = await compressPhoto(uri, settings.imageQuality);

      // Generate IDs
      const photoId = Crypto.randomUUID();
      const userId = user.id;

      if (isEditing) {
        // EXISTING ENTRY: Save photo to DB immediately (entry exists in Supabase)
        const localPath = await savePhotoToLocalStorage(compressed.uri, photoId, userId, entryId!);

        await localDB.createPhoto({
          photo_id: photoId,
          entry_id: entryId!,
          user_id: userId,
          file_path: generatePhotoPath(userId, entryId!, photoId, 'jpg'),
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
        const localPath = await savePhotoToLocalStorage(compressed.uri, photoId, userId, tempEntryId);

        addPendingPhoto({
          photoId,
          localPath,
          filePath: generatePhotoPath(userId, tempEntryId, photoId, 'jpg'),
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

  // Photo deletion handler
  const handlePhotoDelete = async (photoId: string) => {
    try {
      if (isEditing) {
        // EXISTING ENTRY: Delete from DB
        await deletePhoto(photoId);
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

  // Show loading when editing and entry is loading
  if (isEditing && isLoadingEntry) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Show error if editing and entry not found
  if (isEditing && !entry) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.errorText}>Entry not found</Text>
        <TouchableOpacity onPress={() => navigate("inbox")} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to Uncategorized</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Bar with Cancel/Date/Save buttons */}
      <CaptureFormHeader
        isEditMode={isEditMode}
        isFullScreen={isFullScreen}
        isSubmitting={isSubmitting}
        isEditing={isEditing}
        title={formData.title}
        entryDate={formData.entryDate}
        includeTime={formData.includeTime}
        onTitleChange={(text) => updateField("title", text)}
        onCancel={handleCancel}
        onBack={() => handleNavigationWithUnsavedCheck(navigateBack)}
        onSave={handleSave}
        onDatePress={() => setActivePicker('entryDate')}
        onTimePress={() => setActivePicker('time')}
        onAddTime={() => {
          updateField("includeTime", true);
          const date = new Date(formData.entryDate);
          date.setMilliseconds(0);
          updateField("entryDate", date.toISOString());
        }}
        onMenuToggle={() => setShowMenu(!showMenu)}
        enterEditMode={enterEditMode}
        showMenu={showMenu}
        menuItems={isEditing ? [...wrappedMenuItems.slice(0, -1), { label: "Delete Entry", onPress: handleDelete, destructive: true }, wrappedMenuItems[wrappedMenuItems.length - 1]] : wrappedMenuItems}
        userEmail={userEmail || null}
        onProfilePress={wrappedOnProfilePress}
        onMenuClose={() => setShowMenu(false)}
        editorRef={editorRef}
      />

      {/* Title Row - Full width below header (hidden in fullscreen - formData.title shows in header) */}
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
              <Text style={styles.titlePlaceholder}>
                {isEditMode ? "Add Title" : "Untitled"}
              </Text>
            </TouchableOpacity>
          ) : (
            <TextInput
              ref={titleInputRef}
              value={formData.title}
              onChangeText={(text) => updateField("title", text)}
              placeholder="Title"
              placeholderTextColor="#9ca3af"
              style={styles.titleInputFullWidth}
              editable={isEditMode && !isSubmitting}
              returnKeyType="next"
              blurOnSubmit={false}
              onFocus={() => {
                setIsTitleExpanded(true);
                // Clear any pending body focus - title is being focused instead
                editorRef.current?.clearPendingFocus?.();
              }}
              onPressIn={handleTitlePress}
            />
          )}
        </View>
      )}

      {/* Metadata Bar - Only shows SET values (hidden in full-screen mode) */}
      {!isFullScreen && (
        <MetadataBar
          streamName={formData.streamName}
          captureLocation={formData.captureLocation}
          locationData={formData.locationData}
          status={formData.status}
          dueDate={formData.dueDate}
          rating={formData.rating}
          priority={formData.priority}
          photoCount={photoCount}
          photosCollapsed={photosCollapsed}
          showLocation={showLocation}
          showStatus={showStatus}
          showDueDate={showDueDate}
          showRating={showRating}
          showPriority={showPriority}
          showPhotos={showPhotos}
          isEditMode={isEditMode}
          enterEditMode={enterEditMode}
          onStreamPress={() => setActivePicker(activePicker === 'stream' ? null : 'stream')}
          onLocationPress={() => setActivePicker(activePicker === 'location' ? null : 'location')}
          onStatusPress={() => {
            // Cycle through statuses
            if (formData.status === "incomplete") updateField("status", "in_progress");
            else if (formData.status === "in_progress") updateField("status", "complete");
            else updateField("status", "none");
            if (!isEditMode) enterEditMode();
          }}
          onDueDatePress={() => setActivePicker(activePicker === 'dueDate' ? null : 'dueDate')}
          onRatingPress={() => setActivePicker('rating')}
          onPriorityPress={() => setActivePicker('priority')}
          onPhotosPress={() => setPhotosCollapsed(false)}
          onMenuPress={() => setActivePicker('attributes')}
          editorRef={editorRef}
        />
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
            entryId={entryId || tempEntryId}
            refreshKey={photoCount}
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
        >
          <StreamPicker
            visible={true}
            onClose={() => setActivePicker(null)}
            onSelect={(id, name) => {
              const hadStream = !!formData.streamId;
              const isRemoving = !id;
              updateField("streamId", id);
              updateField("streamName", name);
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
              updateField("captureLocation", false);
              setActivePicker(null);
              showSnackbar('You removed the location');
              if (!isEditMode) {
                enterEditMode();
              }
              return;
            }

            // Show snackbar based on whether we're adding or updating
            const isUpdating = !!formData.locationData;
            updateField("locationData", location);
            updateField("captureLocation", true);
            setActivePicker(null);
            showSnackbar(isUpdating ? 'Success! You updated the location.' : 'Success! You added the location.');
            if (!isEditMode) {
              enterEditMode();
            }
          }}
          initialLocation={formData.locationData}
        />
      )}

      {/* Date Picker Dropdown (Due Date) */}
      <TopBarDropdownContainer
        visible={activePicker === 'dueDate'}
        onClose={() => setActivePicker(null)}
      >
        <SimpleDatePicker
          value={formData.dueDate ? new Date(formData.dueDate) : null}
          onChange={(date) => {
            const hadDueDate = !!formData.dueDate;
            if (date) {
              updateField("dueDate", date.toISOString());
              showSnackbar(hadDueDate ? 'Success! You updated the due date.' : 'Success! You added the due date.');
            } else {
              updateField("dueDate", null);
              if (hadDueDate) {
                showSnackbar('You removed the due date');
              }
            }
          }}
          onClose={() => setActivePicker(null)}
        />
      </TopBarDropdownContainer>

      {/* Entry Date Picker Dropdown */}
      <TopBarDropdownContainer
        visible={activePicker === 'entryDate'}
        onClose={() => setActivePicker(null)}
      >
        <SimpleDatePicker
          value={new Date(formData.entryDate)}
          onChange={(date) => {
            if (date) {
              // Preserve the current time when changing date
              const currentDate = new Date(formData.entryDate);
              date.setHours(currentDate.getHours(), currentDate.getMinutes(), currentDate.getSeconds(), currentDate.getMilliseconds());
              updateField("entryDate", date.toISOString());
            }
          }}
          onClose={() => setActivePicker(null)}
          allowClear={false}
        />
      </TopBarDropdownContainer>

      {/* Time Picker Modal */}
      <TimePicker
        visible={activePicker === 'time'}
        onClose={() => setActivePicker(null)}
        entryDate={formData.entryDate}
        onEntryDateChange={(date) => updateField("entryDate", date)}
        onIncludeTimeChange={(include) => updateField("includeTime", include)}
      />

      {/* Rating Picker Modal */}
      <RatingPicker
        visible={activePicker === 'rating'}
        onClose={() => setActivePicker(null)}
        rating={formData.rating}
        onRatingChange={(value) => updateField("rating", value)}
        onSnackbar={showSnackbar}
      />

      {/* Priority Picker Modal */}
      <PriorityPicker
        visible={activePicker === 'priority'}
        onClose={() => setActivePicker(null)}
        priority={formData.priority}
        onPriorityChange={(value) => updateField("priority", value)}
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
        showDueDate={showDueDate}
        showRating={showRating}
        showPriority={showPriority}
        showPhotos={showPhotos}
        captureLocation={formData.captureLocation}
        hasLocationData={!!formData.locationData}
        status={formData.status}
        dueDate={formData.dueDate}
        rating={formData.rating}
        priority={formData.priority}
        photoCount={photoCount}
        onShowLocationPicker={() => setActivePicker('location')}
        onStatusChange={(status) => updateField("status", status)}
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
      />

      {/* Snackbar */}
      {snackbarMessage && (
        <Animated.View style={[styles.snackbar, { opacity: snackbarOpacity }]}>
          <Text style={styles.snackbarText}>{snackbarMessage}</Text>
        </Animated.View>
      )}
    </View>
  );
}
