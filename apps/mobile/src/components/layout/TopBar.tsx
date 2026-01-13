import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar, Image } from "react-native";
import Svg, { Path, Line, Circle } from "react-native-svg";
import { useState } from "react";
import { NavigationMenu, NavigationMenuItem } from "../navigation/NavigationMenu";
import { Breadcrumb, BreadcrumbSegment } from "./Breadcrumb";
import { useTheme, type ThemeContextValue } from "../../shared/contexts/ThemeContext";
import { themeBase } from "../../shared/theme/themeBase";
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
  const theme = useTheme();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      {/* Left Hamburger Menu (Drawer Toggle) */}
      {onLeftMenuPress && (
        <TouchableOpacity
          style={styles.leftMenuButton}
          onPress={onLeftMenuPress}
          activeOpacity={0.7}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
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
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
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
            theme={theme}
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
          <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]}>{title}</Text>
          {badge !== undefined && (
            <View style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
              <Text style={[styles.badgeText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.semibold }]}>{badge}</Text>
            </View>
          )}
          {showDropdownArrow && (
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.secondary} strokeWidth={2} style={styles.dropdownArrow}>
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
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={isSearchActive ? theme.colors.functional.accent : theme.colors.text.primary} strokeWidth={2}>
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
                style={[styles.avatarImage, { backgroundColor: theme.colors.background.tertiary }]}
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
    paddingHorizontal: themeBase.spacing.lg,
    paddingBottom: themeBase.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftMenuButton: {
    padding: themeBase.spacing.sm,
    marginRight: themeBase.spacing.sm,
  },
  backButton: {
    padding: themeBase.spacing.sm,
    marginRight: themeBase.spacing.sm,
  },
  breadcrumbContainer: {
    flex: 1,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.sm,
    flex: 1,
  },
  title: {
    fontSize: 28,
    // Note: fontWeight removed - use fontFamily with weight variant instead
  },
  badge: {
    borderRadius: themeBase.borderRadius.full,
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: themeBase.typography.fontSize.sm,
    // Note: fontWeight removed - use fontFamily with weight variant instead
  },
  dropdownArrow: {
    marginLeft: 4,
  },
  customContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.md,
  },
  rightButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.xs,
  },
  iconButton: {
    padding: themeBase.spacing.sm,
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
  },
});
