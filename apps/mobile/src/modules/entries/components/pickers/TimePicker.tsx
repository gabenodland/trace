/**
 * TimePicker - Inline time selection component with scroll wheels
 * iOS-style wheel picker for hour, minute, and AM/PM selection
 */

import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Line } from "react-native-svg";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { WheelPicker } from "../../../../components/pickers";
import { theme } from "../../../../shared/theme/theme";

interface TimePickerProps {
  visible: boolean;
  onClose: () => void;
  entryDate: string;
  onEntryDateChange: (date: string) => void;
  onIncludeTimeChange: (include: boolean) => void;
  onSnackbar: (message: string) => void;
  includeTime: boolean;
}

// Generate hour options (1-12, then 12 again at end for wrap-around feel)
const HOUR_ITEMS = [...[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 12].map((h, i) => ({
  value: h,
  label: h.toString(),
  key: i, // Unique key since 12 appears twice
}));

// Generate minute options (00-59, then 00 again at end for wrap-around feel)
const MINUTE_ITEMS = [...Array.from({ length: 60 }, (_, i) => i), 0].map((m, i) => ({
  value: m,
  label: m.toString().padStart(2, "0"),
  key: i, // Unique key since 0 appears twice
}));

// AM/PM options
const PERIOD_ITEMS = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
];

export function TimePicker({
  visible,
  onClose,
  entryDate,
  onEntryDateChange,
  onIncludeTimeChange,
  onSnackbar,
  includeTime,
}: TimePickerProps) {
  const date = new Date(entryDate);

  // Local state for hour/minute/period selection
  const [selectedHour, setSelectedHour] = useState(() => {
    const h = date.getHours();
    return h === 0 ? 12 : h > 12 ? h - 12 : h;
  });
  const [selectedMinute, setSelectedMinute] = useState(() => date.getMinutes());
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">(() => {
    return date.getHours() >= 12 ? "PM" : "AM";
  });

  // Reset selection when picker opens
  useEffect(() => {
    if (visible) {
      const d = new Date(entryDate);
      const h = d.getHours();
      setSelectedHour(h === 0 ? 12 : h > 12 ? h - 12 : h);
      setSelectedMinute(d.getMinutes());
      setSelectedPeriod(h >= 12 ? "PM" : "AM");
    }
  }, [visible, entryDate]);

  const handleSave = () => {
    const newDate = new Date(entryDate);
    let hour24 = selectedHour;
    if (selectedPeriod === "PM" && selectedHour !== 12) {
      hour24 = selectedHour + 12;
    } else if (selectedPeriod === "AM" && selectedHour === 12) {
      hour24 = 0;
    }
    newDate.setHours(hour24, selectedMinute, 0, 0);
    onEntryDateChange(newDate.toISOString());
    onIncludeTimeChange(true);
    onSnackbar("Time updated");
    onClose();
  };

  const handleClear = () => {
    onIncludeTimeChange(false);
    const newDate = new Date(entryDate);
    newDate.setMilliseconds(100); // Flag to indicate time should be hidden
    onEntryDateChange(newDate.toISOString());
    onSnackbar("Time cleared");
    onClose();
  };

  // Format the currently selected time for display
  const formattedTime = `${selectedHour}:${selectedMinute.toString().padStart(2, "0")} ${selectedPeriod}`;

  return (
    <TopBarDropdownContainer visible={visible} onClose={onClose}>
      <View style={styles.container}>
        {/* Header with title and close button */}
        <View style={styles.header}>
          <Text style={styles.title}>Set Time</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Current time display */}
        <View style={styles.currentTimeContainer}>
          <Text style={styles.currentTimeText}>{formattedTime}</Text>
        </View>

        {/* Wheel Pickers Row */}
        <View style={styles.wheelRow}>
          {/* Hour Picker */}
          <View style={styles.wheelContainer}>
            <WheelPicker
              items={HOUR_ITEMS}
              selectedValue={selectedHour}
              onValueChange={(value) => setSelectedHour(value as number)}
              width={70}
            />
            <Text style={styles.wheelLabel}>Hour</Text>
          </View>

          {/* Separator */}
          <Text style={styles.separator}>:</Text>

          {/* Minute Picker */}
          <View style={styles.wheelContainer}>
            <WheelPicker
              items={MINUTE_ITEMS}
              selectedValue={selectedMinute}
              onValueChange={(value) => setSelectedMinute(value as number)}
              width={70}
            />
            <Text style={styles.wheelLabel}>Min</Text>
          </View>

          {/* AM/PM Picker */}
          <View style={styles.wheelContainer}>
            <WheelPicker
              items={PERIOD_ITEMS}
              selectedValue={selectedPeriod}
              onValueChange={(value) => setSelectedPeriod(value as "AM" | "PM")}
              width={70}
            />
            <Text style={styles.wheelLabel}></Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          {includeTime && (
            <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}>
                <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
                <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
              </Svg>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.doneButton, !includeTime && styles.doneButtonFull]}
            onPress={handleSave}
          >
            <Text style={styles.doneButtonText}>Save Time</Text>
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
  header: {
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
  currentTimeContainer: {
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
  },
  currentTimeText: {
    fontSize: 28,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  wheelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  wheelContainer: {
    alignItems: "center",
  },
  wheelLabel: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing.xs,
    fontWeight: theme.typography.fontWeight.medium,
  },
  separator: {
    fontSize: 28,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: 20, // Offset to align with wheel center
  },
  actionsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  clearButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: "#fee2e2",
    gap: theme.spacing.sm,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.medium,
    color: "#dc2626",
  },
  doneButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.text.primary,
  },
  doneButtonFull: {
    flex: 1,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.medium,
    color: "#ffffff",
  },
});
