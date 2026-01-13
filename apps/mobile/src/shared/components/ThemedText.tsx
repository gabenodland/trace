/**
 * ThemedText - Text component that uses theme fonts
 *
 * Use this instead of React Native's Text to get theme-aware fonts.
 * Falls back to regular weight if no weight prop specified.
 */

import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export interface ThemedTextProps extends TextProps {
  /** Font weight variant */
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}

/**
 * Text component that automatically uses the current theme's font family.
 *
 * @example
 * <ThemedText>Regular text</ThemedText>
 * <ThemedText weight="bold">Bold text</ThemedText>
 * <ThemedText weight="medium" style={{ fontSize: 18 }}>Medium 18px</ThemedText>
 */
export function ThemedText({
  weight = 'regular',
  style,
  children,
  ...props
}: ThemedTextProps) {
  const theme = useTheme();
  const fontFamily = theme.typography.fontFamily[weight];

  return (
    <Text style={[{ fontFamily }, style]} {...props}>
      {children}
    </Text>
  );
}

/**
 * Pre-styled text variants for common use cases
 */
export const ThemedTextVariants = {
  /** Large title - bold, 24px */
  Title: (props: Omit<ThemedTextProps, 'weight'>) => (
    <ThemedText weight="bold" {...props} style={[{ fontSize: 24 }, props.style]} />
  ),

  /** Section header - semibold, 18px */
  Heading: (props: Omit<ThemedTextProps, 'weight'>) => (
    <ThemedText weight="semibold" {...props} style={[{ fontSize: 18 }, props.style]} />
  ),

  /** Body text - regular, 15px */
  Body: (props: Omit<ThemedTextProps, 'weight'>) => (
    <ThemedText weight="regular" {...props} style={[{ fontSize: 15 }, props.style]} />
  ),

  /** Caption/metadata - regular, 13px */
  Caption: (props: Omit<ThemedTextProps, 'weight'>) => (
    <ThemedText weight="regular" {...props} style={[{ fontSize: 13 }, props.style]} />
  ),
};
