/**
 * RatingPicker - Star rating picker component
 * Extracted from CaptureForm for maintainability
 *
 * Note: Ratings are stored internally as 0-10 scale
 * Stars map to: 1★=2, 2★=4, 3★=6, 4★=8, 5★=10
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Line } from "react-native-svg";
import { starsToDecimal, decimalToStars } from "@trace/core";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { styles } from "../CaptureForm.styles";
import { themeBase } from "../../../../shared/theme/themeBase";
import { useTheme } from "../../../../shared/contexts/ThemeContext";

interface RatingPickerProps {
  visible: boolean;
  onClose: () => void;
  rating: number; // Stored as 0-10 scale
  onRatingChange: (rating: number) => void; // Returns 0-10 scale
  onSnackbar: (message: string) => void;
}

export function RatingPicker({
  visible,
  onClose,
  rating,
  onRatingChange,
  onSnackbar,
}: RatingPickerProps) {
  const dynamicTheme = useTheme();

  // Convert stored rating (0-10) to stars (1-5) for display
  const currentStars = decimalToStars(rating);

  return (
    <TopBarDropdownContainer visible={visible} onClose={onClose}>
      <View style={[styles.pickerContainer, { backgroundColor: dynamicTheme.colors.background.primary }]}>
        {/* Header with title and close button */}
        <View style={localStyles.header}>
          <Text style={[styles.pickerTitle, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.primary }]}>Set Rating</Text>
          <TouchableOpacity style={localStyles.closeButton} onPress={onClose}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.secondary} strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Star Rating Buttons - 1 to 5 stars */}
        <View style={styles.starRatingRow}>
          {[1, 2, 3, 4, 5].map((starValue) => (
            <TouchableOpacity
              key={starValue}
              style={styles.starRatingButton}
              onPress={() => {
                // Convert stars to 0-10 scale for storage
                const decimalValue = starsToDecimal(starValue);
                onRatingChange(decimalValue);
                onSnackbar(`Rating set to ${starValue}/5`);
                onClose();
              }}
            >
              <Text
                style={[
                  styles.starRatingIcon,
                  { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.tertiary },
                  currentStars >= starValue && { color: dynamicTheme.colors.status.blocked },
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
            style={[localStyles.clearButton, { backgroundColor: `${dynamicTheme.colors.functional.overdue}15` }]}
            onPress={() => {
              onRatingChange(0);
              onSnackbar("Rating cleared");
              onClose();
            }}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.functional.overdue} strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
            <Text style={[localStyles.clearButtonText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.functional.overdue }]}>Clear Rating</Text>
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
    marginBottom: themeBase.spacing.xs,
  },
  closeButton: {
    padding: 4,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
    gap: themeBase.spacing.sm,
    marginTop: themeBase.spacing.md,
  },
  clearButtonText: {
    fontSize: 16,
  },
});
