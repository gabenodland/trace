import { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Platform, StatusBar } from "react-native";
import { useEntry, extractTagsAndMentions, getWordCount, getCharacterCount } from "@trace/core";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { RichTextEditor } from "../components/editor/RichTextEditor";
import Svg, { Path } from "react-native-svg";

interface EntryEditScreenProps {
  entryId: string;
}

export function EntryEditScreen({ entryId }: EntryEditScreenProps) {
  const { navigate } = useNavigation();
  const { entry, isLoading, error, entryMutations } = useEntry(entryId);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load entry data when it arrives
  useEffect(() => {
    if (entry) {
      setTitle(entry.title || "");
      setContent(entry.content);
    }
  }, [entry]);

  const wordCount = getWordCount(content);
  const charCount = getCharacterCount(content);

  const handleSave = async () => {
    // Prevent multiple simultaneous saves
    if (isSubmitting) return;

    const textContent = content.replace(/<[^>]*>/g, '').trim();

    if (!textContent || textContent.length === 0) {
      Alert.alert("Empty Entry", "Please add some content before saving");
      return;
    }

    setIsSubmitting(true);

    try {
      // Extract tags and mentions from updated content
      const { tags, mentions } = extractTagsAndMentions(content);

      await entryMutations.updateEntry({
        title: title.trim() || null,
        content,
        tags,
        mentions,
      });

      Alert.alert("Success", "Entry updated successfully!");

      // Navigate back to inbox
      navigate("inbox");
    } catch (error) {
      console.error("Failed to update entry:", error);
      Alert.alert("Error", `Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
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
              await entryMutations.deleteEntry();
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error || !entry) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Entry Not Found</Text>
          <Text style={styles.errorMessage}>
            The entry you're looking for doesn't exist or you don't have permission to view it.
          </Text>
          <TouchableOpacity
            onPress={() => navigate("inbox")}
            style={styles.errorButton}
          >
            <Text style={styles.errorButtonText}>Back to Inbox</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Toolbar */}
      <View style={styles.topToolbar}>
        <TouchableOpacity
          onPress={() => navigate("inbox")}
          style={styles.backButton}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2}>
            <Path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Entry</Text>
      </View>

      {/* Content Area */}
      <ScrollView style={styles.contentContainer} contentContainerStyle={styles.contentInner}>
        {/* Title Input */}
        <View style={styles.titleContainer}>
          <Text style={styles.label}>Title (optional)</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Enter a title..."
            placeholderTextColor="#9ca3af"
            style={styles.titleInput}
            editable={!isSubmitting}
          />
        </View>

        {/* Rich Text Editor */}
        <View style={styles.editorContainer}>
          <Text style={styles.label}>Content</Text>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Start typing..."
          />
        </View>

        {/* Metadata */}
        <View style={styles.metadataContainer}>
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Created:</Text>
            <Text style={styles.metadataValue}>{formatDate(entry.created_at)}</Text>
          </View>
          {entry.location_lat && entry.location_lng && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Location:</Text>
              <Text style={styles.metadataValue}>
                {entry.location_lat.toFixed(4)}, {entry.location_lng.toFixed(4)}
              </Text>
            </View>
          )}
          {entry.tags && entry.tags.length > 0 && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Tags:</Text>
              <View style={styles.tagsContainer}>
                {entry.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Character/Word Count */}
        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            {wordCount} {wordCount === 1 ? "word" : "words"} • {charCount}{" "}
            {charCount === 1 ? "character" : "characters"}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSubmitting || !content.trim()}
            style={[styles.saveButton, (isSubmitting || !content.trim()) && styles.buttonDisabled]}
          >
            <Text style={styles.saveButtonText}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDelete}
            disabled={isSubmitting}
            style={[styles.deleteButton, isSubmitting && styles.buttonDisabled]}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom padding for scroll */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6b7280",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 24,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#991b1b",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#dc2626",
    marginBottom: 16,
  },
  errorButton: {
    backgroundColor: "#dc2626",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  errorButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  topToolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : (StatusBar.currentHeight || 0) + 16,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginLeft: 16,
  },
  contentContainer: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
  },
  titleContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  editorContainer: {
    marginBottom: 16,
    minHeight: 300,
  },
  metadataContainer: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  metadataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  metadataLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  metadataValue: {
    fontSize: 14,
    color: "#111827",
    flex: 1,
    textAlign: "right",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    flex: 1,
    justifyContent: "flex-end",
  },
  tag: {
    backgroundColor: "#dbeafe",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: "#1e40af",
  },
  countContainer: {
    marginBottom: 16,
  },
  countText: {
    fontSize: 14,
    color: "#6b7280",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  deleteButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: "#ef4444",
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
