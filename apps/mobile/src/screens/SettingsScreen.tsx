import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from "react-native";
import { useState } from "react";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { useSettings } from "../shared/contexts/SettingsContext";
import { TopBar } from "../components/layout/TopBar";
import { UnitSystemSelector } from "../components/settings/UnitSystemSelector";
import { ImageQualitySelector } from "../components/settings/ImageQualitySelector";
import { UNIT_OPTIONS, IMAGE_QUALITY_OPTIONS } from "@trace/core";

export function SettingsScreen() {
  const { navigate } = useNavigation();
  const { menuItems, userEmail, displayName, avatarUrl, onProfilePress } = useNavigationMenu();
  const { settings, updateSettings } = useSettings();

  const [showUnitSelector, setShowUnitSelector] = useState(false);
  const [showImageQualitySelector, setShowImageQualitySelector] = useState(false);

  // Get labels for current settings
  const unitLabel = UNIT_OPTIONS.find(u => u.value === settings.units)?.label || 'Metric';
  const imageQualityLabel = IMAGE_QUALITY_OPTIONS.find(q => q.value === settings.imageQuality)?.label || 'Standard';

  return (
    <View style={styles.container}>
      <TopBar
        title="Settings"
        menuItems={menuItems}
        userEmail={userEmail}
        displayName={displayName}
        avatarUrl={avatarUrl}
        onProfilePress={onProfilePress}
      />

      <ScrollView style={styles.content}>
        {/* Entry Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Entry</Text>

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

        {/* Display Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Display</Text>

          <TouchableOpacity
            style={[styles.settingRow, { borderBottomWidth: 0 }]}
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
        </View>

        {/* Storage Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Storage</Text>

          <TouchableOpacity
            style={[styles.settingRow, { borderBottomWidth: 0 }]}
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
        </View>
      </ScrollView>

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
});
