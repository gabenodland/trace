import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { createScopedLogger, LogScopes } from "../shared/utils/logger";
import { Icon, EmptyState, LoadingState, SortBar, type SortOption } from "../shared/components";
import { useStreams } from "../modules/streams/mobileStreamHooks";
import type { Stream } from "@trace/core";
import { useNavigate } from "../shared/navigation";
import { useDrawer } from "../shared/contexts/DrawerContext";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { useTheme } from "../shared/contexts/ThemeContext";
import { ActionSheet, type ActionSheetItem } from "../components/sheets";

const log = createScopedLogger(LogScopes.Streams);

// ─── Sort ────────────────────────────────────────────────────────────────────────

type StreamSortKey = "name" | "count" | "recent";

const STREAM_SORT_OPTIONS: SortOption<StreamSortKey>[] = [
  { key: "name", label: "Name" },
  { key: "count", label: "Count" },
  { key: "recent", label: "Recent" },
];

function sortStreams(streams: Stream[], sortKey: StreamSortKey, ascending: boolean): Stream[] {
  const sorted = [...streams];
  switch (sortKey) {
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "count":
      sorted.sort((a, b) => b.entry_count - a.entry_count);
      break;
    case "recent":
      sorted.sort((a, b) => {
        const aDate = a.last_entry_updated_at ?? "";
        const bDate = b.last_entry_updated_at ?? "";
        if (bDate > aDate) return 1;
        if (bDate < aDate) return -1;
        return 0;
      });
      break;
  }
  return ascending ? sorted : sorted.reverse();
}

export function StreamsScreen() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { setSelectedStreamId, setSelectedStreamName } = useDrawer();
  const { streams, isLoading, streamMutations } = useStreams();

  const [searchText, setSearchText] = useState("");
  const [actionSheetStream, setActionSheetStream] = useState<Stream | null>(null);

  // Sort state
  const [sortKey, setSortKey] = useState<StreamSortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const handleSortPress = useCallback((key: StreamSortKey) => {
    if (key === sortKey) {
      setSortAsc(prev => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }, [sortKey]);

  const sortedStreams = useMemo(() => {
    const filtered = searchText.trim()
      ? streams.filter((s) => s.name.toLowerCase().includes(searchText.toLowerCase()))
      : streams;
    return sortStreams(filtered, sortKey, sortAsc);
  }, [streams, searchText, sortKey, sortAsc]);

  const handleCreateStream = () => {
    navigate("stream-properties", { streamId: null });
  };

  const handleDeleteStream = (stream: Stream) => {
    Alert.alert(
      "Delete Stream",
      `Are you sure you want to delete "${stream.name}"? Entries will be moved to Inbox.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await streamMutations.deleteStream(stream.stream_id);
            } catch (error) {
              log.error("Failed to delete stream", error);
              Alert.alert("Error", "Failed to delete stream");
            }
          },
        },
      ]
    );
  };

  const handleOpenSettings = (stream: Stream) => {
    navigate("stream-properties", { streamId: stream.stream_id });
  };

  const handleOpenEntries = (stream: Stream) => {
    setSelectedStreamId(stream.stream_id);
    setSelectedStreamName(stream.name);
    navigate("inbox");
  };

  const actionSheetItems: ActionSheetItem[] = actionSheetStream
    ? [
        {
          label: "Edit Stream",
          icon: "Settings",
          onPress: () => handleOpenSettings(actionSheetStream),
        },
        {
          label: "View Entries",
          icon: "List",
          onPress: () => handleOpenEntries(actionSheetStream),
        },
        {
          label: "Delete Stream",
          icon: "Trash2",
          onPress: () => handleDeleteStream(actionSheetStream),
          isDanger: true,
        },
      ]
    : [];

  const addButton = (
    <TouchableOpacity
      style={[styles.createButton, { backgroundColor: theme.colors.functional.accent }]}
      onPress={handleCreateStream}
      activeOpacity={0.8}
    >
      <Icon name="Plus" size={16} color="#ffffff" />
      <Text style={[styles.createButtonText, { fontFamily: theme.typography.fontFamily.medium }]}>Create</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader title="Manage Streams" rightAction={addButton} />

      {isLoading ? (
        <LoadingState message="Loading streams..." />
      ) : streams.length === 0 && !searchText ? (
        <EmptyState
          icon="Layers"
          title="No Streams Yet"
          subtitle="Streams help you organize entries into categories"
          action={{ label: "Create Your First Stream", onPress: handleCreateStream }}
        />
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {/* Search bar */}
          <View style={[styles.searchWrapper, { backgroundColor: theme.colors.background.tertiary }]}>
            <Icon name="Search" size={16} color={theme.colors.text.tertiary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular }]}
              placeholder="Search streams..."
              placeholderTextColor={theme.colors.text.tertiary}
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="X" size={16} color={theme.colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Sort bar */}
          <SortBar
            options={STREAM_SORT_OPTIONS}
            activeKey={sortKey}
            ascending={sortAsc}
            onPress={handleSortPress}
          />

          {sortedStreams.length === 0 ? (
            <View style={styles.noResultsContainer}>
              <Text style={[styles.noResultsText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                No streams match "{searchText}"
              </Text>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
              {sortedStreams.map((stream, index) => (
                <View
                  key={stream.stream_id}
                  style={[
                    styles.streamRow,
                    index < sortedStreams.length - 1 && [styles.streamRowSeparator, { borderBottomColor: theme.colors.border.light }],
                  ]}
                >
                  <TouchableOpacity
                    style={styles.streamRowContent}
                    onPress={() => handleOpenSettings(stream)}
                    activeOpacity={0.7}
                  >
                    {/* Color dot or emoji */}
                    {stream.icon ? (
                      <Text style={styles.streamEmoji}>{stream.icon}</Text>
                    ) : stream.color ? (
                      <View style={[styles.colorDot, { backgroundColor: stream.color }]} />
                    ) : null}

                    {/* Stream name */}
                    <Text
                      style={[styles.streamName, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}
                      numberOfLines={1}
                    >
                      {stream.name}
                    </Text>

                    {/* Status badges */}
                    {stream.is_localonly && (
                      <Icon name="Smartphone" size={14} color={theme.colors.text.tertiary} />
                    )}
                    {stream.is_private && (
                      <Icon name="Lock" size={14} color={theme.colors.text.tertiary} />
                    )}

                    {/* Entry count */}
                    {(stream.entry_count ?? 0) > 0 && (
                      <Text style={[styles.entryCount, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                        {stream.entry_count}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* More menu */}
                  <TouchableOpacity
                    style={styles.moreButton}
                    onPress={() => setActionSheetStream(stream)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="MoreVertical" size={18} color={theme.colors.text.tertiary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      {/* Action sheet */}
      <ActionSheet
        visible={!!actionSheetStream}
        onClose={() => setActionSheetStream(null)}
        items={actionSheetItems}
        title="Actions"
        subtitle={actionSheetStream?.name}
      />
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
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    height: 36,
    fontSize: 15,
  },
  card: {
    borderRadius: 12,
    overflow: "hidden",
  },
  streamRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  streamRowSeparator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  streamEmoji: {
    fontSize: 16,
  },
  streamRowContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  streamName: {
    flex: 1,
    fontSize: 16,
  },
  entryCount: {
    fontSize: 15,
  },
  moreButton: {
    padding: 4,
    marginLeft: 4,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 4,
  },
  createButtonText: {
    fontSize: 14,
    color: "#ffffff",
  },
  noResultsContainer: {
    padding: 32,
    alignItems: "center",
  },
  noResultsText: {
    fontSize: 15,
    textAlign: "center",
  },
  bottomSpacer: {
    height: 20,
  },
});
