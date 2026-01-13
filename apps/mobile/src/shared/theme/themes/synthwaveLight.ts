/**
 * Synthwave Light Theme
 *
 * Sunset-inspired light theme with warm pink and purple tones.
 * Evokes the feeling of a Miami sunset, vaporwave aesthetics,
 * and that golden hour glow before the neon takes over.
 */

import type { Theme } from '../ThemeTypes';

export const synthwaveLightTheme: Theme = {
  id: 'synthwave-light',
  name: 'Synthwave Sunset',
  description: 'Outrun Sunset',
  isDark: false,

  colors: {
    background: {
      primary: '#FFF5F8',      // Soft blush pink
      secondary: '#FFEEF4',    // Lighter rose
      tertiary: '#FFE4ED',     // Warm pink tint
    },

    text: {
      primary: '#4A1942',      // Deep plum
      secondary: '#7B4B6E',    // Muted magenta
      tertiary: '#A67999',     // Dusty rose
      disabled: '#D4B5C7',     // Faded lavender
    },

    border: {
      light: '#F5E0EB',        // Very soft pink (lighter for subtle dividers)
      medium: '#F5B8D0',       // Rose pink
      dark: '#E89DBB',         // Deeper pink
    },

    shadow: 'rgba(255, 105, 180, 0.12)',   // Hot pink glow
    shadowMedium: 'rgba(255, 105, 180, 0.20)',

    functional: {
      complete: '#00C9A7',     // Tropical teal
      incomplete: '#A67999',   // Dusty rose
      overdue: '#FF6B8A',      // Coral pink
      accent: '#FF69B4',       // Hot pink
      accentLight: '#FFE4F0',  // Pale pink bg
    },

    interactive: {
      primary: '#FF69B4',      // Hot pink
      primaryHover: '#FF85C1', // Lighter hot pink
      secondary: '#9B6B8A',    // Mauve
    },

    status: {
      open: '#7B68EE',         // Medium slate blue - dreamy
      working: '#FF69B4',      // Hot pink - active energy
      blocked: '#FFB347',      // Pastel orange - sunset
      complete: '#00C9A7',     // Tropical teal - refreshing
      cancelled: '#FF6B8A',    // Coral pink - soft warning
    },

    surface: {
      overlay: '#E8D4F0',      // Pastel purple for drawers
      elevated: '#FFF5F8',     // Blush pink for menus
      drawerText: '#FF6B35',           // Sunset orange for drawer text
      drawerTextSecondary: '#FF8C5A',  // Lighter orange
      drawerTextTertiary: '#CC5522',   // Muted burnt orange
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
      shadowColor: '#FF69B4',  // Pink glow
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 1,
    },
    sm: {
      shadowColor: '#FF69B4',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 5,
      elevation: 2,
    },
    md: {
      shadowColor: '#FF69B4',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 7,
      elevation: 3,
    },
  },
};
