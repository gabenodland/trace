import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from "react-native";
import { useStreams } from "../modules/streams/mobileStreamHooks";
import type { Stream, UpdateStreamInput } from "@trace/core";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { TopBar } from "../components/layout/TopBar";

interface StreamPropertiesScreenProps {
  streamId: string;
}

export function StreamPropertiesScreen({ streamId }: StreamPropertiesScreenProps) {
  const { navigate } = useNavigation();
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();
  const { streams, streamMutations } = useStreams();

  const stream = streams.find((s) => s.stream_id === streamId);

  // Local state for editing
  const [name, setName] = useState("");
  const [entryTitleTemplate, setEntryTitleTemplate] = useState("");
  const [entryContentTemplate, setEntryContentTemplate] = useState("");
  const [entryContentType, setEntryContentType] = useState("text");
  const [useRating, setUseRating] = useState(true);
  const [usePriority, setUsePriority] = useState(true);
  const [useStatus, setUseStatus] = useState(true);
  const [useDueDates, setUseDueDates] = useState(true);
  const [useLocation, setUseLocation] = useState(true);
  const [usePhotos, setUsePhotos] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLocalOnly, setIsLocalOnly] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form with stream data
  useEffect(() => {
    if (stream) {
      setName(stream.name || "");
      setEntryTitleTemplate(stream.entry_title_template || "");
      setEntryContentTemplate(stream.entry_content_template || "");
      setEntryContentType(stream.entry_content_type || "text");
      setUseRating(stream.entry_use_rating ?? true);
      setUsePriority(stream.entry_use_priority ?? true);
      setUseStatus(stream.entry_use_status ?? true);
      setUseDueDates(stream.entry_use_duedates ?? true);
      setUseLocation(stream.entry_use_location ?? true);
      setUsePhotos(stream.entry_use_photos ?? true);
      setIsPrivate(stream.is_private ?? false);
      setIsLocalOnly(stream.is_localonly ?? false);
      setHasChanges(false);
    }
  }, [stream]);

  // Track changes
  const markChanged = () => {
    setHasChanges(true);
  };

  // Save changes
  const handleSave = async () => {
    if (!stream) return;

    try {
      const updates: UpdateStreamInput = {
        name: name.trim() || stream.name,
        entry_title_template: entryTitleTemplate || null,
        entry_content_template: entryContentTemplate || null,
        entry_content_type: entryContentType,
        entry_use_rating: useRating,
        entry_use_priority: usePriority,
        entry_use_status: useStatus,
        entry_use_duedates: useDueDates,
        entry_use_location: useLocation,
        entry_use_photos: usePhotos,
        is_private: isPrivate,
        is_localonly: isLocalOnly,
      };

      await streamMutations.updateStream(streamId, updates);
      setHasChanges(false);
      Alert.alert("Success", "Stream properties saved");
    } catch (error) {
      console.error("Failed to save stream:", error);
      Alert.alert("Error", "Failed to save stream properties");
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (hasChanges) {
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. Discard them?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => navigate("streams"),
          },
        ]
      );
    } else {
      navigate("streams");
    }
  };

  if (!stream) {
    return (
      <View style={styles.container}>
        <TopBar
          title="Stream Properties"
          menuItems={menuItems}
          userEmail={userEmail}
          onProfilePress={onProfilePress}
        />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Stream not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigate("streams")}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>Back to Streams</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const contentTypes = [
    { value: "text", label: "Plain Text" },
    { value: "list", label: "List" },
    { value: "bullet", label: "Bullet Points" },
    { value: "richformat", label: "Rich Format" },
  ];

  return (
    <View style={styles.container}>
      <TopBar
        title={stream.name}
        menuItems={menuItems}
        userEmail={userEmail}
        onProfilePress={onProfilePress}
        showBackButton
        onBackPress={handleBack}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Info</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={(text) => {
                setName(text);
                markChanged();
              }}
              placeholder="Stream name"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>

        {/* Entry Templates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Entry Templates</Text>
          <Text style={styles.sectionDescription}>
            Default values for new entries in this stream
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Title Template</Text>
            <TextInput
              style={styles.textInput}
              value={entryTitleTemplate}
              onChangeText={(text) => {
                setEntryTitleTemplate(text);
                markChanged();
              }}
              placeholder="e.g., Meeting Notes - "
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Content Template</Text>
            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              value={entryContentTemplate}
              onChangeText={(text) => {
                setEntryContentTemplate(text);
                markChanged();
              }}
              placeholder="e.g., Attendees:\n\nAgenda:\n\nNotes:"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Content Type</Text>
            <View style={styles.segmentedControl}>
              {contentTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.segmentButton,
                    entryContentType === type.value && styles.segmentButtonActive,
                  ]}
                  onPress={() => {
                    setEntryContentType(type.value);
                    markChanged();
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      entryContentType === type.value && styles.segmentButtonTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Feature Toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Entry Features</Text>
          <Text style={styles.sectionDescription}>
            Enable or disable features for entries in this stream
          </Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Rating</Text>
              <Text style={styles.toggleDescription}>Star rating for entries</Text>
            </View>
            <Switch
              value={useRating}
              onValueChange={(value) => {
                setUseRating(value);
                markChanged();
              }}
              trackColor={{ false: "#d1d5db", true: "#3b82f6" }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Priority</Text>
              <Text style={styles.toggleDescription}>Priority levels (low, medium, high)</Text>
            </View>
            <Switch
              value={usePriority}
              onValueChange={(value) => {
                setUsePriority(value);
                markChanged();
              }}
              trackColor={{ false: "#d1d5db", true: "#3b82f6" }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Status</Text>
              <Text style={styles.toggleDescription}>Track completion status</Text>
            </View>
            <Switch
              value={useStatus}
              onValueChange={(value) => {
                setUseStatus(value);
                markChanged();
              }}
              trackColor={{ false: "#d1d5db", true: "#3b82f6" }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Due Dates</Text>
              <Text style={styles.toggleDescription}>Assign due dates to entries</Text>
            </View>
            <Switch
              value={useDueDates}
              onValueChange={(value) => {
                setUseDueDates(value);
                markChanged();
              }}
              trackColor={{ false: "#d1d5db", true: "#3b82f6" }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Location</Text>
              <Text style={styles.toggleDescription}>Attach location to entries</Text>
            </View>
            <Switch
              value={useLocation}
              onValueChange={(value) => {
                setUseLocation(value);
                markChanged();
              }}
              trackColor={{ false: "#d1d5db", true: "#3b82f6" }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Photos</Text>
              <Text style={styles.toggleDescription}>Attach photos to entries</Text>
            </View>
            <Switch
              value={usePhotos}
              onValueChange={(value) => {
                setUsePhotos(value);
                markChanged();
              }}
              trackColor={{ false: "#d1d5db", true: "#3b82f6" }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Privacy Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Sync</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Private</Text>
              <Text style={styles.toggleDescription}>Hide from shared views</Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={(value) => {
                setIsPrivate(value);
                markChanged();
              }}
              trackColor={{ false: "#d1d5db", true: "#3b82f6" }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Local Only</Text>
              <Text style={styles.toggleDescription}>
                Don't sync to cloud (entries stay on this device only)
              </Text>
            </View>
            <Switch
              value={isLocalOnly}
              onValueChange={(value) => {
                setIsLocalOnly(value);
                markChanged();
              }}
              trackColor={{ false: "#d1d5db", true: "#ef4444" }}
              thumbColor="#ffffff"
            />
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      {hasChanges && (
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            activeOpacity={0.7}
          >
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  textInput: {
    height: 48,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#1f2937",
  },
  multilineInput: {
    height: 100,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: "top",
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  segmentButtonActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6b7280",
  },
  segmentButtonTextActive: {
    color: "#1f2937",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1f2937",
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 13,
    color: "#6b7280",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "500",
  },
  saveButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  saveButton: {
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
});
