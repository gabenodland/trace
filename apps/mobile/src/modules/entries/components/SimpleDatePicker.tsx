import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../../../shared/theme/theme';

interface SimpleDatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  onClose: () => void;
}

export function SimpleDatePicker({ value, onChange, onClose }: SimpleDatePickerProps) {
  const currentDate = value || new Date();
  const today = new Date();

  // Get month/year
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  // Month names
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const days = [];

  // Add empty cells for days before month starts
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
  }

  // Add day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const isSelected = value &&
      date.getDate() === value.getDate() &&
      date.getMonth() === value.getMonth() &&
      date.getFullYear() === value.getFullYear();
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
        onPress={() => {
          const selected = new Date(year, month, day);
          selected.setHours(12, 0, 0, 0);
          onChange(selected);
        }}
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

  const handlePrevMonth = () => {
    const newDate = new Date(year, month - 1, 1);
    onChange(new Date(newDate.getFullYear(), newDate.getMonth(), value?.getDate() || 1));
  };

  const handleNextMonth = () => {
    const newDate = new Date(year, month + 1, 1);
    onChange(new Date(newDate.getFullYear(), newDate.getMonth(), value?.getDate() || 1));
  };

  return (
    <View style={styles.container}>
      {/* Header with month/year and navigation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
          <Text style={styles.navText}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.monthYear}>
          {monthNames[month]} {year}
        </Text>

        <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
          <Text style={styles.navText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day labels */}
      <View style={styles.weekDays}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <View key={i} style={styles.weekDayCell}>
            <Text style={styles.weekDayText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.daysGrid}>
        {days}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {value && (
          <TouchableOpacity
            onPress={() => {
              onChange(null);
              onClose();
            }}
            style={styles.actionButton}
          >
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={onClose}
          style={styles.actionButton}
        >
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  navButton: {
    padding: theme.spacing.sm,
  },
  navText: {
    fontSize: 28,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.normal,
  },
  monthYear: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  weekDays: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  weekDayText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%', // 100% / 7 days
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.bold,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  clearText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.tertiary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  doneText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});
