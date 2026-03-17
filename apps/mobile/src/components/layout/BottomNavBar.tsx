/**
 * BottomNavBar - Bottom navigation with view switching and menu
 *
 * Layout: [List] [Map] [Calendar] [TraceLogo]
 * FAB floats above the bar on the right side
 *
 * Instant feedback: onPressIn sets a local highlight (tiny re-render),
 * onPress fires the heavy navigation. The user sees blue immediately on touch-down.
 */

import { useState, useCallback } from "react";
import { View, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { Icon } from "../../shared/components";
import type { ViewMode } from "../../shared/contexts/DrawerContext";

/** Approximate height of the bottom nav bar (used for scroll padding calculations) */
export const BOTTOM_NAV_HEIGHT = Platform.OS === "ios" ? 84 : 72;
/** Extra padding needed for content to clear the FAB */
export const FAB_CLEARANCE = 80;

interface BottomNavBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onAddPress: () => void;
  onMenuPress: () => void;
  isMenuActive?: boolean;
  hideFab?: boolean;
}

export function BottomNavBar({
  viewMode,
  onViewModeChange,
  onAddPress,
  onMenuPress,
  isMenuActive = false,
  hideFab = false,
}: BottomNavBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Local highlight for instant feedback on touch-down
  const [touchedMode, setTouchedMode] = useState<ViewMode | null>(null);

  const getIconColor = (mode: ViewMode) => {
    if (isMenuActive) return theme.colors.text.tertiary;
    // Touched mode takes priority for instant feedback
    if (touchedMode !== null) {
      return touchedMode === mode ? theme.colors.functional.accent : theme.colors.text.tertiary;
    }
    return viewMode === mode ? theme.colors.functional.accent : theme.colors.text.tertiary;
  };

  const handlePressIn = useCallback((mode: ViewMode) => {
    setTouchedMode(mode);
  }, []);

  const handlePress = useCallback((mode: ViewMode) => {
    setTouchedMode(null); // Clear — viewMode prop will take over
    onViewModeChange(mode);
  }, [onViewModeChange]);

  return (
    <View style={styles.wrapper}>
      {/* Floating Add Button - positioned above bar on right */}
      {!hideFab && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.colors.functional.accent + "D9" }]}
          onPress={onAddPress}
          activeOpacity={0.8}
        >
          <Icon name="Plus" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Navigation Bar */}
      <View style={[styles.container, { backgroundColor: theme.colors.background.primary, borderTopColor: theme.colors.border.light, paddingBottom: insets.bottom }]}>
        {/* List View */}
        <TouchableOpacity
          style={styles.tabButton}
          onPressIn={() => handlePressIn("list")}
          onPress={() => handlePress("list")}
          activeOpacity={1}
        >
          <Icon name="List" size={24} color={getIconColor("list")} />
        </TouchableOpacity>

        {/* Map View */}
        <TouchableOpacity
          style={styles.tabButton}
          onPressIn={() => handlePressIn("map")}
          onPress={() => handlePress("map")}
          activeOpacity={1}
        >
          <Icon name="Map" size={24} color={getIconColor("map")} />
        </TouchableOpacity>

        {/* Calendar View */}
        <TouchableOpacity
          style={styles.tabButton}
          onPressIn={() => handlePressIn("calendar")}
          onPress={() => handlePress("calendar")}
          activeOpacity={1}
        >
          <Icon name="Calendar" size={24} color={getIconColor("calendar")} />
        </TouchableOpacity>

        {/* Menu */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={onMenuPress}
          activeOpacity={0.4}
        >
          <Icon name="TraceLogoLine" size={28} color={isMenuActive ? theme.colors.functional.accent : theme.colors.text.tertiary} />
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
