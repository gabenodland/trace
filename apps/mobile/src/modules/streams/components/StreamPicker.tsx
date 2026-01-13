/**
 * StreamPicker - Stream selection picker component
 * Uses PickerBottomSheet for consistent bottom sheet presentation
 */

import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useStreams } from "../mobileStreamHooks";
import { StreamList } from "./StreamList";
import Svg, { Path } from "react-native-svg";
import { PickerBottomSheet } from "../../../components/sheets";
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

  // Clear search when picker closes
  useEffect(() => {
    if (!visible) {
      setSearchQuery("");
    }
  }, [visible]);

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
    <PickerBottomSheet
      visible={visible}
      onClose={handleClose}
      title={isNewEntry ? "Set Stream for New Entry" : "Set Stream"}
      height={0.8}
    >
      {/* Search Input */}
      <View style={[styles.searchContainer, { backgroundColor: dynamicTheme.colors.background.secondary, borderColor: dynamicTheme.colors.border.light }]}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.tertiary} strokeWidth={2} style={styles.searchIcon}>
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
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.tertiary} strokeWidth={2}>
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
            { backgroundColor: dynamicTheme.colors.background.secondary },
            selectedStreamId === null && { backgroundColor: dynamicTheme.colors.background.tertiary },
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
            {selectedStreamId === null && (
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.functional.accent} strokeWidth={2.5} style={styles.checkIcon}>
                <Path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}
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
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: themeBase.spacing.md,
    paddingVertical: themeBase.spacing.sm,
    borderRadius: themeBase.borderRadius.md,
    borderWidth: 1,
    marginBottom: themeBase.spacing.md,
  },
  searchIcon: {
    marginRight: themeBase.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  clearSearch: {
    padding: 4,
  },
  content: {
    flex: 1,
    marginHorizontal: -themeBase.spacing.lg, // Extend to edges
  },
  scrollContent: {
    paddingBottom: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.lg,
    gap: themeBase.spacing.sm,
  },
  streamItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
  },
  streamContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.sm,
    flex: 1,
  },
  streamName: {
    fontSize: 16,
    flex: 1,
  },
  checkIcon: {
    marginLeft: "auto",
  },
  loadingContainer: {
    padding: themeBase.spacing.xl,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: themeBase.spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    padding: themeBase.spacing.xl,
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
