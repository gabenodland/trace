import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { ReactNode, useState, useEffect } from "react";
import Svg, { Path, Circle } from "react-native-svg";
import { getDefaultAvatarUrl } from "@trace/core";
import { useTheme } from "../../shared/contexts/ThemeContext";

export interface NavigationMenuItem {
  label?: string;
  onPress?: () => void;
  icon?: ReactNode;
  isDivider?: boolean;
  isSignOut?: boolean;
  destructive?: boolean;
}

interface NavigationMenuProps {
  visible: boolean;
  onClose: () => void;
  menuItems: NavigationMenuItem[];
  userEmail?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  onProfilePress?: () => void;
}

export function NavigationMenu({ visible, onClose, menuItems, userEmail, displayName, avatarUrl, onProfilePress }: NavigationMenuProps) {
  const theme = useTheme();
  const [avatarError, setAvatarError] = useState(false);

  // Reset avatar error when avatarUrl changes
  useEffect(() => {
    setAvatarError(false);
  }, [avatarUrl]);

  if (!visible) return null;

  // Get avatar URL - use actual avatar or generate default from display name
  // Falls back to default if remote image fails to load (e.g., when offline)
  const effectiveDisplayName = displayName || userEmail || "User";
  const defaultAvatar = getDefaultAvatarUrl(effectiveDisplayName);
  const effectiveAvatarUrl = avatarError || !avatarUrl ? defaultAvatar : avatarUrl;

  return (
    <>
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Menu Dropdown */}
      <View style={[styles.menu, { backgroundColor: theme.colors.surface.elevated }]}>
        {/* User Profile Section */}
        {(displayName || userEmail) && (
          <>
            <TouchableOpacity
              style={styles.userSection}
              onPress={() => {
                onClose();
                onProfilePress?.();
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.userName, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]} numberOfLines={1}>{effectiveDisplayName}</Text>
              <Image
                source={{ uri: effectiveAvatarUrl }}
                style={[styles.avatarImage, { backgroundColor: theme.colors.background.tertiary }]}
                onError={() => setAvatarError(true)}
              />
            </TouchableOpacity>
            <View style={[styles.divider, { backgroundColor: theme.colors.border.light }]} />
          </>
        )}

        {/* Menu Items */}
        <View style={styles.menuItemsContainer}>
          {menuItems.map((item, index) => {
            if (item.isDivider) {
              return <View key={index} style={[styles.divider, { backgroundColor: theme.colors.border.light }]} />;
            }

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.menuItem,
                  item.isSignOut && styles.signOutButton,
                ]}
                onPress={() => {
                  onClose();
                  item.onPress?.();
                }}
                activeOpacity={0.7}
              >
                {item.icon}
                <Text style={[
                  styles.menuItemText,
                  { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium },
                  item.isSignOut && { color: theme.colors.functional.overdue },
                  item.destructive && { color: theme.colors.functional.overdue },
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: 199,
  },
  menu: {
    position: "absolute",
    top: 51,
    right: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    minWidth: 240,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 200,
  },
  userSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  userName: {
    fontSize: 16,
    // Note: fontWeight removed - use fontFamily with weight variant instead
    flex: 1,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  divider: {
    height: 1,
  },
  menuItemsContainer: {
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 15,
    // Note: fontWeight removed - use fontFamily with weight variant instead
  },
  signOutButton: {
    paddingVertical: 16,
  },
});
