/**
 * PriorityPicker - Priority slider/button picker component
 * Extracted from CaptureForm for maintainability
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Line } from "react-native-svg";
import Slider from "@react-native-community/slider";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { styles } from "../CaptureForm.styles";
import { themeBase } from "../../../../shared/theme/themeBase";
import { useTheme } from "../../../../shared/contexts/ThemeContext";

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

  return (
    <TopBarDropdownContainer visible={visible} onClose={onClose}>
      <View style={[styles.pickerContainer, { backgroundColor: dynamicTheme.colors.background.primary }]}>
        {/* Header with title and close button */}
        <View style={localStyles.header}>
          <Text style={[styles.pickerTitle, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.primary }]}>Set Priority (1-100)</Text>
          <TouchableOpacity style={localStyles.closeButton} onPress={onClose}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.secondary} strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Current Priority Display */}
        <View style={styles.priorityDisplay}>
          <Text style={[styles.priorityValueText, { fontFamily: dynamicTheme.typography.fontFamily.bold, color: dynamicTheme.colors.text.primary }]}>{priority || 0}</Text>
        </View>

        {/* Priority Slider */}
        <View style={styles.sliderContainer}>
          <Text style={[styles.sliderLabel, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.secondary }]}>1</Text>
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
          <Text style={[styles.sliderLabel, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.secondary }]}>100</Text>
        </View>

        {/* Quick Set Buttons - Row 1: 1-10 */}
        <View style={styles.quickButtonRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.quickButton,
                { backgroundColor: dynamicTheme.colors.background.secondary },
                priority === value && { backgroundColor: dynamicTheme.colors.functional.accent },
              ]}
              onPress={() => onPriorityChange(value)}
            >
              <Text
                style={[
                  styles.quickButtonText,
                  { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary },
                  priority === value && { color: dynamicTheme.colors.background.primary, fontFamily: dynamicTheme.typography.fontFamily.semibold },
                ]}
              >
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Set Buttons - Row 2: 20, 30, 40, 50, 60, 70, 80, 90, 100 */}
        <View style={styles.quickButtonRow}>
          {[20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.quickButton,
                { backgroundColor: dynamicTheme.colors.background.secondary },
                priority === value && { backgroundColor: dynamicTheme.colors.functional.accent },
              ]}
              onPress={() => onPriorityChange(value)}
            >
              <Text
                style={[
                  styles.quickButtonText,
                  { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary },
                  priority === value && { color: dynamicTheme.colors.background.primary, fontFamily: dynamicTheme.typography.fontFamily.semibold },
                ]}
              >
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={localStyles.actionRow}>
          {priority > 0 && (
            <TouchableOpacity
              style={[localStyles.clearButton, { backgroundColor: `${dynamicTheme.colors.functional.overdue}15` }]}
              onPress={() => {
                onPriorityChange(0);
                onSnackbar("Priority cleared");
                onClose();
              }}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.functional.overdue} strokeWidth={2}>
                <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
                <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
              </Svg>
              <Text style={[localStyles.clearButtonText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.functional.overdue }]}>Clear</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[localStyles.doneButton, { backgroundColor: dynamicTheme.colors.text.primary }]}
            onPress={() => {
              if (priority > 0) {
                onSnackbar(`Priority set to ${priority}`);
              }
              onClose();
            }}
          >
            <Text style={[localStyles.doneButtonText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.background.primary }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TopBarDropdownContainer>
  );
}

const localStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: themeBase.spacing.xs,
  },
  closeButton: {
    padding: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: themeBase.spacing.sm,
    marginTop: themeBase.spacing.md,
  },
  clearButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
    gap: themeBase.spacing.sm,
  },
  clearButtonText: {
    fontSize: 16,
  },
  doneButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
  },
  doneButtonText: {
    fontSize: 16,
  },
});
