/**
 * DatePickerSheet - Custom themed date picker using PickerBottomSheet
 *
 * Fully themed calendar picker that matches app themes.
 * Uses our existing PickerBottomSheet for consistent presentation.
 */

import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { PickerBottomSheet } from './PickerBottomSheet';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { themeBase } from '../../shared/theme/themeBase';

interface DatePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: Date) => void;
  value?: Date | null;
  title?: string;
  minDate?: Date;
  maxDate?: Date;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function DatePickerSheet({
  visible,
  onClose,
  onSelect,
  value,
  title = 'Select Date',
  minDate,
  maxDate,
}: DatePickerSheetProps) {
  const theme = useTheme();

  // Current view month/year (for navigation)
  const [viewDate, setViewDate] = useState(() => value || new Date());

  // Get the current view month and year
  const viewMonth = viewDate.getMonth();
  const viewYear = viewDate.getFullYear();

  // Generate calendar days for the current view month
  const calendarDays = useMemo(() => {
    const days: (Date | null)[] = [];

    // First day of the month
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startDayOfWeek = firstDay.getDay();

    // Last day of the month
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Add empty slots for days before the first of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(viewYear, viewMonth, day));
    }

    return days;
  }, [viewMonth, viewYear]);

  // Check if a date is the selected date
  const isSelected = (date: Date | null) => {
    if (!date || !value) return false;
    return (
      date.getDate() === value.getDate() &&
      date.getMonth() === value.getMonth() &&
      date.getFullYear() === value.getFullYear()
    );
  };

  // Check if a date is today
  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Check if a date is disabled (outside min/max range)
  const isDisabled = (date: Date | null) => {
    if (!date) return true;
    if (minDate && date < new Date(minDate.setHours(0, 0, 0, 0))) return true;
    if (maxDate && date > new Date(maxDate.setHours(23, 59, 59, 999))) return true;
    return false;
  };

  // Navigate to previous month
  const goToPrevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  // Handle date selection
  const handleSelect = (date: Date | null) => {
    if (!date || isDisabled(date)) return;
    onSelect(date);
    onClose();
  };

  // Quick select options
  const handleToday = () => {
    const today = new Date();
    if (!isDisabled(today)) {
      onSelect(today);
      onClose();
    }
  };

  const handleTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (!isDisabled(tomorrow)) {
      onSelect(tomorrow);
      onClose();
    }
  };

  const handleNextWeek = () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    if (!isDisabled(nextWeek)) {
      onSelect(nextWeek);
      onClose();
    }
  };

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      height={0.65}
    >
      {/* Quick Select Buttons */}
      <View style={styles.quickSelectRow}>
        <TouchableOpacity
          style={[styles.quickSelectButton, { backgroundColor: theme.colors.background.secondary }]}
          onPress={handleToday}
          activeOpacity={0.7}
        >
          <Text style={[styles.quickSelectText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
            Today
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickSelectButton, { backgroundColor: theme.colors.background.secondary }]}
          onPress={handleTomorrow}
          activeOpacity={0.7}
        >
          <Text style={[styles.quickSelectText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
            Tomorrow
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickSelectButton, { backgroundColor: theme.colors.background.secondary }]}
          onPress={handleNextWeek}
          activeOpacity={0.7}
        >
          <Text style={[styles.quickSelectText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
            Next Week
          </Text>
        </TouchableOpacity>
      </View>

      {/* Month/Year Header with Navigation */}
      <View style={styles.monthHeader}>
        <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton} activeOpacity={0.7}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 18l-6-6 6-6"
              stroke={theme.colors.text.primary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>

        <Text style={[styles.monthYearText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
          {MONTHS[viewMonth]} {viewYear}
        </Text>

        <TouchableOpacity onPress={goToNextMonth} style={styles.navButton} activeOpacity={0.7}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 18l6-6-6-6"
              stroke={theme.colors.text.primary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Days of Week Header */}
      <View style={styles.weekHeader}>
        {DAYS_OF_WEEK.map(day => (
          <View key={day} style={styles.weekDayCell}>
            <Text style={[styles.weekDayText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
              {day}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {calendarDays.map((date, index) => {
          const selected = isSelected(date);
          const today = isToday(date);
          const disabled = isDisabled(date);

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.dayCell,
                selected && { backgroundColor: theme.colors.interactive.primary },
                today && !selected && { borderColor: theme.colors.interactive.primary, borderWidth: 1 },
              ]}
              onPress={() => handleSelect(date)}
              disabled={disabled || !date}
              activeOpacity={0.7}
            >
              {date && (
                <Text style={[
                  styles.dayText,
                  { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular },
                  selected && { color: theme.colors.background.primary, fontFamily: theme.typography.fontFamily.semibold },
                  today && !selected && { color: theme.colors.interactive.primary, fontFamily: theme.typography.fontFamily.semibold },
                  disabled && { color: theme.colors.text.tertiary },
                ]}>
                  {date.getDate()}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  quickSelectRow: {
    flexDirection: 'row',
    gap: themeBase.spacing.sm,
    marginBottom: themeBase.spacing.lg,
    paddingHorizontal: themeBase.spacing.lg,
  },
  quickSelectButton: {
    flex: 1,
    paddingVertical: themeBase.spacing.sm,
    borderRadius: themeBase.borderRadius.md,
    alignItems: 'center',
  },
  quickSelectText: {
    fontSize: themeBase.typography.fontSize.sm,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: themeBase.spacing.md,
    marginBottom: themeBase.spacing.md,
  },
  navButton: {
    padding: themeBase.spacing.sm,
  },
  monthYearText: {
    fontSize: themeBase.typography.fontSize.lg,
  },
  weekHeader: {
    flexDirection: 'row',
    paddingHorizontal: themeBase.spacing.sm,
    marginBottom: themeBase.spacing.sm,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: themeBase.spacing.xs,
  },
  weekDayText: {
    fontSize: themeBase.typography.fontSize.xs,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: themeBase.spacing.sm,
  },
  dayCell: {
    width: '14.28%', // 100% / 7 days
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: themeBase.borderRadius.full,
  },
  dayText: {
    fontSize: themeBase.typography.fontSize.base,
  },
});
