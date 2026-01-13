/**
 * StreamDrawerItem
 *
 * Memoized row component for stream list in drawer.
 * Clean, minimal design without icons.
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { Stream } from "@trace/core";
import { useTheme } from "../../shared/contexts/ThemeContext";

interface StreamDrawerItemProps {
  stream: Stream;
  isSelected: boolean;
  onPress: () => void;
  // Optional drawer-specific colors (falls back to theme defaults)
  textColor?: string;
  textColorSecondary?: string;
  textColorTertiary?: string;
}

export const StreamDrawerItem = React.memo(function StreamDrawerItem({
  stream,
  isSelected,
  onPress,
  textColor,
  textColorSecondary,
  textColorTertiary,
}: StreamDrawerItemProps) {
  const theme = useTheme();
  const primaryColor = textColor || theme.colors.text.primary;
  const secondaryColor = textColorSecondary || theme.colors.text.secondary;
  const tertiaryColor = textColorTertiary || theme.colors.text.tertiary;

  return (
    <TouchableOpacity
      style={[styles.item, isSelected && { backgroundColor: theme.colors.background.tertiary }]}
      onPress={onPress}
      activeOpacity={0.6}
      delayPressIn={0}
    >
      <Text
        style={[
          styles.name,
          { color: primaryColor, fontFamily: theme.typography.fontFamily.regular },
          isSelected && { fontFamily: theme.typography.fontFamily.semibold },
        ]}
        numberOfLines={1}
      >
        {stream.name}
      </Text>
      {stream.entry_count > 0 && (
        <Text style={[styles.count, { color: tertiaryColor, fontFamily: theme.typography.fontFamily.medium }, isSelected && { color: secondaryColor }]}>
          {stream.entry_count}
        </Text>
      )}
    </TouchableOpacity>
  );
});

/**
 * Special item for "All Entries" and "Unassigned" filters
 */
interface QuickFilterItemProps {
  label: string;
  count: number;
  isSelected: boolean;
  onPress: () => void;
  // Optional drawer-specific colors (falls back to theme defaults)
  textColor?: string;
  textColorSecondary?: string;
  textColorTertiary?: string;
}

export const QuickFilterItem = React.memo(function QuickFilterItem({
  label,
  count,
  isSelected,
  onPress,
  textColor,
  textColorSecondary,
  textColorTertiary,
}: QuickFilterItemProps) {
  const theme = useTheme();
  const primaryColor = textColor || theme.colors.text.primary;
  const secondaryColor = textColorSecondary || theme.colors.text.secondary;
  const tertiaryColor = textColorTertiary || theme.colors.text.tertiary;

  return (
    <TouchableOpacity
      style={[styles.item, isSelected && { backgroundColor: theme.colors.background.tertiary }]}
      onPress={onPress}
      activeOpacity={0.6}
      delayPressIn={0}
    >
      <Text
        style={[
          styles.name,
          { color: primaryColor, fontFamily: theme.typography.fontFamily.regular },
          isSelected && { fontFamily: theme.typography.fontFamily.semibold },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {count > 0 && (
        <Text style={[styles.count, { color: tertiaryColor, fontFamily: theme.typography.fontFamily.medium }, isSelected && { color: secondaryColor }]}>
          {count}
        </Text>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    borderRadius: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  count: {
    fontSize: 14,
    marginLeft: 12,
  },
});
