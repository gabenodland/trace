import { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { createScopedLogger, LogScopes } from "../shared/utils/logger";

const log = createScopedLogger(LogScopes.Streams);
import { Icon } from "../shared/components";
import { useStreams } from "../modules/streams/mobileStreamHooks";
import type { Stream } from "@trace/core";
import { useNavigate } from "../shared/navigation";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { useTheme } from "../shared/contexts/ThemeContext";

export function StreamsScreen() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { streams, isLoading, streamMutations } = useStreams();

  const [searchText, setSearchText] = useState("");

  // Filter streams by search text
  const filteredStreams = useMemo(() => {
    if (!searchText.trim()) return streams;
    const searchLower = searchText.toLowerCase();
    return streams.filter((stream) =>
      stream.name.toLowerCase().includes(searchLower)
    );
  }, [streams, searchText]);

  // Sort streams alphabetically
  const sortedStreams = useMemo(() => {
    return [...filteredStreams].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [filteredStreams]);

  // Navigate to create new stream screen
  const handleCreateStream = () => {
    navigate("stream-properties", { streamId: null });
  };

  // Delete stream with confirmation
  const handleDeleteStream = (stream: Stream) => {
    Alert.alert(
      "Delete Stream",
      `Are you sure you want to delete "${stream.name}"? Entries will be moved to no stream.`,
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

  // Open stream settings screen
  const handleOpenSettings = (stream: Stream) => {
    navigate("stream-properties", { streamId: stream.stream_id });
  };

  // Open entry list filtered by stream
  const handleOpenEntries = (stream: Stream) => {
    navigate("inbox", { returnStreamId: stream.stream_id, returnStreamName: stream.name });
  };

  // Render a single stream item
  const renderStreamItem = ({ item: stream }: { item: Stream }) => {
    return (
      <View style={[styles.streamItem, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
        <TouchableOpacity
          style={styles.streamMain}
          onPress={() => handleOpenSettings(stream)}
          onLongPress={() => handleOpenEntries(stream)}
          activeOpacity={0.7}
        >
          {/* Stream icon */}
          <View
            style={[
              styles.streamIcon,
              { backgroundColor: stream.color || theme.colors.text.secondary },
            ]}
          >
            {stream.icon ? (
              <Text style={styles.streamIconText}>{stream.icon}</Text>
            ) : (
              <Icon name="Layers" size={16} color="#ffffff" />
            )}
          </View>

          {/* Stream name */}
          <View style={styles.streamInfo}>
            <Text style={[styles.streamName, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>{stream.name}</Text>
          </View>
        </TouchableOpacity>

        {/* Delete action */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteStream(stream)}
          activeOpacity={0.7}
        >
          <Icon name="Trash2" size={18} color={theme.colors.functional.overdue} />
        </TouchableOpacity>
      </View>
    );
  };

  const addButton = (
    <TouchableOpacity
      style={styles.headerAddButton}
      onPress={handleCreateStream}
      activeOpacity={0.7}
    >
      <Icon name="Plus" size={22} color={theme.colors.functional.accent} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader title="Streams" rightAction={addButton} />

      {/* Search bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.colors.background.primary, borderBottomColor: theme.colors.border.light }]}>
        <View style={[styles.searchInputWrapper, { backgroundColor: theme.colors.background.tertiary }]}>
          <Icon name="Search" size={18} color={theme.colors.text.tertiary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular }]}
            placeholder="Search streams..."
            placeholderTextColor={theme.colors.text.tertiary}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Icon name="X" size={18} color={theme.colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stream list */}
      {isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Loading streams...</Text>
        </View>
      ) : sortedStreams.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
            {searchText ? "No streams match your search" : "No streams yet"}
          </Text>
          {!searchText && (
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: theme.colors.functional.accent }]}
              onPress={handleCreateStream}
              activeOpacity={0.7}
            >
              <Text style={[styles.emptyButtonText, { fontFamily: theme.typography.fontFamily.medium }]}>Create your first stream</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={sortedStreams}
          keyExtractor={(item) => item.stream_id}
          renderItem={renderStreamItem}
          contentContainerStyle={styles.listContent}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAddButton: {
    padding: 4,
  },
  listContent: {
    padding: 16,
  },
  streamItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  streamMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  streamIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  streamIconText: {
    fontSize: 16,
  },
  streamInfo: {
    flex: 1,
  },
  streamName: {
    fontSize: 16,
  },
  actionButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  emptyButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: "#ffffff",
    fontSize: 16,
  },
});
