/**
 * PriorityPicker - Priority level picker using named levels
 * Uses PickerBottomSheet for consistent bottom sheet presentation
 *
 * Priority levels: Urgent (4), High (3), Medium (2), Low (1), None (0)
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ALL_PRIORITIES, type PriorityLevel, type PriorityCategory } from "@trace/core";
import { PickerBottomSheet } from "../../../../components/sheets";
import { useTheme } from "../../../../shared/contexts/ThemeContext";
import { themeBase } from "../../../../shared/theme/themeBase";

interface PriorityPickerProps {
  visible: boolean;
  onClose: () => void;
  priority: number;
  onPriorityChange: (priority: number) => void;
  onSnackbar: (message: string) => void;
}

export function PriorityPicker({
  visible,
  onClose,
  priority,
  onPriorityChange,
  onSnackbar,
}: PriorityPickerProps) {
  const theme = useTheme();

  // Get color for a priority category from theme
  const getPriorityColor = (category: PriorityCategory): string => {
    return theme.colors.priority[category];
  };

  const handleSelect = (value: PriorityLevel) => {
    const info = ALL_PRIORITIES.find(p => p.value === value);
    onPriorityChange(value);
    if (value > 0 && info) {
      onSnackbar(`Priority set to ${info.label}`);
    } else {
      onSnackbar("Priority removed");
    }
    onClose();
  };

  // Find current priority info
  const currentPriority = ALL_PRIORITIES.find(p => p.value === priority) || ALL_PRIORITIES[4]; // Default to "None"

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Set Priority"
      height="auto"
    >
      {/* Current Priority Display */}
      <View style={styles.currentDisplay}>
        <View
          style={[
            styles.currentIndicator,
            { backgroundColor: getPriorityColor(currentPriority.category) },
          ]}
        />
        <Text
          style={[
            styles.currentLabel,
            {
              fontFamily: theme.typography.fontFamily.semibold,
              color: theme.colors.text.primary,
            },
          ]}
        >
          {currentPriority.label}
        </Text>
      </View>

      {/* Priority Options */}
      <View style={styles.optionsContainer}>
        {ALL_PRIORITIES.map((priorityInfo) => {
          const isSelected = priority === priorityInfo.value;
          const color = getPriorityColor(priorityInfo.category);

          return (
            <TouchableOpacity
              key={priorityInfo.value}
              style={[
                styles.option,
                { backgroundColor: theme.colors.background.secondary },
                isSelected && {
                  backgroundColor: color + '20', // 20% opacity
                  borderColor: color,
                  borderWidth: 2,
                },
              ]}
              onPress={() => handleSelect(priorityInfo.value)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.optionIndicator,
                  { backgroundColor: color },
                ]}
              />
              <Text
                style={[
                  styles.optionLabel,
                  {
                    fontFamily: isSelected
                      ? theme.typography.fontFamily.semibold
                      : theme.typography.fontFamily.medium,
                    color: isSelected ? color : theme.colors.text.primary,
                  },
                ]}
              >
                {priorityInfo.label}
              </Text>
              {isSelected && (
                <View style={styles.checkmark}>
                  <Text
                    style={[
                      styles.checkmarkText,
                      { color: color },
                    ]}
                  >
                    ✓
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bottom padding */}
      <View style={{ height: themeBase.spacing.md }} />
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  currentDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: themeBase.spacing.lg,
    gap: themeBase.spacing.sm,
  },
  currentIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  currentLabel: {
    fontSize: themeBase.typography.fontSize.xl,
  },
  optionsContainer: {
    gap: themeBase.spacing.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
    borderWidth: 0,
    borderColor: "transparent",
  },
  optionIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: themeBase.spacing.md,
  },
  optionLabel: {
    fontSize: themeBase.typography.fontSize.base,
    flex: 1,
  },
  checkmark: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkText: {
    fontSize: 18,
    fontWeight: "bold",
  },
});
