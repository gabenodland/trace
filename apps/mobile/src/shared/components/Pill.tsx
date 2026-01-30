/**
 * Pill - Reusable pill/chip component for metadata display
 *
 * A small, tappable badge with an optional icon and text label.
 * Used for displaying metadata like stream, status, location, etc.
 */

import React from "react";
import { TouchableOpacity, Text, View, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { themeBase } from "../theme/themeBase";

interface PillProps {
  /** Text to display */
  label: string;
  /** Optional icon element (renders before label) */
  icon?: React.ReactNode;
  /** Called when pill is pressed */
  onPress?: () => void;
  /** Whether the pill has a value set (affects styling) */
  isSet?: boolean;
  /** Whether this attribute is unsupported by current stream (strikethrough) */
  isUnsupported?: boolean;
  /** Whether the pill is disabled */
  disabled?: boolean;
  /** Maximum width before text truncates */
  maxWidth?: number;
}

export const Pill = React.memo(function Pill({
  label,
  icon,
  onPress,
  isSet = true,
  isUnsupported = false,
  disabled = false,
  maxWidth = 140,
}: PillProps) {
  const theme = useTheme();

  const textColor = isUnsupported
    ? "#9ca3af" // Gray for unsupported
    : isSet
      ? theme.colors.text.primary
      : theme.colors.text.disabled;

  const backgroundColor = isSet
    ? theme.colors.background.tertiary
    : "transparent";

  const borderColor = isSet
    ? "transparent"
    : theme.colors.border.light;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor,
          borderColor,
          borderWidth: isSet ? 0 : 1,
          maxWidth,
        },
      ]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text
        style={[
          styles.label,
          {
            color: textColor,
            fontFamily: isSet
              ? theme.typography.fontFamily.medium
              : theme.typography.fontFamily.regular,
          },
          isUnsupported && styles.unsupportedLabel,
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: themeBase.spacing.xs,
    borderRadius: themeBase.borderRadius.full,
    gap: 4,
  },
  iconContainer: {
    flexShrink: 0,
  },
  label: {
    fontSize: themeBase.typography.fontSize.sm,
    flexShrink: 1,
  },
  unsupportedLabel: {
    textDecorationLine: "line-through",
  },
});
