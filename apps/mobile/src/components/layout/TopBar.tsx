import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { Icon } from "../../shared/components";
import { themeBase } from "../../shared/theme/themeBase";

interface TopBarProps {
  // Title mode (for list screens)
  title?: string;
  titleIcon?: ReactNode;  // Optional icon before title (stream icon, location pin, etc.)
  badge?: number;
  onTitlePress?: () => void;
  onMenuPress?: () => void;  // Hamburger menu button

  // Custom content mode (for editing screens)
  children?: React.ReactNode;

  // Search button
  onSearchPress?: () => void;
  isSearchActive?: boolean;

  // Offline indicator
  isOffline?: boolean;
}

export function TopBar({
  title,
  titleIcon,
  badge,
  onTitlePress,
  onMenuPress,
  children,
  onSearchPress,
  isSearchActive = false,
  isOffline = false,
}: TopBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top + (isOffline ? 4 : 16) }]}>
      {/* Offline indicator - centered above the header row */}
      {isOffline && (
        <View style={styles.offlineRow}>
          <View style={[styles.offlineBadge, { backgroundColor: theme.colors.functional.warning }]}>
            <Icon name="WifiOff" size={10} color={theme.colors.functional.warningText} />
            <Text style={[styles.offlineBadgeText, { color: theme.colors.functional.warningText, fontFamily: theme.typography.fontFamily.semibold }]}>Offline</Text>
          </View>
        </View>
      )}

      {/* Header row */}
      <View style={styles.headerRow}>
        {/* Hamburger menu button */}
        {onMenuPress && (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={onMenuPress}
            activeOpacity={0.7}
          >
            <Icon name="Menu" size={22} color={theme.colors.text.primary} />
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
            <Text
              style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {badge !== undefined && (
              <View style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
                <Text style={[styles.badgeText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.semibold }]}>{badge}</Text>
              </View>
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
          {/* Search Button */}
          {onSearchPress && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onSearchPress}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Icon name="Search" size={22} color={isSearchActive ? theme.colors.functional.accent : theme.colors.text.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: themeBase.spacing.lg,
    paddingBottom: themeBase.spacing.xs,
  },
  offlineRow: {
    alignItems: "center",
    paddingBottom: 2,
  },
  offlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  offlineBadgeText: {
    fontSize: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuButton: {
    padding: themeBase.spacing.sm,
    marginLeft: -themeBase.spacing.sm,
    marginRight: themeBase.spacing.xs,
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
    fontSize: themeBase.typography.fontSize.xl,
    flexShrink: 1,
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
    padding: themeBase.spacing.xs,
    paddingHorizontal: themeBase.spacing.sm,
  },
});
