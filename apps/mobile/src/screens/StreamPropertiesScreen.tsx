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
import { Icon, LoadingState, EmptyState, Button } from "../shared/components";
import { useStreams, useStream } from "../modules/streams/mobileStreamHooks";
import {
  type UpdateStreamInput,
  type EntryStatus,
  DEFAULT_STREAM_STATUSES,
  DEFAULT_INITIAL_STATUS,
  getStatusLabel,
  type RatingType,
  getRatingTypeLabel,
} from "@trace/core";
import { useNavigate } from "../shared/navigation";
import { useTheme } from "../shared/contexts/ThemeContext";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { BottomBar } from "../components/layout/BottomBar";
import { useKeyboardHeight } from "../modules/entries/components/hooks/useKeyboardHeight";
import { StatusConfigModal } from "../modules/streams/components/StatusConfigModal";
import { TypeConfigModal } from "../modules/streams/components/TypeConfigModal";
import { RatingConfigModal } from "../modules/streams/components/RatingConfigModal";
import { TemplateHelpModal } from "../modules/streams/components/TemplateHelpModal";
import { TemplateEditorModal } from "../modules/streams/components/TemplateEditorModal";

const log = createScopedLogger(LogScopes.Streams);

interface StreamPropertiesScreenProps {
  streamId: string | null;
  returnTo?: string;
}

export function StreamPropertiesScreen({ streamId, returnTo = "streams" }: StreamPropertiesScreenProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const { streamMutations: { createStream: createStreamMutation } } = useStreams();
  const { stream, isLoading, streamMutations } = useStream(streamId);

  const keyboardHeight = useKeyboardHeight();

  const isCreateMode = streamId === null;
  const backDestination = returnTo as "streams" | "inbox";

  const screenTitle = isCreateMode ? "New Stream" : stream?.name || "Stream";

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

  // Clean up animations on unmount
  useEffect(() => {
    return () => {
      snackbarOpacity.stopAnimation();
      snackbarTranslateY.stopAnimation();
    };
  }, []);

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    snackbarTranslateY.setValue(-20);
    snackbarOpacity.setValue(0);

    Animated.sequence([
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
      Animated.delay(1500),
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

  // Initialize form with stream data or defaults
  useEffect(() => {
    if (isCreateMode) {
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
      setEntryStatuses(stream.entry_statuses ?? [...DEFAULT_STREAM_STATUSES]);
      setEntryDefaultStatus((stream.entry_default_status as EntryStatus) ?? DEFAULT_INITIAL_STATUS);
      setUseType(stream.entry_use_type ?? false);
      setEntryTypes(stream.entry_types ?? []);
      setHasChanges(false);
    }
  }, [streamId, isCreateMode, stream]);

  const markChanged = () => {
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a stream name");
      return;
    }

    try {
      if (isCreateMode) {
        await createStreamMutation(name.trim());
        showSnackbar("Stream created");
        navigate(backDestination);
      } else if (streamId) {
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
          entry_statuses: entryStatuses,
          entry_default_status: entryDefaultStatus,
          entry_use_type: useType,
          entry_types: entryTypes,
        };

        await streamMutations.updateStream(updates);
        navigate(backDestination);
      }
    } catch (error) {
      log.error("Failed to save stream", error);
      showSnackbar(isCreateMode ? "Failed to create stream" : "Failed to save stream properties");
    }
  };

  const handleStatusConfigSave = (statuses: EntryStatus[], defaultStatus: EntryStatus) => {
    setEntryStatuses(statuses);
    setEntryDefaultStatus(defaultStatus);
    markChanged();
  };

  const handleTypeConfigSave = (types: string[]) => {
    setEntryTypes(types);
    if (types.length === 0) {
      setUseType(false);
    }
    markChanged();
  };

  const formatTypeList = () => {
    if (entryTypes.length === 0) return "None";
    if (entryTypes.length <= 3) return entryTypes.join(", ");
    return `${entryTypes.slice(0, 3).join(", ")} +${entryTypes.length - 3} more`;
  };

  const formatStatusList = () => {
    return entryStatuses.map(s => getStatusLabel(s)).join(", ");
  };

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

  const handleLocalOnlyToggle = (value: boolean) => {
    if (value && !isCreateMode && streamId) {
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
                await streamMutations.makeStreamLocalOnly();
                // Update UI immediately — server data is already gone
                setIsLocalOnly(true);
                // Persist the flag to SQLite (best-effort — UI is already correct)
                await streamMutations.updateStream({ is_localonly: true });
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
      setIsLocalOnly(value);
      markChanged();
    }
  };

  // Loading state
  if (!isCreateMode && isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        <SecondaryHeader title="Stream" onBack={() => navigate(backDestination)} />
        <LoadingState message="Loading..." />
      </View>
    );
  }

  // Not found state
  if (!isCreateMode && !stream) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        <SecondaryHeader title="Not Found" onBack={() => navigate(backDestination)} />
        <EmptyState
          title="Stream not found"
          action={{ label: "Back to Streams", onPress: () => navigate(backDestination) }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader title={screenTitle} onBack={handleBack} />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* General */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>General</Text>

          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Name</Text>
            </View>
          </View>
          <TextInput
            style={[styles.textInput, { backgroundColor: theme.colors.background.tertiary, color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular }]}
            value={name}
            onChangeText={(text) => {
              setName(text);
              markChanged();
            }}
            placeholder="Stream name"
            placeholderTextColor={theme.colors.text.tertiary}
            autoFocus={isCreateMode}
          />
        </View>

        {/* Remaining sections only shown in edit mode */}
        {!isCreateMode && (
          <>
            {/* Privacy & Sync */}
            <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
              <Text style={[styles.cardTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>Privacy & Sync</Text>

              <View style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}>
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Private</Text>
                  <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Hide from shared views</Text>
                </View>
                <Switch
                  value={isPrivate}
                  onValueChange={(value) => {
                    setIsPrivate(value);
                    markChanged();
                  }}
                  trackColor={{ false: theme.colors.border.dark, true: theme.colors.functional.accent }}
                  thumbColor="#ffffff"
                />
              </View>

              <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Local Only</Text>
                  <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                    Don't sync to cloud (stays on this device)
                  </Text>
                </View>
                <Switch
                  value={isLocalOnly}
                  onValueChange={handleLocalOnlyToggle}
                  trackColor={{ false: theme.colors.border.dark, true: theme.colors.functional.overdue }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            {/* Features */}
            <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
              <Text style={[styles.cardTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>Features</Text>

              {/* Rating */}
              <View style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}>
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Rating</Text>
                  <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Rate entries with stars or numbers</Text>
                  {useRating && (
                    <Text style={[styles.featureDetail, { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.regular }]}>{getRatingTypeLabel(ratingType)}</Text>
                  )}
                </View>
                {useRating && (
                  <TouchableOpacity
                    style={styles.gearButton}
                    onPress={() => setShowRatingConfig(true)}
                  >
                    <Icon name="Settings" size={18} color={theme.colors.text.tertiary} />
                  </TouchableOpacity>
                )}
                <Switch
                  value={useRating}
                  onValueChange={(value) => {
                    setUseRating(value);
                    markChanged();
                  }}
                  trackColor={{ false: theme.colors.border.dark, true: theme.colors.functional.accent }}
                  thumbColor="#ffffff"
                />
              </View>

              {/* Priority */}
              <View style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}>
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Priority</Text>
                  <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Assign importance levels to entries</Text>
                  {usePriority && (
                    <Text style={[styles.featureDetail, { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.regular }]}>Low, Medium, High, Urgent</Text>
                  )}
                </View>
                <Switch
                  value={usePriority}
                  onValueChange={(value) => {
                    setUsePriority(value);
                    markChanged();
                  }}
                  trackColor={{ false: theme.colors.border.dark, true: theme.colors.functional.accent }}
                  thumbColor="#ffffff"
                />
              </View>

              {/* Status */}
              <View style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}>
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Status</Text>
                  <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Track completion status</Text>
                  {useStatus && (
                    <Text style={[styles.featureDetail, { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.regular }]}>{formatStatusList()}</Text>
                  )}
                </View>
                {useStatus && (
                  <TouchableOpacity
                    style={styles.gearButton}
                    onPress={() => setShowStatusConfig(true)}
                  >
                    <Icon name="Settings" size={18} color={theme.colors.text.tertiary} />
                  </TouchableOpacity>
                )}
                <Switch
                  value={useStatus}
                  onValueChange={(value) => {
                    setUseStatus(value);
                    if (!value) {
                      setEntryDefaultStatus("none");
                    }
                    markChanged();
                  }}
                  trackColor={{ false: theme.colors.border.dark, true: theme.colors.functional.accent }}
                  thumbColor="#ffffff"
                />
              </View>

              {/* Type */}
              <View style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}>
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Type</Text>
                  <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Categorize entries with custom types</Text>
                  {useType && (
                    <Text style={[styles.featureDetail, { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.regular }]}>{formatTypeList()}</Text>
                  )}
                </View>
                {useType && (
                  <TouchableOpacity
                    style={styles.gearButton}
                    onPress={() => setShowTypeConfig(true)}
                  >
                    <Icon name="Settings" size={18} color={theme.colors.text.tertiary} />
                  </TouchableOpacity>
                )}
                <Switch
                  value={useType}
                  onValueChange={(value) => {
                    setUseType(value);
                    if (value && entryTypes.length === 0) {
                      setShowTypeConfig(true);
                    }
                    markChanged();
                  }}
                  trackColor={{ false: theme.colors.border.dark, true: theme.colors.functional.accent }}
                  thumbColor="#ffffff"
                />
              </View>

              {/* Due Dates */}
              <View style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}>
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Due Dates</Text>
                  <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Assign due dates to entries</Text>
                </View>
                <Switch
                  value={useDueDates}
                  onValueChange={(value) => {
                    setUseDueDates(value);
                    markChanged();
                  }}
                  trackColor={{ false: theme.colors.border.dark, true: theme.colors.functional.accent }}
                  thumbColor="#ffffff"
                />
              </View>

              {/* Location */}
              <View style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}>
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Location</Text>
                  <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Attach location to entries</Text>
                </View>
                <Switch
                  value={useLocation}
                  onValueChange={(value) => {
                    setUseLocation(value);
                    markChanged();
                  }}
                  trackColor={{ false: theme.colors.border.dark, true: theme.colors.functional.accent }}
                  thumbColor="#ffffff"
                />
              </View>

              {/* Photos */}
              <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Photos</Text>
                  <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Attach photos to entries</Text>
                </View>
                <Switch
                  value={usePhotos}
                  onValueChange={(value) => {
                    setUsePhotos(value);
                    markChanged();
                  }}
                  trackColor={{ false: theme.colors.border.dark, true: theme.colors.functional.accent }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            {/* Templates */}
            <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
              <Text style={[styles.cardTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>Templates</Text>
              <Text style={[styles.cardDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                Auto-fill when creating new entries. Use variables like {"{date}"}.
              </Text>

              {/* Title Template */}
              <TouchableOpacity
                style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}
                onPress={() => setShowTitleHelp(true)}
                activeOpacity={0.7}
              >
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Title Template</Text>
                </View>
                <View style={styles.settingValue}>
                  <Icon name="HelpCircle" size={16} color={theme.colors.text.tertiary} />
                </View>
              </TouchableOpacity>
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

              {/* Content Template */}
              <TouchableOpacity
                style={[styles.settingRow, styles.contentTemplateHeader, { borderBottomColor: theme.colors.border.light }]}
                onPress={() => setShowContentHelp(true)}
                activeOpacity={0.7}
              >
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Content Template</Text>
                </View>
                <View style={styles.settingValue}>
                  <Icon name="HelpCircle" size={16} color={theme.colors.text.tertiary} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contentTemplatePreview, { backgroundColor: theme.colors.background.tertiary }]}
                onPress={() => setShowContentTemplateEditor(true)}
                activeOpacity={0.7}
              >
                {entryContentTemplate ? (
                  <Text style={[styles.contentTemplateText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]} numberOfLines={5}>
                    {entryContentTemplate}
                  </Text>
                ) : (
                  <Text style={[styles.contentTemplatePlaceholder, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                    Tap to add content template...
                  </Text>
                )}
                <View style={[styles.editIndicator, { backgroundColor: theme.colors.background.secondary }]}>
                  <Icon name="Edit" size={14} color={theme.colors.text.tertiary} />
                </View>
              </TouchableOpacity>
            </View>
            {/* Delete Stream */}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                Alert.alert(
                  "Delete Stream",
                  `Are you sure you want to delete "${stream?.name || "this stream"}"? Entries will be moved to Inbox.`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          await streamMutations.deleteStream();
                          navigate(backDestination);
                        } catch (error) {
                          log.error("Failed to delete stream", error);
                          Alert.alert("Error", "Failed to delete stream");
                        }
                      },
                    },
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.deleteButtonText, { color: theme.colors.functional.overdue, fontFamily: theme.typography.fontFamily.medium }]}>Delete Stream</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 100 + (keyboardHeight > 0 ? keyboardHeight : 0) + ((isCreateMode || hasChanges) ? 60 : 0) }} />
      </ScrollView>

      {/* Save/Create Button */}
      {(isCreateMode || hasChanges) && (
        <BottomBar keyboardOffset={keyboardHeight}>
          <Button
            label={isCreateMode ? "Create" : "Save Changes"}
            onPress={handleSave}
            size="lg"
            fullWidth
          />
        </BottomBar>
      )}

      {/* Modals */}
      <StatusConfigModal
        visible={showStatusConfig}
        onClose={() => setShowStatusConfig(false)}
        selectedStatuses={entryStatuses}
        defaultStatus={entryDefaultStatus}
        onSave={handleStatusConfigSave}
      />

      <TypeConfigModal
        visible={showTypeConfig}
        onClose={() => setShowTypeConfig(false)}
        types={entryTypes}
        onSave={handleTypeConfigSave}
      />

      <RatingConfigModal
        visible={showRatingConfig}
        onClose={() => setShowRatingConfig(false)}
        ratingType={ratingType}
        onSave={(newType) => {
          setRatingType(newType);
          markChanged();
        }}
      />

      <TemplateHelpModal
        visible={showTitleHelp}
        onClose={() => setShowTitleHelp(false)}
        mode="title"
      />

      <TemplateHelpModal
        visible={showContentHelp}
        onClose={() => setShowContentHelp(false)}
        mode="content"
      />

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
            {
              backgroundColor: theme.isDark ? "rgba(255, 255, 255, 0.9)" : "rgba(0, 0, 0, 0.8)",
              opacity: snackbarOpacity,
              transform: [{ translateY: snackbarTranslateY }],
            },
          ]}
        >
          <Text style={[styles.snackbarText, { color: theme.isDark ? "#000" : "#fff", fontFamily: theme.typography.fontFamily.medium }]}>{snackbarMessage}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    marginBottom: 16,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    marginTop: -8,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingContent: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  settingValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  featureDetail: {
    fontSize: 12,
    marginTop: 4,
  },
  gearButton: {
    padding: 8,
    marginRight: 4,
  },
  textInput: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 4,
  },
  contentTemplateHeader: {
    marginTop: 12,
  },
  contentTemplatePreview: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 100,
    marginBottom: 4,
  },
  contentTemplateText: {
    fontSize: 13,
    lineHeight: 18,
  },
  contentTemplatePlaceholder: {
    fontSize: 14,
    fontStyle: "italic",
  },
  editIndicator: {
    position: "absolute",
    right: 10,
    bottom: 10,
    borderRadius: 4,
    padding: 4,
  },
  deleteButton: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  snackbar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : (StatusBar.currentHeight || 24) + 5,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    maxWidth: "70%",
  },
  snackbarText: {
    fontSize: 14,
    textAlign: "center",
  },
});
