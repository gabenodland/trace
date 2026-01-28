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
      accent: '#C06C52',       // Terracotta/coral
      accentLight: '#FDF0EC',  // Light terracotta bg
      accentSecondary: '#D97706', // Amber - secondary accent for previews
    },

    interactive: {
      primary: '#C06C52',      // Terracotta/coral
      primaryHover: '#A85A42', // Darker terracotta
      secondary: '#5C5046',    // Brown
    },

    status: {
      open: '#7B9EBF',         // Dusty blue - new, todo
      working: '#C4784A',      // Burnt sienna - in_progress, in_review
      blocked: '#C9A227',      // Mustard - waiting, on_hold
      complete: '#6B8E6B',     // Sage green - done, closed
      cancelled: '#B85450',    // Muted brick red - cancelled
    },

    priority: {
      urgent: '#B85450',       // Muted brick red - highest priority
      high: '#C4784A',         // Burnt sienna - high priority
      medium: '#C9A227',       // Mustard - medium priority
      low: '#7B9EBF',          // Dusty blue - low priority
      none: '#8B7D6B',         // Brown-gray - no priority
    },

    surface: {
      overlay: '#EDE4D9',      // Warm tan for drawers
      elevated: '#F7F0E8',     // Light tan for menus
    },
  },

  typography: {
    fontFamily: {
      regular: 'Lora_400Regular',
      medium: 'Lora_500Medium',
      semibold: 'Lora_600SemiBold',
      bold: 'Lora_700Bold',
    },
    webFontFamily: "'Lora', Georgia, 'Times New Roman', serif",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap',
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
