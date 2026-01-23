/**
 * StatusFilterSelector - Multi-select status filter using bottom sheet
 * Uses PickerBottomSheet for consistent presentation with other pickers
 */

import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { ALL_STATUSES, type EntryStatus } from '@trace/core';
import Svg, { Path } from 'react-native-svg';
import { PickerBottomSheet } from '../../../components/sheets';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { themeBase } from '../../../shared/theme/themeBase';

interface StatusFilterSelectorProps {
  visible: boolean;
  selectedStatuses: string[];
  onSelect: (statuses: string[]) => void;
  onClose: () => void;
  /** Statuses available for filtering. If not provided, shows all statuses. */
  allowedStatuses?: string[];
}

export function StatusFilterSelector({
  visible,
  selectedStatuses,
  onSelect,
  onClose,
  allowedStatuses,
}: StatusFilterSelectorProps) {
  const theme = useTheme();

  // Filter to only show allowed statuses
  const availableStatuses = allowedStatuses
    ? ALL_STATUSES.filter(s => allowedStatuses.includes(s.value))
    : ALL_STATUSES;

  // Filter selected statuses to only include ones that are actually available
  // This handles cases where user switches streams and has stale selections
  const availableStatusValues = availableStatuses.map(s => s.value) as string[];
  const validSelectedStatuses = selectedStatuses.filter(s => availableStatusValues.includes(s));

  const allSelected = validSelectedStatuses.length === availableStatuses.length;
  const noneSelected = validSelectedStatuses.length === 0;

  const handleToggleStatus = (status: EntryStatus) => {
    const isSelected = validSelectedStatuses.includes(status);
    if (isSelected) {
      // Remove from valid selections only
      onSelect(validSelectedStatuses.filter(s => s !== status));
    } else {
      onSelect([...validSelectedStatuses, status]);
    }
  };

  const handleToggleAll = () => {
    if (allSelected || noneSelected) {
      // If all selected or none selected, clear all
      onSelect([]);
    } else {
      // If some selected, select all
      onSelect(availableStatuses.map(s => s.value));
    }
  };

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Status Filter"
      height="auto"
    >
      {/* Header row with hint text and Select All checkbox */}
      <View style={styles.headerRow}>
        <Text style={[styles.hint, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
          {noneSelected
            ? "Showing all statuses"
            : `Showing ${validSelectedStatuses.length} of ${availableStatuses.length}`}
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
          {availableStatuses.map((status) => {
            const isSelected = validSelectedStatuses.includes(status.value);

            return (
              <TouchableOpacity
                key={status.value}
                style={[
                  styles.optionButton,
                  { backgroundColor: theme.colors.background.secondary },
                  isSelected && { backgroundColor: theme.colors.background.tertiary },
                ]}
                onPress={() => handleToggleStatus(status.value)}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
                  <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                  <Text style={[
                    styles.optionLabel,
                    { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium },
                    isSelected && { fontFamily: theme.typography.fontFamily.semibold }
                  ]}>
                    {status.label}
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
  statusDot: {
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
