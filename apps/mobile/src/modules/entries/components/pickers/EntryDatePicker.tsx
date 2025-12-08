/**
 * EntryDatePicker - Entry date calendar picker component
 * Follows the same pattern as DueDatePicker
 * Used for setting the entry's date (required, cannot be cleared)
 */

import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Line } from "react-native-svg";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { theme } from "../../../../shared/theme/theme";

interface EntryDatePickerProps {
  visible: boolean;
  onClose: () => void;
  entryDate: string;
  onEntryDateChange: (date: string) => void;
  onSnackbar: (message: string) => void;
}

export function EntryDatePicker({
  visible,
  onClose,
  entryDate,
  onEntryDateChange,
  onSnackbar,
}: EntryDatePickerProps) {
  const today = new Date();
  const currentDate = new Date(entryDate);

  // Track the currently displayed month/year (for navigation)
  const [displayYear, setDisplayYear] = useState(currentDate.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(currentDate.getMonth());

  // Reset display to current date when picker becomes visible
  useEffect(() => {
    if (visible) {
      const date = new Date(entryDate);
      setDisplayYear(date.getFullYear());
      setDisplayMonth(date.getMonth());
    }
  }, [visible, entryDate]);

  // Days in month
  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(displayYear, displayMonth, 1).getDay();

  // Month names
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear(displayYear - 1);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear(displayYear + 1);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  };

  const handlePrevYear = () => {
    setDisplayYear(displayYear - 1);
  };

  const handleNextYear = () => {
    setDisplayYear(displayYear + 1);
  };

  const handleTodayPress = () => {
    // Navigate to today's month
    setDisplayYear(today.getFullYear());
    setDisplayMonth(today.getMonth());
  };

  const handleDayPress = (day: number) => {
    const selected = new Date(displayYear, displayMonth, day);
    // Preserve the current time
    selected.setHours(
      currentDate.getHours(),
      currentDate.getMinutes(),
      currentDate.getSeconds(),
      currentDate.getMilliseconds()
    );
    onEntryDateChange(selected.toISOString());
    onSnackbar("Date updated");
    onClose();
  };

  // Build calendar days
  const days = [];

  // Add empty cells for days before month starts
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
  }

  // Add day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(displayYear, displayMonth, day);
    const isSelected =
      date.getDate() === currentDate.getDate() &&
      date.getMonth() === currentDate.getMonth() &&
      date.getFullYear() === currentDate.getFullYear();
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    days.push(
      <TouchableOpacity
        key={day}
        style={[
          styles.dayCell,
          isSelected && styles.dayCellSelected,
        ]}
        onPress={() => handleDayPress(day)}
      >
        <Text style={[
          styles.dayText,
          isSelected && styles.dayTextSelected,
          isToday && !isSelected && styles.dayTextToday,
        ]}>
          {day}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TopBarDropdownContainer visible={visible} onClose={onClose}>
      <View style={styles.container}>
        {/* Header with title and close button */}
        <View style={styles.titleHeader}>
          <Text style={styles.title}>Set Date</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Month/Year navigation */}
        <View style={styles.navHeader}>
          <View style={styles.navButtons}>
            <TouchableOpacity onPress={handlePrevYear} style={styles.navButton}>
              <Text style={styles.navText}>«</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
              <Text style={styles.navText}>‹</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.monthYear}>
            {monthNames[displayMonth]} {displayYear}
          </Text>

          <View style={styles.navButtons}>
            <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
              <Text style={styles.navText}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNextYear} style={styles.navButton}>
              <Text style={styles.navText}>»</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Day labels */}
        <View style={styles.weekDays}>
          {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
            <View key={i} style={styles.weekDayCell}>
              <Text style={styles.weekDayText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.daysGrid}>
          {days}
        </View>

        {/* Actions - Today only (no clear since entry date is required) */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleTodayPress}
          >
            <Text style={styles.todayText}>Today</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TopBarDropdownContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  titleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  navHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  navButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  navButton: {
    padding: theme.spacing.sm,
  },
  navText: {
    fontSize: 24,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.normal,
  },
  monthYear: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  weekDays: {
    flexDirection: "row",
    marginBottom: theme.spacing.sm,
  },
  weekDayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: theme.spacing.xs,
  },
  weekDayText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%", // 100% / 7 days
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellSelected: {
    backgroundColor: theme.colors.text.primary,
    borderRadius: theme.borderRadius.md,
  },
  dayText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.normal,
  },
  dayTextSelected: {
    color: theme.colors.background.primary,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  dayTextToday: {
    color: "#3b82f6",
    fontWeight: theme.typography.fontWeight.bold,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  actionButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.secondary,
  },
  todayText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.medium,
  },
});
