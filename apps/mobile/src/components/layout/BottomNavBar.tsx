/**
 * BottomNavBar - Bottom navigation with view switching and account
 *
 * Layout: [List] [Map] [Calendar] [Account]
 * FAB floats above the bar on the right side
 */

import { View, TouchableOpacity, StyleSheet, Platform, Image } from "react-native";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { Icon } from "../../shared/components";
import { getDefaultAvatarUrl } from "@trace/core";
import { useState, useEffect } from "react";
import type { ViewMode } from "../../shared/contexts/DrawerContext";

/** Height of the bottom nav bar (excluding safe area) */
export const BOTTOM_NAV_HEIGHT = Platform.OS === "ios" ? 84 : 64;
/** Extra padding needed for content to clear the FAB */
export const FAB_CLEARANCE = 80;

interface BottomNavBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onAddPress: () => void;
  onAccountPress: () => void;
  avatarUrl?: string | null;
  displayName?: string | null;
}

export function BottomNavBar({
  viewMode,
  onViewModeChange,
  onAddPress,
  onAccountPress,
  avatarUrl,
  displayName,
}: BottomNavBarProps) {
  const theme = useTheme();
  const [avatarError, setAvatarError] = useState(false);

  // Reset avatar error when avatarUrl changes
  useEffect(() => {
    setAvatarError(false);
  }, [avatarUrl]);

  const defaultAvatar = getDefaultAvatarUrl(displayName || "User");
  const effectiveAvatarUrl = avatarError || !avatarUrl ? defaultAvatar : avatarUrl;

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
      <View style={[styles.container, { backgroundColor: theme.colors.background.primary, borderTopColor: theme.colors.border.light }]}>
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

        {/* Account/Profile */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={onAccountPress}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: effectiveAvatarUrl }}
            style={[styles.avatar, { backgroundColor: theme.colors.background.tertiary }]}
            onError={() => setAvatarError(true)}
          />
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
    paddingBottom: Platform.OS === "ios" ? 20 : 0,
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
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
});
