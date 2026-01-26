/**
 * Synthwave Sunset Theme
 *
 * Retro-futuristic 80s aesthetic with deep purple backgrounds
 * and neon pink/cyan accents. Inspired by outrun, cyberpunk,
 * and the digital sunset aesthetic.
 */

import type { Theme } from '../ThemeTypes';

export const synthwaveDarkTheme: Theme = {
  id: 'synthwave-dark',
  name: 'Synthwave Night',
  description: 'Night drive 1985',
  isDark: true,
  isPro: true,

  colors: {
    background: {
      primary: '#13111C',      // Deep space purple
      secondary: '#1A1625',    // Midnight purple
      tertiary: '#262036',     // Elevated purple
    },

    text: {
      primary: '#F0E6FA',      // Soft lavender white
      secondary: '#B8A8C8',    // Muted lavender
      tertiary: '#7A6B8A',     // Dim purple
      disabled: '#4D4260',     // Deep purple
    },

    border: {
      light: '#2A2440',        // Subtle purple
      medium: '#3D3555',       // Visible purple
      dark: '#524A6A',         // Strong purple
    },

    shadow: 'rgba(255, 46, 151, 0.15)',   // Pink glow
    shadowMedium: 'rgba(255, 46, 151, 0.25)',

    functional: {
      complete: '#00F5D4',     // Neon cyan
      incomplete: '#7A6B8A',   // Muted purple
      overdue: '#FF6B6B',      // Neon coral
      accent: '#FF2E97',       // Hot pink
      accentLight: '#2D1A2E',  // Dark magenta
      accentSecondary: '#22D3EE', // Neon cyan - secondary accent for previews
    },

    interactive: {
      primary: '#FF2E97',      // Hot pink
      primaryHover: '#FF5CAD', // Lighter hot pink
      secondary: '#B8A8C8',    // Lavender
    },

    status: {
      open: '#00D4FF',         // Electric cyan - new, todo
      working: '#FF2E97',      // Hot pink - in_progress, in_review
      blocked: '#FFBE0B',      // Neon yellow - waiting, on_hold
      complete: '#00F5D4',     // Neon cyan-green - done, closed
      cancelled: '#FF6B6B',    // Neon coral - cancelled
    },

    surface: {
      overlay: '#1E1A2E',      // Deep purple for drawers
      elevated: '#262036',     // Elevated purple for menus
      drawerText: '#FF2E97',           // Neon pink for drawer text
      drawerTextSecondary: '#FF5CAD',  // Lighter neon pink
      drawerTextTertiary: '#B8408A',   // Muted magenta
    },
  },

  typography: {
    fontFamily: {
      // Orbitron - retro-futuristic geometric display font
      regular: 'Orbitron_400Regular',
      medium: 'Orbitron_500Medium',
      semibold: 'Orbitron_600SemiBold',
      bold: 'Orbitron_700Bold',
    },
    webFontFamily: "'Orbitron', system-ui, -apple-system, sans-serif",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700&display=swap',
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
      shadowColor: '#FF2E97',  // Pink glow
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 1,
    },
    sm: {
      shadowColor: '#FF2E97',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 2,
    },
    md: {
      shadowColor: '#FF2E97',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 3,
    },
  },
};
