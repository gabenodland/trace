/**
 * StreamDrawerItem
 *
 * Memoized row component for stream list in drawer.
 * Clean, minimal design without icons.
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { Stream } from "@trace/core";
import { theme } from "../../shared/theme/theme";

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
  return (
    <TouchableOpacity
      style={[styles.item, isSelected && styles.itemSelected]}
      onPress={onPress}
      activeOpacity={0.6}
      delayPressIn={0}
    >
      <Text
        style={[styles.name, isSelected && styles.nameSelected]}
        numberOfLines={1}
      >
        {stream.name}
      </Text>
      {stream.entry_count > 0 && (
        <Text style={[styles.count, isSelected && styles.countSelected]}>
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
  return (
    <TouchableOpacity
      style={[styles.item, isSelected && styles.itemSelected]}
      onPress={onPress}
      activeOpacity={0.6}
      delayPressIn={0}
    >
      <Text
        style={[styles.name, isSelected && styles.nameSelected]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {count > 0 && (
        <Text style={[styles.count, isSelected && styles.countSelected]}>
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
  itemSelected: {
    backgroundColor: "#f3f4f6",
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: "400",
    color: theme.colors.text.primary,
    letterSpacing: -0.2,
  },
  nameSelected: {
    fontWeight: "600",
    color: theme.colors.text.primary,
  },
  count: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.text.tertiary,
    marginLeft: 12,
  },
  countSelected: {
    color: theme.colors.text.secondary,
  },
});
