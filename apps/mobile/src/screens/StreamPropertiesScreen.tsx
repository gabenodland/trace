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
  Platform,
  StatusBar,
} from "react-native";
import { createScopedLogger, LogScopes } from "../shared/utils/logger";

const log = createScopedLogger(LogScopes.Streams);
import { Icon } from "../shared/components";
import { useStreams } from "../modules/streams/mobileStreamHooks";
import {
  type UpdateStreamInput,
  type EntryStatus,
  DEFAULT_STREAM_STATUSES,
  DEFAULT_INITIAL_STATUS,
  getStatusLabel,
} from "@trace/core";
import { supabase } from "@trace/core/src/shared/supabase";
import { useNavigate } from "../shared/navigation";
import { useTheme } from "../shared/contexts/ThemeContext";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { StatusConfigModal } from "../modules/streams/components/StatusConfigModal";
import { TypeConfigModal } from "../modules/streams/components/TypeConfigModal";
import { RatingConfigModal } from "../modules/streams/components/RatingConfigModal";
import { TemplateHelpModal } from "../modules/streams/components/TemplateHelpModal";
import { TemplateEditorModal } from "../modules/streams/components/TemplateEditorModal";
import { type RatingType, getRatingTypeLabel } from "@trace/core";

type TabType = "features" | "template" | "general";

interface StreamPropertiesScreenProps {
  streamId: string | null;
  returnTo?: string;  // Where to navigate on back (default: "streams")
}

export function StreamPropertiesScreen({ streamId, returnTo = "streams" }: StreamPropertiesScreenProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const { streams, streamMutations } = useStreams();

  const isCreateMode = streamId === null;
  const backDestination = returnTo as "streams" | "inbox";
  const stream = isCreateMode ? null : streams.find((s) => s.stream_id === streamId);

  // Screen title
  const screenTitle = isCreateMode ? "New Stream" : stream?.name || "Stream";

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

  // Template modals
  const [showTitleHelp, setShowTitleHelp] = useState(false);
  const [showContentHelp, setShowContentHelp] = useState(false);
  const [showContentTemplateEditor, setShowContentTemplateEditor] = useState(false);

  // Snackbar state
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const snackbarOpacity = useRef(new Animated.Value(0)).current;
  const snackbarTranslateY = useRef(new Animated.Value(-20)).current;

  // Show snackbar with pop-down animation
  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    // Reset position
    snackbarTranslateY.setValue(-20);
    snackbarOpacity.setValue(0);

    Animated.sequence([
      // Pop down
      Animated.parallel([
        Animated.timing(snackbarOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(snackbarTranslateY, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      // Hold
      Animated.delay(1500),
      // Pop away
      Animated.parallel([
        Animated.timing(snackbarOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(snackbarTranslateY, {
          toValue: -20,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
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
        navigate(backDestination);
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
      log.error("Failed to save stream", error);
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
            onPress: () => navigate(backDestination),
          },
        ]
      );
    } else {
      navigate(backDestination);
    }
  };

  // Show not found only for edit mode when stream doesn't exist
  if (!isCreateMode && !stream) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        <SecondaryHeader title="Not Found" onBack={() => navigate(backDestination)} />
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Stream not found</Text>
          <TouchableOpacity
            style={[styles.backButtonContainer, { backgroundColor: theme.colors.functional.accent }]}
            onPress={() => navigate(backDestination)}
            activeOpacity={0.7}
          >
            <Text style={[styles.backButtonText, { fontFamily: theme.typography.fontFamily.medium }]}>Back to Streams</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render Features Tab
  const renderFeaturesTab = () => (
    <View style={[styles.section, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
      <Text style={[styles.sectionDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
        Enable or disable features for entries in this stream
      </Text>

      <View style={[styles.toggleRow, { borderBottomColor: theme.colors.border.light }]}>
        <View style={styles.toggleInfo}>
          <Text style={[styles.toggleLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Rating</Text>
          <Text style={[styles.toggleDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Rate entries with stars or numbers</Text>
          {useRating && (
            <Text style={[styles.statusList, { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.regular }]}>{getRatingTypeLabel(ratingType)}</Text>
          )}
        </View>
        {useRating && (
          <TouchableOpacity
            style={styles.gearButton}
            onPress={() => setShowRatingConfig(true)}
          >
            <Icon name="Settings" size={20} color="#6b7280" />
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

      <View style={[styles.toggleRow, { borderBottomColor: theme.colors.border.light }]}>
        <View style={styles.toggleInfo}>
          <Text style={[styles.toggleLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Priority</Text>
          <Text style={[styles.toggleDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Priority levels (low, medium, high)</Text>
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

      <View style={[styles.toggleRow, { borderBottomColor: theme.colors.border.light }]}>
        <View style={styles.toggleInfo}>
          <Text style={[styles.toggleLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Status</Text>
          <Text style={[styles.toggleDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Track completion status</Text>
          {useStatus && (
            <Text style={[styles.statusList, { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.regular }]}>{formatStatusList()}</Text>
          )}
        </View>
        {useStatus && (
          <TouchableOpacity
            style={styles.gearButton}
            onPress={() => setShowStatusConfig(true)}
          >
            <Icon name="Settings" size={20} color="#6b7280" />
          </TouchableOpacity>
        )}
        <Switch
          value={useStatus}
          onValueChange={(value) => {
            setUseStatus(value);
            // When status is disabled, clear the default status to prevent
            // stale defaults from being applied to new entries
            if (!value) {
              setEntryDefaultStatus("none");
            }
            markChanged();
          }}
          trackColor={{ false: "#d1d5db", true: "#3b82f6" }}
          thumbColor="#ffffff"
        />
      </View>

      <View style={[styles.toggleRow, { borderBottomColor: theme.colors.border.light }]}>
        <View style={styles.toggleInfo}>
          <Text style={[styles.toggleLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Type</Text>
          <Text style={[styles.toggleDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Categorize entries with custom types</Text>
          {useType && (
            <Text style={[styles.statusList, { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.regular }]}>{formatTypeList()}</Text>
          )}
        </View>
        {useType && (
          <TouchableOpacity
            style={styles.gearButton}
            onPress={() => setShowTypeConfig(true)}
          >
            <Icon name="Settings" size={20} color="#6b7280" />
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

      <View style={[styles.toggleRow, { borderBottomColor: theme.colors.border.light }]}>
        <View style={styles.toggleInfo}>
          <Text style={[styles.toggleLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Due Dates</Text>
          <Text style={[styles.toggleDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Assign due dates to entries</Text>
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

      <View style={[styles.toggleRow, { borderBottomColor: theme.colors.border.light }]}>
        <View style={styles.toggleInfo}>
          <Text style={[styles.toggleLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Location</Text>
          <Text style={[styles.toggleDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Attach location to entries</Text>
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
          <Text style={[styles.toggleLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Photos</Text>
          <Text style={[styles.toggleDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Attach photos to entries</Text>
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
    <View style={[styles.section, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
      <Text style={[styles.sectionDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
        Templates auto-fill when creating new empty entries in this stream.
        Use variables like {"{date}"} and basic markdown formatting.
      </Text>

      <View style={styles.inputGroup}>
        <View style={styles.labelWithInfo}>
          <Text style={[styles.inputLabel, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>Title Template</Text>
          <TouchableOpacity
            style={styles.infoButton}
            onPress={() => setShowTitleHelp(true)}
            activeOpacity={0.7}
          >
            <Icon name="Info" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <TextInput
          style={[styles.textInput, { backgroundColor: theme.colors.background.tertiary, color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular }]}
          value={entryTitleTemplate}
          onChangeText={(text) => {
            setEntryTitleTemplate(text);
            markChanged();
          }}
          placeholder="e.g., Meeting Notes - {date}"
          placeholderTextColor={theme.colors.text.tertiary}
        />
      </View>

      <View style={styles.inputGroup}>
        <View style={styles.labelWithInfo}>
          <Text style={[styles.inputLabel, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>Content Template</Text>
          <TouchableOpacity
            style={styles.infoButton}
            onPress={() => setShowContentHelp(true)}
            activeOpacity={0.7}
          >
            <Icon name="Info" size={18} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.textInput, styles.contentTemplatePreview, { backgroundColor: theme.colors.background.tertiary }]}
          onPress={() => setShowContentTemplateEditor(true)}
          activeOpacity={0.7}
        >
          {entryContentTemplate ? (
            <Text style={[styles.contentTemplatePreviewText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]} numberOfLines={5}>
              {entryContentTemplate}
            </Text>
          ) : (
            <Text style={[styles.contentTemplatePreviewPlaceholder, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
              Tap to add content template...
            </Text>
          )}
          <View style={styles.editIndicator}>
            <Icon name="Edit" size={16} color="#9ca3af" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render General Tab (Name + Privacy & Sync combined)
  const renderGeneralTab = () => (
    <>
      <View style={[styles.section, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>Stream Name</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: theme.colors.background.tertiary, color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular }]}
            value={name}
            onChangeText={(text) => {
              setName(text);
              markChanged();
            }}
            placeholder="Stream name"
            placeholderTextColor={theme.colors.text.tertiary}
          />
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>Privacy & Sync</Text>

        <View style={[styles.toggleRow, { borderBottomColor: theme.colors.border.light }]}>
          <View style={styles.toggleInfo}>
            <Text style={[styles.toggleLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Private</Text>
            <Text style={[styles.toggleDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Hide from shared views</Text>
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
            <Text style={[styles.toggleLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Local Only</Text>
            <Text style={[styles.toggleDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
              Don't sync to cloud (entries stay on this device only)
            </Text>
          </View>
          <Switch
            value={isLocalOnly}
            onValueChange={(value) => {
              // If turning ON local-only for an existing stream, show warning
              if (value && !isCreateMode && stream) {
                Alert.alert(
                  "Make Stream Local Only?",
                  "This will delete all entries and photos from the server and other devices. Your local data will be preserved.\n\nThis action cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Make Local Only",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          // Delete entries from server first (cascade will handle photos)
                          const { error: entriesError } = await supabase
                            .from("entries")
                            .update({ deleted_at: new Date().toISOString() })
                            .eq("stream_id", stream.stream_id);

                          if (entriesError) {
                            log.error("Failed to delete server entries", entriesError);
                          }

                          // Delete stream from server
                          const { error: streamError } = await supabase
                            .from("streams")
                            .delete()
                            .eq("stream_id", stream.stream_id);

                          if (streamError) {
                            log.error("Failed to delete server stream", streamError);
                          }

                          // Now update local state
                          setIsLocalOnly(true);
                          markChanged();
                          showSnackbar("Stream is now local only");
                        } catch (error) {
                          log.error("Failed to make stream local only", error);
                          showSnackbar("Failed to delete server data");
                        }
                      },
                    },
                  ]
                );
              } else {
                // Turning OFF or creating new - no confirmation needed
                setIsLocalOnly(value);
                markChanged();
              }
            }}
            trackColor={{ false: "#d1d5db", true: "#ef4444" }}
            thumbColor="#ffffff"
          />
        </View>
      </View>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader title={screenTitle} onBack={handleBack} />

      {/* Tabs */}
      <View style={[styles.tabContainer, { backgroundColor: theme.colors.background.primary, borderBottomColor: theme.colors.border.light }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "general" && [styles.tabActive, { borderBottomColor: theme.colors.functional.accent }]]}
          onPress={() => setActiveTab("general")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }, activeTab === "general" && { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.semibold }]}>General</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "features" && [styles.tabActive, { borderBottomColor: theme.colors.functional.accent }]]}
          onPress={() => setActiveTab("features")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }, activeTab === "features" && { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.semibold }]}>Features</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "template" && [styles.tabActive, { borderBottomColor: theme.colors.functional.accent }]]}
          onPress={() => setActiveTab("template")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }, activeTab === "template" && { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.semibold }]}>Template</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {activeTab === "general" && renderGeneralTab()}
        {activeTab === "features" && renderFeaturesTab()}
        {activeTab === "template" && renderTemplateTab()}
      </ScrollView>

      {/* Save/Create Button */}
      {(isCreateMode || hasChanges) && (
        <View style={[styles.saveButtonContainer, { backgroundColor: theme.colors.background.primary, borderTopColor: theme.colors.border.light }]}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.colors.functional.accent }]}
            onPress={handleSave}
            activeOpacity={0.7}
          >
            <Text style={[styles.saveButtonText, { fontFamily: theme.typography.fontFamily.semibold }]}>{isCreateMode ? "Create" : "Save Changes"}</Text>
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

      {/* Title Help Modal */}
      <TemplateHelpModal
        visible={showTitleHelp}
        onClose={() => setShowTitleHelp(false)}
        mode="title"
      />

      {/* Content Help Modal */}
      <TemplateHelpModal
        visible={showContentHelp}
        onClose={() => setShowContentHelp(false)}
        mode="content"
      />

      {/* Template Editor Modal */}
      <TemplateEditorModal
        visible={showContentTemplateEditor}
        onClose={() => setShowContentTemplateEditor(false)}
        value={entryContentTemplate}
        onSave={(value) => {
          setEntryContentTemplate(value);
          markChanged();
        }}
      />

      {/* Snackbar */}
      {snackbarMessage && (
        <Animated.View
          style={[
            styles.snackbar,
            { opacity: snackbarOpacity, transform: [{ translateY: snackbarTranslateY }] },
          ]}
        >
          <Text style={styles.snackbarText}>{snackbarMessage}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
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
    // borderBottomColor set inline with theme
  },
  tabText: {
    fontSize: 14,
  },
  tabTextActive: {
    // Styles set inline with theme
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  textInput: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  multilineInput: {
    height: 100,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: "top",
  },
  contentTemplatePreview: {
    height: 120,
    paddingTop: 12,
    paddingBottom: 12,
    position: "relative",
  },
  contentTemplatePreviewText: {
    fontSize: 13,
    lineHeight: 18,
  },
  contentTemplatePreviewPlaceholder: {
    fontSize: 14,
    fontStyle: "italic",
  },
  editIndicator: {
    position: "absolute",
    right: 12,
    bottom: 12,
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
    padding: 4,
  },
  labelWithInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  infoButton: {
    padding: 4,
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
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 16,
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 13,
  },
  gearButton: {
    padding: 8,
    marginRight: 8,
  },
  statusList: {
    fontSize: 12,
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
    marginBottom: 16,
  },
  backButtonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: 16,
  },
  saveButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
  },
  snackbar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : (StatusBar.currentHeight || 24) + 5,
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    maxWidth: "70%",
  },
  snackbarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
});
