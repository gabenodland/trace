/**
 * BottomNavBar - Bottom navigation with view switching and menu
 *
 * Layout: [List] [Map] [Calendar] [TraceLogo]
 * FAB floats above the bar on the right side
 */

import { View, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { Icon } from "../../shared/components";
import type { ViewMode } from "../../shared/contexts/DrawerContext";

/** Approximate height of the bottom nav bar (used for scroll padding calculations) */
export const BOTTOM_NAV_HEIGHT = Platform.OS === "ios" ? 84 : 64;
/** Extra padding needed for content to clear the FAB */
export const FAB_CLEARANCE = 80;

interface BottomNavBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onAddPress: () => void;
  onMenuPress: () => void;
}

export function BottomNavBar({
  viewMode,
  onViewModeChange,
  onAddPress,
  onMenuPress,
}: BottomNavBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const getIconColor = (mode: ViewMode) =>
    viewMode === mode ? theme.colors.functional.accent : theme.colors.text.tertiary;

  return (
    <View style={styles.wrapper}>
      {/* Floating Add Button - positioned above bar on right */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.functional.accent + "D9" }]}
        onPress={onAddPress}
        activeOpacity={0.8}
      >
        <Icon name="Plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Navigation Bar */}
      <View style={[styles.container, { backgroundColor: theme.colors.background.primary, borderTopColor: theme.colors.border.light, paddingBottom: insets.bottom }]}>
        {/* List View */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => onViewModeChange("list")}
          activeOpacity={0.7}
        >
          <Icon name="List" size={24} color={getIconColor("list")} />
        </TouchableOpacity>

        {/* Map View */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => onViewModeChange("map")}
          activeOpacity={0.7}
        >
          <Icon name="Map" size={24} color={getIconColor("map")} />
        </TouchableOpacity>

        {/* Calendar View */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => onViewModeChange("calendar")}
          activeOpacity={0.7}
        >
          <Icon name="Calendar" size={24} color={getIconColor("calendar")} />
        </TouchableOpacity>

        {/* Menu */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={onMenuPress}
          activeOpacity={0.7}
        >
          <Icon name="TraceLogoLine" size={28} color={theme.colors.text.tertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    height: BOTTOM_NAV_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  fab: {
    position: "absolute",
    right: 50,
    top: -80,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
});
