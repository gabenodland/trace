/**
 * DecimalRatingPicker - Decimal (0-10) rating picker component
 * Uses two scroll pickers: whole number (0-10) and decimal (0-9)
 *
 * Rules:
 * - If whole = 10, decimal is locked to 0
 * - If whole = 0, decimal must be >= 1 (minimum 0.1)
 */

import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { clampRating } from "@trace/core";
import { PickerBottomSheet, RemoveIcon } from "../../../../components/sheets";
import { useTheme } from "../../../../shared/contexts/ThemeContext";
import { themeBase } from "../../../../shared/theme/themeBase";

interface DecimalRatingPickerProps {
  visible: boolean;
  onClose: () => void;
  rating: number; // Stored as 0-10 scale
  onRatingChange: (rating: number) => void;
  onSnackbar: (message: string) => void;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;

export function DecimalRatingPicker({
  visible,
  onClose,
  rating,
  onRatingChange,
  onSnackbar,
}: DecimalRatingPickerProps) {
  const dynamicTheme = useTheme();

  // Parse the current rating into whole and decimal parts
  const initialWhole = Math.floor(rating);
  const initialDecimal = Math.round((rating - initialWhole) * 10);

  const [wholeValue, setWholeValue] = useState(initialWhole);
  const [decimalValue, setDecimalValue] = useState(initialDecimal);

  const wholeScrollRef = useRef<ScrollView>(null);
  const decimalScrollRef = useRef<ScrollView>(null);

  // Reset values when picker opens
  useEffect(() => {
    if (visible) {
      const whole = Math.floor(rating);
      const decimal = Math.round((rating - whole) * 10);
      setWholeValue(whole);
      setDecimalValue(decimal);

      // Scroll to positions after a short delay
      setTimeout(() => {
        wholeScrollRef.current?.scrollTo({ y: whole * ITEM_HEIGHT, animated: false });
        decimalScrollRef.current?.scrollTo({ y: decimal * ITEM_HEIGHT, animated: false });
      }, 100);
    }
  }, [visible, rating]);

  // Handle whole number scroll
  const handleWholeScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const newWhole = Math.max(0, Math.min(10, index));

    if (newWhole !== wholeValue) {
      setWholeValue(newWhole);

      // If 10, lock decimal to 0
      if (newWhole === 10 && decimalValue !== 0) {
        setDecimalValue(0);
        decimalScrollRef.current?.scrollTo({ y: 0, animated: true });
      }
      // If 0, ensure decimal is at least 1
      if (newWhole === 0 && decimalValue === 0) {
        setDecimalValue(1);
        decimalScrollRef.current?.scrollTo({ y: ITEM_HEIGHT, animated: true });
      }
    }
  };

  // Handle decimal scroll
  const handleDecimalScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    let newDecimal = Math.max(0, Math.min(9, index));

    // If whole is 10, lock to 0
    if (wholeValue === 10) {
      newDecimal = 0;
    }
    // If whole is 0, minimum is 1
    if (wholeValue === 0 && newDecimal === 0) {
      newDecimal = 1;
    }

    if (newDecimal !== decimalValue) {
      setDecimalValue(newDecimal);
    }
  };

  // Handle save
  const handleSave = () => {
    const finalRating = clampRating(wholeValue + decimalValue / 10);
    onRatingChange(finalRating);
    onSnackbar(`Rating set to ${finalRating.toFixed(1)}/10`);
    onClose();
  };

  // Handle remove
  const handleRemove = () => {
    onRatingChange(0);
    onSnackbar("Rating removed");
    onClose();
  };

  // Render picker column
  const renderPickerColumn = (
    values: number[],
    selectedValue: number,
    scrollRef: React.RefObject<ScrollView | null>,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void,
    disabled?: boolean
  ) => {
    const paddingItems = Math.floor(VISIBLE_ITEMS / 2);

    return (
      <View style={styles.pickerColumn}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={onScroll}
          scrollEnabled={!disabled}
          style={[styles.scrollView, disabled && styles.scrollViewDisabled]}
          contentContainerStyle={{ paddingVertical: paddingItems * ITEM_HEIGHT }}
        >
          {values.map((value) => (
            <TouchableOpacity
              key={value}
              style={styles.pickerItem}
              onPress={() => {
                if (!disabled) {
                  scrollRef.current?.scrollTo({ y: value * ITEM_HEIGHT, animated: true });
                }
              }}
            >
              <Text
                style={[
                  styles.pickerItemText,
                  { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.tertiary },
                  value === selectedValue && [
                    styles.pickerItemTextSelected,
                    { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.primary }
                  ],
                  disabled && { opacity: 0.4 },
                ]}
              >
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {/* Selection highlight */}
        <View style={[styles.selectionHighlight, { borderColor: dynamicTheme.colors.border.medium, backgroundColor: dynamicTheme.colors.background.tertiary }]} pointerEvents="none" />
      </View>
    );
  };

  const wholeNumbers = Array.from({ length: 11 }, (_, i) => i); // 0-10
  const decimalNumbers = Array.from({ length: 10 }, (_, i) => i); // 0-9

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Set Rating"
      primaryAction={{
        label: "Set Rating",
        variant: "primary",
        onPress: handleSave,
      }}
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
      {/* Current value display */}
      <View style={styles.valueDisplay}>
        <Text style={[styles.valueText, { fontFamily: dynamicTheme.typography.fontFamily.bold, color: dynamicTheme.colors.text.primary }]}>
          {(wholeValue + decimalValue / 10).toFixed(1)}
        </Text>
        <Text style={[styles.valueLabel, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.secondary }]}>
          /10
        </Text>
      </View>

      {/* Picker columns */}
      <View style={styles.pickerRow}>
        {renderPickerColumn(wholeNumbers, wholeValue, wholeScrollRef, handleWholeScroll)}
        <Text style={[styles.decimalPoint, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.primary }]}>
          .
        </Text>
        {renderPickerColumn(decimalNumbers, decimalValue, decimalScrollRef, handleDecimalScroll, wholeValue === 10)}
      </View>
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  valueDisplay: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginBottom: themeBase.spacing.md,
  },
  valueText: {
    fontSize: 36,
  },
  valueLabel: {
    fontSize: 20,
    marginLeft: 4,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    marginBottom: themeBase.spacing.md,
  },
  pickerColumn: {
    width: 60,
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    position: "relative",
  },
  scrollView: {
    flex: 1,
  },
  scrollViewDisabled: {
    opacity: 0.4,
  },
  pickerItem: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  pickerItemText: {
    fontSize: 22,
  },
  pickerItemTextSelected: {
    fontSize: 26,
  },
  selectionHighlight: {
    position: "absolute",
    top: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    zIndex: -1,
  },
  decimalPoint: {
    fontSize: 26,
    marginHorizontal: 4,
  },
});
