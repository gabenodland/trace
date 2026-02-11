/**
 * AccountScreen
 *
 * Main account hub replacing the dropdown menu.
 * Follows Apple's iOS pattern for account/settings hierarchy.
 *
 * Sections:
 * - Profile header with avatar, name, subscription badge
 * - Content Management (Streams, Locations)
 * - Settings
 * - Sign Out
 */

import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Platform, StatusBar } from "react-native";
import { useState, useEffect } from "react";
import { Icon } from "../shared/components";
import { getDefaultAvatarUrl } from "@trace/core";
import { useAuth } from "../shared/contexts/AuthContext";
import { useNavigate } from "../shared/navigation";
import { useTheme } from "../shared/contexts/ThemeContext";
import { useMobileProfile } from "../shared/hooks/useMobileProfile";
import { useSubscription } from "../shared/hooks/useSubscription";
import { themeBase } from "../shared/theme/themeBase";

interface AccountRowProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  showChevron?: boolean;
  destructive?: boolean;
}

function AccountRow({ icon, label, onPress, showChevron = true, destructive = false }: AccountRowProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={[
        styles.rowLabel,
        { color: destructive ? theme.colors.functional.overdue : theme.colors.text.primary },
        { fontFamily: theme.typography.fontFamily.medium }
      ]}>
        {label}
      </Text>
      {showChevron && (
        <Icon name="ChevronRight" size={20} color={theme.colors.text.tertiary} />
      )}
    </TouchableOpacity>
  );
}

export function AccountScreen() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, isOffline } = useMobileProfile(user?.id);
  const { isPro, isDevMode, expiresAt } = useSubscription();

  const [avatarError, setAvatarError] = useState(false);

  // Reset avatar error when URL changes
  useEffect(() => {
    setAvatarError(false);
  }, [profile?.avatar_url]);

  // Display name priority: name > username > email
  const displayName = profile?.name || (profile?.username ? `@${profile.username}` : null) || user?.email || "User";
  const effectiveAvatarUrl = avatarError || !profile?.avatar_url
    ? getDefaultAvatarUrl(displayName)
    : profile.avatar_url;

  // Format subscription status
  const getSubscriptionLabel = () => {
    if (isDevMode) return "Developer";
    if (isPro) {
      if (expiresAt) {
        const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 30) return `Pro (${daysLeft} days)`;
      }
      return "Pro";
    }
    return "Free";
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.background.primary }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigate("back")}
          activeOpacity={0.7}
        >
          <Icon name="ChevronLeft" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
          Account
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}
          onPress={() => navigate("profile")}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: effectiveAvatarUrl }}
            style={[styles.avatar, { backgroundColor: theme.colors.background.tertiary }]}
            onError={() => setAvatarError(true)}
          />
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]} numberOfLines={1}>
              {displayName}
            </Text>
            {profile?.name && profile?.username && (
              <Text style={[styles.profileUsername, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                @{profile.username}
              </Text>
            )}
            {user?.email && (!profile?.name || !profile?.username) && (
              <Text style={[styles.profileEmail, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]} numberOfLines={1}>
                {user.email}
              </Text>
            )}
          </View>
          <Icon name="ChevronRight" size={20} color={theme.colors.text.tertiary} />
        </TouchableOpacity>

        {/* Subscription Badge */}
        <TouchableOpacity
          style={[styles.subscriptionCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}
          onPress={() => navigate("subscription")}
          activeOpacity={0.7}
        >
          <View style={styles.subscriptionHeader}>
            <View style={[
              styles.subscriptionBadge,
              { backgroundColor: isPro || isDevMode ? theme.colors.functional.accent : theme.colors.background.tertiary }
            ]}>
              <Icon name="Star" size={16} color={isPro || isDevMode ? "#fff" : theme.colors.text.tertiary} />
            </View>
            <View style={styles.subscriptionInfo}>
              <Text style={[styles.subscriptionLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
                {getSubscriptionLabel()}
              </Text>
              <Text style={[styles.subscriptionDesc, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                {isPro || isDevMode ? "Full access to all features" : "Upgrade for more features"}
              </Text>
            </View>
            <Icon name="ChevronRight" size={20} color={theme.colors.text.tertiary} />
          </View>
          {!isPro && !isDevMode && (
            <View
              style={[styles.upgradeButton, { backgroundColor: theme.colors.functional.accent }]}
            >
              <Text style={[styles.upgradeButtonText, { fontFamily: theme.typography.fontFamily.semibold }]}>
                Upgrade to Pro
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Content Management Section */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.semibold }]}>
          MANAGE
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          <AccountRow
            icon={<Icon name="Layers" size={22} color={theme.colors.text.secondary} />}
            label="Streams"
            onPress={() => navigate("streams")}
          />
          <View style={[styles.rowDivider, { backgroundColor: theme.colors.border.light }]} />
          <AccountRow
            icon={<Icon name="MapPin" size={22} color={theme.colors.text.secondary} />}
            label="Locations"
            onPress={() => navigate("locations")}
          />
        </View>

        {/* Settings Section */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.semibold }]}>
          PREFERENCES
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          <AccountRow
            icon={<Icon name="Settings" size={22} color={theme.colors.text.secondary} />}
            label="Settings"
            onPress={() => navigate("settings")}
          />
        </View>

        {/* Sign Out */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary, marginTop: themeBase.spacing.xl }, theme.shadows.sm]}>
          <AccountRow
            icon={<Icon name="LogOut" size={22} color={theme.colors.functional.overdue} />}
            label="Sign Out"
            onPress={handleSignOut}
            showChevron={false}
            destructive
          />
        </View>

        {/* Offline indicator */}
        {isOffline && (
          <View style={styles.offlineNotice}>
            <Text style={[styles.offlineText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
              You're offline. Some features may be limited.
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 60 : (StatusBar.currentHeight || 0) + 16,
    paddingBottom: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.md,
  },
  backButton: {
    padding: themeBase.spacing.sm,
  },
  headerTitle: {
    fontSize: 17,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: themeBase.spacing.lg,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: themeBase.spacing.lg,
    borderRadius: 12,
    marginBottom: themeBase.spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  profileInfo: {
    flex: 1,
    marginLeft: themeBase.spacing.md,
  },
  profileName: {
    fontSize: 18,
  },
  profileUsername: {
    fontSize: 14,
    marginTop: 2,
  },
  profileEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  subscriptionCard: {
    padding: themeBase.spacing.lg,
    borderRadius: 12,
    marginBottom: themeBase.spacing.xl,
  },
  subscriptionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  subscriptionBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  subscriptionInfo: {
    flex: 1,
    marginLeft: themeBase.spacing.md,
  },
  subscriptionLabel: {
    fontSize: 16,
  },
  subscriptionDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  upgradeButton: {
    marginTop: themeBase.spacing.md,
    paddingVertical: themeBase.spacing.sm,
    paddingHorizontal: themeBase.spacing.lg,
    borderRadius: 8,
    alignItems: "center",
  },
  upgradeButtonText: {
    color: "#fff",
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: themeBase.spacing.sm,
    marginLeft: themeBase.spacing.xs,
  },
  card: {
    borderRadius: 12,
    marginBottom: themeBase.spacing.lg,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.lg,
  },
  rowIcon: {
    width: 28,
    alignItems: "center",
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    marginLeft: themeBase.spacing.md,
  },
  rowDivider: {
    height: 1,
    marginLeft: 56,
  },
  offlineNotice: {
    alignItems: "center",
    marginTop: themeBase.spacing.lg,
  },
  offlineText: {
    fontSize: 13,
  },
});
