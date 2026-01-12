import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar, Image } from "react-native";
import Svg, { Path, Line, Circle } from "react-native-svg";
import { useState } from "react";
import { NavigationMenu, NavigationMenuItem } from "../navigation/NavigationMenu";
import { Breadcrumb, BreadcrumbSegment } from "./Breadcrumb";
import { theme } from "../../shared/theme/theme";
import { getDefaultAvatarUrl } from "@trace/core";

interface TopBarProps {
  // Title mode (for list screens)
  title?: string;
  badge?: number;
  onTitlePress?: () => void;
  showDropdownArrow?: boolean;

  // Breadcrumb mode (for hierarchical navigation)
  breadcrumbs?: BreadcrumbSegment[];
  onBreadcrumbPress?: (segment: BreadcrumbSegment) => void;

  // Custom content mode (for editing screens)
  children?: React.ReactNode;

  // Back button
  showBackButton?: boolean;
  onBackPress?: () => void;

  // Left hamburger menu (drawer toggle)
  onLeftMenuPress?: () => void;

  // Search button
  onSearchPress?: () => void;
  isSearchActive?: boolean;

  // Hamburger menu (customizable menu items)
  menuItems?: NavigationMenuItem[];
  userEmail?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  onProfilePress?: () => void;
}

export function TopBar({
  title,
  badge,
  onTitlePress,
  showDropdownArrow = false,
  breadcrumbs,
  onBreadcrumbPress,
  children,
  showBackButton = false,
  onBackPress,
  onLeftMenuPress,
  onSearchPress,
  isSearchActive = false,
  menuItems = [],
  userEmail,
  displayName,
  avatarUrl,
  onProfilePress,
}: TopBarProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <View style={styles.container}>
      {/* Left Hamburger Menu (Drawer Toggle) */}
      {onLeftMenuPress && (
        <TouchableOpacity
          style={styles.leftMenuButton}
          onPress={onLeftMenuPress}
          activeOpacity={0.7}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth={2}>
            <Line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
            <Line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
            <Line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
      )}

      {/* Back Button - Hidden for minimalist design */}
      {false && showBackButton && onBackPress && (
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

      {/* Breadcrumb Mode */}
      {breadcrumbs && onBreadcrumbPress && (
        <View style={styles.breadcrumbContainer}>
          <Breadcrumb
            segments={breadcrumbs}
            onSegmentPress={onBreadcrumbPress}
            badge={badge}
          />
        </View>
      )}

      {/* Title Mode */}
      {!breadcrumbs && title && (
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
      {!breadcrumbs && children && (
        <View style={styles.customContent}>
          {children}
        </View>
      )}

      {/* Right side buttons */}
      <View style={styles.rightButtons}>
        {/* Search Button */}
        {onSearchPress && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onSearchPress}
            activeOpacity={0.7}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={isSearchActive ? "#3b82f6" : "#1f2937"} strokeWidth={2}>
              <Circle cx={11} cy={11} r={8} />
              <Line x1={21} y1={21} x2={16.65} y2={16.65} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        )}

        {/* Profile Avatar Menu */}
        {menuItems.length > 0 && (
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={() => setShowMenu(!showMenu)}
              activeOpacity={0.7}
            >
              <Image
                source={{ uri: avatarUrl || getDefaultAvatarUrl(displayName || userEmail || "User") }}
                style={styles.avatarImage}
              />
            </TouchableOpacity>

            <NavigationMenu
              visible={showMenu}
              onClose={() => setShowMenu(false)}
              menuItems={menuItems}
              userEmail={userEmail}
              displayName={displayName}
              avatarUrl={avatarUrl}
              onProfilePress={onProfilePress}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 110,
    paddingTop: Platform.OS === "ios" ? 45 : (StatusBar.currentHeight || 0) + 10,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.background.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftMenuButton: {
    padding: theme.spacing.sm,
    marginRight: theme.spacing.sm,
  },
  backButton: {
    padding: theme.spacing.sm,
    marginRight: theme.spacing.sm,
  },
  breadcrumbContainer: {
    flex: 1,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  badge: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  dropdownArrow: {
    marginLeft: 4,
  },
  customContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  rightButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  iconButton: {
    padding: theme.spacing.sm,
  },
  menuContainer: {
    position: "relative",
  },
  avatarButton: {
    padding: 2,
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e5e7eb",
  },
});
