/**
 * Light Theme
 *
 * Clean, minimal grayscale design with white backgrounds.
 * This is the default theme.
 */

import type { Theme } from '../ThemeTypes';

export const lightTheme: Theme = {
  id: 'light',
  name: 'Light',
  description: 'Clean and minimal',
  isDark: false,

  colors: {
    background: {
      primary: '#FFFFFF',      // Pure white
      secondary: '#F9FAFB',    // Very light gray
      tertiary: '#F3F4F6',     // Light gray
    },

    text: {
      primary: '#111827',      // Almost black
      secondary: '#4B5563',    // Medium-dark gray
      tertiary: '#9CA3AF',     // Medium gray
      disabled: '#D1D5DB',     // Light gray
    },

    border: {
      light: '#F3F4F6',        // Very subtle
      medium: '#E5E7EB',       // Subtle
      dark: '#D1D5DB',         // Visible but soft
    },

    shadow: 'rgba(0, 0, 0, 0.03)',
    shadowMedium: 'rgba(0, 0, 0, 0.06)',

    functional: {
      complete: '#10B981',     // Green
      incomplete: '#9CA3AF',   // Gray
      overdue: '#EF4444',      // Red
      accent: '#3B82F6',       // Blue
      accentLight: '#EFF6FF',  // Light blue bg
    },

    interactive: {
      primary: '#3B82F6',      // Blue
      primaryHover: '#2563EB', // Darker blue
      secondary: '#6B7280',    // Gray
    },
  },

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
};
