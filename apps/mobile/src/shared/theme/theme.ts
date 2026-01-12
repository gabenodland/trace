/**
 * Shared theme and design system for the mobile app
 *
 * BACKWARD COMPATIBILITY:
 * This file exports a static 'theme' object that uses the light theme values.
 * Components that haven't been migrated to useTheme() will continue to work.
 *
 * NEW COMPONENTS should use:
 *   import { useTheme } from '../shared/contexts/ThemeContext';
 *   const theme = useTheme();
 *
 * This allows components to respond to theme changes dynamically.
 */

import { lightTheme } from './themes';
import { themeBase } from './themeBase';

/**
 * Static theme object for backward compatibility
 *
 * @deprecated Use useTheme() hook for dynamic theming
 */
export const theme = {
  // Colors from light theme (static - won't change with theme setting)
  colors: lightTheme.colors,

  // Base values (shared across all themes)
  spacing: themeBase.spacing,
  typography: themeBase.typography,
  borderRadius: themeBase.borderRadius,

  // Shadows from light theme
  shadows: lightTheme.shadows,
} as const;

// Helper to create consistent component styles
export const createComponentStyles = {
  // Card/Surface style
  card: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    ...theme.shadows.xs,
  },

  // Badge/Pill style (very subtle)
  badge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background.tertiary,
  },

  // Badge text
  badgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.tertiary,
  },
};
