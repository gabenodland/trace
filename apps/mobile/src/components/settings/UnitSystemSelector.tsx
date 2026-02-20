/**
 * Unit System Selector - Bottom sheet for choosing between Metric and Imperial units
 */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { type UnitSystem, UNIT_OPTIONS } from '@trace/core';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { Icon } from '../../shared/components';
import { PickerBottomSheet } from '../sheets/PickerBottomSheet';
import { themeBase } from '../../shared/theme/themeBase';

interface UnitSystemSelectorProps {
  visible: boolean;
  selectedUnit: UnitSystem;
  onSelect: (unit: UnitSystem) => void;
  onClose: () => void;
}

export function UnitSystemSelector({
  visible,
  selectedUnit,
  onSelect,
  onClose,
}: UnitSystemSelectorProps) {
  const theme = useTheme();

  const handleSelect = (unit: UnitSystem) => {
    onSelect(unit);
    onClose();
  };

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Distance Units"
      height="auto"
    >
      <View style={styles.optionsList}>
        {UNIT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionItem,
              { backgroundColor: theme.colors.background.primary },
              selectedUnit === option.value && { borderColor: theme.colors.functional.accent, backgroundColor: theme.colors.functional.accentLight },
            ]}
            onPress={() => handleSelect(option.value)}
            activeOpacity={0.7}
          >
            <View style={styles.optionContent}>
              <Text style={[
                styles.optionLabel,
                { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold },
                selectedUnit === option.value && { color: theme.colors.functional.accent },
              ]}>
                {option.label}
              </Text>
              <Text style={[styles.optionDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>{option.description}</Text>
            </View>
            {selectedUnit === option.value && (
              <Icon name="Check" size={24} color={theme.colors.functional.accent} />
            )}
          </TouchableOpacity>
        ))}
      </View>
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
});
