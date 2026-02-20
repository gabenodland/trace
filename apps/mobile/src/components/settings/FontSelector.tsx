/**
 * Font Selector - Bottom sheet for choosing app font
 *
 * Shows available fonts with sample text preview.
 * Pro fonts are gated - free users see them but can't select.
 */

import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { getFontOptions } from '../../shared/theme/fonts';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { useNavigate } from '../../shared/navigation';
import { useSubscription } from '../../shared/hooks/useSubscription';
import { Icon } from '../../shared/components';
import { PickerBottomSheet } from '../sheets/PickerBottomSheet';
import { themeBase } from '../../shared/theme/themeBase';

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
  const navigate = useNavigate();
  const { isPro } = useSubscription();
  const fontOptions = getFontOptions();

  const handleSelect = (fontId: string, isProFont: boolean) => {
    if (isProFont && !isPro) {
      Alert.alert(
        'Pro Font',
        'This font is available with a Pro subscription. Upgrade to unlock all fonts.',
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

    onSelect(fontId);
    onClose();
  };

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Font"
      height="large"
      swipeArea="grabber"
    >
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <View style={styles.optionsList}>
          {fontOptions.map((option) => {
            const isLocked = option.isPro && !isPro;
            const isSelected = selectedFont === option.id;

            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionItem,
                  { backgroundColor: theme.colors.background.primary },
                  isSelected && { borderColor: theme.colors.functional.accent, backgroundColor: theme.colors.functional.accentLight },
                  isLocked && styles.optionItemLocked,
                ]}
                onPress={() => handleSelect(option.id, !!option.isPro)}
                activeOpacity={0.7}
              >
                {/* Font preview */}
                <View style={[styles.previewContainer, isLocked && styles.previewContainerLocked]}>
                  <Text style={[
                    styles.previewText,
                    { fontFamily: option.previewFont, color: theme.colors.text.primary },
                    isLocked && { color: theme.colors.text.secondary },
                  ]}>
                    Aa
                  </Text>
                </View>

                {/* Label, description, and Pro badge */}
                <View style={styles.optionContent}>
                  <View style={styles.labelRow}>
                    <Text style={[
                      styles.optionLabel,
                      { color: theme.colors.text.primary, fontFamily: option.previewFont },
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
        </View>
      </ScrollView>
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  optionsList: {
    gap: themeBase.spacing.md,
    paddingBottom: themeBase.spacing.lg,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: themeBase.spacing.lg,
    borderRadius: themeBase.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionItemLocked: {
    opacity: 0.8,
  },
  previewContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: themeBase.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainerLocked: {
    opacity: 0.7,
  },
  previewText: {
    fontSize: 24,
  },
  optionContent: {
    flex: 1,
    marginRight: themeBase.spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  optionLabel: {
    fontSize: themeBase.typography.fontSize.base,
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
    fontSize: themeBase.typography.fontSize.sm,
  },
});
