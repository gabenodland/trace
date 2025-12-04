import { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useStreams } from "../modules/streams/mobileStreamHooks";
import type { Stream } from "@trace/core";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { TopBar } from "../components/layout/TopBar";

export function StreamsScreen() {
  const { navigate } = useNavigation();
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();
  const { streams, isLoading, streamMutations } = useStreams();

  const [searchText, setSearchText] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStreamName, setNewStreamName] = useState("");
  const [editingStream, setEditingStream] = useState<Stream | null>(null);
  const [editName, setEditName] = useState("");

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

  // Create new stream
  const handleCreateStream = async () => {
    if (!newStreamName.trim()) {
      Alert.alert("Error", "Please enter a stream name");
      return;
    }

    try {
      await streamMutations.createStream(newStreamName.trim());
      setNewStreamName("");
      setShowCreateModal(false);
    } catch (error) {
      console.error("Failed to create stream:", error);
      Alert.alert("Error", "Failed to create stream");
    }
  };

  // Update stream name
  const handleUpdateStream = async () => {
    if (!editingStream || !editName.trim()) {
      Alert.alert("Error", "Please enter a stream name");
      return;
    }

    try {
      await streamMutations.updateStream(editingStream.stream_id, {
        name: editName.trim(),
      });
      setEditingStream(null);
      setEditName("");
    } catch (error) {
      console.error("Failed to update stream:", error);
      Alert.alert("Error", "Failed to update stream");
    }
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

  // Open stream properties screen
  const handleOpenProperties = (stream: Stream) => {
    navigate("stream-properties", { streamId: stream.stream_id });
  };

  // Navigate to entries filtered by stream
  const handleViewEntries = (stream: Stream) => {
    navigate("inbox", {
      returnStreamId: stream.stream_id,
      returnStreamName: stream.name,
    });
  };

  // Render a single stream item
  const renderStreamItem = ({ item: stream }: { item: Stream }) => {
    return (
      <View style={styles.streamItem}>
        <TouchableOpacity
          style={styles.streamMain}
          onPress={() => handleViewEntries(stream)}
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

          {/* Stream name and count */}
          <View style={styles.streamInfo}>
            <Text style={styles.streamName}>{stream.name}</Text>
            <Text style={styles.streamCount}>
              {stream.entry_count} {stream.entry_count === 1 ? "entry" : "entries"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Actions */}
        <View style={styles.streamActions}>
          {/* Edit name */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setEditingStream(stream);
              setEditName(stream.name);
            }}
            activeOpacity={0.7}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>

          {/* Properties */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleOpenProperties(stream)}
            activeOpacity={0.7}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>

          {/* Delete */}
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
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TopBar
        title="Streams"
        menuItems={menuItems}
        userEmail={userEmail}
        onProfilePress={onProfilePress}
      />

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

        {/* Add stream button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.7}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
            <Path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
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
              onPress={() => setShowCreateModal(true)}
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

      {/* Create Stream Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Stream</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Stream name"
              placeholderTextColor="#9ca3af"
              value={newStreamName}
              onChangeText={setNewStreamName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowCreateModal(false);
                  setNewStreamName("");
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCreateButton}
                onPress={handleCreateStream}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCreateText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Stream Modal */}
      <Modal
        visible={editingStream !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingStream(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Stream</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Stream name"
              placeholderTextColor="#9ca3af"
              value={editName}
              onChangeText={setEditName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setEditingStream(null);
                  setEditName("");
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCreateButton}
                onPress={handleUpdateStream}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCreateText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    marginBottom: 2,
  },
  streamCount: {
    fontSize: 13,
    color: "#6b7280",
  },
  streamActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 16,
  },
  modalInput: {
    height: 48,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#1f2937",
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6b7280",
  },
  modalCreateButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#3b82f6",
  },
  modalCreateText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#ffffff",
  },
});
