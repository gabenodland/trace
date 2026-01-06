import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { ReactNode } from "react";
import Svg, { Path, Circle } from "react-native-svg";
import { getDefaultAvatarUrl } from "@trace/core";

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
  if (!visible) return null;

  // Get avatar URL - use actual avatar or generate default from display name
  const effectiveDisplayName = displayName || userEmail || "User";
  const effectiveAvatarUrl = avatarUrl || getDefaultAvatarUrl(effectiveDisplayName);

  return (
    <>
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Menu Dropdown */}
      <View style={styles.menu}>
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
              <Text style={styles.userName} numberOfLines={1}>{effectiveDisplayName}</Text>
              <Image
                source={{ uri: effectiveAvatarUrl }}
                style={styles.avatarImage}
              />
            </TouchableOpacity>
            <View style={styles.divider} />
          </>
        )}

        {/* Menu Items */}
        <View style={styles.menuItemsContainer}>
          {menuItems.map((item, index) => {
            if (item.isDivider) {
              return <View key={index} style={styles.divider} />;
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
                  item.isSignOut && styles.signOutText,
                  item.destructive && styles.destructiveText,
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
    backgroundColor: "#ffffff",
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
    color: "#1f2937",
    fontWeight: "600",
    flex: 1,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e5e7eb",
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
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
    color: "#1f2937",
    fontWeight: "500",
  },
  signOutButton: {
    paddingVertical: 16,
  },
  signOutText: {
    color: "#ef4444",
    fontWeight: "600",
  },
  destructiveText: {
    color: "#ef4444",
  },
});
