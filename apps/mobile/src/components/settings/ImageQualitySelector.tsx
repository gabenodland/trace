/**
 * Image Quality Selector - Bottom sheet for choosing photo compression quality
 */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { type ImageQuality, IMAGE_QUALITY_OPTIONS } from '@trace/core';
import { useTheme } from '../../shared/contexts/ThemeContext';
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

  const handleSelect = (quality: ImageQuality) => {
    onSelect(quality);
    onClose();
  };

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Photo Quality"
      height="auto"
    >
      <View style={styles.optionsList}>
        {IMAGE_QUALITY_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionItem,
              { backgroundColor: theme.colors.background.primary },
              selectedQuality === option.value && { borderColor: theme.colors.functional.accent, backgroundColor: theme.colors.functional.accentLight },
            ]}
            onPress={() => handleSelect(option.value)}
            activeOpacity={0.7}
          >
            <View style={styles.optionContent}>
              <Text style={[
                styles.optionLabel,
                { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold },
                selectedQuality === option.value && { color: theme.colors.functional.accent },
              ]}>
                {option.label}
              </Text>
              <Text style={[styles.optionDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>{option.description}</Text>
            </View>
            {selectedQuality === option.value && (
              <Icon name="Check" size={24} color={theme.colors.functional.accent} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Info text */}
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
  optionContent: {
    flex: 1,
    marginRight: themeBase.spacing.md,
  },
  optionLabel: {
    fontSize: themeBase.typography.fontSize.base,
    marginBottom: 4,
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
