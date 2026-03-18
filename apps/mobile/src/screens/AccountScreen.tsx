/**
 * AccountScreen — Main Menu
 *
 * Top-level menu accessed via the Trace logo in the bottom nav.
 * Branded header with logo, stacked profile + subscription card,
 * management rows, settings, and sign out.
 */

import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Alert } from "react-native";
import { useState, useEffect, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../shared/components";
import { getDefaultAvatarUrl } from "@trace/core";
import { useAuth } from "../shared/contexts/AuthContext";
import { useNavigate } from "../shared/navigation";
import { useTheme } from "../shared/contexts/ThemeContext";
import { useMobileProfile } from "../shared/hooks/useMobileProfile";
import { useSubscription } from "../shared/hooks/useSubscription";
import { useDevices } from "../modules/devices";
import { useTopLevelCounts } from "../modules/dataManagement";
import { useEntryDerivedPlaces } from "../modules/locations/mobileLocationHooks";
import { useCloudStorageUsage, formatMB } from "@trace/core";
import { themeBase } from "../shared/theme/themeBase";
import { BottomNavBar } from "../components/layout/BottomNavBar";
import { useDrawer } from "../shared/contexts/DrawerContext";

// ─── Menu Row ────────────────────────────────────────────────────────────────

interface MenuRowProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  detail?: string;
  showChevron?: boolean;
  destructive?: boolean;
}

function MenuRow({ icon, label, onPress, detail, showChevron = true, destructive = false }: MenuRowProps) {
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
      {detail && (
        <Text style={[styles.rowDetail, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
          {detail}
        </Text>
      )}
      {showChevron && (
        <Icon name="ChevronRight" size={20} color={theme.colors.text.tertiary} />
      )}
    </TouchableOpacity>
  );
}

// ─── Main Menu Screen ────────────────────────────────────────────────────────

export function AccountScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigate = useNavigate();
  const { viewMode, setViewMode } = useDrawer();
  const { data: devicesList } = useDevices();
  const { user, signOut, isOfflineAuth, isOffline, offlineAccessEnabled } = useAuth();
  const { profile } = useMobileProfile(user?.id);
  const { isPro, isDevMode, expiresAt } = useSubscription();
  const { counts, isLoading: streamsLoading } = useTopLevelCounts();
  const { data: entryDerivedPlaces } = useEntryDerivedPlaces();
  const { storageUsage: cloudStorage } = useCloudStorageUsage();

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

  // Format subscription status — always show actual tier, not dev mode
  const subscriptionLabel = useMemo(() => {
    if (isPro) {
      if (expiresAt) {
        const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysLeft > 0 && daysLeft <= 30) return `Pro (${daysLeft} days)`;
      }
      return "Pro";
    }
    return "Free";
  }, [isPro, expiresAt]);

  const streamDetail = streamsLoading ? undefined : `${counts.streams}`;
  const placeDetail = entryDerivedPlaces != null ? `${entryDerivedPlaces.length}` : undefined;
  const storageDetail = (!isOfflineAuth && cloudStorage != null)
    ? formatMB(
        cloudStorage.active_content_bytes + cloudStorage.active_attachment_bytes +
        cloudStorage.trash_content_bytes + cloudStorage.trash_attachment_bytes
      )
    : undefined;


  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      {/* Branded Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top + themeBase.spacing.md }]}>
        {/* Status badge — same pattern as TopBar */}
        {(isOfflineAuth || (!isOfflineAuth && isOffline)) && (
          <View style={[styles.statusRow, { top: insets.top + 1 }]}>
            {isOfflineAuth ? (
              <View style={[styles.statusBadge, { backgroundColor: theme.colors.functional.accent + '22' }]}>
                <Icon name="Lock" size={10} color={theme.colors.functional.accent} />
                <Text style={[styles.statusBadgeText, { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.semibold }]}>
                  {isOffline ? "Offline · Local Only" : "Local Only"}
                </Text>
              </View>
            ) : (
              <View style={[styles.statusBadge, { backgroundColor: theme.colors.functional.warning }]}>
                <Icon name="WifiOff" size={10} color={theme.colors.functional.warningText} />
                <Text style={[styles.statusBadgeText, { color: theme.colors.functional.warningText, fontFamily: theme.typography.fontFamily.semibold }]}>Offline</Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.headerLeft}>
          <Icon name="TraceLogoColor" size={36} color={theme.colors.text.primary} />
          <Text style={[styles.headerTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]}>
            Trace
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile + Subscription Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          {/* Profile section — taps to profile */}
          <TouchableOpacity
            style={styles.profileSection}
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
                <Text style={[styles.profileSubtext, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                  @{profile.username}
                </Text>
              )}
              {user?.email && (!profile?.name || !profile?.username) && (
                <Text style={[styles.profileSubtext, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]} numberOfLines={1}>
                  {user.email}
                </Text>
              )}
              {isDevMode && (
                <View style={styles.devBadge}>
                  <Icon name="BrainCog" size={12} color={theme.colors.functional.accent} />
                  <Text style={[styles.devBadgeText, { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.medium }]}>
                    Developer
                  </Text>
                </View>
              )}
            </View>
            <Icon name="ChevronRight" size={20} color={theme.colors.text.tertiary} />
          </TouchableOpacity>

          {/* Divider */}
          <View style={[styles.rowDivider, { backgroundColor: theme.colors.border.light }]} />

          {/* Subscription section — taps to subscription */}
          <TouchableOpacity
            style={styles.subscriptionSection}
            onPress={() => navigate("subscription")}
            activeOpacity={0.7}
          >
            <View style={[
              styles.subscriptionBadge,
              { backgroundColor: isPro ? theme.colors.functional.accent : theme.colors.background.tertiary }
            ]}>
              <Icon name="Star" size={16} color={isPro ? "#fff" : theme.colors.text.tertiary} />
            </View>
            <View style={styles.subscriptionInfo}>
              <Text style={[styles.subscriptionLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
                {subscriptionLabel}
              </Text>
              <Text style={[styles.subscriptionDesc, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                {isPro ? "Full access to all features" : "Upgrade for more features"}
              </Text>
            </View>
            <Icon name="ChevronRight" size={20} color={theme.colors.text.tertiary} />
          </TouchableOpacity>

          {/* Upgrade CTA for free users */}
          {!isPro && (
            <TouchableOpacity
              style={[styles.upgradeButton, { backgroundColor: theme.colors.functional.accent }]}
              onPress={() => navigate("subscription")}
              activeOpacity={0.8}
            >
              <Text style={[styles.upgradeButtonText, { fontFamily: theme.typography.fontFamily.semibold }]}>
                Upgrade to Pro
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Local Only Mode Card */}
        {isOfflineAuth && (
          <View style={[styles.card, { backgroundColor: theme.colors.functional.accent + '12', borderWidth: 1, borderColor: theme.colors.functional.accent + '30' }]}>
            <View style={styles.localOnlyCard}>
              <View style={styles.localOnlyHeader}>
                <Icon name="Lock" size={18} color={theme.colors.functional.accent} />
                <Text style={[styles.localOnlyTitle, { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.semibold }]}>
                  Local Only Mode
                </Text>
              </View>
              <Text style={[styles.localOnlyBody, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                You signed in with biometrics. Your notes are available locally, but syncing is paused and cloud features are unavailable until you sign in with your Trace or Google account.
              </Text>
              {!isOffline && (
                <TouchableOpacity
                  style={[styles.localOnlyButton, { backgroundColor: theme.colors.functional.accent }]}
                  onPress={signOut}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.localOnlyButtonText, { fontFamily: theme.typography.fontFamily.semibold }]}>
                    Sign In to Sync
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Content Management Section */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.semibold }]}>
          MANAGE
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          <MenuRow
            icon={<Icon name="Layers" size={22} color={theme.colors.text.secondary} />}
            label="Streams"
            detail={streamDetail}
            onPress={() => navigate("streams")}
          />
          <View style={[styles.rowDivider, { backgroundColor: theme.colors.border.light }]} />
          <MenuRow
            icon={<Icon name="MapPin" size={22} color={theme.colors.text.secondary} />}
            label="Places"
            detail={placeDetail}
            onPress={() => navigate("locations")}
          />
          <View style={[styles.rowDivider, { backgroundColor: theme.colors.border.light }]} />
          <MenuRow
            icon={<Icon name="Smartphone" size={22} color={theme.colors.text.secondary} />}
            label="Devices"
            detail={devicesList ? `${devicesList.filter(d => d.is_active).length}` : undefined}
            onPress={() => navigate("devices")}
          />
          <View style={[styles.rowDivider, { backgroundColor: theme.colors.border.light }]} />
          <MenuRow
            icon={<Icon name="Database" size={22} color={theme.colors.text.secondary} />}
            label="Data"
            detail={storageDetail}
            onPress={() => navigate("data")}
          />
        </View>

        {/* Settings Section */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.semibold }]}>
          PREFERENCES
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          <MenuRow
            icon={<Icon name="Settings" size={22} color={theme.colors.text.secondary} />}
            label="Settings"
            onPress={() => navigate("settings")}
          />
        </View>

        {/* Sign Out */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary, marginTop: themeBase.spacing.xl }, theme.shadows.sm]}>
          <MenuRow
            icon={<Icon name="LogOut" size={22} color={theme.colors.functional.overdue} />}
            label="Sign Out"
            onPress={() => {
              if (isOffline && !offlineAccessEnabled) {
                Alert.alert(
                  "Sign Out While Offline?",
                  "You're offline and don't have Biometric Access enabled. You'll need internet to sign back in.\n\nEnable Biometric Access in your profile to allow offline sign-in.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Sign Out Anyway", style: "destructive", onPress: signOut },
                  ]
                );
              } else if (isOffline) {
                Alert.alert(
                  "Sign Out?",
                  "You're offline. You can sign back in using Face ID or fingerprint.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Sign Out", style: "destructive", onPress: signOut },
                  ]
                );
              } else {
                signOut();
              }
            }}
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

      <BottomNavBar
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          setViewMode(mode);
          const screenMap = { list: "allEntries", map: "map", calendar: "calendar" } as const;
          navigate(screenMap[mode]);
        }}
        onAddPress={() => {}}
        onMenuPress={() => {}}
        isMenuActive
        hideFab
      />
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
    paddingHorizontal: themeBase.spacing.lg,
    paddingBottom: 16,
  },
  statusRow: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  statusBadgeText: {
    fontSize: 10,
  },
  localOnlyCard: {
    padding: 16,
    gap: 10,
  },
  localOnlyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  localOnlyTitle: {
    fontSize: 15,
  },
  localOnlyBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  localOnlyButton: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  localOnlyButtonText: {
    color: "#fff",
    fontSize: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 28,
  },
  content: {
    flex: 1,
    padding: themeBase.spacing.lg,
  },
  card: {
    borderRadius: 12,
    marginBottom: themeBase.spacing.lg,
    overflow: "hidden",
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    padding: themeBase.spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  profileInfo: {
    flex: 1,
    marginLeft: themeBase.spacing.md,
  },
  profileName: {
    fontSize: 17,
  },
  profileSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  devBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  devBadgeText: {
    fontSize: 12,
    lineHeight: 16,
  },
  subscriptionSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.lg,
  },
  subscriptionBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  subscriptionInfo: {
    flex: 1,
    marginLeft: themeBase.spacing.md,
  },
  subscriptionLabel: {
    fontSize: 15,
  },
  subscriptionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  upgradeButton: {
    marginHorizontal: themeBase.spacing.lg,
    marginBottom: themeBase.spacing.md,
    paddingVertical: themeBase.spacing.sm,
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
  rowDetail: {
    fontSize: 14,
    marginRight: themeBase.spacing.xs,
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
  offlineAccessRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  offlineAccessLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  offlineAccessText: {
    flex: 1,
    gap: 2,
  },
  offlineAccessLabel: {
    fontSize: 16,
  },
  offlineAccessDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
});
