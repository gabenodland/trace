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
import Svg, { Path, Circle } from "react-native-svg";
import { getDefaultAvatarUrl } from "@trace/core";
import { useAuth } from "../shared/contexts/AuthContext";
import { useNavigation } from "../shared/contexts/NavigationContext";
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
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 18l6-6-6-6"
            stroke={theme.colors.text.tertiary}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      )}
    </TouchableOpacity>
  );
}

export function AccountScreen() {
  const theme = useTheme();
  const { navigate } = useNavigation();
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
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 18l-6-6 6-6"
              stroke={theme.colors.text.primary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
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
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 18l6-6-6-6"
              stroke={theme.colors.text.tertiary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
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
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  stroke={isPro || isDevMode ? "#fff" : theme.colors.text.tertiary}
                  strokeWidth={2}
                  fill={isPro || isDevMode ? "#fff" : "none"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <View style={styles.subscriptionInfo}>
              <Text style={[styles.subscriptionLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
                {getSubscriptionLabel()}
              </Text>
              <Text style={[styles.subscriptionDesc, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                {isPro || isDevMode ? "Full access to all features" : "Upgrade for more features"}
              </Text>
            </View>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 18l6-6-6-6"
                stroke={theme.colors.text.tertiary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
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
            icon={
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.secondary} strokeWidth={2}>
                <Path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
            label="Streams"
            onPress={() => navigate("streams")}
          />
          <View style={[styles.rowDivider, { backgroundColor: theme.colors.border.light }]} />
          <AccountRow
            icon={
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.secondary} strokeWidth={2}>
                <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
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
            icon={
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.secondary} strokeWidth={2}>
                <Circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
            label="Settings"
            onPress={() => navigate("settings")}
          />
        </View>

        {/* Sign Out */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary, marginTop: themeBase.spacing.xl }, theme.shadows.sm]}>
          <AccountRow
            icon={
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={theme.colors.functional.overdue} strokeWidth={2}>
                <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M16 17l5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
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
