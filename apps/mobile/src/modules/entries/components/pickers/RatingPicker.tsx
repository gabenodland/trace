/**
 * RatingPicker - Star rating picker component
 * Extracted from CaptureForm for maintainability
 */

import { View, Text, TouchableOpacity } from "react-native";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { styles } from "../CaptureForm.styles";

interface RatingPickerProps {
  visible: boolean;
  onClose: () => void;
  rating: number;
  onRatingChange: (rating: number) => void;
  onSnackbar: (message: string) => void;
}

export function RatingPicker({
  visible,
  onClose,
  rating,
  onRatingChange,
  onSnackbar,
}: RatingPickerProps) {
  return (
    <TopBarDropdownContainer visible={visible} onClose={onClose}>
      <View style={styles.pickerContainer}>
        <Text style={styles.pickerTitle}>Set Rating</Text>

        {/* Star Rating Buttons - 1 to 5 stars */}
        <View style={styles.starRatingRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <TouchableOpacity
              key={value}
              style={styles.starRatingButton}
              onPress={() => {
                onRatingChange(value);
                onSnackbar(`Rating set to ${value}/5`);
                onClose();
              }}
            >
              <Text
                style={[
                  styles.starRatingIcon,
                  rating >= value && styles.starRatingIconActive,
                ]}
              >
                ★
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Clear Rating Button */}
        {rating > 0 && (
          <TouchableOpacity
            style={[styles.pickerButton, styles.pickerButtonDanger]}
            onPress={() => {
              onRatingChange(0);
              onSnackbar("Rating cleared");
              onClose();
            }}
          >
            <Text style={[styles.pickerButtonText, styles.pickerButtonDangerText]}>
              Clear Rating
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TopBarDropdownContainer>
  );
}
