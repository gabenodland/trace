import { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useStreams } from "../mobileStreamHooks";
import { StreamList } from "./StreamList";
import Svg, { Path } from "react-native-svg";

interface StreamPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (streamId: string | null, streamName: string | null) => void;
  selectedStreamId: string | null;
}

export function StreamPicker({ visible, onClose, onSelect, selectedStreamId }: StreamPickerProps) {
  const { streams, isLoading } = useStreams();
  const [searchQuery, setSearchQuery] = useState("");

  // Filter streams based on search query
  const filteredStreams = streams.filter((stream) =>
    stream.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (streamId: string | null) => {
    const selectedStream = streams.find(s => s.stream_id === streamId);
    onSelect(streamId, selectedStream?.name || null);
    setSearchQuery("");
    onClose();
  };

  const handleClose = () => {
    setSearchQuery("");
    onClose();
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2} style={styles.searchIcon}>
          <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search streams..."
          placeholderTextColor="#9ca3af"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearch}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2}>
              <Path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {/* Unassigned Option - First item */}
        <TouchableOpacity
          style={[
            styles.streamItem,
            selectedStreamId === null && styles.streamItemSelected,
          ]}
          onPress={() => handleSelect(null)}
        >
          <View style={styles.streamContent}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={selectedStreamId === null ? "#2563eb" : "#6b7280"} strokeWidth={1.5}>
              <Path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" />
              <Path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" />
              <Path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" />
            </Svg>
            <Text style={[styles.streamName, selectedStreamId === null && styles.streamNameSelected]}>
              Unassigned
            </Text>
          </View>
        </TouchableOpacity>

        {/* Stream List */}
        {searchQuery === "" ? (
          <>
            {!isLoading && streams.length > 0 && (
              <StreamList
                streams={streams}
                onStreamPress={(streamId) => handleSelect(streamId)}
                selectedId={selectedStreamId}
              />
            )}

            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text style={styles.loadingText}>Loading streams...</Text>
              </View>
            )}

            {!isLoading && streams.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No streams yet</Text>
                <Text style={styles.emptySubtext}>Create a stream first</Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Filtered Streams when searching */}
            {filteredStreams.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No streams found</Text>
                <Text style={styles.emptySubtext}>Try a different search</Text>
              </View>
            ) : (
              <StreamList
                streams={filteredStreams}
                onStreamPress={(streamId) => handleSelect(streamId)}
                selectedId={selectedStreamId}
              />
            )}
          </>
        )}
      </ScrollView>
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
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    padding: 0,
  },
  clearSearch: {
    padding: 4,
  },
  content: {
    maxHeight: 400,
  },
  streamItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  streamItemSelected: {
    backgroundColor: "#dbeafe",
  },
  streamContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  streamName: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
  },
  streamNameSelected: {
    color: "#1e40af",
    fontWeight: "600",
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#9ca3af",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
  },
});
