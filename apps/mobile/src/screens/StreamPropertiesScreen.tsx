import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  Animated,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useStreams } from "../modules/streams/mobileStreamHooks";
import {
  type UpdateStreamInput,
  type EntryStatus,
  DEFAULT_STREAM_STATUSES,
  DEFAULT_INITIAL_STATUS,
  getStatusLabel,
} from "@trace/core";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { TopBar } from "../components/layout/TopBar";
import type { BreadcrumbSegment } from "../components/layout/Breadcrumb";
import { StatusConfigModal } from "../modules/streams/components/StatusConfigModal";
import { TypeConfigModal } from "../modules/streams/components/TypeConfigModal";
import { RatingConfigModal } from "../modules/streams/components/RatingConfigModal";
import { type RatingType, getRatingTypeLabel } from "@trace/core";

type TabType = "features" | "template" | "general";

interface StreamPropertiesScreenProps {
  streamId: string | null;
}

export function StreamPropertiesScreen({ streamId }: StreamPropertiesScreenProps) {
  const { navigate } = useNavigation();
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();
  const { streams, streamMutations } = useStreams();

  const isCreateMode = streamId === null;
  const stream = isCreateMode ? null : streams.find((s) => s.stream_id === streamId);

  // Build breadcrumbs
  const breadcrumbs: BreadcrumbSegment[] = [
    { id: "streams", label: "Streams" },
    { id: streamId, label: isCreateMode ? "New Stream" : stream?.name || "Stream" },
  ];

  // Active tab - default to "general"
  const [activeTab, setActiveTab] = useState<TabType>("general");

  // Local state for editing
  const [name, setName] = useState("");
  const [entryTitleTemplate, setEntryTitleTemplate] = useState("");
  const [entryContentTemplate, setEntryContentTemplate] = useState("");
  const [entryContentType, setEntryContentType] = useState("text");
  const [useRating, setUseRating] = useState(true);
  const [ratingType, setRatingType] = useState<RatingType>('stars');
  const [showRatingConfig, setShowRatingConfig] = useState(false);
  const [usePriority, setUsePriority] = useState(true);
  const [useStatus, setUseStatus] = useState(true);
  const [useDueDates, setUseDueDates] = useState(true);
  const [useLocation, setUseLocation] = useState(true);
  const [usePhotos, setUsePhotos] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLocalOnly, setIsLocalOnly] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Status configuration
  const [entryStatuses, setEntryStatuses] = useState<EntryStatus[]>([...DEFAULT_STREAM_STATUSES]);
  const [entryDefaultStatus, setEntryDefaultStatus] = useState<EntryStatus>(DEFAULT_INITIAL_STATUS);
  const [showStatusConfig, setShowStatusConfig] = useState(false);

  // Type configuration
  const [useType, setUseType] = useState(false);
  const [entryTypes, setEntryTypes] = useState<string[]>([]);
  const [showTypeConfig, setShowTypeConfig] = useState(false);

  // Snackbar state
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const snackbarOpacity = useRef(new Animated.Value(0)).current;

  // Show snackbar helper
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

  // Initialize form with stream data or defaults for create mode
  useEffect(() => {
    if (isCreateMode) {
      // Set defaults for create mode
      setName("");
      setEntryTitleTemplate("");
      setEntryContentTemplate("");
      setEntryContentType("text");
      setUseRating(true);
      setRatingType('stars');
      setUsePriority(true);
      setUseStatus(true);
      setUseDueDates(true);
      setUseLocation(true);
      setUsePhotos(true);
      setIsPrivate(false);
      setIsLocalOnly(false);
      setEntryStatuses([...DEFAULT_STREAM_STATUSES]);
      setEntryDefaultStatus(DEFAULT_INITIAL_STATUS);
      setUseType(false);
      setEntryTypes([]);
      setHasChanges(false);
    } else if (stream) {
      setName(stream.name || "");
      setEntryTitleTemplate(stream.entry_title_template || "");
      setEntryContentTemplate(stream.entry_content_template || "");
      setEntryContentType(stream.entry_content_type || "text");
      setUseRating(stream.entry_use_rating ?? true);
      setRatingType(stream.entry_rating_type ?? 'stars');
      setUsePriority(stream.entry_use_priority ?? true);
      setUseStatus(stream.entry_use_status ?? true);
      setUseDueDates(stream.entry_use_duedates ?? true);
      setUseLocation(stream.entry_use_location ?? true);
      setUsePhotos(stream.entry_use_photos ?? true);
      setIsPrivate(stream.is_private ?? false);
      setIsLocalOnly(stream.is_localonly ?? false);
      // Status configuration
      setEntryStatuses(stream.entry_statuses ?? [...DEFAULT_STREAM_STATUSES]);
      setEntryDefaultStatus((stream.entry_default_status as EntryStatus) ?? DEFAULT_INITIAL_STATUS);
      // Type configuration
      setUseType(stream.entry_use_type ?? false);
      setEntryTypes(stream.entry_types ?? []);
      setHasChanges(false);
    }
  }, [stream, isCreateMode]);

  // Track changes
  const markChanged = () => {
    setHasChanges(true);
  };

  // Save changes (create or update)
  const handleSave = async () => {
    // Validate name
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a stream name");
      return;
    }

    try {
      if (isCreateMode) {
        // Create new stream
        await streamMutations.createStream(name.trim());
        showSnackbar("Stream created");
        navigate("streams");
      } else if (stream) {
        // Update existing stream
        const updates: UpdateStreamInput = {
          name: name.trim(),
          entry_title_template: entryTitleTemplate || null,
          entry_content_template: entryContentTemplate || null,
          entry_content_type: entryContentType,
          entry_use_rating: useRating,
          entry_rating_type: ratingType,
          entry_use_priority: usePriority,
          entry_use_status: useStatus,
          entry_use_duedates: useDueDates,
          entry_use_location: useLocation,
          entry_use_photos: usePhotos,
          is_private: isPrivate,
          is_localonly: isLocalOnly,
          // Status configuration
          entry_statuses: entryStatuses,
          entry_default_status: entryDefaultStatus,
          // Type configuration
          entry_use_type: useType,
          entry_types: entryTypes,
        };

        await streamMutations.updateStream(streamId!, updates);
        setHasChanges(false);
        showSnackbar("Stream settings saved");
      }
    } catch (error) {
      console.error("Failed to save stream:", error);
      showSnackbar(isCreateMode ? "Failed to create stream" : "Failed to save stream properties");
    }
  };

  // Handle status config save
  const handleStatusConfigSave = (statuses: EntryStatus[], defaultStatus: EntryStatus) => {
    setEntryStatuses(statuses);
    setEntryDefaultStatus(defaultStatus);
    markChanged();
  };

  // Handle type config save
  const handleTypeConfigSave = (types: string[]) => {
    setEntryTypes(types);
    // If types list is now empty, disable the feature
    if (types.length === 0) {
      setUseType(false);
    }
    markChanged();
  };

  // Format type list for display
  const formatTypeList = () => {
    if (entryTypes.length === 0) return "No types configured";
    if (entryTypes.length <= 3) return entryTypes.join(", ");
    return `${entryTypes.slice(0, 3).join(", ")} +${entryTypes.length - 3} more`;
  };

  // Format status list for display
  const formatStatusList = () => {
    return entryStatuses.map(s => getStatusLabel(s)).join(", ");
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

  // Handle breadcrumb press
  const handleBreadcrumbPress = (segment: BreadcrumbSegment) => {
    if (segment.id === "streams") {
      handleBack();
    }
  };

  // Show not found only for edit mode when stream doesn't exist
  if (!isCreateMode && !stream) {
    const notFoundBreadcrumbs: BreadcrumbSegment[] = [
      { id: "streams", label: "Streams" },
      { id: null, label: "Not Found" },
    ];
    return (
      <View style={styles.container}>
        <TopBar
          breadcrumbs={notFoundBreadcrumbs}
          onBreadcrumbPress={(segment) => {
            if (segment.id === "streams") navigate("streams");
          }}
          menuItems={menuItems}
          userEmail={userEmail}
          onProfilePress={onProfilePress}
        />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Stream not found</Text>
          <TouchableOpacity
            style={styles.backButtonContainer}
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

  // Render Features Tab
  const renderFeaturesTab = () => (
    <View style={styles.section}>
      <Text style={styles.sectionDescription}>
        Enable or disable features for entries in this stream
      </Text>

      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleLabel}>Rating</Text>
          <Text style={styles.toggleDescription}>Rate entries with stars or numbers</Text>
          {useRating && (
            <Text style={styles.statusList}>{getRatingTypeLabel(ratingType)}</Text>
          )}
        </View>
        {useRating && (
          <TouchableOpacity
            style={styles.gearButton}
            onPress={() => setShowRatingConfig(true)}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <Path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
            </Svg>
          </TouchableOpacity>
        )}
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
          {useStatus && (
            <Text style={styles.statusList}>{formatStatusList()}</Text>
          )}
        </View>
        {useStatus && (
          <TouchableOpacity
            style={styles.gearButton}
            onPress={() => setShowStatusConfig(true)}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <Path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
            </Svg>
          </TouchableOpacity>
        )}
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
          <Text style={styles.toggleLabel}>Type</Text>
          <Text style={styles.toggleDescription}>Categorize entries with custom types</Text>
          {useType && (
            <Text style={styles.statusList}>{formatTypeList()}</Text>
          )}
        </View>
        {useType && (
          <TouchableOpacity
            style={styles.gearButton}
            onPress={() => setShowTypeConfig(true)}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <Path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
            </Svg>
          </TouchableOpacity>
        )}
        <Switch
          value={useType}
          onValueChange={(value) => {
            setUseType(value);
            // If enabling and no types configured, show config modal
            if (value && entryTypes.length === 0) {
              setShowTypeConfig(true);
            }
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
  );

  // Render Template Tab
  const renderTemplateTab = () => (
    <View style={styles.section}>
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
  );

  // Render General Tab (Name + Privacy & Sync combined)
  const renderGeneralTab = () => (
    <>
      <View style={styles.section}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Stream Name</Text>
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
    </>
  );

  return (
    <View style={styles.container}>
      <TopBar
        breadcrumbs={breadcrumbs}
        onBreadcrumbPress={handleBreadcrumbPress}
        menuItems={menuItems}
        userEmail={userEmail}
        onProfilePress={onProfilePress}
      />

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "general" && styles.tabActive]}
          onPress={() => setActiveTab("general")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === "general" && styles.tabTextActive]}>General</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "features" && styles.tabActive]}
          onPress={() => setActiveTab("features")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === "features" && styles.tabTextActive]}>Features</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "template" && styles.tabActive]}
          onPress={() => setActiveTab("template")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === "template" && styles.tabTextActive]}>Template</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {activeTab === "general" && renderGeneralTab()}
        {activeTab === "features" && renderFeaturesTab()}
        {activeTab === "template" && renderTemplateTab()}
      </ScrollView>

      {/* Save/Create Button */}
      {(isCreateMode || hasChanges) && (
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            activeOpacity={0.7}
          >
            <Text style={styles.saveButtonText}>{isCreateMode ? "Create" : "Save Changes"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Status Config Modal */}
      <StatusConfigModal
        visible={showStatusConfig}
        onClose={() => setShowStatusConfig(false)}
        selectedStatuses={entryStatuses}
        defaultStatus={entryDefaultStatus}
        onSave={handleStatusConfigSave}
      />

      {/* Type Config Modal */}
      <TypeConfigModal
        visible={showTypeConfig}
        onClose={() => setShowTypeConfig(false)}
        types={entryTypes}
        onSave={handleTypeConfigSave}
      />

      {/* Rating Config Modal */}
      <RatingConfigModal
        visible={showRatingConfig}
        onClose={() => setShowRatingConfig(false)}
        ratingType={ratingType}
        onSave={(newType) => {
          setRatingType(newType);
          markChanged();
        }}
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
    backgroundColor: "#f9fafb",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#3b82f6",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  tabTextActive: {
    color: "#3b82f6",
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
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
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
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
  gearButton: {
    padding: 8,
    marginRight: 8,
  },
  statusList: {
    fontSize: 12,
    color: "#3b82f6",
    marginTop: 4,
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
  backButtonContainer: {
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
  snackbar: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  snackbarText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
  },
});
