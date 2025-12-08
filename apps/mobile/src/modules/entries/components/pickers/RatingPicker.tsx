/**
 * RatingPicker - Star rating picker component
 * Extracted from CaptureForm for maintainability
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Line } from "react-native-svg";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { styles } from "../CaptureForm.styles";
import { theme } from "../../../../shared/theme/theme";

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
        {/* Header with title and close button */}
        <View style={localStyles.header}>
          <Text style={styles.pickerTitle}>Set Rating</Text>
          <TouchableOpacity style={localStyles.closeButton} onPress={onClose}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

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
            style={localStyles.clearButton}
            onPress={() => {
              onRatingChange(0);
              onSnackbar("Rating cleared");
              onClose();
            }}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
            <Text style={localStyles.clearButtonText}>Clear Rating</Text>
          </TouchableOpacity>
        )}
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
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: "#fee2e2",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.medium,
    color: "#dc2626",
  },
});
