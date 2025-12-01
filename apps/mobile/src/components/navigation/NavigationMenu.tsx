import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ReactNode } from "react";
import Svg, { Path, Circle } from "react-native-svg";

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
  onProfilePress?: () => void;
}

export function NavigationMenu({ visible, onClose, menuItems, userEmail, onProfilePress }: NavigationMenuProps) {
  if (!visible) return null;

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
        {userEmail && (
          <>
            <TouchableOpacity
              style={styles.userSection}
              onPress={() => {
                onClose();
                onProfilePress?.();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.userEmail}>{userEmail}</Text>
              <View style={styles.profileIconCircle}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
                  <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  userEmail: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "600",
    flex: 1,
  },
  profileIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
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
