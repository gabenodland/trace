/**
 * PriorityPicker - Priority slider/button picker component
 * Extracted from CaptureForm for maintainability
 */

import { View, Text, TouchableOpacity } from "react-native";
import Slider from "@react-native-community/slider";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { styles } from "../CaptureForm.styles";

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
        <Text style={styles.pickerTitle}>Set Priority (1-100)</Text>

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
        <View style={styles.pickerActionRow}>
          {priority > 0 && (
            <TouchableOpacity
              style={[styles.pickerActionButton, styles.pickerButtonDanger]}
              onPress={() => {
                onPriorityChange(0);
                onSnackbar("Priority cleared");
                onClose();
              }}
            >
              <Text style={[styles.pickerButtonText, styles.pickerButtonDangerText]}>
                Clear
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.pickerActionButton, styles.pickerButtonPrimary]}
            onPress={() => {
              if (priority > 0) {
                onSnackbar(`Priority set to ${priority}`);
              }
              onClose();
            }}
          >
            <Text style={styles.pickerButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TopBarDropdownContainer>
  );
}
