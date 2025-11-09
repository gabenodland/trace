import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import * as Location from "expo-location";
import {
  useEntries,
  extractTagsAndMentions,
  getWordCount,
  getCharacterCount,
} from "@trace/core";
import { RichTextEditor } from "../../../components/editor/RichTextEditor";

export function CaptureForm() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { entryMutations } = useEntries();

  const wordCount = getWordCount(content);
  const charCount = getCharacterCount(content);

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert("Error", "Content is required");
      return;
    }

    setIsSubmitting(true);

    try {
      // Extract tags and mentions from content
      const { tags, mentions } = extractTagsAndMentions(content);

      // Get GPS coordinates
      let location_lat: number | null = null;
      let location_lng: number | null = null;
      let location_accuracy: number | null = null;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          location_lat = location.coords.latitude;
          location_lng = location.coords.longitude;
          location_accuracy = location.coords.accuracy; // Accuracy in meters
        }
      } catch (geoError) {
        // Silently fail if location not available
        console.log("Location not available:", geoError);
      }

      // Create entry
      await entryMutations.createEntry({
        title: title.trim() || null,
        content,
        tags,
        mentions,
        location_lat,
        location_lng,
        location_accuracy,
        category_id: null, // Inbox for now
      });

      // Success - clear form
      setTitle("");
      setContent("");
      Alert.alert("Success", "Entry saved successfully!");
    } catch (error) {
      console.error("Failed to create entry:", error);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to save entry"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    Alert.alert("Clear Form", "Are you sure you want to clear the form?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          setTitle("");
          setContent("");
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title Input */}
        <View style={styles.field}>
          <Text style={styles.label}>Title (optional)</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Enter a title..."
            style={styles.titleInput}
            editable={!isSubmitting}
          />
        </View>

        {/* Rich Text Editor */}
        <View style={styles.field}>
          <Text style={styles.label}>Content</Text>
          <View style={styles.editorContainer}>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Start typing... Use #tags and @mentions"
            />
          </View>
        </View>

        {/* Character/Word Count */}
        <View style={styles.stats}>
          <Text style={styles.statsText}>
            {wordCount} {wordCount === 1 ? "word" : "words"} • {charCount}{" "}
            {charCount === 1 ? "character" : "characters"}
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting || !content.trim() ? styles.buttonDisabled : null]}
            onPress={handleSubmit}
            disabled={isSubmitting || !content.trim()}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? "Saving..." : "Save to Inbox"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.clearButton, isSubmitting ? styles.buttonDisabled : null]}
            onPress={handleClear}
            disabled={isSubmitting}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  editorContainer: {
    height: 300,
  },
  stats: {
    marginBottom: 16,
  },
  statsText: {
    fontSize: 12,
    color: "#6b7280",
  },
  buttons: {
    gap: 12,
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  clearButton: {
    backgroundColor: "#e5e7eb",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  clearButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
