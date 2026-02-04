import { View, Text, StyleSheet, TouchableOpacity, type LayoutChangeEvent } from "react-native";
import { Icon } from "../../../shared/components/Icon";
import { SubBar, SubBarSelector } from "../../../components/layout/SubBar";
import { theme } from "../../../shared/theme/theme";

interface EntryListHeaderProps {
  title: string;
  entryCount: number;
  displayModeLabel: string;
  sortModeLabel: string;
  onDisplayModePress: () => void;
  onSortModePress: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * Header component for entry lists with title and View/Sort controls.
 * Used in CalendarScreen and can be reused in other screens.
 */
export function EntryListHeader({
  title,
  entryCount,
  displayModeLabel,
  sortModeLabel,
  onDisplayModePress,
  onSortModePress,
  onLayout,
}: EntryListHeaderProps) {
  const titleWithCount = `${title} • ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`;

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{titleWithCount}</Text>
      </View>
      <SubBar>
        <SubBarSelector
          label="View"
          value={displayModeLabel}
          onPress={onDisplayModePress}
        />
        <SubBarSelector
          label="Sort"
          value={sortModeLabel}
          onPress={onSortModePress}
        />
      </SubBar>
    </View>
  );
}

interface StickyEntryListHeaderProps extends EntryListHeaderProps {
  onScrollToTop: () => void;
}

/**
 * Sticky version of the entry list header that appears when scrolling.
 * Includes a scroll-to-top button.
 */
export function StickyEntryListHeader({
  title,
  entryCount,
  displayModeLabel,
  sortModeLabel,
  onDisplayModePress,
  onSortModePress,
  onScrollToTop,
}: StickyEntryListHeaderProps) {
  const titleWithCount = `${title} • ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`;

  return (
    <View style={styles.stickyContainer}>
      <View style={styles.stickyTitleRow}>
        <Text style={styles.stickyTitle}>{titleWithCount}</Text>
        <TouchableOpacity onPress={onScrollToTop} style={styles.scrollToTopButton}>
          <Icon name="ChevronUp" size={16} color={theme.colors.text.tertiary} />
        </TouchableOpacity>
      </View>
      <SubBar>
        <SubBarSelector
          label="View"
          value={displayModeLabel}
          onPress={onDisplayModePress}
        />
        <SubBarSelector
          label="Sort"
          value={sortModeLabel}
          onPress={onSortModePress}
        />
      </SubBar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    marginBottom: 8,
    overflow: "hidden",
  },
  titleRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  stickyContainer: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    flexDirection: "column",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    overflow: "hidden",
  },
  stickyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stickyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  scrollToTopButton: {
    padding: 4,
  },
});
