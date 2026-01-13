import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useStreams } from "../mobileStreamHooks";
import { StreamList } from "./StreamList";
import Svg, { Path, Line } from "react-native-svg";
import { themeBase } from "../../../shared/theme/themeBase";
import { useTheme } from "../../../shared/contexts/ThemeContext";

const ITEM_HEIGHT = 45; // Approximate height of each stream item (used for scroll positioning)

interface StreamPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (streamId: string | null, streamName: string | null) => void;
  selectedStreamId: string | null;
  /** When true, shows "Set Stream for New Entry" as title */
  isNewEntry?: boolean;
}

export function StreamPicker({ visible, onClose, onSelect, selectedStreamId, isNewEntry = false }: StreamPickerProps) {
  const dynamicTheme = useTheme();
  const { streams, isLoading } = useStreams();
  const [searchQuery, setSearchQuery] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);

  // Scroll to selected item when picker becomes visible
  useEffect(() => {
    if (visible && selectedStreamId && streams.length > 0 && scrollViewRef.current) {
      // Find the index of the selected stream (+1 for the "Unassigned" option at the top)
      const selectedIndex = streams.findIndex(s => s.stream_id === selectedStreamId);
      if (selectedIndex >= 0) {
        // Wait a bit for the ScrollView to be fully rendered
        setTimeout(() => {
          const scrollOffset = (selectedIndex + 1) * ITEM_HEIGHT; // +1 for Unassigned
          scrollViewRef.current?.scrollTo({ y: scrollOffset, animated: true });
        }, 100);
      }
    }
  }, [visible, selectedStreamId, streams]);

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
      {/* Header with title and close button */}
      <View style={styles.header}>
        <Text style={[styles.title, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.primary }]}>
          {isNewEntry ? "Set Stream for New Entry" : "Set Stream"}
        </Text>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.secondary} strokeWidth={2}>
            <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
            <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={[styles.searchContainer, { backgroundColor: dynamicTheme.colors.background.secondary, borderBottomColor: dynamicTheme.colors.border.light }]}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.tertiary} strokeWidth={2} style={styles.searchIcon}>
          <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search streams..."
          placeholderTextColor={dynamicTheme.colors.text.tertiary}
          style={[styles.searchInput, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.primary }]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearch}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.tertiary} strokeWidth={2}>
              <Path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        {/* Unassigned Option - First item */}
        <TouchableOpacity
          style={[
            styles.streamItem,
            { borderBottomColor: dynamicTheme.colors.border.light },
            selectedStreamId === null && [styles.streamItemSelected, { backgroundColor: `${dynamicTheme.colors.functional.accent}20` }],
          ]}
          onPress={() => handleSelect(null)}
        >
          <View style={styles.streamContent}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={selectedStreamId === null ? dynamicTheme.colors.functional.accent : dynamicTheme.colors.text.secondary} strokeWidth={1.5}>
              <Path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" />
              <Path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" />
              <Path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" />
            </Svg>
            <Text style={[
              styles.streamName,
              { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary },
              selectedStreamId === null && { color: dynamicTheme.colors.functional.accent, fontFamily: dynamicTheme.typography.fontFamily.semibold }
            ]}>
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
                <ActivityIndicator size="small" color={dynamicTheme.colors.functional.accent} />
                <Text style={[styles.loadingText, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.tertiary }]}>Loading streams...</Text>
              </View>
            )}

            {!isLoading && streams.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.tertiary }]}>No streams yet</Text>
                <Text style={[styles.emptySubtext, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.tertiary }]}>Create a stream first</Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Filtered Streams when searching */}
            {filteredStreams.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.tertiary }]}>No streams found</Text>
                <Text style={[styles.emptySubtext, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.tertiary }]}>Try a different search</Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  clearSearch: {
    padding: 4,
  },
  content: {
    flex: 1, // Fill remaining space in container
  },
  scrollContent: {
    paddingBottom: 20, // Ensure last item is visible above keyboard
  },
  streamItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  streamItemSelected: {
    // background color applied inline
  },
  streamContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  streamName: {
    fontSize: 16,
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
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
  },
});
