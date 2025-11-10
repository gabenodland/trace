import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from "react-native";
import Svg, { Path, Line } from "react-native-svg";
import { useState, ReactNode } from "react";

export interface TopBarMenuItem {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  isDivider?: boolean;
  isSignOut?: boolean;
}

interface TopBarProps {
  // Title mode (for list screens)
  title?: string;
  badge?: number;
  onTitlePress?: () => void;
  showDropdownArrow?: boolean;

  // Custom content mode (for editing screens)
  children?: React.ReactNode;

  // Hamburger menu (customizable menu items)
  menuItems?: TopBarMenuItem[];
  userEmail?: string;
}

export function TopBar({
  title,
  badge,
  onTitlePress,
  showDropdownArrow = false,
  children,
  menuItems = [],
  userEmail,
}: TopBarProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <View style={styles.container}>
      {/* Title Mode */}
      {title && (
        <TouchableOpacity
          style={styles.titleContainer}
          onPress={onTitlePress}
          disabled={!onTitlePress}
          activeOpacity={onTitlePress ? 0.7 : 1}
        >
          <Text style={styles.title}>{title}</Text>
          {badge !== undefined && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
          {showDropdownArrow && (
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2} style={styles.dropdownArrow}>
              <Path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          )}
        </TouchableOpacity>
      )}

      {/* Custom Content Mode */}
      {children && (
        <View style={styles.customContent}>
          {children}
        </View>
      )}

      {/* Hamburger Menu */}
      {menuItems.length > 0 && (
        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setShowMenu(!showMenu)}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth={2}>
              <Line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
              <Line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
              <Line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>

          {showMenu && (
            <>
              <TouchableOpacity
                style={styles.menuBackdrop}
                activeOpacity={1}
                onPress={() => setShowMenu(false)}
              />
              <View style={styles.menu}>
                {/* User Email Section */}
                {userEmail && (
                  <>
                    <View style={styles.userSection}>
                      <Text style={styles.userEmail}>{userEmail}</Text>
                    </View>
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
                          setShowMenu(false);
                          item.onPress();
                        }}
                        activeOpacity={0.7}
                      >
                        {item.icon}
                        <Text style={[
                          styles.menuItemText,
                          item.isSignOut && styles.signOutText,
                        ]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 110,
    paddingTop: Platform.OS === "ios" ? 45 : (StatusBar.currentHeight || 0) + 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },
  badge: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  dropdownArrow: {
    marginLeft: 4,
  },
  customContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuContainer: {
    position: "relative",
  },
  menuButton: {
    padding: 8,
  },
  menuBackdrop: {
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  userEmail: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "600",
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
});
