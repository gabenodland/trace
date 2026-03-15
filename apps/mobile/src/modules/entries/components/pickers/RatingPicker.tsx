/**
 * RatingPicker - Dispatches to the correct rating picker based on ratingType
 *
 * - 'stars' → Star picker (1-5 stars, stored as 0-10 scale)
 * - 'decimal_whole' → WholeNumberRatingPicker (0-10)
 * - 'decimal' → DecimalRatingPicker (0.0-10.0)
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { starsToDecimal, decimalToStars } from "@trace/core";
import type { RatingType } from "@trace/core";
import { PickerBottomSheet, RemoveIcon } from "../../../../components/sheets";
import { useTheme } from "../../../../shared/contexts/ThemeContext";
import { themeBase } from "../../../../shared/theme/themeBase";
import { Icon } from "../../../../shared/components";
import { WholeNumberRatingPicker } from "./WholeNumberRatingPicker";
import { DecimalRatingPicker } from "./DecimalRatingPicker";

interface RatingPickerProps {
  visible: boolean;
  onClose: () => void;
  rating: number; // Stored as 0-10 scale
  onRatingChange: (rating: number) => void; // Returns 0-10 scale
  onSnackbar: (message: string) => void;
  ratingType?: RatingType;
}

export function RatingPicker({
  visible,
  onClose,
  rating,
  onRatingChange,
  onSnackbar,
  ratingType = 'stars',
}: RatingPickerProps) {
  // Delegate to the appropriate picker
  if (ratingType === 'decimal_whole') {
    return (
      <WholeNumberRatingPicker
        visible={visible}
        onClose={onClose}
        rating={rating}
        onRatingChange={onRatingChange}
        onSnackbar={onSnackbar}
      />
    );
  }

  if (ratingType === 'decimal') {
    return (
      <DecimalRatingPicker
        visible={visible}
        onClose={onClose}
        rating={rating}
        onRatingChange={onRatingChange}
        onSnackbar={onSnackbar}
      />
    );
  }

  // Default: star picker
  return <StarRatingPicker
    visible={visible}
    onClose={onClose}
    rating={rating}
    onRatingChange={onRatingChange}
    onSnackbar={onSnackbar}
  />;
}

/**
 * Star rating picker (1-5 stars)
 * Stars map to: 1★=2, 2★=4, 3★=6, 4★=8, 5★=10
 */
function StarRatingPicker({
  visible,
  onClose,
  rating,
  onRatingChange,
  onSnackbar,
}: Omit<RatingPickerProps, 'ratingType'>) {
  const dynamicTheme = useTheme();

  // Convert stored rating (0-10) to stars (1-5) for display
  const currentStars = decimalToStars(rating);

  const handleStarPress = (starValue: number) => {
    // Convert stars to 0-10 scale for storage
    const decimalValue = starsToDecimal(starValue);
    onRatingChange(decimalValue);
    onSnackbar(`Rating set to ${starValue}/5`);
    onClose();
  };

  const handleRemove = () => {
    onRatingChange(0);
    onSnackbar("Rating removed");
    onClose();
  };

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Set Rating"
      secondaryAction={
        rating > 0
          ? {
              label: "Remove",
              variant: "danger",
              icon: <RemoveIcon color={dynamicTheme.colors.functional.overdue} />,
              onPress: handleRemove,
            }
          : undefined
      }
    >
      {/* Star Rating Buttons - 1 to 5 stars */}
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((starValue) => (
          <TouchableOpacity
            key={starValue}
            style={styles.starButton}
            onPress={() => handleStarPress(starValue)}
          >
            <Icon
              name="StarFilled"
              size={40}
              color={
                currentStars >= starValue
                  ? dynamicTheme.colors.status.blocked
                  : dynamicTheme.colors.border.medium
              }
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Current rating label */}
      {rating > 0 && (
        <Text
          style={[
            styles.ratingLabel,
            {
              fontFamily: dynamicTheme.typography.fontFamily.medium,
              color: dynamicTheme.colors.text.secondary,
            },
          ]}
        >
          {currentStars} of 5 stars
        </Text>
      )}
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  starRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: themeBase.spacing.xl,
    gap: themeBase.spacing.sm,
  },
  starButton: {
    padding: themeBase.spacing.sm,
  },
  ratingLabel: {
    textAlign: "center",
    fontSize: 14,
  },
});
