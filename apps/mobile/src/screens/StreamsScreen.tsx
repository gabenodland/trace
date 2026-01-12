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
import Svg, { Path } from "react-native-svg";
import { useStreams } from "../modules/streams/mobileStreamHooks";
import type { Stream } from "@trace/core";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";

export function StreamsScreen() {
  const { navigate } = useNavigation();
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
              console.error("Failed to delete stream:", error);
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
      <View style={styles.streamItem}>
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
              { backgroundColor: stream.color || "#6b7280" },
            ]}
          >
            {stream.icon ? (
              <Text style={styles.streamIconText}>{stream.icon}</Text>
            ) : (
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
                <Path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}
          </View>

          {/* Stream name */}
          <View style={styles.streamInfo}>
            <Text style={styles.streamName}>{stream.name}</Text>
          </View>
        </TouchableOpacity>

        {/* Delete action */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteStream(stream)}
          activeOpacity={0.7}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2}>
            <Path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
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
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2}>
        <Path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SecondaryHeader title="Streams" rightAction={addButton} />

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2}>
            <Path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <TextInput
            style={styles.searchInput}
            placeholder="Search streams..."
            placeholderTextColor="#9ca3af"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2}>
                <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stream list */}
      {isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Loading streams...</Text>
        </View>
      ) : sortedStreams.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchText ? "No streams match your search" : "No streams yet"}
          </Text>
          {!searchText && (
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={handleCreateStream}
              activeOpacity={0.7}
            >
              <Text style={styles.emptyButtonText}>Create your first stream</Text>
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
    backgroundColor: "#f9fafb",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: "#1f2937",
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#3b82f6",
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
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
    fontWeight: "500",
    color: "#1f2937",
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
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "500",
  },
});
