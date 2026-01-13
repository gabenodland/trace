/**
 * DueDatePicker - Due date calendar picker component
 * Follows the same pattern as RatingPicker and PriorityPicker
 */

import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Line } from "react-native-svg";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { themeBase } from "../../../../shared/theme/themeBase";
import { useTheme } from "../../../../shared/contexts/ThemeContext";

interface DueDatePickerProps {
  visible: boolean;
  onClose: () => void;
  dueDate: string | null;
  onDueDateChange: (date: string | null) => void;
  onSnackbar: (message: string) => void;
}

export function DueDatePicker({
  visible,
  onClose,
  dueDate,
  onDueDateChange,
  onSnackbar,
}: DueDatePickerProps) {
  const dynamicTheme = useTheme();

  // Track the currently displayed month/year (for navigation)
  const today = new Date();
  const initialDate = dueDate ? new Date(dueDate) : today;
  const [displayYear, setDisplayYear] = useState(initialDate.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(initialDate.getMonth());

  // Reset display to initial date when picker becomes visible
  // This ensures the picker shows the correct month when opened
  const selectedDate = dueDate ? new Date(dueDate) : null;

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
    // Just navigate to today's month, don't select the date
    setDisplayYear(today.getFullYear());
    setDisplayMonth(today.getMonth());
  };

  const handleDayPress = (day: number) => {
    const selected = new Date(displayYear, displayMonth, day);
    selected.setHours(12, 0, 0, 0);
    const hadDueDate = !!dueDate;
    onDueDateChange(selected.toISOString());
    onSnackbar(hadDueDate ? "Due date updated" : "Due date set");
    onClose();
  };

  const handleClear = () => {
    onDueDateChange(null);
    onSnackbar("Due date cleared");
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
    const isSelected = selectedDate &&
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear();
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    days.push(
      <TouchableOpacity
        key={day}
        style={[
          styles.dayCell,
          isSelected && [styles.dayCellSelected, { backgroundColor: dynamicTheme.colors.text.primary }],
        ]}
        onPress={() => handleDayPress(day)}
      >
        <Text style={[
          styles.dayText,
          { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.primary },
          isSelected && { color: dynamicTheme.colors.background.primary, fontFamily: dynamicTheme.typography.fontFamily.semibold },
          isToday && !isSelected && { color: dynamicTheme.colors.functional.accent, fontFamily: dynamicTheme.typography.fontFamily.bold },
        ]}>
          {day}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TopBarDropdownContainer visible={visible} onClose={onClose}>
      <View style={[styles.container, { backgroundColor: dynamicTheme.colors.background.primary }]}>
        {/* Header with title and close button */}
        <View style={styles.titleHeader}>
          <Text style={[styles.title, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.primary }]}>Set Due Date</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.secondary} strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Month/Year navigation */}
        <View style={styles.navHeader}>
          <View style={styles.navButtons}>
            <TouchableOpacity onPress={handlePrevYear} style={styles.navButton}>
              <Text style={[styles.navText, { color: dynamicTheme.colors.text.primary }]}>«</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
              <Text style={[styles.navText, { color: dynamicTheme.colors.text.primary }]}>‹</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.monthYear, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.primary }]}>
            {monthNames[displayMonth]} {displayYear}
          </Text>

          <View style={styles.navButtons}>
            <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
              <Text style={[styles.navText, { color: dynamicTheme.colors.text.primary }]}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNextYear} style={styles.navButton}>
              <Text style={[styles.navText, { color: dynamicTheme.colors.text.primary }]}>»</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Day labels */}
        <View style={styles.weekDays}>
          {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
            <View key={i} style={styles.weekDayCell}>
              <Text style={[styles.weekDayText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.tertiary }]}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.daysGrid}>
          {days}
        </View>

        {/* Actions - Today and Clear */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
            onPress={handleTodayPress}
          >
            <Text style={[styles.todayText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary }]}>Today</Text>
          </TouchableOpacity>

          {dueDate && (
            <TouchableOpacity
              style={[styles.actionButton, styles.clearButton, { backgroundColor: `${dynamicTheme.colors.functional.overdue}15` }]}
              onPress={handleClear}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.functional.overdue} strokeWidth={2}>
                <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
                <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
              </Svg>
              <Text style={[styles.clearText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.functional.overdue }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TopBarDropdownContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: themeBase.borderRadius.lg,
    padding: themeBase.spacing.lg,
  },
  titleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: themeBase.spacing.md,
  },
  title: {
    fontSize: 18,
  },
  closeButton: {
    padding: 4,
  },
  navHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: themeBase.spacing.md,
  },
  navButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  navButton: {
    padding: themeBase.spacing.sm,
  },
  navText: {
    fontSize: 24,
  },
  monthYear: {
    fontSize: themeBase.typography.fontSize.base,
  },
  weekDays: {
    flexDirection: "row",
    marginBottom: themeBase.spacing.sm,
  },
  weekDayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: themeBase.spacing.xs,
  },
  weekDayText: {
    fontSize: themeBase.typography.fontSize.xs,
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
    borderRadius: themeBase.borderRadius.md,
  },
  dayText: {
    fontSize: themeBase.typography.fontSize.base,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: themeBase.spacing.lg,
    gap: themeBase.spacing.md,
  },
  actionButton: {
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.xl,
    borderRadius: themeBase.borderRadius.md,
  },
  todayText: {
    fontSize: themeBase.typography.fontSize.base,
  },
  clearButton: {
    flexDirection: "row",
    gap: themeBase.spacing.sm,
  },
  clearText: {
    fontSize: themeBase.typography.fontSize.base,
  },
});
