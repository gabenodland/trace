/**
 * Tech Green Theme
 *
 * Dark theme with green accents. Matrix/terminal inspired.
 */

import type { Theme } from '../ThemeTypes';

export const techGreenTheme: Theme = {
  id: 'tech-green',
  name: 'Tech Green',
  description: 'Matrix vibes',
  isDark: true,
  isPro: true,

  colors: {
    background: {
      primary: '#0D1117',      // GitHub dark bg
      secondary: '#161B22',    // Slightly lighter
      tertiary: '#21262D',     // Card/elevated bg
    },

    text: {
      primary: '#E6EDF3',      // Light gray
      secondary: '#8B949E',    // Muted gray
      tertiary: '#6E7681',     // Dimmed
      disabled: '#484F58',     // Very dim
    },

    border: {
      light: '#21262D',        // Subtle
      medium: '#30363D',       // Visible
      dark: '#484F58',         // Strong
    },

    shadow: 'rgba(0, 0, 0, 0.4)',
    shadowMedium: 'rgba(0, 0, 0, 0.6)',

    functional: {
      complete: '#3FB950',     // GitHub green
      incomplete: '#6E7681',   // Gray
      overdue: '#F85149',      // GitHub red
      accent: '#39D353',       // Bright green
      accentLight: '#0D2818',  // Dark green bg
      accentSecondary: '#F97316', // Techy orange - secondary accent for previews
    },

    interactive: {
      primary: '#39D353',      // Bright green
      primaryHover: '#2EA043', // Darker green
      secondary: '#8B949E',    // Gray
    },

    status: {
      open: '#58A6FF',         // Bright cyan - new, todo
      working: '#F0883E',      // Bright orange - in_progress, in_review
      blocked: '#D29922',      // Bright yellow - waiting, on_hold
      complete: '#3FB950',     // Neon green - done, closed
      cancelled: '#F85149',    // Bright red - cancelled
    },

    priority: {
      urgent: '#F85149',       // Bright red - highest priority
      high: '#F0883E',         // Bright orange - high priority
      medium: '#D29922',       // Bright yellow - medium priority
      low: '#58A6FF',          // Bright cyan - low priority
      none: '#8B949E',         // Gray - no priority
    },

    surface: {
      overlay: '#161B22',      // Slightly lighter for drawers
      elevated: '#21262D',     // Card bg for menus
      // Green text for drawer (Matrix terminal style)
      drawerText: '#7EE787',          // Bright green
      drawerTextSecondary: '#56D364', // Medium green
      drawerTextTertiary: '#3FB950',  // GitHub green
    },
  },

  typography: {
    fontFamily: {
      // JetBrains Mono - monospace font for terminal/hacker aesthetic
      regular: 'JetBrainsMono_400Regular',
      medium: 'JetBrainsMono_500Medium',
      semibold: 'JetBrainsMono_600SemiBold',
      bold: 'JetBrainsMono_700Bold',
    },
    webFontFamily: "'JetBrains Mono', Menlo, Monaco, Consolas, monospace",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
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
      shadowColor: '#39D353',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
      elevation: 1,
    },
    sm: {
      shadowColor: '#39D353',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#39D353',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 3,
    },
  },
};
