/**
 * Theme Selector - Modal for choosing app theme
 *
 * Shows available themes with color preview swatches.
 * Pro themes are gated - free users see them but can't select.
 */

import { View, Text, TouchableOpacity, StyleSheet, Modal, SafeAreaView, ScrollView, Alert } from 'react-native';
import { getThemeOptions } from '../../shared/theme/themes';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { useNavigate } from '../../shared/navigation';
import { useSubscription } from '../../shared/hooks/useSubscription';
import { Icon } from '../../shared/components';

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
  const navigate = useNavigate();
  const { isPro } = useSubscription();
  const themeOptions = getThemeOptions();

  const handleSelect = (themeId: string, isProTheme: boolean) => {
    // If it's a Pro theme and user doesn't have Pro, show upgrade prompt
    if (isProTheme && !isPro) {
      Alert.alert(
        'Pro Theme',
        'This theme is available with a Pro subscription. Upgrade to unlock all themes.',
        [
          { text: 'Maybe Later', style: 'cancel' },
          { text: 'Learn More', onPress: () => {
            onClose();
            navigate('subscription');
          }},
        ]
      );
      return;
    }

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
          <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>Theme</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="X" size={24} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Options */}
        <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
          {themeOptions.map((option) => {
            const isLocked = option.isPro && !isPro;
            const isSelected = selectedTheme === option.id;

            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionItem,
                  { backgroundColor: theme.colors.background.primary },
                  isSelected && [styles.optionItemSelected, { borderColor: theme.colors.functional.accent, backgroundColor: theme.colors.functional.accentLight }],
                  isLocked && styles.optionItemLocked,
                ]}
                onPress={() => handleSelect(option.id, !!option.isPro)}
                activeOpacity={0.7}
              >
                {/* Color preview swatches */}
                <View style={styles.previewContainer}>
                  <View
                    style={[
                      styles.previewSwatch,
                      { backgroundColor: option.preview.background, borderColor: theme.colors.border.light },
                      isLocked && styles.previewSwatchLocked,
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

                {/* Label, description, and Pro badge */}
                <View style={styles.optionContent}>
                  <View style={styles.labelRow}>
                    <Text style={[
                      styles.optionLabel,
                      { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold },
                      isSelected && { color: theme.colors.functional.accent },
                      isLocked && { color: theme.colors.text.secondary },
                    ]}>
                      {option.name}
                    </Text>
                    {option.isPro && (
                      <View style={[
                        styles.proBadge,
                        { backgroundColor: isPro ? theme.colors.functional.accent : theme.colors.text.tertiary }
                      ]}>
                        <Text style={[styles.proBadgeText, { fontFamily: theme.typography.fontFamily.semibold }]}>PRO</Text>
                      </View>
                    )}
                  </View>
                  {option.description && (
                    <Text style={[
                      styles.optionDescription,
                      { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular },
                      isLocked && { color: theme.colors.text.tertiary },
                    ]}>
                      {option.description}
                    </Text>
                  )}
                </View>

                {/* Checkmark or Lock icon */}
                {isSelected ? (
                  <Icon name="Check" size={24} color={theme.colors.functional.accent} />
                ) : isLocked ? (
                  <Icon name="Lock" size={20} color={theme.colors.text.tertiary} />
                ) : null}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 20 }} />
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
  },
  closeButton: {
    padding: 4,
  },
  optionsList: {
    flex: 1,
    padding: 20,
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
    borderWidth: 2,
  },
  optionItemLocked: {
    opacity: 0.8,
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
  },
  previewSwatchLocked: {
    opacity: 0.7,
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  optionLabel: {
    fontSize: 16,
  },
  proBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  optionDescription: {
    fontSize: 14,
  },
});
