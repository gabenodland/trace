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

    status: {
      open: '#3B82F6',         // Blue - new, todo
      working: '#F59E0B',      // Orange - in_progress, in_review
      blocked: '#EAB308',      // Yellow - waiting, on_hold
      complete: '#10B981',     // Green - done, closed
      cancelled: '#EF4444',    // Red - cancelled
    },

    surface: {
      overlay: '#F9FAFB',      // Light gray for drawers
      elevated: '#FFFFFF',     // White for menus/dropdowns
    },
  },

  typography: {
    fontFamily: {
      regular: 'Inter_400Regular',
      medium: 'Inter_500Medium',
      semibold: 'Inter_600SemiBold',
      bold: 'Inter_700Bold',
    },
    webFontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
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
