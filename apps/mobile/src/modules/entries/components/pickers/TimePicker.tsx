/**
 * TimePicker - Inline time selection component with scroll wheels
 * Uses PickerBottomSheet for consistent bottom sheet presentation
 */

import { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { PickerBottomSheet, RemoveIcon } from "../../../../components/sheets";
import { WheelPicker } from "../../../../components/pickers";
import { useTheme } from "../../../../shared/contexts/ThemeContext";
import { themeBase } from "../../../../shared/theme/themeBase";

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
  const dynamicTheme = useTheme();

  // Parse time from entryDate — if date-only (no 'T'), use current local time
  // This avoids the UTC midnight bug where new Date('YYYY-MM-DD') = midnight UTC = 6PM CST
  const getLocalDate = (dateStr: string) => {
    if (dateStr.includes('T')) return new Date(dateStr);
    return new Date(); // Date-only string: default to current time
  };

  const date = getLocalDate(entryDate);

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
      const d = getLocalDate(entryDate);
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

  const handleRemove = () => {
    onIncludeTimeChange(false);
    const newDate = new Date(entryDate);
    newDate.setMilliseconds(100); // Flag to indicate time should be hidden
    onEntryDateChange(newDate.toISOString());
    onSnackbar("Time removed");
    onClose();
  };

  const handleSetNow = () => {
    const now = new Date();
    const h = now.getHours();
    setSelectedHour(h === 0 ? 12 : h > 12 ? h - 12 : h);
    setSelectedMinute(now.getMinutes());
    setSelectedPeriod(h >= 12 ? "PM" : "AM");
  };

  // Format the currently selected time for display
  const formattedTime = `${selectedHour}:${selectedMinute.toString().padStart(2, "0")} ${selectedPeriod}`;

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Set Time"
      swipeArea="grabber"
      primaryAction={{
        label: "Save",
        onPress: handleSave,
      }}
      secondaryAction={
        includeTime
          ? {
              label: "Remove",
              variant: "danger",
              icon: <RemoveIcon color={dynamicTheme.colors.functional.overdue} />,
              onPress: handleRemove,
            }
          : {
              label: "Now",
              onPress: handleSetNow,
            }
      }
    >
      {/* Current time display */}
      <View style={[styles.currentTimeContainer, { backgroundColor: dynamicTheme.colors.background.secondary }]}>
        <Text style={[styles.currentTimeText, { fontFamily: dynamicTheme.typography.fontFamily.bold, color: dynamicTheme.colors.text.primary }]}>
          {formattedTime}
        </Text>
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
          <Text style={[styles.wheelLabel, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.tertiary }]}>
            Hour
          </Text>
        </View>

        {/* Separator */}
        <Text style={[styles.separator, { fontFamily: dynamicTheme.typography.fontFamily.bold, color: dynamicTheme.colors.text.primary }]}>
          :
        </Text>

        {/* Minute Picker */}
        <View style={styles.wheelContainer}>
          <WheelPicker
            items={MINUTE_ITEMS}
            selectedValue={selectedMinute}
            onValueChange={(value) => setSelectedMinute(value as number)}
            width={70}
          />
          <Text style={[styles.wheelLabel, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.tertiary }]}>
            Min
          </Text>
        </View>

        {/* AM/PM Picker */}
        <View style={styles.wheelContainer}>
          <WheelPicker
            items={PERIOD_ITEMS}
            selectedValue={selectedPeriod}
            onValueChange={(value) => setSelectedPeriod(value as "AM" | "PM")}
            width={70}
          />
          <Text style={[styles.wheelLabel, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.tertiary }]}>
            {" "}
          </Text>
        </View>
      </View>
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  currentTimeContainer: {
    alignItems: "center",
    paddingVertical: themeBase.spacing.sm,
    marginBottom: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
  },
  currentTimeText: {
    fontSize: 28,
  },
  wheelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: themeBase.spacing.sm,
    marginBottom: themeBase.spacing.md,
  },
  wheelContainer: {
    alignItems: "center",
  },
  wheelLabel: {
    fontSize: 12,
    marginTop: themeBase.spacing.xs,
  },
  separator: {
    fontSize: 28,
    marginBottom: 20, // Offset to align with wheel center
  },
});
