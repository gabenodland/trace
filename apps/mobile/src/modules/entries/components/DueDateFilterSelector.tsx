/**
 * DueDateFilterSelector - Due date filter with presets and custom range
 */

import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DUE_DATE_PRESETS, type DueDatePreset } from '@trace/core';
import { PickerBottomSheet } from '../../../components/sheets';
import { Icon } from '../../../shared/components';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { themeBase } from '../../../shared/theme/themeBase';

interface DueDateFilterSelectorProps {
  visible: boolean;
  preset: DueDatePreset;
  customStart: string | null;
  customEnd: string | null;
  onSelect: (preset: DueDatePreset, customStart: string | null, customEnd: string | null) => void;
  onClose: () => void;
}

export function DueDateFilterSelector({
  visible,
  preset,
  customStart,
  customEnd,
  onSelect,
  onClose,
}: DueDateFilterSelectorProps) {
  const theme = useTheme();

  // Local state for custom date picker
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [localStart, setLocalStart] = useState<Date | null>(customStart ? new Date(customStart) : null);
  const [localEnd, setLocalEnd] = useState<Date | null>(customEnd ? new Date(customEnd) : null);

  // Reset local state when props change
  useEffect(() => {
    setLocalStart(customStart ? new Date(customStart) : null);
    setLocalEnd(customEnd ? new Date(customEnd) : null);
  }, [customStart, customEnd]);

  const handlePresetSelect = (selectedPreset: DueDatePreset) => {
    if (selectedPreset === 'custom') {
      // When selecting custom, keep existing dates or use defaults
      onSelect('custom', localStart?.toISOString() || null, localEnd?.toISOString() || null);
    } else {
      // For presets, clear custom dates
      onSelect(selectedPreset, null, null);
    }
  };

  const handleStartDateChange = (_event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setLocalStart(selectedDate);
      onSelect('custom', selectedDate.toISOString(), localEnd?.toISOString() || null);
    }
  };

  const handleEndDateChange = (_event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setLocalEnd(selectedDate);
      onSelect('custom', localStart?.toISOString() || null, selectedDate.toISOString());
    }
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return 'Not set';
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isFiltering = preset !== 'all';

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Due Date Filter"
      height="auto"
    >
      {/* Presets */}
      <View style={styles.presetsContainer}>
        {DUE_DATE_PRESETS.filter(p => p.value !== 'custom').map((presetOption) => (
          <TouchableOpacity
            key={presetOption.value}
            style={[
              styles.presetChip,
              { backgroundColor: theme.colors.background.secondary },
              preset === presetOption.value && { backgroundColor: theme.colors.interactive.primary },
            ]}
            onPress={() => handlePresetSelect(presetOption.value)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.presetText,
              { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular },
              preset === presetOption.value && { color: theme.colors.background.primary, fontFamily: theme.typography.fontFamily.semibold },
            ]}>
              {presetOption.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom Range Section */}
      <View style={[styles.customSection, { borderTopColor: theme.colors.border.light }]}>
        <TouchableOpacity
          style={[
            styles.customHeader,
            preset === 'custom' && { backgroundColor: theme.colors.background.tertiary },
          ]}
          onPress={() => handlePresetSelect('custom')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.customTitle,
            { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium },
            preset === 'custom' && { fontFamily: theme.typography.fontFamily.semibold },
          ]}>
            Custom Range
          </Text>
          <View style={[
            styles.radio,
            { borderColor: theme.colors.border.dark },
            preset === 'custom' && { borderColor: theme.colors.interactive.primary, backgroundColor: theme.colors.interactive.primary },
          ]}>
            {preset === 'custom' && <View style={[styles.radioInner, { backgroundColor: theme.colors.background.primary }]} />}
          </View>
        </TouchableOpacity>

        {preset === 'custom' && (
          <View style={styles.datePickersContainer}>
            {/* Start Date */}
            <TouchableOpacity
              style={[styles.dateButton, { backgroundColor: theme.colors.background.secondary }]}
              onPress={() => setShowStartPicker(true)}
              activeOpacity={0.7}
            >
              <View style={styles.dateButtonContent}>
                <Text style={[styles.dateLabel, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                  From
                </Text>
                <Text style={[styles.dateValue, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
                  {formatDate(localStart)}
                </Text>
              </View>
              {localStart && (
                <TouchableOpacity
                  onPress={() => {
                    setLocalStart(null);
                    onSelect('custom', null, localEnd?.toISOString() || null);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="X" size={16} color={theme.colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* End Date */}
            <TouchableOpacity
              style={[styles.dateButton, { backgroundColor: theme.colors.background.secondary }]}
              onPress={() => setShowEndPicker(true)}
              activeOpacity={0.7}
            >
              <View style={styles.dateButtonContent}>
                <Text style={[styles.dateLabel, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                  To
                </Text>
                <Text style={[styles.dateValue, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
                  {formatDate(localEnd)}
                </Text>
              </View>
              {localEnd && (
                <TouchableOpacity
                  onPress={() => {
                    setLocalEnd(null);
                    onSelect('custom', localStart?.toISOString() || null, null);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="X" size={16} color={theme.colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Date Pickers */}
            {showStartPicker && (
              <DateTimePicker
                value={localStart || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleStartDateChange}
              />
            )}
            {showEndPicker && (
              <DateTimePicker
                value={localEnd || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleEndDateChange}
              />
            )}
          </View>
        )}
      </View>

      {/* Bottom padding */}
      <View style={{ height: themeBase.spacing.md }} />
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: themeBase.spacing.sm,
    marginBottom: themeBase.spacing.lg,
  },
  presetChip: {
    paddingVertical: themeBase.spacing.sm,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
  },
  presetText: {
    fontSize: themeBase.typography.fontSize.sm,
  },
  customSection: {
    borderTopWidth: 1,
    paddingTop: themeBase.spacing.md,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.sm,
    borderRadius: themeBase.borderRadius.md,
  },
  customTitle: {
    fontSize: themeBase.typography.fontSize.base,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  datePickersContainer: {
    gap: themeBase.spacing.sm,
    paddingTop: themeBase.spacing.sm,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
  },
  dateButtonContent: {
    flex: 1,
  },
  dateLabel: {
    fontSize: themeBase.typography.fontSize.xs,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: themeBase.typography.fontSize.base,
  },
});
