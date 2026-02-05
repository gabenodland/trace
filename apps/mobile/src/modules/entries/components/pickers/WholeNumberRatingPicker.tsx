/**
 * WholeNumberRatingPicker - 10-base (0-10) whole number rating picker
 * Uses a single scroll picker for whole numbers 0-10
 */

import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { clampRating } from "@trace/core";
import { PickerBottomSheet, RemoveIcon } from "../../../../components/sheets";
import { useTheme } from "../../../../shared/contexts/ThemeContext";
import { themeBase } from "../../../../shared/theme/themeBase";

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
  const dynamicTheme = useTheme();
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

  // Handle remove
  const handleRemove = () => {
    onRatingChange(0);
    onSnackbar("Rating removed");
    onClose();
  };

  const values = Array.from({ length: 11 }, (_, i) => i); // 0-10
  const paddingItems = Math.floor(VISIBLE_ITEMS / 2);

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
          {selectedValue}
        </Text>
        <Text style={[styles.valueLabel, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.secondary }]}>
          /10
        </Text>
      </View>

      {/* Picker */}
      <View style={styles.pickerContainer}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={handleScroll}
          style={styles.scrollView}
          contentContainerStyle={{ paddingVertical: paddingItems * ITEM_HEIGHT }}
        >
          {values.map((value) => (
            <TouchableOpacity
              key={value}
              style={styles.pickerItem}
              onPress={() => {
                scrollRef.current?.scrollTo({ y: value * ITEM_HEIGHT, animated: true });
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
    fontSize: 42,
  },
  valueLabel: {
    fontSize: 22,
    marginLeft: 4,
  },
  pickerContainer: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    position: "relative",
    marginBottom: themeBase.spacing.md,
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
  },
  pickerItemTextSelected: {
    fontSize: 28,
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
});
