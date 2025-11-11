import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from "react-native";
import Svg, { Path, Line } from "react-native-svg";
import { useState } from "react";
import { NavigationMenu, NavigationMenuItem } from "../navigation/NavigationMenu";

interface TopBarProps {
  // Title mode (for list screens)
  title?: string;
  badge?: number;
  onTitlePress?: () => void;
  showDropdownArrow?: boolean;

  // Custom content mode (for editing screens)
  children?: React.ReactNode;

  // Back button
  showBackButton?: boolean;
  onBackPress?: () => void;

  // Hamburger menu (customizable menu items)
  menuItems?: NavigationMenuItem[];
  userEmail?: string;
  onProfilePress?: () => void;
}

export function TopBar({
  title,
  badge,
  onTitlePress,
  showDropdownArrow = false,
  children,
  showBackButton = false,
  onBackPress,
  menuItems = [],
  userEmail,
  onProfilePress,
}: TopBarProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <View style={styles.container}>
      {/* Back Button */}
      {showBackButton && onBackPress && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackPress}
          activeOpacity={0.7}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth={2}>
            <Path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      )}

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

          <NavigationMenu
            visible={showMenu}
            onClose={() => setShowMenu(false)}
            menuItems={menuItems}
            userEmail={userEmail}
            onProfilePress={onProfilePress}
          />
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
  backButton: {
    padding: 8,
    marginRight: 8,
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
});
