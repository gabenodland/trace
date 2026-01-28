/**
 * EntryDateRangeSelector - Entry date range filter
 * Filters by entry_date (when the event/memory happened)
 */

import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Path } from 'react-native-svg';
import { PickerBottomSheet } from '../../../components/sheets';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { themeBase } from '../../../shared/theme/themeBase';

interface EntryDateRangeSelectorProps {
  visible: boolean;
  startDate: string | null;
  endDate: string | null;
  onSelect: (startDate: string | null, endDate: string | null) => void;
  onClose: () => void;
}

export function EntryDateRangeSelector({
  visible,
  startDate,
  endDate,
  onSelect,
  onClose,
}: EntryDateRangeSelectorProps) {
  const theme = useTheme();

  // Local state for date picker
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [localStart, setLocalStart] = useState<Date | null>(startDate ? new Date(startDate) : null);
  const [localEnd, setLocalEnd] = useState<Date | null>(endDate ? new Date(endDate) : null);

  // Reset local state when props change
  useEffect(() => {
    setLocalStart(startDate ? new Date(startDate) : null);
    setLocalEnd(endDate ? new Date(endDate) : null);
  }, [startDate, endDate]);

  const handleStartDateChange = (_event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setLocalStart(selectedDate);
      onSelect(selectedDate.toISOString(), localEnd?.toISOString() || null);
    }
  };

  const handleEndDateChange = (_event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setLocalEnd(selectedDate);
      onSelect(localStart?.toISOString() || null, selectedDate.toISOString());
    }
  };

  const handleClear = () => {
    setLocalStart(null);
    setLocalEnd(null);
    onSelect(null, null);
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return 'Any';
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isFiltering = localStart !== null || localEnd !== null;

  // Generate description text
  const getFilterDescription = (): string => {
    if (!localStart && !localEnd) return 'All dates';
    if (localStart && localEnd) return `${formatDate(localStart)} to ${formatDate(localEnd)}`;
    if (localStart) return `After ${formatDate(localStart)}`;
    if (localEnd) return `Before ${formatDate(localEnd)}`;
    return 'All dates';
  };

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Entry Date Filter"
      height="auto"
    >
      {/* Header with description and clear button */}
      <View style={styles.headerRow}>
        <Text style={[styles.hint, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
          {getFilterDescription()}
        </Text>
        {isFiltering && (
          <TouchableOpacity onPress={handleClear} activeOpacity={0.7}>
            <Text style={[styles.clearButton, { color: theme.colors.interactive.primary, fontFamily: theme.typography.fontFamily.medium }]}>
              Clear
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Date Range Pickers */}
      <View style={styles.datePickersContainer}>
        {/* Start Date */}
        <TouchableOpacity
          style={[styles.dateButton, { backgroundColor: theme.colors.background.secondary }]}
          onPress={() => setShowStartPicker(true)}
          activeOpacity={0.7}
        >
          <View style={styles.dateButtonContent}>
            <Text style={[styles.dateLabel, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
              From (after this date)
            </Text>
            <Text style={[styles.dateValue, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
              {formatDate(localStart)}
            </Text>
          </View>
          {localStart && (
            <TouchableOpacity
              onPress={() => {
                setLocalStart(null);
                onSelect(null, localEnd?.toISOString() || null);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 6L6 18M6 6l12 12"
                  stroke={theme.colors.text.tertiary}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
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
              To (before this date)
            </Text>
            <Text style={[styles.dateValue, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
              {formatDate(localEnd)}
            </Text>
          </View>
          {localEnd && (
            <TouchableOpacity
              onPress={() => {
                setLocalEnd(null);
                onSelect(localStart?.toISOString() || null, null);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 6L6 18M6 6l12 12"
                  stroke={theme.colors.text.tertiary}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
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

      {/* Bottom padding */}
      <View style={{ height: themeBase.spacing.md }} />
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: themeBase.spacing.lg,
  },
  hint: {
    fontSize: themeBase.typography.fontSize.xs,
  },
  clearButton: {
    fontSize: themeBase.typography.fontSize.sm,
  },
  datePickersContainer: {
    gap: themeBase.spacing.sm,
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
