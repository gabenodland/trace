import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from "react-native";
import { useAuth } from "../shared/contexts/AuthContext";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { useSettings } from "../shared/contexts/SettingsContext";
import { TopBar } from "../components/layout/TopBar";
import { UnsavedChangesBehaviorSelector } from "../components/settings/UnsavedChangesBehaviorSelector";
import { UnitSystemSelector } from "../components/settings/UnitSystemSelector";
import { ImageQualitySelector } from "../components/settings/ImageQualitySelector";
import Svg, { Path } from "react-native-svg";
import { useSync } from "../shared/sync";
import { useState } from "react";
import { createScopedLogger } from "../shared/utils/logger";
import { UNSAVED_CHANGES_BEHAVIOR_OPTIONS, UNIT_OPTIONS, IMAGE_QUALITY_OPTIONS } from "@trace/core";

const log = createScopedLogger('ProfileScreen');

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { navigate } = useNavigation();
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();
  const { settings, updateSettings } = useSettings();
  const { sync } = useSync();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showBehaviorSelector, setShowBehaviorSelector] = useState(false);
  const [showUnitSelector, setShowUnitSelector] = useState(false);
  const [showImageQualitySelector, setShowImageQualitySelector] = useState(false);

  // Get labels for current settings
  const behaviorLabel = UNSAVED_CHANGES_BEHAVIOR_OPTIONS.find(b => b.value === settings.unsavedChangesBehavior)?.label || 'Ask';
  const unitLabel = UNIT_OPTIONS.find(u => u.value === settings.units)?.label || 'Metric';
  const imageQualityLabel = IMAGE_QUALITY_OPTIONS.find(q => q.value === settings.imageQuality)?.label || 'Standard';

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      log.info('Syncing before sign out');

      // Try to sync all unsaved changes before signing out
      await sync();

      log.success('Sync complete, signing out');
      await signOut();
    } catch (error) {
      log.error('Error during sign out', error);

      // Ask user if they still want to sign out despite sync failure
      Alert.alert(
        'Sync Failed',
        'Could not sync your changes. Sign out anyway? Unsaved changes may be lost.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setIsSigningOut(false),
          },
          {
            text: 'Sign Out Anyway',
            style: 'destructive',
            onPress: async () => {
              await signOut();
              setIsSigningOut(false);
            },
          },
        ]
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <View style={styles.container}>
      <TopBar
        title="Profile"
        menuItems={menuItems}
        userEmail={userEmail}
        onProfilePress={onProfilePress}
      />

      <ScrollView style={styles.content}>
        {/* User Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Information</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email || "Not available"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>User ID</Text>
            <Text style={styles.infoValue}>{user?.id || "Not available"}</Text>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Settings</Text>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setShowBehaviorSelector(true)}
            activeOpacity={0.7}
          >
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Unsaved Changes</Text>
              <Text style={styles.settingDescription}>
                What to do when leaving an entry with unsaved changes
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={styles.settingValueText}>{behaviorLabel}</Text>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M9 18l6-6-6-6"
                  stroke="#9ca3af"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setShowUnitSelector(true)}
            activeOpacity={0.7}
          >
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Distance Units</Text>
              <Text style={styles.settingDescription}>
                Display distances in metric or imperial
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={styles.settingValueText}>{unitLabel}</Text>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M9 18l6-6-6-6"
                  stroke="#9ca3af"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setShowImageQualitySelector(true)}
            activeOpacity={0.7}
          >
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Photo Quality</Text>
              <Text style={styles.settingDescription}>
                Compression level for photos. Higher quality uses more storage.
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={styles.settingValueText}>{imageQualityLabel}</Text>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M9 18l6-6-6-6"
                  stroke="#9ca3af"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </TouchableOpacity>

          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Capture GPS Location</Text>
              <Text style={styles.settingDescription}>
                Automatically capture your GPS coordinates when creating new entries
              </Text>
            </View>
            <Switch
              value={settings.captureGpsLocation}
              onValueChange={(value) => updateSettings({ captureGpsLocation: value })}
              trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.signOutButton, isSigningOut && styles.signOutButtonDisabled]}
          onPress={handleSignOut}
          activeOpacity={0.7}
          disabled={isSigningOut}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
            <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.signOutText}>
            {isSigningOut ? "Syncing & Signing Out..." : "Sign Out"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Unsaved Changes Behavior Selector */}
      <UnsavedChangesBehaviorSelector
        visible={showBehaviorSelector}
        selectedBehavior={settings.unsavedChangesBehavior}
        onSelect={(behavior) => updateSettings({ unsavedChangesBehavior: behavior })}
        onClose={() => setShowBehaviorSelector(false)}
      />

      {/* Unit System Selector */}
      <UnitSystemSelector
        visible={showUnitSelector}
        selectedUnit={settings.units}
        onSelect={(units) => updateSettings({ units })}
        onClose={() => setShowUnitSelector(false)}
      />

      {/* Image Quality Selector */}
      <ImageQualitySelector
        visible={showImageQualitySelector}
        selectedQuality={settings.imageQuality}
        onSelect={(imageQuality) => updateSettings({ imageQuality })}
        onClose={() => setShowImageQualitySelector(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  cardDescription: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  settingContent: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1f2937",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
  },
  settingValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  settingValueText: {
    fontSize: 14,
    color: "#6b7280",
  },
  infoRow: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: "#1f2937",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#ef4444",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 40,
  },
  signOutButtonDisabled: {
    backgroundColor: "#9ca3af",
    opacity: 0.7,
  },
  signOutText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
