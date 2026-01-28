/**
 * Modern Theme
 *
 * Clean, minimal design with cool undertones and vibrant accents.
 * Contemporary feel with subtle depth.
 */

import type { Theme } from '../ThemeTypes';

export const modernTheme: Theme = {
  id: 'modern',
  name: 'Modern',
  description: 'Clean and contemporary',
  isDark: false,
  isPro: true,

  colors: {
    background: {
      primary: '#FAFBFC',      // Cool white
      secondary: '#F1F5F9',    // Cool light gray (slate-100)
      tertiary: '#E2E8F0',     // Cool gray (slate-200)
    },

    text: {
      primary: '#0F172A',      // Slate-900 (deep blue-black)
      secondary: '#475569',    // Slate-600
      tertiary: '#94A3B8',     // Slate-400
      disabled: '#CBD5E1',     // Slate-300
    },

    border: {
      light: '#E2E8F0',        // Slate-200
      medium: '#CBD5E1',       // Slate-300
      dark: '#94A3B8',         // Slate-400
    },

    shadow: 'rgba(15, 23, 42, 0.04)',
    shadowMedium: 'rgba(15, 23, 42, 0.08)',

    functional: {
      complete: '#059669',     // Emerald-600 (vibrant green)
      incomplete: '#94A3B8',   // Slate-400
      overdue: '#DC2626',      // Red-600 (vibrant red)
      accent: '#6366F1',       // Indigo-500 (vibrant purple-blue)
      accentLight: '#EEF2FF',  // Indigo-50
      accentSecondary: '#F59E0B', // Orange - secondary accent for previews
    },

    interactive: {
      primary: '#6366F1',      // Indigo-500
      primaryHover: '#4F46E5', // Indigo-600
      secondary: '#64748B',    // Slate-500
    },

    status: {
      open: '#6B7F99',         // Muted slate-blue - new, todo
      working: '#9A8478',      // Muted taupe - in_progress, in_review
      blocked: '#A39171',      // Muted khaki - waiting, on_hold
      complete: '#6B8F71',     // Muted sage - done, closed
      cancelled: '#947272',    // Muted mauve - cancelled
    },

    priority: {
      urgent: '#947272',       // Muted mauve - highest priority
      high: '#9A8478',         // Muted taupe - high priority
      medium: '#A39171',       // Muted khaki - medium priority
      low: '#6B7F99',          // Muted slate-blue - low priority
      none: '#94A3B8',         // Slate-400 - no priority
    },

    surface: {
      overlay: '#F1F5F9',      // Cool slate for drawers
      elevated: '#FFFFFF',     // White for menus
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
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    sm: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
  },
};
