import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Linking, Alert } from "react-native";
import { useState, useEffect } from "react";
import { Icon } from "../shared/components";
import { getAppVersion, getBuildNumber } from "../config/appVersionService";
import { useSettings } from "../shared/contexts/SettingsContext";
import { useTheme } from "../shared/contexts/ThemeContext";
import { useNavigate } from "../shared/navigation";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { UnitSystemSelector } from "../components/settings/UnitSystemSelector";
import { ImageQualitySelector } from "../components/settings/ImageQualitySelector";
import { ThemeSelector } from "../components/settings/ThemeSelector";
import { FontSelector } from "../components/settings/FontSelector";
import { UNIT_OPTIONS, IMAGE_QUALITY_OPTIONS } from "@trace/core";
import { getThemeOptions } from "../shared/theme/themes";
import { getFontOptions } from "../shared/theme/fonts";
import { logger } from "../shared/utils/logger";
import { ApiKeysSection } from "../modules/settings/components/ApiKeysSection";

export function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const theme = useTheme();
  const navigate = useNavigate();

  const [showUnitSelector, setShowUnitSelector] = useState(false);
  const [showImageQualitySelector, setShowImageQualitySelector] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [showFontSelector, setShowFontSelector] = useState(false);

  // Debug mode state
  const [debugModeEnabled, setDebugModeEnabled] = useState(logger.isDebugModeEnabled());
  const [logBufferSize, setLogBufferSize] = useState(logger.getBufferSize());

  // Sync debug mode state with logger on mount
  useEffect(() => {
    setDebugModeEnabled(logger.isDebugModeEnabled());
    setLogBufferSize(logger.getBufferSize());
  }, []);

  // Handle debug mode toggle
  const handleDebugModeToggle = async (enabled: boolean) => {
    setDebugModeEnabled(enabled);
    await logger.setDebugMode(enabled);
    setLogBufferSize(logger.getBufferSize());
  };

  // Handle export logs
  const handleExportLogs = async () => {
    const bufferSize = logger.getBufferSize();
    if (bufferSize === 0) {
      Alert.alert('No Logs', 'There are no logs to export. Enable debug mode and use the app to generate logs.');
      return;
    }
    await logger.shareLogs();
  };

  // Handle clear logs
  const handleClearLogs = () => {
    Alert.alert(
      'Clear Debug Logs',
      `Are you sure you want to clear ${logBufferSize} log entries?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            logger.clearBuffer();
            setLogBufferSize(0);
          },
        },
      ]
    );
  };

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
              <Icon name="ChevronRight" size={16} color={theme.colors.text.tertiary} />
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
              <Icon name="ChevronRight" size={16} color={theme.colors.text.tertiary} />
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
              <Icon name="ChevronRight" size={16} color={theme.colors.text.tertiary} />
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
              <Icon name="ChevronRight" size={16} color={theme.colors.text.tertiary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Integrations Section - API Keys for MCP */}
        <ApiKeysSection />

        {/* Legal Section */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>Legal</Text>

          {/* Privacy Policy */}
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}
            onPress={() => Linking.openURL('https://www.mindjig.com/privacy.html')}
            activeOpacity={0.7}
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Privacy Policy</Text>
            </View>
            <View style={styles.settingValue}>
              <Icon name="ExternalLink" size={16} color={theme.colors.text.tertiary} />
            </View>
          </TouchableOpacity>

          {/* Terms of Service */}
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomWidth: 0, borderBottomColor: theme.colors.border.light }]}
            onPress={() => Linking.openURL('https://www.mindjig.com/terms.html')}
            activeOpacity={0.7}
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Terms of Service</Text>
            </View>
            <View style={styles.settingValue}>
              <Icon name="ExternalLink" size={16} color={theme.colors.text.tertiary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>About</Text>

          {/* Database Info */}
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}
            onPress={() => navigate("debug")}
            activeOpacity={0.7}
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Database Info</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                View sync status and database statistics
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Icon name="ChevronRight" size={16} color={theme.colors.text.tertiary} />
            </View>
          </TouchableOpacity>

          {/* Version Info */}
          <View style={[styles.settingRow, { borderBottomWidth: 0, borderBottomColor: theme.colors.border.light }]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Version</Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={[styles.settingValueText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                {getAppVersion()} ({getBuildNumber() || '1'}){__DEV__ ? ' dev' : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Developer Section */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>Developer</Text>

          {/* Debug Mode Toggle */}
          <View style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Debug Mode</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                {__DEV__
                  ? 'Always enabled in development builds.'
                  : 'Enable verbose logging for troubleshooting. Logs can be exported for bug reports.'}
              </Text>
            </View>
            <Switch
              value={__DEV__ ? true : debugModeEnabled}
              onValueChange={handleDebugModeToggle}
              disabled={__DEV__}
              trackColor={{ false: theme.colors.border.dark, true: theme.colors.functional.accent }}
              thumbColor="#ffffff"
            />
          </View>

          {/* Export Logs Button */}
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}
            onPress={handleExportLogs}
            activeOpacity={0.7}
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Export Debug Logs</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                Share logs via email or other apps for support
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={[styles.settingValueText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                {logBufferSize} entries
              </Text>
              <Icon name="ExternalLink" size={16} color={theme.colors.text.tertiary} />
            </View>
          </TouchableOpacity>

          {/* Clear Logs Button */}
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}
            onPress={handleClearLogs}
            activeOpacity={0.7}
            disabled={logBufferSize === 0}
          >
            <View style={styles.settingContent}>
              <Text style={[
                styles.settingLabel,
                { color: logBufferSize > 0 ? theme.colors.functional.overdue : theme.colors.text.disabled, fontFamily: theme.typography.fontFamily.medium }
              ]}>Clear Debug Logs</Text>
            </View>
            <View style={styles.settingValue}>
              <Icon name="Trash2" size={16} color={logBufferSize > 0 ? theme.colors.functional.overdue : theme.colors.text.disabled} />
            </View>
          </TouchableOpacity>

          {/* Editor Test (Layer 1 - Plain WebView) */}
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}
            onPress={() => navigate("editorTest")}
            activeOpacity={0.7}
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Editor Test (L1)</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                Plain WebView - no TenTap
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Icon name="ChevronRight" size={16} color={theme.colors.text.tertiary} />
            </View>
          </TouchableOpacity>

          {/* TenTap Test (Layer 2 - TenTap Bridge) */}
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}
            onPress={() => navigate("tenTapTest")}
            activeOpacity={0.7}
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>TenTap Test (L2)</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                EditorWebBridge - single instance
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Icon name="ChevronRight" size={16} color={theme.colors.text.tertiary} />
            </View>
          </TouchableOpacity>

          {/* RichTextEditorV2 Test (Layer 3) */}
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomColor: theme.colors.border.light }]}
            onPress={() => navigate("editorV2Test")}
            activeOpacity={0.7}
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>RichTextEditor V2 (L3)</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                Full editor with onChange
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Icon name="ChevronRight" size={16} color={theme.colors.text.tertiary} />
            </View>
          </TouchableOpacity>

          {/* Data Fetch Test */}
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomWidth: 0, borderBottomColor: theme.colors.border.light }]}
            onPress={() => navigate("dataFetchTest")}
            activeOpacity={0.7}
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>Data Fetch Test</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                Test SQLite query timing
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Icon name="ChevronRight" size={16} color={theme.colors.text.tertiary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Bottom padding */}
        <View style={{ height: 20 }} />
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
