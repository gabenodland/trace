/**
 * PriorityFilterSelector - Multi-select priority filter using bottom sheet
 * Uses PickerBottomSheet for consistent presentation with other pickers
 */

import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { ALL_PRIORITIES, type PriorityLevel, type PriorityCategory } from '@trace/core';
import Svg, { Path } from 'react-native-svg';
import { PickerBottomSheet } from '../../../components/sheets';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { themeBase } from '../../../shared/theme/themeBase';

interface PriorityFilterSelectorProps {
  visible: boolean;
  selectedPriorities: PriorityLevel[];
  onSelect: (priorities: PriorityLevel[]) => void;
  onClose: () => void;
}

export function PriorityFilterSelector({
  visible,
  selectedPriorities,
  onSelect,
  onClose,
}: PriorityFilterSelectorProps) {
  const theme = useTheme();

  const allSelected = selectedPriorities.length === ALL_PRIORITIES.length;
  const noneSelected = selectedPriorities.length === 0;

  const handleTogglePriority = (priority: PriorityLevel) => {
    const isSelected = selectedPriorities.includes(priority);
    if (isSelected) {
      onSelect(selectedPriorities.filter(p => p !== priority));
    } else {
      onSelect([...selectedPriorities, priority]);
    }
  };

  const handleToggleAll = () => {
    if (allSelected) {
      // If all selected, clear all
      onSelect([]);
    } else {
      // If none or some selected, select all
      onSelect(ALL_PRIORITIES.map(p => p.value));
    }
  };

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Priority Filter"
      height="auto"
    >
      {/* Header row with hint text and Select All checkbox */}
      <View style={styles.headerRow}>
        <Text style={[styles.hint, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
          {noneSelected
            ? "Showing all priorities"
            : `Showing ${selectedPriorities.length} of ${ALL_PRIORITIES.length}`}
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
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M5 13l4 4L19 7"
                  stroke={theme.colors.background.primary}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.optionsContainer}>
          {ALL_PRIORITIES.map((priority) => {
            const isSelected = selectedPriorities.includes(priority.value);
            const priorityColor = theme.colors.priority[priority.category as PriorityCategory];

            return (
              <TouchableOpacity
                key={priority.value}
                style={[
                  styles.optionButton,
                  { backgroundColor: theme.colors.background.secondary },
                  isSelected && { backgroundColor: theme.colors.background.tertiary },
                ]}
                onPress={() => handleTogglePriority(priority.value)}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
                  <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
                  <Text style={[
                    styles.optionLabel,
                    { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium },
                    isSelected && { fontFamily: theme.typography.fontFamily.semibold }
                  ]}>
                    {priority.label}
                  </Text>
                </View>

                <View style={[
                  styles.checkbox,
                  { borderColor: theme.colors.border.dark },
                  isSelected && { backgroundColor: theme.colors.interactive.primary, borderColor: theme.colors.interactive.primary }
                ]}>
                  {isSelected && (
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M5 13l4 4L19 7"
                        stroke={theme.colors.background.primary}
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
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
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: themeBase.spacing.md,
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
