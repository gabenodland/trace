/**
 * Dark Theme
 *
 * Dark background with light text. Easy on the eyes in low light.
 */

import type { Theme } from '../ThemeTypes';

export const darkTheme: Theme = {
  id: 'dark',
  name: 'Dark',
  description: 'Easy on the eyes',
  isDark: true,

  colors: {
    background: {
      primary: '#111827',      // Very dark blue-gray
      secondary: '#1F2937',    // Dark gray
      tertiary: '#374151',     // Medium-dark gray
    },

    text: {
      primary: '#F9FAFB',      // Almost white
      secondary: '#D1D5DB',    // Light gray
      tertiary: '#9CA3AF',     // Medium gray
      disabled: '#6B7280',     // Darker gray
    },

    border: {
      light: '#1F2937',        // Very subtle
      medium: '#374151',       // Subtle
      dark: '#4B5563',         // Visible
    },

    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowMedium: 'rgba(0, 0, 0, 0.5)',

    functional: {
      complete: '#34D399',     // Lighter green for dark bg
      incomplete: '#6B7280',   // Gray
      overdue: '#F87171',      // Lighter red for dark bg
      accent: '#60A5FA',       // Lighter blue for dark bg
      accentLight: '#1E3A5F',  // Dark blue bg
    },

    interactive: {
      primary: '#60A5FA',      // Lighter blue
      primaryHover: '#93C5FD', // Even lighter blue
      secondary: '#9CA3AF',    // Gray
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
      shadowOpacity: 0.4,
      shadowRadius: 2,
      elevation: 1,
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.5,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.6,
      shadowRadius: 4,
      elevation: 3,
    },
  },
};
