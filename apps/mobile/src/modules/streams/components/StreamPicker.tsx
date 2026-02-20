/**
 * StreamPicker - Stream selection picker component
 * Uses PickerBottomSheet for consistent bottom sheet presentation
 */

import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Keyboard, Platform } from "react-native";
import { useStreams } from "../mobileStreamHooks";
import { StreamList } from "./StreamList";
import { PickerBottomSheet } from "../../../components/sheets";
import { themeBase } from "../../../shared/theme/themeBase";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { Icon, EmptyState } from "../../../shared/components";

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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Track keyboard height for proper content positioning
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showListener = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideListener = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  // Clear search when picker closes
  useEffect(() => {
    if (!visible) {
      setSearchQuery("");
    }
  }, [visible]);

  // Scroll to selected item when picker becomes visible
  useEffect(() => {
    if (visible && selectedStreamId && streams.length > 0 && scrollViewRef.current) {
      // Find the index of the selected stream (+1 for the "Inbox" option at the top)
      const selectedIndex = streams.findIndex(s => s.stream_id === selectedStreamId);
      if (selectedIndex >= 0) {
        // Wait a bit for the ScrollView to be fully rendered
        setTimeout(() => {
          const scrollOffset = (selectedIndex + 1) * ITEM_HEIGHT; // +1 for Inbox
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
      height={0.85}
    >
      {/* Search Input */}
      <View style={[styles.searchContainer, { backgroundColor: dynamicTheme.colors.background.secondary, borderColor: dynamicTheme.colors.border.light }]}>
        <Icon name="Search" size={18} color={dynamicTheme.colors.text.tertiary} style={styles.searchIcon} />
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
            <Icon name="X" size={18} color={dynamicTheme.colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContent,
          keyboardHeight > 0 && { paddingBottom: keyboardHeight + 40 }
        ]}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        {/* Inbox Option - First item */}
        <TouchableOpacity
          style={[
            styles.streamItem,
            { backgroundColor: dynamicTheme.colors.background.secondary },
            selectedStreamId === null && { backgroundColor: dynamicTheme.colors.background.tertiary },
          ]}
          onPress={() => handleSelect(null)}
        >
          <View style={styles.streamContent}>
            <Icon name="Inbox" size={20} color={selectedStreamId === null ? dynamicTheme.colors.functional.accent : dynamicTheme.colors.text.secondary} />
            <Text style={[
              styles.streamName,
              { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary },
              selectedStreamId === null && { color: dynamicTheme.colors.functional.accent, fontFamily: dynamicTheme.typography.fontFamily.semibold }
            ]}>
              Inbox
            </Text>
            {selectedStreamId === null && (
              <Icon name="Check" size={18} color={dynamicTheme.colors.functional.accent} style={styles.checkIcon} />
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
              <EmptyState title="No streams yet" subtitle="Create a stream first" />
            )}
          </>
        ) : (
          <>
            {/* Filtered Streams when searching */}
            {filteredStreams.length === 0 ? (
              <EmptyState title="No streams found" subtitle="Try a different search" />
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
});
