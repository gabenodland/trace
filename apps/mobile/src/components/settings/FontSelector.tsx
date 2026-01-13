/**
 * Font Selector - Modal for choosing app font
 *
 * Shows available fonts with sample text preview.
 */

import { View, Text, TouchableOpacity, StyleSheet, Modal, SafeAreaView, ScrollView } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { getFontOptions } from '../../shared/theme/fonts';
import { useTheme } from '../../shared/contexts/ThemeContext';

interface FontSelectorProps {
  visible: boolean;
  selectedFont: string;
  onSelect: (fontId: string) => void;
  onClose: () => void;
}

export function FontSelector({
  visible,
  selectedFont,
  onSelect,
  onClose,
}: FontSelectorProps) {
  const theme = useTheme();
  const fontOptions = getFontOptions();

  const handleSelect = (fontId: string) => {
    onSelect(fontId);
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
          <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>Font</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.secondary} strokeWidth={2}>
              <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Options */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.optionsList}
          showsVerticalScrollIndicator={true}
        >
          {fontOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionItem,
                { backgroundColor: theme.colors.background.primary },
                selectedFont === option.id && [styles.optionItemSelected, { borderColor: theme.colors.functional.accent, backgroundColor: theme.colors.functional.accentLight }],
              ]}
              onPress={() => handleSelect(option.id)}
              activeOpacity={0.7}
            >
              {/* Font preview */}
              <View style={styles.previewContainer}>
                <Text style={[styles.previewText, { fontFamily: option.previewFont, color: theme.colors.text.primary }]}>
                  Aa
                </Text>
              </View>

              {/* Label and description */}
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionLabel,
                  { color: theme.colors.text.primary, fontFamily: option.previewFont },
                  selectedFont === option.id && { color: theme.colors.functional.accent },
                ]}>
                  {option.name}
                </Text>
                {option.description && (
                  <Text style={[styles.optionDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>{option.description}</Text>
                )}
              </View>

              {/* Checkmark */}
              {selectedFont === option.id && (
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={theme.colors.functional.accent} strokeWidth={2}>
                  <Path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    // Note: fontWeight removed - use fontFamily with weight variant instead
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  optionsList: {
    padding: 20,
    paddingBottom: 40,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionItemSelected: {
    // borderColor and backgroundColor set inline with theme
  },
  previewContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    fontSize: 24,
  },
  optionContent: {
    flex: 1,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 16,
    // Note: fontWeight removed - use fontFamily with weight variant instead
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 14,
  },
});
