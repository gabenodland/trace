/**
 * PriorityPicker - Priority slider/button picker component
 * Uses PickerBottomSheet for consistent bottom sheet presentation
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import { PickerBottomSheet, RemoveIcon } from "../../../../components/sheets";
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
  const dynamicTheme = useTheme();

  const handleDone = () => {
    if (priority > 0) {
      onSnackbar(`Priority set to ${priority}`);
    }
    onClose();
  };

  const handleRemove = () => {
    onPriorityChange(0);
    onSnackbar("Priority removed");
    onClose();
  };

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Set Priority"
      primaryAction={{
        label: "Done",
        onPress: handleDone,
      }}
      secondaryAction={
        priority > 0
          ? {
              label: "Remove",
              variant: "danger",
              icon: <RemoveIcon color={dynamicTheme.colors.functional.overdue} />,
              onPress: handleRemove,
            }
          : undefined
      }
    >
      {/* Current Priority Display */}
      <View style={styles.display}>
        <Text
          style={[
            styles.displayValue,
            {
              fontFamily: dynamicTheme.typography.fontFamily.bold,
              color: dynamicTheme.colors.text.primary,
            },
          ]}
        >
          {priority || 0}
        </Text>
      </View>

      {/* Priority Slider */}
      <View style={styles.sliderContainer}>
        <Text
          style={[
            styles.sliderLabel,
            {
              fontFamily: dynamicTheme.typography.fontFamily.medium,
              color: dynamicTheme.colors.text.secondary,
            },
          ]}
        >
          1
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={100}
          step={1}
          value={priority || 1}
          onValueChange={(value) => onPriorityChange(Math.round(value))}
          minimumTrackTintColor={dynamicTheme.colors.functional.accent}
          maximumTrackTintColor={dynamicTheme.colors.border.medium}
          thumbTintColor={dynamicTheme.colors.functional.accent}
        />
        <Text
          style={[
            styles.sliderLabel,
            {
              fontFamily: dynamicTheme.typography.fontFamily.medium,
              color: dynamicTheme.colors.text.secondary,
            },
          ]}
        >
          100
        </Text>
      </View>

      {/* Quick Set Buttons - Row 1: 1-10 */}
      <View style={styles.quickButtonRow}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
          <TouchableOpacity
            key={value}
            style={[
              styles.quickButton,
              { backgroundColor: dynamicTheme.colors.background.secondary },
              priority === value && {
                backgroundColor: dynamicTheme.colors.functional.accent,
              },
            ]}
            onPress={() => onPriorityChange(value)}
          >
            <Text
              style={[
                styles.quickButtonText,
                {
                  fontFamily: dynamicTheme.typography.fontFamily.medium,
                  color: dynamicTheme.colors.text.primary,
                },
                priority === value && {
                  color: dynamicTheme.colors.background.primary,
                  fontFamily: dynamicTheme.typography.fontFamily.semibold,
                },
              ]}
            >
              {value}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Set Buttons - Row 2: 20, 30, etc */}
      <View style={styles.quickButtonRow}>
        {[20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => (
          <TouchableOpacity
            key={value}
            style={[
              styles.quickButton,
              { backgroundColor: dynamicTheme.colors.background.secondary },
              priority === value && {
                backgroundColor: dynamicTheme.colors.functional.accent,
              },
            ]}
            onPress={() => onPriorityChange(value)}
          >
            <Text
              style={[
                styles.quickButtonText,
                {
                  fontFamily: dynamicTheme.typography.fontFamily.medium,
                  color: dynamicTheme.colors.text.primary,
                },
                priority === value && {
                  color: dynamicTheme.colors.background.primary,
                  fontFamily: dynamicTheme.typography.fontFamily.semibold,
                },
              ]}
            >
              {value}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  display: {
    alignItems: "center",
    paddingVertical: themeBase.spacing.md,
  },
  displayValue: {
    fontSize: 48,
  },
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: themeBase.spacing.sm,
    marginBottom: themeBase.spacing.md,
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: themeBase.spacing.sm,
  },
  sliderLabel: {
    fontSize: 14,
    width: 30,
    textAlign: "center",
  },
  quickButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: themeBase.spacing.xs,
    marginBottom: themeBase.spacing.sm,
  },
  quickButton: {
    minWidth: 32,
    paddingVertical: themeBase.spacing.sm,
    paddingHorizontal: themeBase.spacing.sm,
    borderRadius: themeBase.borderRadius.sm,
    alignItems: "center",
  },
  quickButtonText: {
    fontSize: 14,
  },
});
