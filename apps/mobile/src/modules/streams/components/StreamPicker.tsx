/**
 * StreamPicker - Stream selection picker component
 * Uses PickerBottomSheet for consistent bottom sheet presentation
 */

import { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Keyboard, Platform, InteractionManager } from "react-native";
import { useStreams } from "../mobileStreamHooks";
import { useEntryCounts } from "../../entries/mobileEntryHooks";
import { StreamList } from "./StreamList";
import { PickerBottomSheet } from "../../../components/sheets";
import { themeBase } from "../../../shared/theme/themeBase";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { Icon, EmptyState, SearchInput } from "../../../shared/components";
import { streamItemStyles } from "./streamItemStyles";

const ITEM_HEIGHT = 45; // Approximate height of each stream item (used for scroll positioning)

interface StreamPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (streamId: string | null) => void;
  selectedStreamId: string | null;
  /** When true, shows "Set Stream for New Entry" as title */
  isNewEntry?: boolean;
}

export function StreamPicker({ visible, onClose, onSelect, selectedStreamId, isNewEntry = false }: StreamPickerProps) {
  const dynamicTheme = useTheme();
  const { streams, isLoading } = useStreams();
  const { data: entryCounts } = useEntryCounts();
  const inboxCount = entryCounts?.noStream || 0;
  const [searchQuery, setSearchQuery] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const hasScrolledRef = useRef(false);

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

  // Clear search and reset scroll flag when picker closes
  useEffect(() => {
    if (!visible) {
      setSearchQuery("");
      hasScrolledRef.current = false;
    }
  }, [visible]);

  // Scroll to selected item once when picker becomes visible
  useEffect(() => {
    if (visible && !hasScrolledRef.current && selectedStreamId && streams.length > 0 && scrollViewRef.current) {
      hasScrolledRef.current = true;
      // Find the index of the selected stream (+1 for the "Inbox" option at the top)
      const selectedIndex = streams.findIndex(s => s.stream_id === selectedStreamId);
      if (selectedIndex >= 0) {
        // Scroll after layout completes
        const handle = InteractionManager.runAfterInteractions(() => {
          const scrollOffset = (selectedIndex + 1) * ITEM_HEIGHT; // +1 for Inbox
          scrollViewRef.current?.scrollTo({ y: scrollOffset, animated: true });
        });
        return () => handle.cancel();
      }
    }
  }, [visible, selectedStreamId, streams]);

  // Filter streams based on search query
  const filteredStreams = streams.filter((stream) =>
    stream.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (streamId: string | null) => {
    onSelect(streamId);
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
      <SearchInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search streams..."
        containerStyle={styles.searchContainer}
      />

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
        {/* Stream List */}
        {searchQuery === "" ? (
          <>
            {/* Inbox - first item, only when not searching */}
            <TouchableOpacity
              style={[
                streamItemStyles.itemContainer,
                { borderBottomColor: dynamicTheme.colors.border.light },
                selectedStreamId === null && [streamItemStyles.itemContainerSelected, { backgroundColor: `${dynamicTheme.colors.functional.accent}20` }],
              ]}
              onPress={() => handleSelect(null)}
            >
              <View style={streamItemStyles.itemContent}>
                <Icon name="Inbox" size={20} color={selectedStreamId === null ? dynamicTheme.colors.functional.accent : dynamicTheme.colors.text.secondary} />
                <Text style={[
                  streamItemStyles.itemName,
                  { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary },
                  selectedStreamId === null && { color: dynamicTheme.colors.functional.accent, fontFamily: dynamicTheme.typography.fontFamily.semibold }
                ]}>
                  Inbox
                </Text>
                {inboxCount > 0 && (
                  <View style={[streamItemStyles.badge, { backgroundColor: dynamicTheme.colors.background.tertiary }]}>
                    <Text style={[streamItemStyles.badgeText, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.secondary }]}>{inboxCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

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
    marginBottom: themeBase.spacing.md,
  },
  content: {
    flex: 1,
    marginHorizontal: -themeBase.spacing.lg, // Extend to edges
  },
  scrollContent: {
    paddingBottom: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.lg,
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
