/**
 * Image Quality Selector - Bottom sheet for choosing photo compression quality
 *
 * Pro qualities (full, high) are gated - free users see them but can't select.
 */

import { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { type ImageQuality, IMAGE_QUALITY_OPTIONS } from '@trace/core';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { useNavigate } from '../../shared/navigation';
import { useSubscription } from '../../shared/hooks/useSubscription';
import { Icon } from '../../shared/components';
import { PickerBottomSheet } from '../sheets/PickerBottomSheet';
import { themeBase } from '../../shared/theme/themeBase';

interface ImageQualitySelectorProps {
  visible: boolean;
  selectedQuality: ImageQuality;
  onSelect: (quality: ImageQuality) => void;
  onClose: () => void;
}

export function ImageQualitySelector({
  visible,
  selectedQuality,
  onSelect,
  onClose,
}: ImageQualitySelectorProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const { hasFeature } = useSubscription();
  const canUseProQualities = hasFeature('highQualityImages');

  const handleSelect = useCallback((quality: ImageQuality, isProOption: boolean) => {
    if (isProOption && !canUseProQualities) {
      Alert.alert(
        'Pro Feature',
        'High quality photos are available with a Pro subscription. Upgrade to unlock all quality options.',
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

    onSelect(quality);
    onClose();
  }, [canUseProQualities, onSelect, onClose, navigate]);

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Photo Quality"
      height="auto"
    >
      <View style={styles.optionsList}>
        {IMAGE_QUALITY_OPTIONS.map((option) => {
          const isLocked = option.isPro && !canUseProQualities;
          const isSelected = selectedQuality === option.value;

          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionItem,
                { backgroundColor: theme.colors.background.primary },
                isSelected && { borderColor: theme.colors.functional.accent, backgroundColor: theme.colors.functional.accentLight },
                isLocked && styles.optionItemLocked,
              ]}
              onPress={() => handleSelect(option.value, !!option.isPro)}
              activeOpacity={0.7}
            >
              <View style={styles.optionContent}>
                <View style={styles.labelRow}>
                  <Text style={[
                    styles.optionLabel,
                    { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold },
                    isSelected && { color: theme.colors.functional.accent },
                    isLocked && { color: theme.colors.text.secondary },
                  ]}>
                    {option.label}
                  </Text>
                  {option.isPro && (
                    <View style={[
                      styles.proBadge,
                      { backgroundColor: canUseProQualities ? theme.colors.functional.accent : theme.colors.text.tertiary }
                    ]}>
                      <Text style={[styles.proBadgeText, { fontFamily: theme.typography.fontFamily.semibold }]}>PRO</Text>
                    </View>
                  )}
                </View>
                <Text style={[
                  styles.optionDescription,
                  { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular },
                  isLocked && { color: theme.colors.text.tertiary },
                ]}>
                  {option.description}
                </Text>
              </View>

              {isSelected ? (
                <Icon name="Check" size={24} color={theme.colors.functional.accent} />
              ) : isLocked ? (
                <Icon name="Lock" size={20} color={theme.colors.text.tertiary} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.infoText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
        Higher quality photos use more storage space. Full Quality preserves the original image from your camera.
      </Text>
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  optionsList: {
    gap: themeBase.spacing.md,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: themeBase.spacing.lg,
    borderRadius: themeBase.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionItemLocked: {
    opacity: 0.8,
  },
  optionContent: {
    flex: 1,
    marginRight: themeBase.spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
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
  infoText: {
    fontSize: themeBase.typography.fontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: themeBase.spacing.lg,
  },
});
