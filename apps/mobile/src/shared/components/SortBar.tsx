/**
 * SortBar — Horizontal sort chip bar
 *
 * Reusable sort control with accent-colored active chip and direction arrows.
 * Used on management screens and the nav drawer.
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

export interface SortOption<K extends string> {
  key: K;
  label: string;
}

interface SortBarProps<K extends string> {
  options: SortOption<K>[];
  activeKey: K;
  ascending: boolean;
  onPress: (key: K) => void;
}

export function SortBar<K extends string>({
  options,
  activeKey,
  ascending,
  onPress,
}: SortBarProps<K>) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const isActive = activeKey === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.chip,
              {
                backgroundColor: isActive
                  ? theme.colors.functional.accent
                  : theme.colors.background.tertiary,
              },
            ]}
            onPress={() => onPress(opt.key)}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 0, right: 0 }}
          >
            <Text
              style={[
                styles.chipText,
                {
                  fontFamily: theme.typography.fontFamily.medium,
                  color: isActive ? theme.colors.background.primary : theme.colors.text.secondary,
                },
              ]}
            >
              {opt.label}
              {isActive ? (ascending ? " ↑" : " ↓") : ""}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minHeight: 28,
  },
  chipText: {
    fontSize: 12,
  },
});
