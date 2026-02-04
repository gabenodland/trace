import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar, Image } from "react-native";
import { useEffect, useState, ReactNode } from "react";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { Icon } from "../../shared/components";
import { themeBase } from "../../shared/theme/themeBase";
import { getDefaultAvatarUrl } from "@trace/core";

interface TopBarProps {
  // Title mode (for list screens)
  title?: string;
  titleIcon?: ReactNode;  // Optional icon before title (stream icon, location pin, etc.)
  badge?: number;
  onTitlePress?: () => void;
  showDropdownArrow?: boolean;

  // Custom content mode (for editing screens)
  children?: React.ReactNode;

  // Back button
  showBackButton?: boolean;
  onBackPress?: () => void;

  // Settings button (gear icon) - for stream management
  onSettingsPress?: () => void;

  // Search button
  onSearchPress?: () => void;
  isSearchActive?: boolean;

  // Avatar/Account button - navigates to account screen
  showAvatar?: boolean;
  avatarUrl?: string | null;
  displayName?: string | null;
  onAvatarPress?: () => void;
}

export function TopBar({
  title,
  titleIcon,
  badge,
  onTitlePress,
  showDropdownArrow = false,
  children,
  showBackButton = false,
  onBackPress,
  onSettingsPress,
  onSearchPress,
  isSearchActive = false,
  showAvatar = false,
  avatarUrl,
  displayName,
  onAvatarPress,
}: TopBarProps) {
  const theme = useTheme();
  const [avatarError, setAvatarError] = useState(false);

  // Reset avatar error when avatarUrl changes
  useEffect(() => {
    setAvatarError(false);
  }, [avatarUrl]);

  // Determine effective avatar URL - use default if remote fails to load
  const defaultAvatar = getDefaultAvatarUrl(displayName || "User");
  const effectiveAvatarUrl = avatarError || !avatarUrl ? defaultAvatar : avatarUrl;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      {/* Back Button - Hidden for minimalist design */}
      {false && showBackButton && onBackPress && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackPress}
          activeOpacity={0.7}
        >
          <Icon name="ChevronLeft" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
      )}

      {/* Title Mode - Clickable stream/filter selector */}
      {title && (
        <TouchableOpacity
          style={styles.titleContainer}
          onPress={onTitlePress}
          disabled={!onTitlePress}
          activeOpacity={onTitlePress ? 0.7 : 1}
        >
          {titleIcon && <View style={styles.titleIcon}>{titleIcon}</View>}
          <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]}>{title}</Text>
          {badge !== undefined && (
            <View style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
              <Text style={[styles.badgeText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.semibold }]}>{badge}</Text>
            </View>
          )}
          {showDropdownArrow && (
            <Icon name="ChevronDown" size={20} color={theme.colors.text.secondary} />
          )}
        </TouchableOpacity>
      )}

      {/* Custom Content Mode */}
      {!title && children && (
        <View style={styles.customContent}>
          {children}
        </View>
      )}

      {/* Right side buttons */}
      <View style={styles.rightButtons}>
        {/* Settings Button (gear icon) - for stream management */}
        {onSettingsPress && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onSettingsPress}
            activeOpacity={0.7}
          >
            <Icon name="Settings" size={22} color={theme.colors.text.primary} />
          </TouchableOpacity>
        )}

        {/* Search Button */}
        {onSearchPress && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onSearchPress}
            activeOpacity={0.7}
          >
            <Icon name="Search" size={22} color={isSearchActive ? theme.colors.functional.accent : theme.colors.text.primary} />
          </TouchableOpacity>
        )}

        {/* Profile Avatar - navigates to Account screen */}
        {showAvatar && onAvatarPress && (
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={onAvatarPress}
            activeOpacity={0.7}
          >
            <Image
              source={{ uri: effectiveAvatarUrl }}
              style={[styles.avatarImage, { backgroundColor: theme.colors.background.tertiary }]}
              onError={() => setAvatarError(true)}
            />
          </TouchableOpacity>
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
  backButton: {
    padding: themeBase.spacing.sm,
    marginRight: themeBase.spacing.sm,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.sm,
    flex: 1,
  },
  titleIcon: {
    marginRight: 2,
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
  avatarButton: {
    padding: 2,
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});
