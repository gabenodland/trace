/**
 * TimePicker - Time selection modal component
 * Extracted from CaptureForm for maintainability
 */

import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { styles } from "../CaptureForm.styles";

interface TimePickerProps {
  visible: boolean;
  onClose: () => void;
  entryDate: string;
  onEntryDateChange: (date: string) => void;
  onIncludeTimeChange: (include: boolean) => void;
}

export function TimePicker({
  visible,
  onClose,
  entryDate,
  onEntryDateChange,
  onIncludeTimeChange,
}: TimePickerProps) {
  // Native picker state managed internally
  const [showNativePicker, setShowNativePicker] = useState(false);

  return (
    <>
      <TopBarDropdownContainer visible={visible} onClose={onClose}>
        <View style={styles.datePickerContainer}>
          <Text style={styles.datePickerTitle}>Set Time</Text>

          {/* Change Time Button */}
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => {
              onClose();
              // Show native picker after a small delay
              setTimeout(() => {
                setShowNativePicker(true);
              }, 100);
            }}
          >
            <Text style={styles.datePickerButtonText}>
              Change Time (
              {new Date(entryDate).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
              )
            </Text>
          </TouchableOpacity>

          {/* Clear Time Button */}
          <TouchableOpacity
            style={[styles.datePickerButton, styles.datePickerButtonDanger]}
            onPress={() => {
              // Clear time by setting milliseconds to 100 (flag to hide time but remember it)
              onIncludeTimeChange(false);
              const date = new Date(entryDate);
              date.setMilliseconds(100);
              onEntryDateChange(date.toISOString());
              onClose();
            }}
          >
            <Text
              style={[styles.datePickerButtonText, styles.datePickerButtonDangerText]}
            >
              Clear Time
            </Text>
          </TouchableOpacity>
        </View>
      </TopBarDropdownContainer>

      {/* Native Time Picker (triggered from modal) */}
      {showNativePicker && (
        <DateTimePicker
          value={new Date(entryDate)}
          mode="time"
          display="default"
          onChange={(event, selectedDate) => {
            if (event.type === "set" && selectedDate) {
              // Set milliseconds to 0 to indicate time should be shown
              selectedDate.setMilliseconds(0);
              onEntryDateChange(selectedDate.toISOString());
            }
            setShowNativePicker(false);
          }}
        />
      )}
    </>
  );
}
