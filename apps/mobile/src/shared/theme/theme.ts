/**
 * Shared theme and design system for the mobile app
 * Modern, minimalist, grayscale design
 */

export const theme = {
  // Colors - Grayscale palette
  colors: {
    // Backgrounds
    background: {
      primary: '#FFFFFF',      // Pure white for main background
      secondary: '#F9FAFB',    // Very light gray for secondary surfaces
      tertiary: '#F3F4F6',     // Light gray for subtle contrast
    },

    // Text colors
    text: {
      primary: '#111827',      // Almost black for primary text
      secondary: '#4B5563',    // Medium-dark gray for secondary text
      tertiary: '#9CA3AF',     // Medium gray for muted/metadata text
      disabled: '#D1D5DB',     // Light gray for disabled text
    },

    // Borders and dividers (use sparingly)
    border: {
      light: '#F3F4F6',        // Very subtle border
      medium: '#E5E7EB',       // Subtle border
      dark: '#D1D5DB',         // Visible but soft border
    },

    // Shadows (very subtle)
    shadow: 'rgba(0, 0, 0, 0.03)',
    shadowMedium: 'rgba(0, 0, 0, 0.06)',

    // Functional colors (very muted)
    functional: {
      complete: '#10B981',     // Muted green for completed tasks
      incomplete: '#9CA3AF',   // Gray for incomplete
      overdue: '#EF4444',      // Muted red for overdue
    },
  },

  // Spacing scale (multiples of 4)
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  // Typography
  typography: {
    // Font sizes
    fontSize: {
      xs: 11,
      sm: 13,
      base: 15,
      lg: 17,
      xl: 20,
      xxl: 24,
    },

    // Font weights
    fontWeight: {
      normal: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },

    // Line heights
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.7,
    },
  },

  // Border radius
  borderRadius: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    full: 999,
  },

  // Shadows (very subtle for minimalist design)
  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    xs: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 2,
      elevation: 1,
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07,
      shadowRadius: 4,
      elevation: 3,
    },
  },
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
