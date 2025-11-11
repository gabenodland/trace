import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, Keyboard } from "react-native";
import * as Location from "expo-location";
import DateTimePicker from "@react-native-community/datetimepicker";
import { extractTagsAndMentions, getWordCount, getCharacterCount, useAuthState } from "@trace/core";
import { useEntries, useEntry } from "../mobileEntryHooks";
import { useCategories } from "../../categories/mobileCategoryHooks";
import { useNavigation } from "../../../shared/contexts/NavigationContext";
import { RichTextEditor } from "../../../components/editor/RichTextEditor";
import { CategoryPicker } from "../../categories/components/CategoryPicker";
import { TopBar } from "../../../components/layout/TopBar";
import { BottomBar } from "../../../components/layout/BottomBar";
import { TopBarDropdownContainer } from "../../../components/layout/TopBarDropdownContainer";
import Svg, { Path, Circle, Line } from "react-native-svg";

import type { ReturnContext } from "../../../screens/EntryScreen";

interface CaptureFormProps {
  entryId?: string | null;
  initialCategoryId?: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "people";
  initialCategoryName?: string;
  initialContent?: string;
  initialDate?: string;
  returnContext?: ReturnContext;
}

export function CaptureForm({ entryId, initialCategoryId, initialCategoryName, initialContent, initialDate, returnContext }: CaptureFormProps = {}) {
  // Determine if we're editing an existing entry or creating a new one
  const isEditing = !!entryId;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState(initialContent || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [captureLocation, setCaptureLocation] = useState(!isEditing); // Default ON for new entries, OFF for editing

  // Initialize category from props for new entries, or null for editing (will be loaded from entry)
  const getInitialCategoryId = (): string | null => {
    if (isEditing) return null; // Will be loaded from entry
    // For new entries, use initialCategoryId if it's a real category (not a filter like "all", "tasks", etc.)
    if (!initialCategoryId || typeof initialCategoryId !== 'string' ||
        initialCategoryId === "all" || initialCategoryId === "tasks" ||
        initialCategoryId === "events" || initialCategoryId === "categories" ||
        initialCategoryId === "tags" || initialCategoryId === "people" ||
        initialCategoryId.startsWith("tag:") || initialCategoryId.startsWith("mention:")) {
      return null; // Default to Inbox for filters
    }
    return initialCategoryId;
  };

  const [categoryId, setCategoryId] = useState<string | null>(getInitialCategoryId());
  const [categoryName, setCategoryName] = useState<string | null>(
    !isEditing && initialCategoryName && getInitialCategoryId() !== null ? initialCategoryName : null
  );
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [status, setStatus] = useState<"none" | "incomplete" | "complete">("none");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
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
  // Check milliseconds to determine if time should be shown (0 = show, 100 = hidden)
  const [includeTime, setIncludeTime] = useState(() => {
    // If initialDate provided, hide time initially
    return !initialDate;
  });
  const [showTimeModal, setShowTimeModal] = useState(false); // Custom modal for time with Clear button
  // Store original category for cancel navigation (for edited entries)
  const [originalCategoryId, setOriginalCategoryId] = useState<string | null>(null);
  const [originalCategoryName, setOriginalCategoryName] = useState<string | null>(null);
  const [locationData, setLocationData] = useState<{
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
  }>({ lat: null, lng: null, accuracy: null });
  const [isTitleExpanded, setIsTitleExpanded] = useState(true);
  const [locationIconBlink, setLocationIconBlink] = useState(true);
  const editorRef = useRef<any>(null);
  const titleInputRef = useRef<TextInput>(null);
  const isInitialLoad = useRef(true); // Track if this is first load
  const lastTitleTap = useRef<number | null>(null); // Track last tap time for double-tap detection

  const { entryMutations } = useEntries();
  const { entry, isLoading: isLoadingEntry, entryMutations: singleEntryMutations } = useEntry(entryId || null);
  const { signOut } = useAuthState();
  const { categories } = useCategories();
  const { navigate } = useNavigation();

  // Edit mode: new entries start in edit mode, existing entries start in read-only
  const [isEditMode, setIsEditMode] = useState(!isEditing);

  // Enter edit mode
  const enterEditMode = () => {
    setIsEditMode(true);
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
    if (captureLocation && !locationData.lat && !locationData.lng) {
      // Start blinking by toggling state
      const interval = setInterval(() => {
        setLocationIconBlink(prev => !prev);
      }, 600);
      return () => clearInterval(interval);
    } else {
      setLocationIconBlink(true);
    }
  }, [captureLocation, locationData.lat, locationData.lng]);

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

      // Load location data if available, keep toggle state reflecting what's saved
      if (entry.location_lat && entry.location_lng) {
        setLocationData({
          lat: entry.location_lat,
          lng: entry.location_lng,
          accuracy: entry.location_accuracy,
        });
        setCaptureLocation(true);
      } else {
        // No location saved - keep toggle off and clear location data
        setLocationData({ lat: null, lng: null, accuracy: null });
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
        // Store original category (Inbox) for cancel navigation
        setOriginalCategoryId(null);
        setOriginalCategoryName(null);
      }

      // Mark that initial load is complete
      isInitialLoad.current = false;
    }
  }, [entry, isEditing, categories]);

  // Fetch GPS location in background when location is enabled
  useEffect(() => {
    if (!captureLocation) {
      setLocationData({ lat: null, lng: null, accuracy: null });
      return;
    }

    // Skip fetching during initial load of edit screen
    if (isEditing && isInitialLoad.current) {
      return;
    }

    // Skip fetching if we already have location data loaded
    if (locationData.lat && locationData.lng) {
      return;
    }

    let timeoutId: NodeJS.Timeout;
    let isCancelled = false;
    let hasLocation = false;

    const fetchLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
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
            setLocationData({
              lat: location.coords.latitude,
              lng: location.coords.longitude,
              accuracy: location.coords.accuracy,
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
  }, [captureLocation, isEditing]);

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

  // Save handler
  const handleSave = async () => {
    // Prevent multiple simultaneous saves
    if (isSubmitting) return;

    setIsSubmitting(true);

    // Check if there's actual content (strip HTML tags to check)
    const textContent = content.replace(/<[^>]*>/g, '').trim();

    if (!textContent || textContent.length === 0) {
      setIsSubmitting(false);
      Alert.alert("Empty Entry", "Please add some content before saving");
      return;
    }

    try {
      const { tags, mentions } = extractTagsAndMentions(content);

      if (isEditing) {
        // Update existing entry
        await singleEntryMutations.updateEntry({
          title: title.trim() || null,
          content,
          tags,
          mentions,
          category_id: categoryId,
          entry_date: entryDate,
          status,
          due_date: dueDate,
        });
      } else {
        // Create new entry
        await entryMutations.createEntry({
          title: title.trim() || null,
          content,
          tags,
          mentions,
          entry_date: entryDate,
          location_lat: locationData.lat,
          location_lng: locationData.lng,
          location_accuracy: locationData.accuracy,
          category_id: categoryId,
          status,
          due_date: dueDate,
        });

        // Clear form only when creating
        setTitle("");
        setContent("");
        setCategoryId(null);
        setCategoryName(null);
        setLocationData({ lat: null, lng: null, accuracy: null });
        setStatus("none");
        setDueDate(null);
      }

      // Navigate back to inbox with the category that was set
      // This ensures the list shows the category where the entry was saved
      // If category is a filter (all, tasks, etc.), default to Inbox
      let returnCategoryId: string | null = categoryId || null;
      let returnCategoryName: string = categoryName || "Inbox";

      // Edge case: If returning to a filter view, switch to Inbox instead
      if (returnCategoryId === "all" || returnCategoryId === "tasks" ||
          returnCategoryId === "events" || returnCategoryId === "categories" ||
          returnCategoryId === "tags" || returnCategoryId === "people" ||
          (typeof returnCategoryId === 'string' && (returnCategoryId.startsWith("tag:") || returnCategoryId.startsWith("mention:")))) {
        returnCategoryId = null;
        returnCategoryName = "Inbox";
      }

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
            returnCategoryName: returnContext.categoryName || "Inbox"
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
          <Text style={styles.backButtonText}>Back to Inbox</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <TopBar>
        {/* Location Toggle */}
        <TouchableOpacity
          style={[styles.topBarButton, captureLocation && styles.topBarButtonActive]}
          onPress={() => {
            setCaptureLocation(!captureLocation);
            if (!isEditMode) {
              enterEditMode();
            }
          }}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={captureLocation ? "#2563eb" : "#6b7280"} strokeWidth={2}>
            <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
            <Circle
              cx={12}
              cy={10}
              r={3}
              fill={
                locationData.lat && locationData.lng
                  ? (captureLocation ? "#2563eb" : "#6b7280")  // Has location: solid
                  : (captureLocation && locationIconBlink ? "#2563eb" : "none")  // Loading: blinking
              }
            />
          </Svg>
          <Text style={[styles.topBarButtonText, captureLocation && styles.topBarButtonTextActive]}>
            Location
          </Text>
        </TouchableOpacity>

        {/* Category Button */}
        <TouchableOpacity
          style={[styles.topBarButton, categoryId && styles.topBarButtonActive]}
          onPress={() => setShowCategoryPicker(!showCategoryPicker)}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={categoryId ? "#2563eb" : "#6b7280"} strokeWidth={2}>
            <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[styles.topBarButtonText, categoryId && styles.topBarButtonTextActive]}>
            {categoryName || "Inbox"}
          </Text>
        </TouchableOpacity>

        {/* Task Status Button */}
        <TouchableOpacity
          style={[
            styles.topBarButton,
            status === "incomplete" && styles.topBarButtonTask,
            status === "complete" && styles.topBarButtonComplete
          ]}
          onPress={() => {
            // Cycle through: none -> incomplete -> complete -> none
            if (status === "none") setStatus("incomplete");
            else if (status === "incomplete") setStatus("complete");
            else setStatus("none");
            if (!isEditMode) enterEditMode();
          }}
        >
          {status === "incomplete" || status === "complete" ? (
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Circle
                cx="12"
                cy="12"
                r="10"
                stroke={status === "complete" ? "#10b981" : "#3b82f6"}
                strokeWidth={2}
                fill={status === "complete" ? "#10b981" : "none"}
              />
              {status === "complete" && (
                <Path d="M7 12l3 3 7-7" stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              )}
            </Svg>
          ) : (
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          )}
          <Text
            style={[
              styles.topBarButtonText,
              status === "incomplete" && styles.topBarButtonTaskText,
              status === "complete" && styles.topBarButtonCompleteText
            ]}
          >
            {status === "none" ? "Note" : status === "incomplete" ? "Task" : "Done"}
          </Text>
        </TouchableOpacity>

        {/* Due Date Button - Always visible (makes notes into events) */}
        <TouchableOpacity
          style={[styles.topBarButton, dueDate && styles.topBarButtonDue]}
          onPress={() => {
            setShowDatePicker(!showDatePicker);
            if (!isEditMode) enterEditMode();
          }}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={dueDate ? "#f97316" : "#6b7280"} strokeWidth={2}>
            <Path d="M3 4a2 2 0 012-2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V4z" strokeLinecap="round" strokeLinejoin="round" />
            <Line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" strokeLinejoin="round" />
            <Line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" strokeLinejoin="round" />
            <Line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[styles.topBarButtonText, dueDate && styles.topBarButtonDueText]}>
            {dueDate ? new Date(dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "Due"}
          </Text>
        </TouchableOpacity>
      </TopBar>

      {/* Content Area */}
      <View style={styles.contentContainer}>
        {/* Title Input - Collapsible */}
        {shouldCollapse ? (
          <TouchableOpacity
            style={styles.titleCollapsed}
            onPress={() => {
              setIsTitleExpanded(true);
              setTimeout(() => titleInputRef.current?.focus(), 100);
            }}
          >
            <View style={styles.titlePlaceholderLine} />
          </TouchableOpacity>
        ) : (
          <View style={styles.titleContainer}>
            <TextInput
              ref={titleInputRef}
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor="#9ca3af"
              style={styles.titleInput}
              editable={isEditMode && !isSubmitting}
              returnKeyType="next"
              blurOnSubmit={false}
              onFocus={() => {
                setIsTitleExpanded(true);
              }}
              onPressIn={handleTitlePress}
            />
          </View>
        )}

        {/* Entry Date & Time - Below title */}
        <View style={styles.entryDateContainer}>
          {/* Date */}
          <TouchableOpacity
            onPress={() => {
              setPickerMode("date");
              setShowNativePicker(true);
              if (!isEditMode) enterEditMode();
            }}
          >
            <Text style={styles.entryDateText}>
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
              style={styles.timeContainer}
              onPress={() => {
                setShowTimeModal(true);
                if (!isEditMode) enterEditMode();
              }}
            >
              <Text style={styles.entryDateText}>
                {entryDate ? new Date(entryDate).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                }) : 'Set time'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.watchIconButton}
              onPress={() => {
                // Show time again by setting milliseconds to 0
                setIncludeTime(true);
                const date = new Date(entryDate);
                date.setMilliseconds(0);
                setEntryDate(date.toISOString());
                if (!isEditMode) enterEditMode();
              }}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2}>
                <Circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          )}
        </View>

        {/* Editor */}
        <View style={[
          styles.editorContainer,
          keyboardHeight > 0 && { paddingBottom: keyboardHeight + 105 }
        ]}>
          <RichTextEditor
            ref={editorRef}
            value={content}
            onChange={setContent}
            placeholder="What's on your mind? Use #tags and @mentions..."
            editable={isEditMode}
            onDoublePress={enterEditMode}
          />
        </View>

        {/* Word/Character Count */}
        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            {getWordCount(content)} {getWordCount(content) === 1 ? "word" : "words"} • {getCharacterCount(content)} {getCharacterCount(content) === 1 ? "character" : "characters"}
          </Text>
        </View>
      </View>

      {/* Bottom Bar */}
      <BottomBar keyboardOffset={keyboardHeight}>
        {/* Formatting Buttons - Only show in edit mode */}
        {isEditMode && (
          <View style={styles.formatButtons}>
            {/* Bold Button */}
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => editorRef.current?.toggleBold()}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2.5}>
                <Path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>

            {/* Italic Button */}
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => editorRef.current?.toggleItalic()}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                <Line x1={19} y1={4} x2={10} y2={4} strokeLinecap="round" />
                <Line x1={14} y1={20} x2={5} y2={20} strokeLinecap="round" />
                <Line x1={15} y1={4} x2={9} y2={20} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>

            {/* Bullet List Button */}
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => editorRef.current?.toggleBulletList()}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                <Line x1={9} y1={6} x2={20} y2={6} strokeLinecap="round" />
                <Line x1={9} y1={12} x2={20} y2={12} strokeLinecap="round" />
                <Line x1={9} y1={18} x2={20} y2={18} strokeLinecap="round" />
                <Circle cx={5} cy={6} r={1} fill="#6b7280" />
                <Circle cx={5} cy={12} r={1} fill="#6b7280" />
                <Circle cx={5} cy={18} r={1} fill="#6b7280" />
              </Svg>
            </TouchableOpacity>

            {/* Indent Button */}
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => editorRef.current?.indent()}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                <Path d="M3 9l4 3-4 3" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M9 4h12M9 8h12M9 12h12M9 16h12M9 20h12" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>

            {/* Outdent Button */}
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => editorRef.current?.outdent()}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                <Path d="M7 9l-4 3 4 3" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M9 4h12M9 8h12M9 12h12M9 16h12M9 20h12" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actionButtons}>
          {/* Delete Button (only when editing and in edit mode) */}
          {isEditing && isEditMode && (
            <TouchableOpacity
              onPress={handleDelete}
              disabled={isSubmitting}
              style={[styles.deleteButton, isSubmitting && styles.buttonDisabled]}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5}>
                <Path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          )}

          {/* Cancel Button (Red X) */}
          <TouchableOpacity
            onPress={() => {
              // Navigate back to the appropriate category (or filter view like tag:xxx, mention:xxx)
              let returnCategoryId: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "people";
              let returnCategoryName: string;

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
                    returnCategoryName: returnContext.categoryName || "Inbox"
                  });
                  return;
                }
              }

              if (isEditing) {
                // For editing: return to entry's original category
                returnCategoryId = originalCategoryId;
                returnCategoryName = originalCategoryName || "Inbox";
              } else {
                // For new entries: return to the list category/filter we came from
                returnCategoryId = initialCategoryId || null;
                returnCategoryName = initialCategoryName || "Inbox";
              }

              navigate("inbox", { returnCategoryId, returnCategoryName });
            }}
            style={styles.cancelButton}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5}>
              <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>

          {/* Edit/Save Button - Blue pencil in read-only, green check in edit mode */}
          {isEditMode ? (
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSubmitting}
              style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
            >
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5}>
                <Path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={enterEditMode}
              style={styles.editButton}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
                <Path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          )}
        </View>
      </BottomBar>

      {/* Category Picker Dropdown */}
      <TopBarDropdownContainer
        visible={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
      >
        <CategoryPicker
          visible={showCategoryPicker}
          onClose={() => setShowCategoryPicker(false)}
          onSelect={(id, name) => {
            setCategoryId(id);
            setCategoryName(name);
            if (!isEditMode) {
              enterEditMode();
            }
          }}
          selectedCategoryId={categoryId}
        />
      </TopBarDropdownContainer>

      {/* Date Picker Modal */}
      <TopBarDropdownContainer
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
      >
        <View style={styles.datePickerContainer}>
          <Text style={styles.datePickerTitle}>Set Due Date</Text>

          {/* Quick Action Buttons */}
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => {
              const today = new Date();
              today.setHours(12, 0, 0, 0);
              setDueDate(today.toISOString());
              setShowDatePicker(false);
            }}
          >
            <Text style={styles.datePickerButtonText}>Today</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              tomorrow.setHours(12, 0, 0, 0);
              setDueDate(tomorrow.toISOString());
              setShowDatePicker(false);
            }}
          >
            <Text style={styles.datePickerButtonText}>Tomorrow</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => {
              const nextWeek = new Date();
              nextWeek.setDate(nextWeek.getDate() + 7);
              nextWeek.setHours(12, 0, 0, 0);
              setDueDate(nextWeek.toISOString());
              setShowDatePicker(false);
            }}
          >
            <Text style={styles.datePickerButtonText}>Next Week</Text>
          </TouchableOpacity>

          {/* Remove Due Date */}
          {dueDate && (
            <TouchableOpacity
              style={[styles.datePickerButton, styles.datePickerButtonDanger]}
              onPress={() => {
                setDueDate(null);
                setShowDatePicker(false);
              }}
            >
              <Text style={[styles.datePickerButtonText, styles.datePickerButtonDangerText]}>
                Remove Due Date
              </Text>
            </TouchableOpacity>
          )}
        </View>
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

      {/* Native Date Picker */}
      {showNativePicker && pickerMode === "date" && (
        <DateTimePicker
          value={new Date(entryDate)}
          mode="date"
          display="spinner"
          onChange={(event, selectedDate) => {
            if (event.type === "set" && selectedDate) {
              setEntryDate(selectedDate.toISOString());
            }
            setShowNativePicker(false);
          }}
        />
      )}

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
  topBarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f9fafb",
  },
  topBarButtonActive: {
    backgroundColor: "#dbeafe",
  },
  topBarButtonText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  topBarButtonTextActive: {
    color: "#2563eb",
  },
  topBarButtonTask: {
    backgroundColor: "#dbeafe",
  },
  topBarButtonTaskText: {
    color: "#3b82f6",
  },
  topBarButtonComplete: {
    backgroundColor: "#d1fae5",
  },
  topBarButtonCompleteText: {
    color: "#10b981",
  },
  topBarButtonDue: {
    backgroundColor: "#ffedd5",
  },
  topBarButtonDueText: {
    color: "#f97316",
  },
  contentContainer: {
    flex: 1,
  },
  titleContainer: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 2,
  },
  titleCollapsed: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 2,
  },
  titlePlaceholderLine: {
    width: 170,
    height: 2,
    backgroundColor: "#d1d5db",
    borderRadius: 1,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    padding: 0,
    margin: 0,
  },
  entryDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 40,
    paddingRight: 24,
    paddingTop: 4,
    paddingBottom: 12,
  },
  entryDateText: {
    fontSize: 13,
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
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 80,
  },
  countContainer: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  countText: {
    fontSize: 14,
    color: "#6b7280",
  },
  formatButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  toolbarButtonActive: {
    backgroundColor: "#dbeafe",
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f97316",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  datePickerContainer: {
    padding: 16,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  datePickerButton: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    marginBottom: 8,
  },
  datePickerButtonText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
  },
  datePickerButtonDanger: {
    backgroundColor: "#fee2e2",
  },
  datePickerButtonDangerText: {
    color: "#dc2626",
  },
});
