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
}

export const StreamDrawerItem = React.memo(function StreamDrawerItem({
  stream,
  isSelected,
  onPress,
}: StreamDrawerItemProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      style={[styles.item, isSelected && { backgroundColor: theme.colors.background.tertiary }]}
      onPress={onPress}
      activeOpacity={0.6}
      delayPressIn={0}
    >
      <Text
        style={[styles.name, { color: theme.colors.text.primary }, isSelected && { fontWeight: "600" }]}
        numberOfLines={1}
      >
        {stream.name}
      </Text>
      {stream.entry_count > 0 && (
        <Text style={[styles.count, { color: theme.colors.text.tertiary }, isSelected && { color: theme.colors.text.secondary }]}>
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
}

export const QuickFilterItem = React.memo(function QuickFilterItem({
  label,
  count,
  isSelected,
  onPress,
}: QuickFilterItemProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      style={[styles.item, isSelected && { backgroundColor: theme.colors.background.tertiary }]}
      onPress={onPress}
      activeOpacity={0.6}
      delayPressIn={0}
    >
      <Text
        style={[styles.name, { color: theme.colors.text.primary }, isSelected && { fontWeight: "600" }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {count > 0 && (
        <Text style={[styles.count, { color: theme.colors.text.tertiary }, isSelected && { color: theme.colors.text.secondary }]}>
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
    fontWeight: "400",
    letterSpacing: -0.2,
  },
  count: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 12,
  },
});
