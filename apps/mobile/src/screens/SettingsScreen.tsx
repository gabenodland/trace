import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from "react-native";
import { useState } from "react";
import Svg, { Path } from "react-native-svg";
import { getAppVersion, getBuildNumber } from "../config/appVersionService";
import { useSettings } from "../shared/contexts/SettingsContext";
import { useTheme } from "../shared/contexts/ThemeContext";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { UnitSystemSelector } from "../components/settings/UnitSystemSelector";
import { ImageQualitySelector } from "../components/settings/ImageQualitySelector";
import { ThemeSelector } from "../components/settings/ThemeSelector";
import { FontSelector } from "../components/settings/FontSelector";
import { UNIT_OPTIONS, IMAGE_QUALITY_OPTIONS } from "@trace/core";
import { getThemeOptions } from "../shared/theme/themes";
import { getFontOptions } from "../shared/theme/fonts";

export function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const theme = useTheme();

  const [showUnitSelector, setShowUnitSelector] = useState(false);
  const [showImageQualitySelector, setShowImageQualitySelector] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [showFontSelector, setShowFontSelector] = useState(false);

  // Get labels for current settings
  const unitLabel = UNIT_OPTIONS.find(u => u.value === settings.units)?.label || 'Metric';
  const imageQualityLabel = IMAGE_QUALITY_OPTIONS.find(q => q.value === settings.imageQuality)?.label || 'Standard';
  const themeLabel = getThemeOptions().find(t => t.id === settings.theme)?.name || 'Light';
  const fontLabel = getFontOptions().find(f => f.id === settings.font)?.name || 'Inter';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader title="Settings" />

      <ScrollView style={styles.content}>
        {/* Entry Settings */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>Entry</Text>

          <View style={[styles.settingRow, { borderBottomWidth: 0, borderBottomColor: theme.colors.border.light }]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Capture GPS Location</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
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
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>Display</Text>

          {/* Theme */}
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}
            onPress={() => setShowThemeSelector(true)}
            activeOpacity={0.7}
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Theme</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                Choose your preferred color scheme
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={[styles.settingValueText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>{themeLabel}</Text>
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

          {/* Font */}
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}
            onPress={() => setShowFontSelector(true)}
            activeOpacity={0.7}
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Font</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                Choose your preferred typeface
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={[styles.settingValueText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>{fontLabel}</Text>
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
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Distance Units</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                Display distances in metric or imperial
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={[styles.settingValueText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>{unitLabel}</Text>
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
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>Storage</Text>

          <TouchableOpacity
            style={[styles.settingRow, { borderBottomWidth: 0, borderBottomColor: theme.colors.border.light }]}
            onPress={() => setShowImageQualitySelector(true)}
            activeOpacity={0.7}
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Photo Quality</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                Compression level for photos. Higher quality uses more storage.
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={[styles.settingValueText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>{imageQualityLabel}</Text>
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

        {/* About Section */}
        <View style={styles.aboutSection}>
          <Text style={[styles.aboutText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
            Trace v{getAppVersion()} (build {getBuildNumber() || '1'})
          </Text>
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

      {/* Font Selector */}
      <FontSelector
        visible={showFontSelector}
        selectedFont={settings.font}
        onSelect={(font) => updateSettings({ font })}
        onClose={() => setShowFontSelector(false)}
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
    // Note: fontWeight removed - use fontFamily with weight variant instead
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
    // Note: fontWeight removed - use fontFamily with weight variant instead
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
  aboutSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingBottom: 40,
  },
  aboutText: {
    fontSize: 13,
  },
});
