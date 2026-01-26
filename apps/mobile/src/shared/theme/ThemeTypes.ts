/**
 * Theme Type Definitions
 *
 * Defines the structure for all themes in the app.
 * New themes can be added by creating a file that exports a Theme object.
 */

/**
 * Color palette structure - all themes must define these colors
 */
export interface ThemeColors {
  // Backgrounds
  background: {
    primary: string;      // Main background
    secondary: string;    // Secondary surfaces
    tertiary: string;     // Subtle contrast areas
  };

  // Text colors
  text: {
    primary: string;      // Primary text
    secondary: string;    // Secondary/muted text
    tertiary: string;     // Metadata/hints
    disabled: string;     // Disabled text
  };

  // Borders and dividers
  border: {
    light: string;        // Very subtle border
    medium: string;       // Standard border
    dark: string;         // Prominent border
  };

  // Shadows
  shadow: string;
  shadowMedium: string;

  // Functional colors (semantic)
  functional: {
    complete: string;     // Success/complete
    incomplete: string;   // Neutral/pending
    overdue: string;      // Error/overdue
    accent: string;       // Primary accent (buttons, links)
    accentLight: string;  // Light accent background
    accentSecondary: string; // Secondary accent (preview markers, alternative highlights)
  };

  // Interactive elements
  interactive: {
    primary: string;      // Primary buttons/links
    primaryHover: string; // Hover state
    secondary: string;    // Secondary actions
  };

  // Status colors (semantic status categories)
  status: {
    open: string;         // New, Todo (blue-ish)
    working: string;      // In Progress, In Review (orange-ish)
    blocked: string;      // Waiting, On Hold (yellow-ish)
    complete: string;     // Done, Closed (green-ish)
    cancelled: string;    // Cancelled (red-ish)
  };

  // Surface colors (overlays, drawers, menus)
  surface: {
    overlay: string;      // Drawers, side panels, menus
    elevated: string;     // Cards, dropdowns, modals
    // Drawer-specific text colors (allows themes like Tech Green to have green drawer text)
    drawerText?: string;         // Primary drawer text (optional - falls back to text.primary)
    drawerTextSecondary?: string; // Secondary drawer text (optional - falls back to text.secondary)
    drawerTextTertiary?: string;  // Tertiary drawer text (optional - falls back to text.tertiary)
  };
}

/**
 * Typography configuration - font families per theme
 * Font sizes/weights stay in themeBase (shared across all themes)
 */
export interface ThemeTypography {
  fontFamily: {
    regular: string;
    medium: string;
    semibold: string;
    bold: string;
  };
  /** CSS font-family string for WebView (e.g., "'Inter', sans-serif") */
  webFontFamily: string;
  /** Google Fonts import URL for WebView (e.g., "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap") */
  webFontUrl: string;
}

/**
 * Shadow configuration for React Native
 */
export interface ThemeShadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

/**
 * Shadow scale
 */
export interface ThemeShadows {
  none: ThemeShadow;
  xs: ThemeShadow;
  sm: ThemeShadow;
  md: ThemeShadow;
}

/**
 * Complete theme definition
 */
export interface Theme {
  // Unique identifier for the theme
  id: string;

  // Display name shown in settings
  name: string;

  // Optional description
  description?: string;

  // Whether this is a dark theme (affects status bar, etc.)
  isDark: boolean;

  // Whether this theme requires Pro subscription (default: false = free)
  isPro?: boolean;

  // Color palette
  colors: ThemeColors;

  // Typography (font families)
  typography: ThemeTypography;

  // Shadows (theme-aware)
  shadows: ThemeShadows;
}

/**
 * Theme option for display in settings
 */
export interface ThemeOption {
  id: string;
  name: string;
  description?: string;
  isPro?: boolean;
  preview: {
    background: string;
    text: string;
    accent: string;
  };
}

/**
 * Available theme IDs
 */
export type ThemeId = 'light' | 'dark' | 'sepia' | string;
