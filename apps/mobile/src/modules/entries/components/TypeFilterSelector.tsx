/**
 * TypeFilterSelector - Multi-select type filter using bottom sheet
 * Shows the stream's custom entry types for filtering
 */

import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { PickerBottomSheet } from '../../../components/sheets';
import { Icon } from '../../../shared/components';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { themeBase } from '../../../shared/theme/themeBase';

interface TypeFilterSelectorProps {
  visible: boolean;
  selectedTypes: string[];
  availableTypes: string[];  // Stream's entry_types
  onSelect: (types: string[]) => void;
  onClose: () => void;
}

export function TypeFilterSelector({
  visible,
  selectedTypes,
  availableTypes,
  onSelect,
  onClose,
}: TypeFilterSelectorProps) {
  const theme = useTheme();

  // Filter selected types to only include ones that are actually available
  const validSelectedTypes = selectedTypes.filter(t => availableTypes.includes(t));
  const allSelected = validSelectedTypes.length === availableTypes.length;
  const noneSelected = validSelectedTypes.length === 0;

  const handleToggleType = (type: string) => {
    const isSelected = validSelectedTypes.includes(type);
    if (isSelected) {
      onSelect(validSelectedTypes.filter(t => t !== type));
    } else {
      onSelect([...validSelectedTypes, type]);
    }
  };

  const handleToggleAll = () => {
    if (allSelected) {
      // If all selected, clear all
      onSelect([]);
    } else {
      // If none or some selected, select all
      onSelect([...availableTypes]);
    }
  };

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Type Filter"
      height="auto"
    >
      {/* Header row with hint text and Select All checkbox */}
      <View style={styles.headerRow}>
        <Text style={[styles.hint, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
          {noneSelected
            ? "Showing all types"
            : `Showing ${validSelectedTypes.length} of ${availableTypes.length}`}
        </Text>
        <TouchableOpacity style={styles.selectAllRow} onPress={handleToggleAll} activeOpacity={0.7}>
          <Text style={[styles.selectAllLabel, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>
            Select all
          </Text>
          <View style={[
            styles.checkbox,
            { borderColor: theme.colors.border.dark },
            allSelected && { backgroundColor: theme.colors.interactive.primary, borderColor: theme.colors.interactive.primary }
          ]}>
            {allSelected && (
              <Icon name="Check" size={12} color={theme.colors.background.primary} />
            )}
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.optionsContainer}>
          {availableTypes.map((type) => {
            const isSelected = validSelectedTypes.includes(type);

            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.optionButton,
                  { backgroundColor: theme.colors.background.secondary },
                  isSelected && { backgroundColor: theme.colors.background.tertiary },
                ]}
                onPress={() => handleToggleType(type)}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
                  <Text style={[
                    styles.optionLabel,
                    { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium },
                    isSelected && { fontFamily: theme.typography.fontFamily.semibold }
                  ]}>
                    {type}
                  </Text>
                </View>

                <View style={[
                  styles.checkbox,
                  { borderColor: theme.colors.border.dark },
                  isSelected && { backgroundColor: theme.colors.interactive.primary, borderColor: theme.colors.interactive.primary }
                ]}>
                  {isSelected && (
                    <Icon name="Check" size={12} color={theme.colors.background.primary} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: themeBase.spacing.md,
  },
  hint: {
    fontSize: themeBase.typography.fontSize.xs,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: themeBase.spacing.sm,
  },
  selectAllLabel: {
    fontSize: themeBase.typography.fontSize.xs,
  },
  scrollView: {
    maxHeight: 360,
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
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionLabel: {
    fontSize: themeBase.typography.fontSize.base,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
