/**
 * WheelPicker - Custom scroll wheel picker component
 * iOS-style wheel picker using ScrollView with snap behavior
 */

import { useRef, useEffect, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { theme } from "../../shared/theme/theme";

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 3;

interface WheelPickerProps {
  items: { value: string | number; label: string; key?: number }[];
  selectedValue: string | number;
  onValueChange: (value: string | number) => void;
  width?: number;
}

export function WheelPicker({ items, selectedValue, onValueChange, width = 80 }: WheelPickerProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const isScrolling = useRef(false);

  // Find the index of the selected value
  const selectedIndex = items.findIndex(item => item.value === selectedValue);

  // Scroll to selected item on mount and when selection changes externally
  useEffect(() => {
    if (scrollViewRef.current && selectedIndex >= 0 && !isScrolling.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: selectedIndex * ITEM_HEIGHT,
          animated: false,
        });
      }, 50);
    }
  }, [selectedIndex]);

  const handleScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));

    if (items[clampedIndex] && items[clampedIndex].value !== selectedValue) {
      onValueChange(items[clampedIndex].value);
    }
    isScrolling.current = false;
  }, [items, selectedValue, onValueChange]);

  const handleScrollBegin = useCallback(() => {
    isScrolling.current = true;
  }, []);

  return (
    <View style={[styles.container, { width }]}>
      {/* Selection highlight */}
      <View style={styles.selectionHighlight} pointerEvents="none" />

      {/* Gradient overlays for fade effect */}
      <View style={styles.topGradient} pointerEvents="none" />
      <View style={styles.bottomGradient} pointerEvents="none" />

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScrollBeginDrag={handleScrollBegin}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={(e) => {
          // Handle case where user lifts finger without momentum
          if (e.nativeEvent.velocity?.y === 0) {
            handleScrollEnd(e);
          }
        }}
      >
        {/* Top padding to center first item */}
        <View style={{ height: ITEM_HEIGHT }} />

        {items.map((item, index) => {
          const isSelected = item.value === selectedValue;
          return (
            <View key={item.key !== undefined ? item.key : item.value} style={styles.item}>
              <Text style={[
                styles.itemText,
                isSelected && styles.itemTextSelected,
              ]}>
                {item.label}
              </Text>
            </View>
          );
        })}

        {/* Bottom padding to center last item */}
        <View style={{ height: ITEM_HEIGHT }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    overflow: "hidden",
    position: "relative",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  itemText: {
    fontSize: 20,
    color: theme.colors.text.tertiary,
    fontWeight: theme.typography.fontWeight.normal,
  },
  itemTextSelected: {
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  selectionHighlight: {
    position: "absolute",
    top: ITEM_HEIGHT,
    left: 4,
    right: 4,
    height: ITEM_HEIGHT,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    zIndex: -1,
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 0.8,
    backgroundColor: "transparent",
    zIndex: 1,
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 0.8,
    backgroundColor: "transparent",
    zIndex: 1,
  },
});
