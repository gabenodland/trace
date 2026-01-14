/**
 * WholeNumberRatingPicker - 10-base (0-10) whole number rating picker
 * Uses a single scroll picker for whole numbers 0-10
 */

import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import Svg, { Line } from "react-native-svg";
import { clampRating } from "@trace/core";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { styles as formStyles } from "../EntryScreen.styles";
import { theme } from "../../../../shared/theme/theme";

interface WholeNumberRatingPickerProps {
  visible: boolean;
  onClose: () => void;
  rating: number; // Stored as 0-10 scale
  onRatingChange: (rating: number) => void;
  onSnackbar: (message: string) => void;
}

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;

export function WholeNumberRatingPicker({
  visible,
  onClose,
  rating,
  onRatingChange,
  onSnackbar,
}: WholeNumberRatingPickerProps) {
  const initialValue = Math.round(rating);
  const [selectedValue, setSelectedValue] = useState(initialValue);
  const scrollRef = useRef<ScrollView>(null);

  // Reset value when picker opens
  useEffect(() => {
    if (visible) {
      const value = Math.round(rating);
      setSelectedValue(value);
      // Scroll to position after a short delay
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: value * ITEM_HEIGHT, animated: false });
      }, 100);
    }
  }, [visible, rating]);

  // Handle scroll
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const newValue = Math.max(0, Math.min(10, index));

    if (newValue !== selectedValue) {
      setSelectedValue(newValue);
    }
  };

  // Handle save
  const handleSave = () => {
    const finalRating = clampRating(selectedValue);
    onRatingChange(finalRating);
    onSnackbar(`Rating set to ${finalRating}/10`);
    onClose();
  };

  const values = Array.from({ length: 11 }, (_, i) => i); // 0-10
  const paddingItems = Math.floor(VISIBLE_ITEMS / 2);

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
          <Text style={localStyles.valueText}>{selectedValue}</Text>
          <Text style={localStyles.valueLabel}>/10</Text>
        </View>

        {/* Picker */}
        <View style={localStyles.pickerContainer}>
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            onMomentumScrollEnd={handleScroll}
            style={localStyles.scrollView}
            contentContainerStyle={{ paddingVertical: paddingItems * ITEM_HEIGHT }}
          >
            {values.map((value) => (
              <TouchableOpacity
                key={value}
                style={localStyles.pickerItem}
                onPress={() => {
                  scrollRef.current?.scrollTo({ y: value * ITEM_HEIGHT, animated: true });
                }}
              >
                <Text
                  style={[
                    localStyles.pickerItemText,
                    value === selectedValue && localStyles.pickerItemTextSelected,
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
    fontSize: 42,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  valueLabel: {
    fontSize: 22,
    fontWeight: "500",
    color: theme.colors.text.secondary,
    marginLeft: 4,
  },
  pickerContainer: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    position: "relative",
    marginBottom: theme.spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  pickerItem: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  pickerItemText: {
    fontSize: 24,
    color: theme.colors.text.tertiary,
  },
  pickerItemTextSelected: {
    fontSize: 28,
    fontWeight: "600",
    color: theme.colors.text.primary,
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
