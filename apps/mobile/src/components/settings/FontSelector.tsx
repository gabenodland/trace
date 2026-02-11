/**
 * Font Selector - Modal for choosing app font
 *
 * Shows available fonts with sample text preview.
 * Pro fonts are gated - free users see them but can't select.
 */

import { View, Text, TouchableOpacity, StyleSheet, Modal, SafeAreaView, ScrollView, Alert } from 'react-native';
import { getFontOptions } from '../../shared/theme/fonts';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { useNavigate } from '../../shared/navigation';
import { useSubscription } from '../../shared/hooks/useSubscription';
import { Icon } from '../../shared/components';

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
    // If it's a Pro font and user doesn't have Pro, show upgrade prompt
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
            <Icon name="X" size={24} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Options */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.optionsList}
          showsVerticalScrollIndicator={true}
        >
          {fontOptions.map((option) => {
            const isLocked = option.isPro && !isPro;
            const isSelected = selectedFont === option.id;

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
  optionItemLocked: {
    opacity: 0.8,
  },
  previewContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 16,
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
    // Note: fontWeight removed - use fontFamily with weight variant instead
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
