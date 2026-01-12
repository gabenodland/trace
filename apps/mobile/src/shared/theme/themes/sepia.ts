/**
 * Sepia Theme
 *
 * Warm, paper-like tones. Comfortable for extended reading.
 */

import type { Theme } from '../ThemeTypes';

export const sepiaTheme: Theme = {
  id: 'sepia',
  name: 'Sepia',
  description: 'Warm and comfortable',
  isDark: false,

  colors: {
    background: {
      primary: '#FDF8F3',      // Warm cream
      secondary: '#F7F0E8',    // Light tan
      tertiary: '#EDE4D9',     // Warm gray
    },

    text: {
      primary: '#3D3229',      // Dark brown
      secondary: '#5C5046',    // Medium brown
      tertiary: '#8B7D6B',     // Light brown
      disabled: '#B8A99A',     // Muted tan
    },

    border: {
      light: '#EDE4D9',        // Very subtle
      medium: '#DDD2C4',       // Subtle
      dark: '#C9BBA8',         // Visible
    },

    shadow: 'rgba(61, 50, 41, 0.04)',
    shadowMedium: 'rgba(61, 50, 41, 0.08)',

    functional: {
      complete: '#5D8A66',     // Muted green
      incomplete: '#8B7D6B',   // Brown-gray
      overdue: '#B85450',      // Muted red
      accent: '#8B6914',       // Amber/gold
      accentLight: '#FEF3C7',  // Light amber bg
    },

    interactive: {
      primary: '#8B6914',      // Amber/gold
      primaryHover: '#A47E1A', // Lighter amber
      secondary: '#5C5046',    // Brown
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
      shadowColor: '#3D3229',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    sm: {
      shadowColor: '#3D3229',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#3D3229',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 3,
    },
  },
};
