/**
 * Theme Selector - Modal for choosing app theme
 *
 * Shows available themes with color preview swatches.
 */

import { View, Text, TouchableOpacity, StyleSheet, Modal, SafeAreaView } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { getThemeOptions } from '../../shared/theme/themes';
import { useTheme } from '../../shared/contexts/ThemeContext';

interface ThemeSelectorProps {
  visible: boolean;
  selectedTheme: string;
  onSelect: (themeId: string) => void;
  onClose: () => void;
}

export function ThemeSelector({
  visible,
  selectedTheme,
  onSelect,
  onClose,
}: ThemeSelectorProps) {
  const theme = useTheme();
  const themeOptions = getThemeOptions();

  const handleSelect = (themeId: string) => {
    onSelect(themeId);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.background.primary, borderBottomColor: theme.colors.border.light }]}>
          <Text style={[styles.title, { color: theme.colors.text.primary }]}>Theme</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.secondary} strokeWidth={2}>
              <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Options */}
        <View style={styles.optionsList}>
          {themeOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionItem,
                { backgroundColor: theme.colors.background.primary },
                selectedTheme === option.id && [styles.optionItemSelected, { borderColor: theme.colors.functional.accent, backgroundColor: theme.colors.functional.accentLight }],
              ]}
              onPress={() => handleSelect(option.id)}
              activeOpacity={0.7}
            >
              {/* Color preview swatches */}
              <View style={styles.previewContainer}>
                <View
                  style={[
                    styles.previewSwatch,
                    { backgroundColor: option.preview.background, borderColor: theme.colors.border.light },
                  ]}
                >
                  <View
                    style={[
                      styles.previewText,
                      { backgroundColor: option.preview.text },
                    ]}
                  />
                  <View
                    style={[
                      styles.previewAccent,
                      { backgroundColor: option.preview.accent },
                    ]}
                  />
                </View>
              </View>

              {/* Label and description */}
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionLabel,
                  { color: theme.colors.text.primary },
                  selectedTheme === option.id && { color: theme.colors.functional.accent },
                ]}>
                  {option.name}
                </Text>
                {option.description && (
                  <Text style={[styles.optionDescription, { color: theme.colors.text.secondary }]}>{option.description}</Text>
                )}
              </View>

              {/* Checkmark */}
              {selectedTheme === option.id && (
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={theme.colors.functional.accent} strokeWidth={2}>
                  <Path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 4,
  },
  optionsList: {
    padding: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionItemSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  previewContainer: {
    marginRight: 16,
  },
  previewSwatch: {
    width: 48,
    height: 48,
    borderRadius: 8,
    padding: 8,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  previewBackground: {
    // backgroundColor set dynamically
  },
  previewText: {
    width: 24,
    height: 4,
    borderRadius: 2,
  },
  previewAccent: {
    width: 16,
    height: 4,
    borderRadius: 2,
  },
  optionContent: {
    flex: 1,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  optionLabelSelected: {
    color: '#2563eb',
  },
  optionDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
});
