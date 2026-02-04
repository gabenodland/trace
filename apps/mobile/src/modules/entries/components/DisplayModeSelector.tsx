/**
 * DisplayModeSelector - Display mode selection using bottom sheet
 * Uses PickerBottomSheet for consistent presentation with other pickers
 */

import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { EntryDisplayMode } from '@trace/core';
import { ENTRY_DISPLAY_MODES } from '@trace/core';
import { PickerBottomSheet } from '../../../components/sheets';
import { Icon } from '../../../shared/components';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { themeBase } from '../../../shared/theme/themeBase';

interface DisplayModeSelectorProps {
  visible: boolean;
  selectedMode: EntryDisplayMode;
  onSelect: (mode: EntryDisplayMode) => void;
  onClose: () => void;
}

export function DisplayModeSelector({
  visible,
  selectedMode,
  onSelect,
  onClose,
}: DisplayModeSelectorProps) {
  const theme = useTheme();

  const handleSelect = (mode: EntryDisplayMode) => {
    onSelect(mode);
    onClose();
  };

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Display Mode"
      height="auto"
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.optionsContainer}>
          {ENTRY_DISPLAY_MODES.map((mode) => {
            const isSelected = mode.value === selectedMode;

            return (
              <TouchableOpacity
                key={mode.value}
                style={[
                  styles.optionButton,
                  { backgroundColor: theme.colors.background.secondary },
                  isSelected && { backgroundColor: theme.colors.background.tertiary },
                ]}
                onPress={() => handleSelect(mode.value)}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
                  <Text style={[
                    styles.optionLabel,
                    { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium },
                    isSelected && { fontFamily: theme.typography.fontFamily.semibold }
                  ]}>
                    {mode.label}
                  </Text>
                  <Text style={[styles.optionDescription, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                    {mode.description}
                  </Text>
                </View>

                {isSelected && (
                  <Icon name="Check" size={20} color={theme.colors.interactive.primary} />
                )}
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
    maxHeight: 400,
  },
  optionsContainer: {
    gap: themeBase.spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
  },
  optionContent: {
    flex: 1,
    marginRight: themeBase.spacing.md,
  },
  optionLabel: {
    fontSize: themeBase.typography.fontSize.base,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: themeBase.typography.fontSize.xs,
  },
});
