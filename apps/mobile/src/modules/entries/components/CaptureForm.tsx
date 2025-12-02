import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Platform, StatusBar, Keyboard, Animated } from "react-native";
import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import DateTimePicker from "@react-native-community/datetimepicker";
import { extractTagsAndMentions, getWordCount, getCharacterCount, useAuthState, generatePhotoPath, type Location as LocationType, locationToCreateInput, locationToEntryGpsFields } from "@trace/core";
import { createLocation, getLocation as getLocationById } from '../../locations/mobileLocationApi';
import { useEntries, useEntry } from "../mobileEntryHooks";
import { useCategories } from "../../categories/mobileCategoryHooks";
import { useNavigation } from "../../../shared/contexts/NavigationContext";
import { useSettings } from "../../../shared/contexts/SettingsContext";
import { RichTextEditor } from "../../../components/editor/RichTextEditor";
import { CategoryPicker } from "../../categories/components/CategoryPicker";
import { BottomBar } from "../../../components/layout/BottomBar";
import { TopBarDropdownContainer } from "../../../components/layout/TopBarDropdownContainer";
import { NavigationMenu } from "../../../components/navigation/NavigationMenu";
import { useNavigationMenu } from "../../../shared/hooks/useNavigationMenu";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { theme } from "../../../shared/theme/theme";
import { SimpleDatePicker } from "./SimpleDatePicker";
import { PhotoCapture, type PhotoCaptureRef } from "../../photos/components/PhotoCapture";
import { PhotoGallery } from "../../photos/components/PhotoGallery";
import { LocationPicker } from "../../locations/components/LocationPicker";
import { compressPhoto, savePhotoToLocalStorage, deletePhoto } from "../../photos/mobilePhotoApi";
import { localDB } from "../../../shared/db/localDB";
import * as Crypto from "expo-crypto";

import type { ReturnContext } from "../../../screens/EntryScreen";

interface CaptureFormProps {
  entryId?: string | null;
  initialCategoryId?: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "people";
  initialCategoryName?: string;
  initialContent?: string;
  initialDate?: string;
  initialLocation?: LocationType;
  returnContext?: ReturnContext;
}

export function CaptureForm({ entryId, initialCategoryId, initialCategoryName, initialContent, initialDate, initialLocation, returnContext }: CaptureFormProps = {}) {
  // Determine if we're editing an existing entry or creating a new one
  const isEditing = !!entryId;

  // Get user settings for default GPS capture behavior
  const { settings } = useSettings();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState(initialContent || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // For new entries: use setting, for editing: use initialLocation presence
  const [captureLocation, setCaptureLocation] = useState(
    isEditing ? !!initialLocation : settings.captureGpsLocation
  );

  // Initialize category from props for new entries, or null for editing (will be loaded from entry)
  const getInitialCategoryId = (): string | null => {
    if (isEditing) return null; // Will be loaded from entry
    // For new entries, use initialCategoryId if it's a real category (not a filter like "all", "tasks", etc.)
    if (!initialCategoryId || typeof initialCategoryId !== 'string' ||
        initialCategoryId === "all" || initialCategoryId === "tasks" ||
        initialCategoryId === "events" || initialCategoryId === "categories" ||
        initialCategoryId === "tags" || initialCategoryId === "people" ||
        initialCategoryId.startsWith("tag:") || initialCategoryId.startsWith("mention:") || initialCategoryId.startsWith("location:")) {
      return null; // Default to Uncategorized for filters
    }
    return initialCategoryId;
  };

  const [categoryId, setCategoryId] = useState<string | null>(getInitialCategoryId());
  const [categoryName, setCategoryName] = useState<string | null>(
    !isEditing && initialCategoryName && getInitialCategoryId() !== null ? initialCategoryName : null
  );
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [status, setStatus] = useState<"none" | "incomplete" | "in_progress" | "complete">("none");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [showRatingPicker, setShowRatingPicker] = useState(false);
  const [priority, setPriority] = useState<number>(0);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showAttributesPicker, setShowAttributesPicker] = useState(false);
  const [entryDate, setEntryDate] = useState<string>(() => {
    // If initialDate is provided (from calendar), use it with current time + 100ms to hide time
    if (initialDate) {
      // Parse YYYY-MM-DD in local timezone to avoid UTC conversion issues
      const [year, month, day] = initialDate.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, day); // month is 0-indexed
      const now = new Date();
      // Set the time to current time but on the selected date
      selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 100); // 100ms to hide time
      return selectedDate.toISOString();
    }
    // Default to current date and time (with 0 milliseconds to show time)
    const now = new Date();
    now.setMilliseconds(0);
    return now.toISOString();
  });
  const [showNativePicker, setShowNativePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");
  const [showEntryDatePicker, setShowEntryDatePicker] = useState(false);
  // Check milliseconds to determine if time should be shown (0 = show, 100 = hidden)
  const [includeTime, setIncludeTime] = useState(() => {
    // If initialDate provided, hide time initially
    return !initialDate;
  });
  const [showTimeModal, setShowTimeModal] = useState(false); // Custom modal for time with Clear button
  // Store original category for cancel navigation (for edited entries)
  const [originalCategoryId, setOriginalCategoryId] = useState<string | null>(null);
  const [originalCategoryName, setOriginalCategoryName] = useState<string | null>(null);
  const [locationData, setLocationData] = useState<LocationType | null>(initialLocation || null);
  const [isTitleExpanded, setIsTitleExpanded] = useState(true);
  const [locationIconBlink, setLocationIconBlink] = useState(true);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const snackbarOpacity = useRef(new Animated.Value(0)).current;
  const editorRef = useRef<any>(null);
  const titleInputRef = useRef<TextInput>(null);
  const photoCaptureRef = useRef<PhotoCaptureRef>(null);
  const isInitialLoad = useRef(true); // Track if this is first load
  const lastTitleTap = useRef<number | null>(null); // Track last tap time for double-tap detection
  const [photoCount, setPhotoCount] = useState(0); // Track photo position for ordering
  const [photosCollapsed, setPhotosCollapsed] = useState(false); // Start expanded
  const [tempEntryId] = useState(() => entryId || Crypto.randomUUID()); // Temp ID for new entries

  // Pending photos for NEW entries only (not saved to DB yet)
  // For EXISTING entries, photos are saved to DB immediately
  const [pendingPhotos, setPendingPhotos] = useState<Array<{
    photoId: string;
    localPath: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
    width: number;
    height: number;
    position: number;
  }>>([]);

  const { entryMutations } = useEntries();
  const { entry, isLoading: isLoadingEntry, entryMutations: singleEntryMutations } = useEntry(entryId || null);
  const { user, signOut } = useAuthState();
  const { categories } = useCategories();
  const { navigate, setBeforeBackHandler } = useNavigation();
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();
  const [showMenu, setShowMenu] = useState(false);

  // Get current category for visibility controls
  const currentCategory = categories.find(c => c.category_id === categoryId);

  // Category-based visibility
  // If no category: show all fields (default true)
  // If category set: only show if field is true (database converts 0/1 to false/true)
  const showRating = !currentCategory || currentCategory.entry_use_rating === true;
  const showPriority = !currentCategory || currentCategory.entry_use_priority === true;
  const showStatus = !currentCategory || currentCategory.entry_use_status !== false;
  const showDueDate = !currentCategory || currentCategory.entry_use_duedates === true;
  const showLocation = !currentCategory || currentCategory.entry_use_location !== false;
  const showPhotos = !currentCategory || currentCategory.entry_use_photos !== false;

  // Get unsaved changes behavior from settings
  const unsavedChangesBehavior = settings.unsavedChangesBehavior;

  // Track original values for change detection
  const originalValues = useRef<{
    title: string;
    content: string;
    categoryId: string | null;
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

  // Full-screen edit mode (hides all metadata, shows only title + body + toolbar)
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Initialize original values for new entries
  useEffect(() => {
    if (!isEditing && !originalValues.current) {
      originalValues.current = {
        title: "",
        content: initialContent || "",
        categoryId: getInitialCategoryId(),
        status: "none",
        dueDate: null,
        rating: 0,
        priority: 0,
        entryDate: entryDate,
        locationData: initialLocation || null,
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
  }, [unsavedChangesBehavior, title, content, categoryId, status, dueDate, entryDate, locationData, photoCount, pendingPhotos, isEditMode]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = (): boolean => {
    // If not in edit mode, no changes are possible
    if (!isEditMode) return false;

    if (!originalValues.current) return false;

    const orig = originalValues.current;

    // Compare current values with original
    if (title !== orig.title) return true;
    if (content !== orig.content) return true;
    if (categoryId !== orig.categoryId) return true;
    if (status !== orig.status) return true;
    if (dueDate !== orig.dueDate) return true;
    if (entryDate !== orig.entryDate) return true;

    // Compare photo count
    const currentPhotoCount = isEditing ? photoCount : pendingPhotos.length;
    if (currentPhotoCount !== orig.photoCount) return true;

    // Compare location data
    const origLoc = orig.locationData;
    if (!locationData && !origLoc) {
      // Both null, no change
    } else if (!locationData || !origLoc) {
      return true; // One is null, other is not
    } else {
      // Compare location fields
      if (locationData.name !== origLoc.name) return true;
      if (locationData.latitude !== origLoc.latitude) return true;
      if (locationData.longitude !== origLoc.longitude) return true;
    }

    return false;
  };

  // Handle navigation with unsaved changes check
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
  const wrappedMenuItems = menuItems.map(item => {
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
  });

  // Wrap profile press to check for unsaved changes
  const wrappedOnProfilePress = () => {
    if (onProfilePress) {
      handleNavigationWithUnsavedCheck(onProfilePress);
    }
  };

  // Enter edit mode, optionally placing cursor at tap coordinates
  const enterEditMode = (tapCoordinates?: { x: number; y: number }) => {
    setIsEditMode(true);
    // If we have tap coordinates, focus the editor at that position after a brief delay
    if (tapCoordinates) {
      setTimeout(() => {
        editorRef.current?.focusAtPosition(tapCoordinates.x, tapCoordinates.y);
      }, 100);
    }
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

  // Handle double-tap on title to enter edit mode
  const handleTitlePress = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300; // ms

    if (lastTitleTap.current && (now - lastTitleTap.current) < DOUBLE_PRESS_DELAY) {
      // Double tap detected
      if (!isEditMode) {
        enterEditMode();
        // Focus the title input after a short delay to ensure edit mode is active
        setTimeout(() => {
          titleInputRef.current?.focus();
        }, 100);
      }
      lastTitleTap.current = null;
    } else {
      // Single tap
      lastTitleTap.current = now;
      setIsTitleExpanded(true);
    }
  };

  // Determine if title should be collapsed
  const shouldCollapse = !title.trim() && content.trim().length > 0 && !isTitleExpanded;

  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  // Blinking animation for location loading
  useEffect(() => {
    // Only blink if location capture is on AND we don't have any location data yet
    // If we have a name OR coordinates, don't blink (location is already set)
    const hasLocationData = locationData && (locationData.name || (locationData.latitude && locationData.longitude));

    if (captureLocation && !hasLocationData) {
      // Start blinking by toggling state
      const interval = setInterval(() => {
        setLocationIconBlink(prev => !prev);
      }, 600);
      return () => clearInterval(interval);
    } else {
      setLocationIconBlink(true);
    }
  }, [captureLocation, locationData?.name, locationData?.latitude, locationData?.longitude]);

  // Auto-collapse title when user starts typing in body without a title
  useEffect(() => {
    if (!title.trim() && content.trim().length > 0) {
      setIsTitleExpanded(false);
    } else if (title.trim()) {
      setIsTitleExpanded(true);
    }
  }, [title, content]);

  // Load entry data when editing
  useEffect(() => {
    if (entry && isEditing) {
      setTitle(entry.title || "");
      setContent(entry.content);
      setCategoryId(entry.category_id || null);
      setStatus(entry.status);
      setDueDate(entry.due_date);
      setRating(entry.rating || 0);
      setPriority(entry.priority || 0);

      // Load entry_date or default to created_at
      if (entry.entry_date) {
        setEntryDate(entry.entry_date);
        // Check milliseconds to determine if time should be shown
        const date = new Date(entry.entry_date);
        setIncludeTime(date.getMilliseconds() !== 100);
      } else if (entry.created_at) {
        setEntryDate(entry.created_at);
        const date = new Date(entry.created_at);
        setIncludeTime(date.getMilliseconds() !== 100);
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
            setLocationData(location);
            setCaptureLocation(true);
            // Update original values for change detection
            if (originalValues.current) {
              originalValues.current.locationData = location;
            }
          } else {
            setLocationData(null);
            setCaptureLocation(false);
          }
        }).catch(err => {
          console.error('Failed to load location:', err);
          setLocationData(null);
          setCaptureLocation(false);
        });
      } else if (entry.entry_latitude && entry.entry_longitude) {
        // Entry has GPS coordinates but no location_id (GPS-only entry)
        const gpsLocation: LocationType = {
          latitude: entry.entry_latitude,
          longitude: entry.entry_longitude,
          name: null,
          source: 'user_custom',
        };
        setLocationData(gpsLocation);
        setCaptureLocation(true);
        // Update original values for change detection
        if (originalValues.current) {
          originalValues.current.locationData = gpsLocation;
        }
      } else {
        // No location saved - keep toggle off and clear location data
        setLocationData(null);
        setCaptureLocation(false);
      }

      // Look up category name from categories list
      if (entry.category_id && categories.length > 0) {
        const category = categories.find(c => c.category_id === entry.category_id);
        setCategoryName(category?.name || null);
        // Store original category for cancel navigation
        setOriginalCategoryId(entry.category_id);
        setOriginalCategoryName(category?.name || null);
      } else {
        setCategoryName(null);
        // Store original category (Uncategorized) for cancel navigation
        setOriginalCategoryId(null);
        setOriginalCategoryName(null);
      }

      // Store original values for change detection (after all state is set)
      // Note: locationData will be set asynchronously by the getLocationById call above
      originalValues.current = {
        title: entry.title || "",
        content: entry.content,
        categoryId: entry.category_id || null,
        status: entry.status,
        dueDate: entry.due_date,
        rating: entry.rating || 0,
        priority: entry.priority || 0,
        entryDate: entry.entry_date || entry.created_at || entryDate,
        locationData: null, // Will be updated when location loads
        photoCount: 0, // Will be updated when photos load
      };

      // Mark that initial load is complete
      isInitialLoad.current = false;
    }
  }, [entry, isEditing, categories]);

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
    if (!captureLocation) {
      setLocationData(null);
      return;
    }

    // Skip fetching during initial load of edit screen
    if (isEditing && isInitialLoad.current) {
      return;
    }

    // Skip fetching if we already have location data loaded
    if (locationData?.latitude && locationData?.longitude) {
      return;
    }

    console.log('[CaptureForm] 📍 Starting GPS fetch for new entry...');

    let timeoutId: NodeJS.Timeout;
    let isCancelled = false;
    let hasLocation = false;

    const fetchLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log('[CaptureForm] GPS permission status:', status);
        if (status === "granted" && !isCancelled) {
          // Set timeout to give up after 15 seconds
          timeoutId = setTimeout(() => {
            if (!isCancelled && !hasLocation) {
              console.log("Location fetch timeout - giving up");
              setCaptureLocation(false);
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
            console.log('[CaptureForm] ✅ GPS acquired:', {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy
            });
            setLocationData({
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
        console.log("Location not available:", geoError);
        if (!isCancelled) {
          setCaptureLocation(false);
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
  }, [showLocation, captureLocation, isEditing]);

  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);

        // Scroll cursor into view when keyboard appears in edit mode
        if (isEditMode && editorRef.current) {
          setTimeout(() => {
            editorRef.current?.scrollToCursor();
          }, 150);
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
    // Navigate back based on returnContext
    if (returnContext) {
      if (returnContext.screen === "calendar") {
        navigate("calendar", {
          returnDate: entryDate,
          returnZoomLevel: returnContext.zoomLevel
        });
        return;
      } else if (returnContext.screen === "tasks") {
        navigate("tasks");
        return;
      } else if (returnContext.screen === "inbox") {
        navigate("inbox", {
          returnCategoryId: returnContext.categoryId || null,
          returnCategoryName: returnContext.categoryName || "Uncategorized"
        });
        return;
      }
    }

    // Default: go to inbox with original category (for edited entries) or current category
    const returnCategoryId = isEditing ? originalCategoryId : (categoryId || null);
    const returnCategoryName = isEditing ? originalCategoryName : (categoryName || "Uncategorized");
    navigate("inbox", { returnCategoryId, returnCategoryName });
  };

  // Save handler
  const handleSave = async () => {
    // Prevent multiple simultaneous saves
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    // Check if there's something to save (title, content, photos, or location)
    const textContent = content.replace(/<[^>]*>/g, '').trim();
    const hasTitle = title.trim().length > 0;
    const hasContent = textContent.length > 0;
    const hasPhotos = isEditing ? photoCount > 0 : pendingPhotos.length > 0;
    const hasLocation = captureLocation && locationData;

    if (!hasTitle && !hasContent && !hasPhotos && !hasLocation) {
      setIsSubmitting(false);
      Alert.alert("Empty Entry", "Please add a title, content, photo, or location before saving");
      return;
    }

    try {
      const { tags, mentions } = extractTagsAndMentions(content);
      const gpsFields = locationToEntryGpsFields(locationData);

      // Get or create location if we have location data
      let location_id: string | null = null;
      if (locationData && locationData.name) {
        // Check if this is a saved location (has existing location_id)
        if (locationData.location_id) {
          // Reuse existing location
          location_id = locationData.location_id;
          console.log('[CaptureForm] 📍 Reusing existing location:', location_id);
        } else {
          // Create a new location in the locations table
          const locationInput = locationToCreateInput(locationData);
          console.log('[CaptureForm] 📍 Creating new location:', locationInput);
          const savedLocation = await createLocation(locationInput);
          location_id = savedLocation.location_id;
          console.log('[CaptureForm] ✅ Location created with ID:', location_id);
        }
      }

      if (isEditing) {
        // Update existing entry
        console.log('[CaptureForm] 💾 Updating entry with location_id:', location_id);

        await singleEntryMutations.updateEntry({
          title: title.trim() || null,
          content,
          tags,
          mentions,
          category_id: categoryId,
          entry_date: entryDate,
          status,
          due_date: dueDate,
          rating: rating || 0,
          priority: priority || 0,
          location_id,
          ...gpsFields,
        });

        console.log('[CaptureForm] ✅ Entry updated successfully');
      } else {
        // Create new entry
        console.log('[CaptureForm] 💾 Saving entry with location_id:', location_id);

        const newEntry = await entryMutations.createEntry({
          title: title.trim() || null,
          content,
          tags,
          mentions,
          entry_date: entryDate,
          category_id: categoryId,
          status,
          due_date: dueDate,
          rating: rating || 0,
          priority: priority || 0,
          location_id,
          ...gpsFields,
        });

        console.log('[CaptureForm] ✅ Entry saved successfully with ID:', newEntry.entry_id);

        // CRITICAL: Save all pending photos to DB with the real entry_id
        if (pendingPhotos.length > 0) {
          for (const photo of pendingPhotos) {
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

          setPendingPhotos([]); // Clear pending photos
        }

        // Clear form only when creating
        setTitle("");
        setContent("");
        setCategoryId(null);
        setCategoryName(null);
        setLocationData(null);
        setStatus("none");
        setDueDate(null);
        setRating(0);
        setPriority(0);
      }

      // Navigate back to inbox with the category that was set
      // This ensures the list shows the category where the entry was saved
      // If category is a filter (all, tasks, etc.), default to Uncategorized
      let returnCategoryId: string | null = categoryId || null;
      let returnCategoryName: string = categoryName || "Uncategorized";

      // Edge case: If returning to a filter view, switch to Uncategorized instead
      if (returnCategoryId === "all" || returnCategoryId === "tasks" ||
          returnCategoryId === "events" || returnCategoryId === "categories" ||
          returnCategoryId === "tags" || returnCategoryId === "people" ||
          (typeof returnCategoryId === 'string' && (returnCategoryId.startsWith("tag:") || returnCategoryId.startsWith("mention:")))) {
        returnCategoryId = null;
        returnCategoryName = "Uncategorized";
      }

      // Note: Sync is triggered automatically in mobileEntryApi after save

      // Navigate back based on returnContext
      if (returnContext) {
        if (returnContext.screen === "calendar") {
          navigate("calendar", {
            returnDate: entryDate,
            returnZoomLevel: returnContext.zoomLevel
          });
          return;
        } else if (returnContext.screen === "tasks") {
          navigate("tasks");
          return;
        } else if (returnContext.screen === "inbox") {
          navigate("inbox", {
            returnCategoryId: returnContext.categoryId || null,
            returnCategoryName: returnContext.categoryName || "Uncategorized"
          });
          return;
        }
      }

      navigate("inbox", { returnCategoryId, returnCategoryName });
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
      console.log(`📸 Compressing photo with quality setting: ${settings.imageQuality}`);
      const compressed = await compressPhoto(uri, settings.imageQuality);
      console.log(`📸 Compressed result: ${compressed.width}x${compressed.height}, ${(compressed.file_size / 1024 / 1024).toFixed(2)} MB`);

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

        setPendingPhotos(prev => [...prev, {
          photoId,
          localPath,
          filePath: generatePhotoPath(userId, tempEntryId, photoId, 'jpg'),
          mimeType: 'image/jpeg',
          fileSize: compressed.file_size,
          width: compressed.width,
          height: compressed.height,
          position: photoCount,
        }]);

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
        setPendingPhotos(prev => prev.filter(p => p.photoId !== photoId));
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
      <View style={[styles.titleBar, isFullScreen && styles.titleBarFullScreen]}>
        {/* Left side: Cancel button in edit mode, Back button in view mode */}
        <View style={styles.headerLeftContainer}>
          {isEditMode ? (
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.headerCancelButton}
            >
              <Text style={styles.headerCancelText}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => handleNavigationWithUnsavedCheck(() => {
                if (returnContext) {
                  if (returnContext.screen === "calendar") {
                    navigate("calendar", {
                      returnDate: returnContext.selectedDate,
                      returnZoomLevel: returnContext.zoomLevel
                    });
                  } else if (returnContext.screen === "tasks") {
                    navigate("tasks");
                  } else if (returnContext.screen === "inbox") {
                    navigate("inbox", {
                      returnCategoryId: returnContext.categoryId || null,
                      returnCategoryName: returnContext.categoryName || "Uncategorized"
                    });
                  } else {
                    navigate("inbox");
                  }
                } else {
                  navigate("inbox");
                }
              })}
              style={styles.headerCancelButton}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                <Path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          )}
        </View>

        {/* Center: Date & Time (normal mode) or Editable Title (fullscreen mode) */}
        {isFullScreen ? (
          <View style={styles.headerTitleContainer}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Untitled"
              placeholderTextColor="#9ca3af"
              style={styles.headerTitleInput}
              editable={isEditMode && !isSubmitting}
              returnKeyType="done"
              blurOnSubmit={true}
            />
          </View>
        ) : (
          <View style={styles.headerDateContainer}>
            {/* Date */}
            <TouchableOpacity
              onPress={() => {
                editorRef.current?.blur();
                Keyboard.dismiss();
                setTimeout(() => {
                  setShowEntryDatePicker(true);
                  if (!isEditMode) enterEditMode();
                }, 100);
              }}
            >
              <Text style={styles.headerDateText}>
                {entryDate ? new Date(entryDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }) : 'Set date'}
              </Text>
            </TouchableOpacity>

            {/* Time or Watch Icon */}
            {includeTime ? (
              <TouchableOpacity
                style={styles.headerTimeContainer}
                onPress={() => {
                  setShowTimeModal(true);
                  if (!isEditMode) enterEditMode();
                }}
              >
                <Text style={styles.headerDateText}>
                  {entryDate ? new Date(entryDate).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  }) : 'Set time'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.headerWatchButton}
                onPress={() => {
                  setIncludeTime(true);
                  const date = new Date(entryDate);
                  date.setMilliseconds(0);
                  setEntryDate(date.toISOString());
                  if (!isEditMode) enterEditMode();
                }}
              >
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2}>
                  <Circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Right side: Save button (in edit mode) + Hamburger Menu (hidden in fullscreen) */}
        <View style={styles.headerRightContainer}>
          {/* Save button only shows in edit mode - no Edit button, user taps content to edit */}
          {isEditMode && (
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSubmitting}
              style={[styles.headerSaveButton, isSubmitting && styles.headerSaveButtonDisabled]}
            >
              <Text style={[styles.headerSaveText, isSubmitting && styles.headerSaveTextDisabled]}>
                {isSubmitting ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Hamburger Menu - hidden in fullscreen mode */}
          {!isFullScreen && (
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => setShowMenu(!showMenu)}
            >
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth={2}>
                <Line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
                <Line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
                <Line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          )}

          <NavigationMenu
            visible={showMenu}
            onClose={() => setShowMenu(false)}
            menuItems={isEditing ? [...wrappedMenuItems.slice(0, -1), { label: "Delete Entry", onPress: handleDelete, destructive: true }, wrappedMenuItems[wrappedMenuItems.length - 1]] : wrappedMenuItems}
            userEmail={userEmail}
            onProfilePress={wrappedOnProfilePress}
          />
        </View>
      </View>

      {/* Title Row - Full width below header (hidden in fullscreen - title shows in header) */}
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
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor="#9ca3af"
              style={styles.titleInputFullWidth}
              editable={isEditMode && !isSubmitting}
              returnKeyType="next"
              blurOnSubmit={false}
              onFocus={() => {
                setIsTitleExpanded(true);
              }}
              onPressIn={handleTitlePress}
            />
          )}
        </View>
      )}

      {/* Metadata Bar - Only shows SET values (hidden in full-screen mode) */}
      {!isFullScreen && (
      <View style={styles.metadataBar}>
        {/* Category - always shown */}
        <TouchableOpacity
          style={styles.metadataLink}
          onPress={() => {
            editorRef.current?.blur();
            Keyboard.dismiss();
            setTimeout(() => setShowCategoryPicker(!showCategoryPicker), 100);
          }}
        >
          <View style={styles.metadataLinkContent}>
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2.5}>
              <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={[styles.metadataText, styles.metadataTextActive]} numberOfLines={1} ellipsizeMode="tail">
              {categoryName || "Uncategorized"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Location - only if set */}
        {showLocation && captureLocation && locationData && (
          <>
            <Text style={styles.metadataDivider}>·</Text>
            <TouchableOpacity
              style={styles.metadataLink}
              onPress={() => {
                editorRef.current?.blur();
                Keyboard.dismiss();
                setTimeout(() => setShowLocationPicker(!showLocationPicker), 100);
              }}
            >
              <View style={styles.metadataLinkContent}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2.5}>
                  <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={12} cy={10} r={3} fill={theme.colors.text.primary} />
                </Svg>
                <Text style={[styles.metadataText, styles.metadataTextActive]} numberOfLines={1} ellipsizeMode="tail">
                  {locationData.name || "GPS"}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Status - only if set (not "none") */}
        {showStatus && status !== "none" && (
          <>
            <Text style={styles.metadataDivider}>·</Text>
            <TouchableOpacity
              style={styles.metadataLink}
              onPress={() => {
                // Cycle through statuses
                if (status === "incomplete") setStatus("in_progress");
                else if (status === "in_progress") setStatus("complete");
                else setStatus("none");
                if (!isEditMode) enterEditMode();
              }}
            >
              <View style={styles.metadataLinkContent}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke={status === "complete" ? theme.colors.text.primary : "#6b7280"}
                    strokeWidth={2}
                    fill={status === "complete" ? theme.colors.text.primary : "none"}
                  />
                  {status === "complete" && (
                    <Path d="M7 12l3 3 7-7" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  )}
                  {status === "in_progress" && (
                    <Circle cx="12" cy="12" r="4" fill="#6b7280" />
                  )}
                </Svg>
                <Text style={[styles.metadataText, styles.metadataTextActive]} numberOfLines={1} ellipsizeMode="tail">
                  {status === "incomplete" ? "Not Started" :
                   status === "in_progress" ? "In Progress" :
                   "Completed"}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Due Date - only if set */}
        {showDueDate && dueDate && (
          <>
            <Text style={styles.metadataDivider}>·</Text>
            <TouchableOpacity
              style={styles.metadataLink}
              onPress={() => {
                editorRef.current?.blur();
                Keyboard.dismiss();
                setTimeout(() => {
                  setShowDatePicker(!showDatePicker);
                  if (!isEditMode) enterEditMode();
                }, 100);
              }}
            >
              <View style={styles.metadataLinkContent}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2.5}>
                  <Path d="M3 4a2 2 0 012-2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V4z" strokeLinecap="round" strokeLinejoin="round" />
                  <Line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" strokeLinejoin="round" />
                  <Line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" strokeLinejoin="round" />
                  <Line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={[styles.metadataText, styles.metadataTextActive]} numberOfLines={1} ellipsizeMode="tail">
                  {new Date(dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Rating - only if set */}
        {showRating && rating > 0 && (
          <>
            <Text style={styles.metadataDivider}>·</Text>
            <TouchableOpacity
              style={styles.metadataLink}
              onPress={() => {
                editorRef.current?.blur();
                Keyboard.dismiss();
                setTimeout(() => {
                  setShowRatingPicker(true);
                  if (!isEditMode) enterEditMode();
                }, 100);
              }}
            >
              <View style={styles.metadataLinkContent}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill={theme.colors.text.primary} stroke="none">
                  <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </Svg>
                <Text style={[styles.metadataText, styles.metadataTextActive]} numberOfLines={1} ellipsizeMode="tail">
                  {rating}/5
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Priority - only if set */}
        {showPriority && priority > 0 && (
          <>
            <Text style={styles.metadataDivider}>·</Text>
            <TouchableOpacity
              style={styles.metadataLink}
              onPress={() => {
                editorRef.current?.blur();
                Keyboard.dismiss();
                setTimeout(() => {
                  setShowPriorityPicker(true);
                  if (!isEditMode) enterEditMode();
                }, 100);
              }}
            >
              <View style={styles.metadataLinkContent}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill={theme.colors.text.primary} stroke="none">
                  <Path d="M5 3v18" strokeWidth="2" stroke={theme.colors.text.primary} />
                  <Path d="M5 3h13l-4 5 4 5H5z" />
                </Svg>
                <Text style={[styles.metadataText, styles.metadataTextActive]} numberOfLines={1} ellipsizeMode="tail">
                  P{priority}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Photos - only if has photos and collapsed */}
        {showPhotos && photoCount > 0 && photosCollapsed && (
          <>
            <Text style={styles.metadataDivider}>·</Text>
            <TouchableOpacity
              style={styles.metadataLink}
              onPress={() => setPhotosCollapsed(false)}
            >
              <View style={styles.metadataLinkContent}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2.5}>
                  <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={12} cy={13} r={4} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={[styles.metadataText, styles.metadataTextActive]} numberOfLines={1} ellipsizeMode="tail">
                  {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Entry Menu Button (...) */}
        <TouchableOpacity
          style={styles.entryMenuButton}
          onPress={() => {
            editorRef.current?.blur();
            Keyboard.dismiss();
            setTimeout(() => setShowAttributesPicker(true), 100);
          }}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="#6b7280" stroke="none">
            <Circle cx={12} cy={5} r={2} />
            <Circle cx={12} cy={12} r={2} />
            <Circle cx={12} cy={19} r={2} />
          </Svg>
        </TouchableOpacity>

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
            entryId={entryId || tempEntryId}
            refreshKey={photoCount}
            onPhotoCountChange={setPhotoCount}
            onPhotoDelete={handlePhotoDelete}
            pendingPhotos={isEditing ? undefined : pendingPhotos}
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
            value={content}
            onChange={setContent}
            placeholder="What's on your mind? Use #tags and @mentions..."
            editable={isEditMode}
            onPress={enterEditMode}
          />
        </View>

        {/* Word/Character Count (hidden in full-screen mode) */}
        {!isFullScreen && (
        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            {getWordCount(content)} {getWordCount(content) === 1 ? "word" : "words"} • {getCharacterCount(content)} {getCharacterCount(content) === 1 ? "character" : "characters"}
          </Text>
        </View>
        )}
      </View>

      {/* Bottom Bar - only shown when in edit mode */}
      {isEditMode && (
      <BottomBar keyboardOffset={keyboardHeight}>
        <View style={styles.fullScreenToolbar}>
          {/* Text formatting */}
          <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.toggleBold()}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2.5}>
              <Path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.toggleItalic()}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Line x1={19} y1={4} x2={10} y2={4} strokeLinecap="round" />
              <Line x1={14} y1={20} x2={5} y2={20} strokeLinecap="round" />
              <Line x1={15} y1={4} x2={9} y2={20} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.toggleHeading(1)}>
            <Text style={styles.headingButtonText}>H1</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.toggleHeading(2)}>
            <Text style={styles.headingButtonText}>H2</Text>
          </TouchableOpacity>

          <View style={styles.toolbarDivider} />

          {/* List formatting */}
          <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.toggleBulletList()}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Line x1={9} y1={6} x2={20} y2={6} strokeLinecap="round" />
              <Line x1={9} y1={12} x2={20} y2={12} strokeLinecap="round" />
              <Line x1={9} y1={18} x2={20} y2={18} strokeLinecap="round" />
              <Circle cx={5} cy={6} r={1} fill="#6b7280" />
              <Circle cx={5} cy={12} r={1} fill="#6b7280" />
              <Circle cx={5} cy={18} r={1} fill="#6b7280" />
            </Svg>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.toggleOrderedList()}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Line x1={10} y1={6} x2={21} y2={6} strokeLinecap="round" />
              <Line x1={10} y1={12} x2={21} y2={12} strokeLinecap="round" />
              <Line x1={10} y1={18} x2={21} y2={18} strokeLinecap="round" />
              <Path d="M4 6h1v4M3 10h3M3 14.5a1.5 1.5 0 011.5-1.5h.5l-2 3h3" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.toggleTaskList()}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Path d="M3 5h4v4H3zM3 14h4v4H3z" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M4 7l1 1 2-2" strokeLinecap="round" strokeLinejoin="round" />
              <Line x1={10} y1={7} x2={21} y2={7} strokeLinecap="round" />
              <Line x1={10} y1={16} x2={21} y2={16} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.indent()}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Path d="M3 9l4 3-4 3" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M9 4h12M9 8h12M9 12h12M9 16h12M9 20h12" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.outdent()}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Path d="M7 9l-4 3 4 3" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M9 4h12M9 8h12M9 12h12M9 16h12M9 20h12" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>

          {/* Full Screen Toggle Button - toggles between expand/collapse */}
          <View style={styles.toolbarDivider} />
          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={() => setIsFullScreen(!isFullScreen)}
          >
            {isFullScreen ? (
              // Collapse icon - arrows pointing inward
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                <Path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            ) : (
              // Expand icon - arrows pointing outward
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                <Path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}
          </TouchableOpacity>
        </View>
      </BottomBar>
      )}

      {/* Category Picker Dropdown */}
      <TopBarDropdownContainer
        visible={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
      >
        <CategoryPicker
          visible={showCategoryPicker}
          onClose={() => setShowCategoryPicker(false)}
          onSelect={(id, name) => {
            const hadCategory = !!categoryId;
            const isRemoving = !id;
            setCategoryId(id);
            setCategoryName(name);
            if (isRemoving && hadCategory) {
              showSnackbar('You removed the category');
            } else if (hadCategory) {
              showSnackbar('Success! You updated the category.');
            } else {
              showSnackbar('Success! You added the category.');
            }
            if (!isEditMode) {
              enterEditMode();
            }
          }}
          selectedCategoryId={categoryId}
        />
      </TopBarDropdownContainer>

      {/* Location Picker (fullscreen modal) */}
      <LocationPicker
        visible={showLocationPicker}
        onClose={() => {
          console.log('[CaptureForm] LocationPicker closed');
          setShowLocationPicker(false);
        }}
        mode={(() => {
          // view: location with a name already selected (either editing existing or user already picked one)
          // select: no location name yet (GPS-only or nothing), user needs to pick/create a location
          const hasNamedLocation = locationData && locationData.name;
          const pickerMode = hasNamedLocation ? 'view' : 'select';
          console.log('[CaptureForm] mode check:', { isEditMode, captureLocation, hasLocationData: !!locationData, hasNamedLocation, pickerMode });
          return pickerMode as 'select' | 'view';
        })()}
        onSelect={(location: LocationType | null) => {
          // If location is null (user selected "None"), clear location data
          if (location === null) {
            console.log('[CaptureForm] 📍 User selected "None" - clearing location data');
            setLocationData(null);
            setCaptureLocation(false);
            setShowLocationPicker(false);
            showSnackbar('You removed the location');
            if (!isEditMode) {
              enterEditMode();
            }
            return;
          }

          console.log('[CaptureForm] 📍 Received location from LocationPicker:', {
            name: location.name,
            latitude: location.latitude,
            longitude: location.longitude,
            city: location.city,
            region: location.region,
            country: location.country,
            neighborhood: location.neighborhood,
            postalCode: location.postalCode,
            subdivision: location.subdivision,
          });

          // Show snackbar based on whether we're adding or updating
          const isUpdating = !!locationData;
          setLocationData(location);
          setCaptureLocation(true);
          setShowLocationPicker(false);
          showSnackbar(isUpdating ? 'Success! You updated the location.' : 'Success! You added the location.');
          if (!isEditMode) {
            enterEditMode();
          }
        }}
        initialLocation={locationData}
      />

      {/* Date Picker Dropdown (Due Date) */}
      <TopBarDropdownContainer
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
      >
        <SimpleDatePicker
          value={dueDate ? new Date(dueDate) : null}
          onChange={(date) => {
            const hadDueDate = !!dueDate;
            if (date) {
              setDueDate(date.toISOString());
              showSnackbar(hadDueDate ? 'Success! You updated the due date.' : 'Success! You added the due date.');
            } else {
              setDueDate(null);
              if (hadDueDate) {
                showSnackbar('You removed the due date');
              }
            }
          }}
          onClose={() => setShowDatePicker(false)}
        />
      </TopBarDropdownContainer>

      {/* Entry Date Picker Dropdown */}
      <TopBarDropdownContainer
        visible={showEntryDatePicker}
        onClose={() => setShowEntryDatePicker(false)}
      >
        <SimpleDatePicker
          value={new Date(entryDate)}
          onChange={(date) => {
            if (date) {
              // Preserve the current time when changing date
              const currentDate = new Date(entryDate);
              date.setHours(currentDate.getHours(), currentDate.getMinutes(), currentDate.getSeconds(), currentDate.getMilliseconds());
              setEntryDate(date.toISOString());
            }
          }}
          onClose={() => setShowEntryDatePicker(false)}
          allowClear={false}
        />
      </TopBarDropdownContainer>

      {/* Time Picker Modal */}
      <TopBarDropdownContainer
        visible={showTimeModal}
        onClose={() => setShowTimeModal(false)}
      >
        <View style={styles.datePickerContainer}>
          <Text style={styles.datePickerTitle}>Set Time</Text>

          {/* Change Time Button */}
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => {
              setShowTimeModal(false);
              // Show native picker after a small delay
              setTimeout(() => {
                setPickerMode("time");
                setShowNativePicker(true);
              }, 100);
            }}
          >
            <Text style={styles.datePickerButtonText}>
              Change Time ({new Date(entryDate).toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })})
            </Text>
          </TouchableOpacity>

          {/* Clear Time Button */}
          <TouchableOpacity
            style={[styles.datePickerButton, styles.datePickerButtonDanger]}
            onPress={() => {
              // Clear time by setting milliseconds to 100 (flag to hide time but remember it)
              setIncludeTime(false);
              const date = new Date(entryDate);
              date.setMilliseconds(100);
              setEntryDate(date.toISOString());
              setShowTimeModal(false);
            }}
          >
            <Text style={[styles.datePickerButtonText, styles.datePickerButtonDangerText]}>
              Clear Time
            </Text>
          </TouchableOpacity>
        </View>
      </TopBarDropdownContainer>

      {/* Native Time Picker (triggered from modal) */}
      {showNativePicker && pickerMode === "time" && (
        <DateTimePicker
          value={new Date(entryDate)}
          mode="time"
          display="default"
          onChange={(event, selectedDate) => {
            if (event.type === "set" && selectedDate) {
              // Set milliseconds to 0 to indicate time should be shown
              selectedDate.setMilliseconds(0);
              setEntryDate(selectedDate.toISOString());
            }
            setShowNativePicker(false);
          }}
        />
      )}

      {/* Rating Picker Modal */}
      <TopBarDropdownContainer
        visible={showRatingPicker}
        onClose={() => setShowRatingPicker(false)}
      >
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerTitle}>Set Rating</Text>

          {/* Star Rating Buttons - 1 to 5 stars */}
          <View style={styles.starRatingRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <TouchableOpacity
                key={value}
                style={styles.starRatingButton}
                onPress={() => {
                  setRating(value);
                  showSnackbar(`Rating set to ${value}/5`);
                  setShowRatingPicker(false);
                }}
              >
                <Text style={[styles.starRatingIcon, rating >= value && styles.starRatingIconActive]}>
                  ★
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Clear Rating Button */}
          {rating > 0 && (
            <TouchableOpacity
              style={[styles.pickerButton, styles.pickerButtonDanger]}
              onPress={() => {
                setRating(0);
                showSnackbar('Rating cleared');
                setShowRatingPicker(false);
              }}
            >
              <Text style={[styles.pickerButtonText, styles.pickerButtonDangerText]}>
                Clear Rating
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TopBarDropdownContainer>

      {/* Priority Picker Modal */}
      <TopBarDropdownContainer
        visible={showPriorityPicker}
        onClose={() => setShowPriorityPicker(false)}
      >
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerTitle}>Set Priority (1-100)</Text>

          {/* Current Priority Display */}
          <View style={styles.priorityDisplay}>
            <Text style={styles.priorityValueText}>{priority || 0}</Text>
          </View>

          {/* Priority Slider */}
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>1</Text>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={100}
              step={1}
              value={priority || 1}
              onValueChange={(value) => setPriority(Math.round(value))}
              minimumTrackTintColor="#3b82f6"
              maximumTrackTintColor="#d1d5db"
              thumbTintColor="#3b82f6"
            />
            <Text style={styles.sliderLabel}>100</Text>
          </View>

          {/* Quick Set Buttons - Row 1: 1-10 */}
          <View style={styles.quickButtonRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
              <TouchableOpacity
                key={value}
                style={[styles.quickButton, priority === value && styles.quickButtonSelected]}
                onPress={() => setPriority(value)}
              >
                <Text style={[styles.quickButtonText, priority === value && styles.quickButtonTextSelected]}>
                  {value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Set Buttons - Row 2: 20, 30, 40, 50, 60, 70, 80, 90, 100 */}
          <View style={styles.quickButtonRow}>
            {[20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => (
              <TouchableOpacity
                key={value}
                style={[styles.quickButton, priority === value && styles.quickButtonSelected]}
                onPress={() => setPriority(value)}
              >
                <Text style={[styles.quickButtonText, priority === value && styles.quickButtonTextSelected]}>
                  {value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.pickerActionRow}>
            {priority > 0 && (
              <TouchableOpacity
                style={[styles.pickerActionButton, styles.pickerButtonDanger]}
                onPress={() => {
                  setPriority(0);
                  showSnackbar('Priority cleared');
                  setShowPriorityPicker(false);
                }}
              >
                <Text style={[styles.pickerButtonText, styles.pickerButtonDangerText]}>
                  Clear
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.pickerActionButton, styles.pickerButtonPrimary]}
              onPress={() => {
                if (priority > 0) {
                  showSnackbar(`Priority set to ${priority}`);
                }
                setShowPriorityPicker(false);
              }}
            >
              <Text style={styles.pickerButtonText}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TopBarDropdownContainer>

      {/* Entry Menu */}
      <TopBarDropdownContainer
        visible={showAttributesPicker}
        onClose={() => setShowAttributesPicker(false)}
      >
        <View style={styles.attributePickerContainer}>
          {/* Attributes Section - only show if there are unset attributes */}
          {(() => {
            const hasUnsetAttributes =
              (showLocation && (!captureLocation || !locationData)) ||
              (showStatus && status === "none") ||
              (showDueDate && !dueDate) ||
              (showRating && rating === 0) ||
              (showPriority && priority === 0) ||
              (showPhotos && photoCount === 0);

            if (!hasUnsetAttributes) return null;

            return (
              <>
                <Text style={styles.attributePickerTitle}>Add Attribute</Text>

                {/* Location */}
                {showLocation && (!captureLocation || !locationData) && (
                  <TouchableOpacity
                    style={styles.attributePickerItem}
                    onPress={() => {
                      setShowAttributesPicker(false);
                      setTimeout(() => setShowLocationPicker(true), 100);
                    }}
                  >
                    <View style={styles.attributePickerItemIcon}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                        <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                        <Circle cx={12} cy={10} r={3} fill="#6b7280" />
                      </Svg>
                    </View>
                    <Text style={styles.attributePickerItemText}>Location</Text>
                  </TouchableOpacity>
                )}

                {/* Status */}
                {showStatus && status === "none" && (
                  <TouchableOpacity
                    style={styles.attributePickerItem}
                    onPress={() => {
                      setStatus("incomplete");
                      setShowAttributesPicker(false);
                      showSnackbar('Status set to Not Started');
                      if (!isEditMode) enterEditMode();
                    }}
                  >
                    <View style={styles.attributePickerItemIcon}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                        <Circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </View>
                    <Text style={styles.attributePickerItemText}>Status</Text>
                  </TouchableOpacity>
                )}

                {/* Due Date */}
                {showDueDate && !dueDate && (
                  <TouchableOpacity
                    style={styles.attributePickerItem}
                    onPress={() => {
                      setShowAttributesPicker(false);
                      setTimeout(() => setShowDatePicker(true), 100);
                      if (!isEditMode) enterEditMode();
                    }}
                  >
                    <View style={styles.attributePickerItemIcon}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                        <Path d="M3 4a2 2 0 012-2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V4z" strokeLinecap="round" strokeLinejoin="round" />
                        <Line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" strokeLinejoin="round" />
                        <Line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" strokeLinejoin="round" />
                        <Line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </View>
                    <Text style={styles.attributePickerItemText}>Due Date</Text>
                  </TouchableOpacity>
                )}

                {/* Rating */}
                {showRating && rating === 0 && (
                  <TouchableOpacity
                    style={styles.attributePickerItem}
                    onPress={() => {
                      setShowAttributesPicker(false);
                      setTimeout(() => setShowRatingPicker(true), 100);
                      if (!isEditMode) enterEditMode();
                    }}
                  >
                    <View style={styles.attributePickerItemIcon}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                        <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </View>
                    <Text style={styles.attributePickerItemText}>Rating</Text>
                  </TouchableOpacity>
                )}

                {/* Priority */}
                {showPriority && priority === 0 && (
                  <TouchableOpacity
                    style={styles.attributePickerItem}
                    onPress={() => {
                      setShowAttributesPicker(false);
                      setTimeout(() => setShowPriorityPicker(true), 100);
                      if (!isEditMode) enterEditMode();
                    }}
                  >
                    <View style={styles.attributePickerItemIcon}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                        <Path d="M5 3v18" strokeLinecap="round" strokeLinejoin="round" />
                        <Path d="M5 3h13l-4 5 4 5H5z" strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </View>
                    <Text style={styles.attributePickerItemText}>Priority</Text>
                  </TouchableOpacity>
                )}

                {/* Photos */}
                {showPhotos && photoCount === 0 && (
                  <TouchableOpacity
                    style={styles.attributePickerItem}
                    onPress={() => {
                      setShowAttributesPicker(false);
                      if (!isEditMode) enterEditMode();
                      setTimeout(() => photoCaptureRef.current?.openMenu(), 100);
                    }}
                  >
                    <View style={styles.attributePickerItemIcon}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                        <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                        <Circle cx={12} cy={13} r={4} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </View>
                    <Text style={styles.attributePickerItemText}>Photos</Text>
                  </TouchableOpacity>
                )}

                {/* Divider before Delete */}
                {isEditing && <View style={styles.menuDivider} />}
              </>
            );
          })()}

          {/* Delete Entry - only shown for existing entries */}
          {isEditing && (
            <TouchableOpacity
              style={styles.attributePickerItem}
              onPress={() => {
                setShowAttributesPicker(false);
                setTimeout(() => handleDelete(), 100);
              }}
            >
              <View style={styles.attributePickerItemIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2}>
                  <Path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={[styles.attributePickerItemText, { color: '#ef4444' }]}>Delete Entry</Text>
            </TouchableOpacity>
          )}
        </View>
      </TopBarDropdownContainer>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#6b7280",
  },
  errorText: {
    fontSize: 16,
    color: "#ef4444",
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#3b82f6",
    borderRadius: 8,
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  titleBar: {
    height: 90,
    paddingTop: Platform.OS === "ios" ? 45 : (StatusBar.currentHeight || 0) + 10,
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: 4,
    backgroundColor: "#fafafa",
    flexDirection: "row",
    alignItems: "center",
  },
  titleBarFullScreen: {
    // Keep same structure as titleBar but adjust spacing
    // Normal titleBar: height 90, paddingTop 45 (ios), paddingBottom 4
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1f2937",
    textAlign: "center",
  },
  headerTitleInput: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1f2937",
    textAlign: "center",
    flex: 1,
    padding: 0,
    margin: 0,
  },
  headerLeftContainer: {
    width: 70,
    alignItems: "flex-start",
  },
  headerRightContainer: {
    width: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    position: "relative",
  },
  headerCancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    minHeight: 32,
    justifyContent: "center",
  },
  headerCancelText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#6b7280",
    fontWeight: "500",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  headerSaveButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight: 32,
    justifyContent: "center",
  },
  headerSaveButtonDisabled: {
    opacity: 0.5,
  },
  headerSaveText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#2563eb",
    fontWeight: "600",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  headerSaveTextDisabled: {
    color: "#9ca3af",
  },
  headerDateContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  headerDateText: {
    fontSize: 15,
    color: "#6b7280",
    fontWeight: "500",
  },
  headerTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerWatchButton: {
    padding: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 6,
    backgroundColor: "#fafafa",
  },
  titleInputFullWidth: {
    flex: 1,
    fontSize: 22,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    padding: 0,
    margin: 0,
    textAlign: "center",
  },
  titleBarContent: {
    flex: 1,
  },
  menuButton: {
    padding: theme.spacing.sm,
  },
  metadataBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#fafafa",
    rowGap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0, 0, 0, 0.08)",
    // Subtle iOS-style shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  metadataLink: {
    paddingVertical: 6,
    paddingHorizontal: 2,
    maxWidth: 130,
  },
  metadataLinkContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metadataText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  metadataTextActive: {
    color: theme.colors.text.primary,
    fontWeight: "600",
  },
  metadataDivider: {
    fontSize: 10,
    color: "#d1d5db",
    paddingHorizontal: 8,
  },
  entryMenuButton: {
    marginLeft: "auto",
    padding: 8,
    opacity: 0.6,
  },
  attributePickerContainer: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  attributePickerTitle: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  attributePickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  attributePickerItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.background.secondary,
    justifyContent: "center",
    alignItems: "center",
  },
  attributePickerItemText: {
    fontSize: 16,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: theme.spacing.sm,
  },
  topBarButtonTask: {
    // No background color
  },
  topBarButtonTaskText: {
    color: theme.colors.text.primary,
  },
  topBarButtonComplete: {
    // No background color
  },
  topBarButtonCompleteText: {
    color: theme.colors.text.primary,
  },
  topBarButtonDue: {
    // No background color
  },
  topBarButtonDueText: {
    color: theme.colors.text.primary,
  },
  contentContainer: {
    flex: 1,
    // No background - inherits from parent container (white)
  },
  titleContainer: {
    flex: 1,
  },
  titleCollapsed: {
    flex: 1,
    alignItems: "center",
  },
  titlePlaceholder: {
    fontSize: 22,
    color: theme.colors.text.disabled,
    fontWeight: theme.typography.fontWeight.bold,
    textAlign: "center",
  },
  titleInput: {
    fontSize: 22,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    padding: 0,
    margin: 0,
  },
  entryDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 24,
    paddingRight: 16,
    paddingTop: 0,
    paddingBottom: 4,
    backgroundColor: "#fafafa",
  },
  entryDateText: {
    fontSize: 19,
    color: "#6b7280",
    fontWeight: "500",
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  watchIconButton: {
    padding: 4,
  },
  editorContainer: {
    flex: 1,
    paddingLeft: 24,
    paddingRight: 12,
    // paddingBottom is set dynamically based on edit mode and popout state
  },
  countContainer: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  countText: {
    fontSize: 14,
    color: "#6b7280",
  },
  // Toolbar styles
  fullScreenToolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flex: 1,
  },
  toolbarDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#d1d5db",
    marginHorizontal: 4,
  },
  fullScreenEditor: {
    paddingTop: 16,
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: "auto",
  },
  toolbarButton: {
    padding: 8,
    borderRadius: 6,
  },
  headingButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  deleteButton: {
    padding: theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: theme.spacing.sm,
  },
  cancelButton: {
    padding: theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: theme.spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  saveButton: {
    padding: theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: theme.spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.3,
  },
  editButton: {
    padding: theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: theme.spacing.sm,
  },
  datePickerContainer: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  datePickerButton: {
    backgroundColor: theme.colors.background.secondary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
  },
  datePickerButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
  },
  datePickerButtonDanger: {
    backgroundColor: "#fee2e2",
  },
  datePickerButtonDangerText: {
    color: "#dc2626",
  },
  snackbar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  snackbarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  // Rating and Priority Picker Styles
  pickerContainer: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  starRatingRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.lg,
  },
  starRatingButton: {
    padding: theme.spacing.sm,
  },
  starRatingIcon: {
    fontSize: 40,
    color: "#d1d5db",
  },
  starRatingIconActive: {
    color: "#fbbf24",
  },
  priorityDisplay: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
  },
  priorityValueText: {
    fontSize: 48,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    minWidth: 30,
    textAlign: "center",
  },
  sliderTrack: {
    flex: 1,
    height: 40,
    flexDirection: "row",
    gap: 1,
  },
  sliderSegment: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 2,
  },
  sliderSegmentActive: {
    backgroundColor: "#3b82f6",
  },
  quickButtonRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "space-between",
  },
  quickButton: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
  },
  quickButtonSelected: {
    backgroundColor: "#dbeafe",
  },
  quickButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
  },
  quickButtonTextSelected: {
    color: "#3b82f6",
  },
  pickerButton: {
    backgroundColor: theme.colors.background.secondary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
  },
  pickerButtonDanger: {
    backgroundColor: "#fee2e2",
  },
  pickerButtonDangerText: {
    color: "#dc2626",
  },
  pickerActionRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  pickerActionButton: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
  },
  pickerButtonPrimary: {
    backgroundColor: "#3b82f6",
  },
  pickerButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
  },
});
