/**
 * High Contrast Theme
 *
 * Maximum contrast for accessibility. Pure black and white
 * with bold, saturated colors for functional elements.
 */

import type { Theme } from '../ThemeTypes';

export const highContrastTheme: Theme = {
  id: 'high-contrast',
  name: 'High Contrast',
  description: 'Maximum readability',
  isDark: false,

  colors: {
    background: {
      primary: '#FFFFFF',      // Pure white
      secondary: '#FFFFFF',    // Pure white (no subtle grays)
      tertiary: '#E5E5E5',     // Light gray for badges
    },

    text: {
      primary: '#000000',      // Pure black
      secondary: '#000000',    // Pure black (no subtle grays)
      tertiary: '#525252',     // Dark gray
      disabled: '#737373',     // Medium gray
    },

    border: {
      light: '#A3A3A3',        // Visible borders
      medium: '#525252',       // Strong borders
      dark: '#000000',         // Black borders
    },

    shadow: 'rgba(0, 0, 0, 0.15)',
    shadowMedium: 'rgba(0, 0, 0, 0.25)',

    functional: {
      complete: '#008000',     // Pure green
      incomplete: '#525252',   // Dark gray
      overdue: '#CC0000',      // Pure red
      accent: '#0000CC',       // Pure blue
      accentLight: '#E6E6FF',  // Light blue bg
      accentSecondary: '#EA580C', // Orange - secondary accent for previews
    },

    interactive: {
      primary: '#0000CC',      // Pure blue
      primaryHover: '#000099', // Darker blue
      secondary: '#525252',    // Dark gray
    },

    status: {
      open: '#0000CC',         // Pure blue - new, todo
      working: '#CC6600',      // Pure orange - in_progress, in_review
      blocked: '#CCAA00',      // Pure yellow - waiting, on_hold
      complete: '#008000',     // Pure green - done, closed
      cancelled: '#CC0000',    // Pure red - cancelled
    },

    surface: {
      overlay: '#F5F5F5',      // Light gray for drawers
      elevated: '#FFFFFF',     // White for menus
    },
  },

  typography: {
    fontFamily: {
      // Atkinson Hyperlegible - designed for maximum legibility
      regular: 'AtkinsonHyperlegible_400Regular',
      medium: 'AtkinsonHyperlegible_400Regular',   // No 500 weight, use regular
      semibold: 'AtkinsonHyperlegible_700Bold',    // No 600 weight, use bold
      bold: 'AtkinsonHyperlegible_700Bold',
    },
    webFontFamily: "'Atkinson Hyperlegible', Verdana, Geneva, sans-serif",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap',
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
      shadowOpacity: 0.15,
      shadowRadius: 1,
      elevation: 2,
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 3,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 3,
      elevation: 4,
    },
  },
};
