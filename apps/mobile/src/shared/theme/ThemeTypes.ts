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
  };

  // Interactive elements
  interactive: {
    primary: string;      // Primary buttons/links
    primaryHover: string; // Hover state
    secondary: string;    // Secondary actions
  };
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

  // Color palette
  colors: ThemeColors;

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
