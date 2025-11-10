import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, Keyboard } from "react-native";
import * as Location from "expo-location";
import { useEntries, useEntry, useCategories, extractTagsAndMentions, getWordCount, getCharacterCount, useAuthState } from "@trace/core";
import { useNavigation } from "../../../shared/contexts/NavigationContext";
import { RichTextEditor } from "../../../components/editor/RichTextEditor";
import { CategoryPicker } from "../../categories/components/CategoryPicker";
import { TopBar } from "../../../components/layout/TopBar";
import { BottomBar } from "../../../components/layout/BottomBar";
import { TopBarDropdownContainer } from "../../../components/layout/TopBarDropdownContainer";
import Svg, { Path, Circle, Line } from "react-native-svg";

interface CaptureFormProps {
  entryId?: string | null;
}

export function CaptureForm({ entryId }: CaptureFormProps = {}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [captureLocation, setCaptureLocation] = useState(!isEditing); // Default ON for new entries, OFF for editing
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
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

  const { entryMutations } = useEntries();
  const { entry, isLoading: isLoadingEntry, entryMutations: singleEntryMutations } = useEntry(entryId || null);
  const { signOut } = useAuthState();
  const { categories } = useCategories();
  const { navigate } = useNavigation();

  const isEditing = !!entryId;

  const menuItems = [
    { label: "Inbox", onPress: () => navigate("inbox") },
    { label: "Categories", onPress: () => navigate("categories") },
    { label: "Calendar", onPress: () => navigate("calendar") },
    { label: "Tasks", onPress: () => navigate("tasks") },
    { label: "Sign Out", onPress: signOut },
  ];

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
      } else {
        setCategoryName(null);
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
  }, []);

  // Save handler
  const handleSave = async () => {
    // Prevent multiple simultaneous saves
    if (isSubmitting) return;

    setIsSubmitting(true);

    console.log("=== SAVE BUTTON PRESSED ===");
    console.log("isEditing:", isEditing);
    console.log("Raw content:", content);
    console.log("Content length:", content.length);

    // Check if there's actual content (strip HTML tags to check)
    const textContent = content.replace(/<[^>]*>/g, '').trim();
    console.log("Text content:", textContent);
    console.log("Text content length:", textContent.length);

    if (!textContent || textContent.length === 0) {
      console.log("❌ No content to save - showing alert");
      setIsSubmitting(false);
      Alert.alert("Empty Entry", "Please add some content before saving");
      return;
    }

    console.log("✓ Content validated, proceeding with save...");

    try {
      const { tags, mentions } = extractTagsAndMentions(content);

      if (isEditing) {
        // Update existing entry
        console.log("Updating entry...");
        await singleEntryMutations.updateEntry({
          title: title.trim() || null,
          content,
          tags,
          mentions,
          category_id: categoryId,
        });
        console.log("Entry updated successfully");
      } else {
        // Create new entry
        console.log("Creating entry...");
        await entryMutations.createEntry({
          title: title.trim() || null,
          content,
          tags,
          mentions,
          location_lat: locationData.lat,
          location_lng: locationData.lng,
          location_accuracy: locationData.accuracy,
          category_id: categoryId,
        });
        console.log("Entry created successfully");

        // Clear form only when creating
        setTitle("");
        setContent("");
        setCategoryId(null);
        setCategoryName(null);
        setLocationData({ lat: null, lng: null, accuracy: null });
      }

      // Navigate to inbox
      navigate("inbox");
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
      <TopBar menuItems={menuItems}>
        {/* Location Toggle */}
        <TouchableOpacity
          style={[styles.topBarButton, captureLocation && styles.topBarButtonActive]}
          onPress={() => setCaptureLocation(!captureLocation)}
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
            <View style={styles.titleCollapsedLine} />
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
              editable={!isSubmitting}
              returnKeyType="next"
              blurOnSubmit={false}
              onFocus={() => setIsTitleExpanded(true)}
            />
          </View>
        )}

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

        <View style={styles.actionButtons}>
          {/* Delete Button (only when editing) */}
          {isEditing && (
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
            onPress={() => navigate("inbox")}
            style={styles.cancelButton}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5}>
              <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>

          {/* Save Button (Green Check) */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSubmitting}
            style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5}>
              <Path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
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
          }}
          selectedCategoryId={categoryId}
        />
      </TopBarDropdownContainer>
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
  contentContainer: {
    flex: 1,
  },
  titleContainer: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  titleCollapsed: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  titleCollapsedLine: {
    height: 0.5,
    backgroundColor: "#d1d5db",
  },
  titleInput: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111827",
    padding: 0,
    margin: 0,
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
});
