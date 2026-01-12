import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from "react-native";
import { useState } from "react";
import Svg, { Path } from "react-native-svg";
import { useSettings } from "../shared/contexts/SettingsContext";
import { useTheme } from "../shared/contexts/ThemeContext";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { UnitSystemSelector } from "../components/settings/UnitSystemSelector";
import { ImageQualitySelector } from "../components/settings/ImageQualitySelector";
import { ThemeSelector } from "../components/settings/ThemeSelector";
import { UNIT_OPTIONS, IMAGE_QUALITY_OPTIONS } from "@trace/core";
import { getThemeOptions } from "../shared/theme/themes";

export function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const theme = useTheme();

  const [showUnitSelector, setShowUnitSelector] = useState(false);
  const [showImageQualitySelector, setShowImageQualitySelector] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  // Get labels for current settings
  const unitLabel = UNIT_OPTIONS.find(u => u.value === settings.units)?.label || 'Metric';
  const imageQualityLabel = IMAGE_QUALITY_OPTIONS.find(q => q.value === settings.imageQuality)?.label || 'Standard';
  const themeLabel = getThemeOptions().find(t => t.id === settings.theme)?.name || 'Light';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader title="Settings" />

      <ScrollView style={styles.content}>
        {/* Entry Settings */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Entry</Text>

          <View style={[styles.settingRow, { borderBottomWidth: 0, borderBottomColor: theme.colors.border.light }]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary }]}>Capture GPS Location</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.text.secondary }]}>
                Automatically capture your GPS coordinates when creating new entries
              </Text>
            </View>
            <Switch
              value={settings.captureGpsLocation}
              onValueChange={(value) => updateSettings({ captureGpsLocation: value })}
              trackColor={{ false: theme.colors.border.dark, true: theme.colors.functional.accent }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Display Settings */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Display</Text>

          {/* Theme */}
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}
            onPress={() => setShowThemeSelector(true)}
            activeOpacity={0.7}
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary }]}>Theme</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.text.secondary }]}>
                Choose your preferred color scheme
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={[styles.settingValueText, { color: theme.colors.text.secondary }]}>{themeLabel}</Text>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M9 18l6-6-6-6"
                  stroke={theme.colors.text.tertiary}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </TouchableOpacity>

          {/* Distance Units */}
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomWidth: 0, borderBottomColor: theme.colors.border.light }]}
            onPress={() => setShowUnitSelector(true)}
            activeOpacity={0.7}
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary }]}>Distance Units</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.text.secondary }]}>
                Display distances in metric or imperial
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={[styles.settingValueText, { color: theme.colors.text.secondary }]}>{unitLabel}</Text>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M9 18l6-6-6-6"
                  stroke={theme.colors.text.tertiary}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </TouchableOpacity>
        </View>

        {/* Storage Settings */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Storage</Text>

          <TouchableOpacity
            style={[styles.settingRow, { borderBottomWidth: 0, borderBottomColor: theme.colors.border.light }]}
            onPress={() => setShowImageQualitySelector(true)}
            activeOpacity={0.7}
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary }]}>Photo Quality</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.text.secondary }]}>
                Compression level for photos. Higher quality uses more storage.
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={[styles.settingValueText, { color: theme.colors.text.secondary }]}>{imageQualityLabel}</Text>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M9 18l6-6-6-6"
                  stroke={theme.colors.text.tertiary}
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

      {/* Theme Selector */}
      <ThemeSelector
        visible={showThemeSelector}
        selectedTheme={settings.theme}
        onSelect={(theme) => updateSettings({ theme })}
        onClose={() => setShowThemeSelector(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingContent: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  settingValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  settingValueText: {
    fontSize: 14,
  },
});
