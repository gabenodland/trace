import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { createScopedLogger, LogScopes } from "../shared/utils/logger";
import { Icon, type IconName, EmptyState, LoadingState, SortBar, type SortOption } from "../shared/components";
import { useStreams } from "../modules/streams/mobileStreamHooks";
import { type Stream, resolveStreamColorHex } from "@trace/core";
import { useNavigate } from "../shared/navigation";
import { useDrawer } from "../shared/contexts/DrawerContext";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { SearchBar } from "../components/layout/SearchBar";
import { useTheme } from "../shared/contexts/ThemeContext";
import { ActionSheet, type ActionSheetItem } from "../components/sheets";
import { CardRowWrapper, useCardListProps, managementCardStyles as mcStyles } from "../components/layout/ManagementCard";

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
  const { selectedStreamId, setSelectedStreamId, setSelectedStreamName } = useDrawer();
  const { streams, isLoading, streamMutations } = useStreams();
  const cardListProps = useCardListProps(theme);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
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

  const handleCreateStream = useCallback(() => {
    navigate("stream-properties", { streamId: null });
  }, [navigate]);

  const handleDeleteStream = useCallback((stream: Stream) => {
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
              if (selectedStreamId === stream.stream_id) {
                setSelectedStreamId("all");
                setSelectedStreamName("All Entries");
              }
            } catch (error) {
              log.error("Failed to delete stream", error);
              Alert.alert("Error", "Failed to delete stream");
            }
          },
        },
      ]
    );
  }, [streamMutations, selectedStreamId, setSelectedStreamId, setSelectedStreamName]);

  const handleOpenSettings = useCallback((stream: Stream) => {
    navigate("stream-properties", { streamId: stream.stream_id });
  }, [navigate]);

  const handleOpenEntries = useCallback((stream: Stream) => {
    setSelectedStreamId(stream.stream_id);
    setSelectedStreamName(stream.name);
    navigate("allEntries");
  }, [navigate, setSelectedStreamId, setSelectedStreamName]);

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

  const renderItem = useCallback(({ item: stream }: { item: Stream }) => (
    <CardRowWrapper theme={theme}>
      <View style={mcStyles.row}>
        <TouchableOpacity
          style={styles.streamRowContent}
          onPress={() => handleOpenSettings(stream)}
          activeOpacity={0.7}
        >
          <Icon name={stream.icon ? stream.icon as IconName : "Layers"} size={16} color={resolveStreamColorHex(stream.color, theme.colors.stream) || theme.colors.text.primary} />

          <Text
            style={[styles.streamName, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}
            numberOfLines={1}
          >
            {stream.name}
          </Text>

          {stream.is_localonly && (
            <Icon name="Smartphone" size={14} color={theme.colors.text.tertiary} />
          )}
          {stream.is_private && (
            <Icon name="Lock" size={14} color={theme.colors.text.tertiary} />
          )}

          {(stream.entry_count ?? 0) > 0 && (
            <Text style={[styles.entryCount, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
              {stream.entry_count}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => setActionSheetStream(stream)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="MoreVertical" size={18} color={theme.colors.text.tertiary} />
        </TouchableOpacity>
      </View>
    </CardRowWrapper>
  ), [theme, handleOpenSettings]);

  const keyExtractor = useCallback((item: Stream) => item.stream_id, []);

  const searchButton = (
    <TouchableOpacity onPress={() => setIsSearchOpen(!isSearchOpen)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Icon name="Search" size={20} color={isSearchOpen ? theme.colors.functional.accent : theme.colors.text.primary} />
    </TouchableOpacity>
  );

  return (
    <View style={[mcStyles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader
        title="Manage Streams"
        rightAction={searchButton}
        count={isLoading ? undefined : { total: streams.length, filtered: searchText.trim() ? sortedStreams.length : undefined }}
      />

      {isSearchOpen && (
        <SearchBar
          value={searchText}
          onChangeText={setSearchText}
          onClose={() => { setIsSearchOpen(false); setSearchText(""); }}
          placeholder="Search streams..."
        />
      )}

      {isLoading ? (
        <LoadingState message="Loading streams..." />
      ) : streams.length === 0 && !searchText ? (
        <EmptyState
          icon="Layers"
          title="No Streams Yet"
          subtitle="Streams are collections for the things you track — journals, projects, habits, anything."
          action={{ label: "Create Your First Stream", onPress: handleCreateStream }}
        />
      ) : (
        <View style={mcStyles.content}>
          <View style={[mcStyles.fixedControls, styles.controlsRow, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
            <SortBar
              options={STREAM_SORT_OPTIONS}
              activeKey={sortKey}
              ascending={sortAsc}
              onPress={handleSortPress}
              style={{ marginBottom: 0 }}
            />
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: theme.colors.functional.accent }]}
              onPress={handleCreateStream}
              activeOpacity={0.8}
            >
              <Icon name="Plus" size={16} color="#ffffff" />
              <Text style={[styles.createButtonText, { fontFamily: theme.typography.fontFamily.medium }]}>Create</Text>
            </TouchableOpacity>
          </View>

          {sortedStreams.length === 0 ? (
            <View style={mcStyles.noResultsContainer}>
              <Text style={[mcStyles.noResultsText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                No streams match "{searchText}"
              </Text>
            </View>
          ) : (
            <FlatList
              // Intentional: remount on sort change — see EntriesScreen for rationale
              key={`${sortKey}-${sortAsc}`}
              {...cardListProps}
              data={sortedStreams}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
            />
          )}
        </View>
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

// Screen-specific styles only
const styles = StyleSheet.create({
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
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
});
