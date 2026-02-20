/**
 * Button - Shared button primitive
 *
 * Variants: primary (accent bg), secondary (bordered), danger (red bg), ghost (no bg/border)
 * All variants enforce 48dp minimum touch target.
 */

import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Icon, type IconName } from "./Icon";
import { useTheme } from "../contexts/ThemeContext";
import { themeBase } from "../theme/themeBase";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

const SIZE_CONFIG = {
  sm: { minHeight: 48, paddingHorizontal: 12, fontSize: 14, iconSize: 16 },
  md: { minHeight: 44, paddingHorizontal: 20, fontSize: 16, iconSize: 18 },
  lg: { minHeight: 52, paddingHorizontal: 24, fontSize: 16, iconSize: 20 },
} as const;

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
}: ButtonProps) {
  const theme = useTheme();
  const sizeConfig = SIZE_CONFIG[size];

  const bgColor = {
    primary: theme.colors.functional.accent,
    secondary: "transparent",
    danger: `${theme.colors.functional.overdue}15`,
    ghost: "transparent",
  }[variant];

  const textColor = {
    primary: "#ffffff",
    secondary: theme.colors.text.primary,
    danger: theme.colors.functional.overdue,
    ghost: theme.colors.text.secondary,
  }[variant];

  const borderColor = variant === "secondary" ? theme.colors.border.dark : undefined;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        {
          backgroundColor: bgColor,
          minHeight: sizeConfig.minHeight,
          paddingHorizontal: sizeConfig.paddingHorizontal,
          borderColor,
          borderWidth: borderColor ? 1 : 0,
        },
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon && <Icon name={icon} size={sizeConfig.iconSize} color={textColor} />}
          <Text
            style={[
              styles.label,
              {
                color: textColor,
                fontSize: sizeConfig.fontSize,
                fontFamily: theme.typography.fontFamily.medium,
              },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: themeBase.borderRadius.md,
    gap: themeBase.spacing.sm,
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    textAlign: "center",
  },
});
