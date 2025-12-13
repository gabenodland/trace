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
import Svg, { Line } from "react-native-svg";
import { clampRating } from "@trace/core";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { styles as formStyles } from "../CaptureForm.styles";
import { theme } from "../../../../shared/theme/theme";

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
      <View style={localStyles.pickerColumn}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={onScroll}
          scrollEnabled={!disabled}
          style={[localStyles.scrollView, disabled && localStyles.scrollViewDisabled]}
          contentContainerStyle={{ paddingVertical: paddingItems * ITEM_HEIGHT }}
        >
          {values.map((value) => (
            <TouchableOpacity
              key={value}
              style={localStyles.pickerItem}
              onPress={() => {
                if (!disabled) {
                  scrollRef.current?.scrollTo({ y: value * ITEM_HEIGHT, animated: true });
                }
              }}
            >
              <Text
                style={[
                  localStyles.pickerItemText,
                  value === selectedValue && localStyles.pickerItemTextSelected,
                  disabled && localStyles.pickerItemTextDisabled,
                ]}
              >
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {/* Selection highlight */}
        <View style={localStyles.selectionHighlight} pointerEvents="none" />
      </View>
    );
  };

  const wholeNumbers = Array.from({ length: 11 }, (_, i) => i); // 0-10
  const decimalNumbers = Array.from({ length: 10 }, (_, i) => i); // 0-9

  return (
    <TopBarDropdownContainer visible={visible} onClose={onClose}>
      <View style={formStyles.pickerContainer}>
        {/* Header with title and close button */}
        <View style={localStyles.header}>
          <Text style={formStyles.pickerTitle}>Set Rating</Text>
          <TouchableOpacity style={localStyles.closeButton} onPress={onClose}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Current value display */}
        <View style={localStyles.valueDisplay}>
          <Text style={localStyles.valueText}>
            {(wholeValue + decimalValue / 10).toFixed(1)}
          </Text>
          <Text style={localStyles.valueLabel}>/10</Text>
        </View>

        {/* Picker columns */}
        <View style={localStyles.pickerRow}>
          {renderPickerColumn(wholeNumbers, wholeValue, wholeScrollRef, handleWholeScroll)}
          <Text style={localStyles.decimalPoint}>.</Text>
          {renderPickerColumn(decimalNumbers, decimalValue, decimalScrollRef, handleDecimalScroll, wholeValue === 10)}
        </View>

        {/* Action buttons */}
        <View style={localStyles.buttonRow}>
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
              <Text style={localStyles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[localStyles.saveButton, !rating && localStyles.saveButtonFull]}
            onPress={handleSave}
          >
            <Text style={localStyles.saveButtonText}>Set Rating</Text>
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
    marginBottom: theme.spacing.md,
  },
  closeButton: {
    padding: 4,
  },
  valueDisplay: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  valueText: {
    fontSize: 36,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  valueLabel: {
    fontSize: 20,
    fontWeight: "500",
    color: theme.colors.text.secondary,
    marginLeft: 4,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    marginBottom: theme.spacing.md,
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
    color: theme.colors.text.tertiary,
  },
  pickerItemTextSelected: {
    fontSize: 26,
    fontWeight: "600",
    color: theme.colors.text.primary,
  },
  pickerItemTextDisabled: {
    color: theme.colors.text.tertiary,
  },
  selectionHighlight: {
    position: "absolute",
    top: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border.medium,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  decimalPoint: {
    fontSize: 26,
    fontWeight: "600",
    color: theme.colors.text.primary,
    marginHorizontal: 4,
  },
  buttonRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
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
  saveButton: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.text.primary,
  },
  saveButtonFull: {
    flex: 1,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.semibold,
    color: "#ffffff",
  },
});
