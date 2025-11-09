import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, Keyboard, StatusBar } from "react-native";
import * as Location from "expo-location";
import { useEntries, extractTagsAndMentions, getWordCount, getCharacterCount } from "@trace/core";
import { useNavigation } from "../../../shared/contexts/NavigationContext";
import { RichTextEditor } from "../../../components/editor/RichTextEditor";
import Svg, { Path, Circle, Line } from "react-native-svg";

export function CaptureForm() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [captureLocation, setCaptureLocation] = useState(true);
  const [locationData, setLocationData] = useState<{
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
  }>({ lat: null, lng: null, accuracy: null });
  const editorRef = useRef<any>(null);

  const { entryMutations } = useEntries();
  const { navigate } = useNavigation();

  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  // Fetch GPS location in background when location is enabled
  useEffect(() => {
    if (!captureLocation) {
      setLocationData({ lat: null, lng: null, accuracy: null });
      return;
    }

    const fetchLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          // Try to get last known position first (instant)
          let location = await Location.getLastKnownPositionAsync();

          // If no cached location, get current position with low accuracy (faster)
          if (!location) {
            location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Low,
            });
          }

          if (location) {
            setLocationData({
              lat: location.coords.latitude,
              lng: location.coords.longitude,
              accuracy: location.coords.accuracy,
            });
          }
        }
      } catch (geoError) {
        console.log("Location not available:", geoError);
      }
    };

    fetchLocation();
  }, [captureLocation]);

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

      console.log("Creating entry...");
      await entryMutations.createEntry({
        title: title.trim() || null,
        content,
        tags,
        mentions,
        location_lat: locationData.lat,
        location_lng: locationData.lng,
        location_accuracy: locationData.accuracy,
        category_id: null,
      });

      console.log("Entry created successfully");

      // Clear form
      setTitle("");
      setContent("");
      setLocationData({ lat: null, lng: null, accuracy: null });

      // Navigate to inbox
      navigate("inbox");
    } catch (error) {
      console.error("Failed to create entry:", error);
      Alert.alert("Error", `Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Toolbar - Absolutely Fixed */}
      <View style={styles.topToolbar}>
        <View style={styles.topToolbarLeft}>
          {/* Location Toggle */}
          <TouchableOpacity
            style={[styles.topToolbarButton, captureLocation && styles.topToolbarButtonActive]}
            onPress={() => setCaptureLocation(!captureLocation)}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={captureLocation ? "#2563eb" : "#6b7280"} strokeWidth={2}>
              <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={12} cy={10} r={3} />
            </Svg>
            <Text style={[styles.topToolbarButtonText, captureLocation && styles.topToolbarButtonTextActive]}>
              Location
            </Text>
          </TouchableOpacity>

          {/* Category Button - placeholder */}
          <TouchableOpacity style={styles.topToolbarButton}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.topToolbarButtonText}>Category</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Area */}
      <View style={styles.contentContainer}>
        {/* Title Input */}
        <View style={styles.titleContainer}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor="#9ca3af"
            style={styles.titleInput}
            editable={!isSubmitting}
            returnKeyType="next"
            blurOnSubmit={false}
          />
        </View>

        {/* Editor */}
        <View style={styles.editorContainer}>
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

      {/* Fixed Bottom Toolbar */}
      <View style={[styles.toolbar, keyboardHeight > 0 && { bottom: keyboardHeight + 25 }]}>
        <View style={styles.toolbarLeft}>
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

        <View style={styles.toolbarRight}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  topToolbar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 60 : (StatusBar.currentHeight || 0) + 16,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    zIndex: 10,
    elevation: 10,
  },
  topToolbarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  topToolbarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f9fafb",
  },
  topToolbarButtonActive: {
    backgroundColor: "#dbeafe",
  },
  topToolbarButtonText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  topToolbarButtonTextActive: {
    color: "#2563eb",
  },
  contentContainer: {
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 120 : (StatusBar.currentHeight || 0) + 76,
  },
  titleContainer: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
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
  toolbar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    zIndex: 50,
    elevation: 50,
  },
  toolbarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toolbarRight: {
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
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
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
