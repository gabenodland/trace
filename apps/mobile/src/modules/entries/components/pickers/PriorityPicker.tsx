/**
 * PriorityPicker - Priority slider/button picker component
 * Extracted from CaptureForm for maintainability
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Line } from "react-native-svg";
import Slider from "@react-native-community/slider";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { styles } from "../CaptureForm.styles";
import { theme } from "../../../../shared/theme/theme";

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
  return (
    <TopBarDropdownContainer visible={visible} onClose={onClose}>
      <View style={styles.pickerContainer}>
        {/* Header with title and close button */}
        <View style={localStyles.header}>
          <Text style={styles.pickerTitle}>Set Priority (1-100)</Text>
          <TouchableOpacity style={localStyles.closeButton} onPress={onClose}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Current Priority Display */}
        <View style={styles.priorityDisplay}>
          <Text style={styles.priorityValueText}>{priority || 0}</Text>
        </View>

        {/* Priority Slider */}
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>1</Text>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={100}
            step={1}
            value={priority || 1}
            onValueChange={(value) => onPriorityChange(Math.round(value))}
            minimumTrackTintColor="#3b82f6"
            maximumTrackTintColor="#d1d5db"
            thumbTintColor="#3b82f6"
          />
          <Text style={styles.sliderLabel}>100</Text>
        </View>

        {/* Quick Set Buttons - Row 1: 1-10 */}
        <View style={styles.quickButtonRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.quickButton,
                priority === value && styles.quickButtonSelected,
              ]}
              onPress={() => onPriorityChange(value)}
            >
              <Text
                style={[
                  styles.quickButtonText,
                  priority === value && styles.quickButtonTextSelected,
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
                priority === value && styles.quickButtonSelected,
              ]}
              onPress={() => onPriorityChange(value)}
            >
              <Text
                style={[
                  styles.quickButtonText,
                  priority === value && styles.quickButtonTextSelected,
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
              style={localStyles.clearButton}
              onPress={() => {
                onPriorityChange(0);
                onSnackbar("Priority cleared");
                onClose();
              }}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}>
                <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
                <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
              </Svg>
              <Text style={localStyles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={localStyles.doneButton}
            onPress={() => {
              if (priority > 0) {
                onSnackbar(`Priority set to ${priority}`);
              }
              onClose();
            }}
          >
            <Text style={localStyles.doneButtonText}>Done</Text>
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
    marginBottom: theme.spacing.xs,
  },
  closeButton: {
    padding: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  clearButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
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
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.text.primary,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.medium,
    color: "#ffffff",
  },
});
