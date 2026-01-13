/**
 * ThemeContext - Provides the active theme to all components
 *
 * Reads theme and font settings from SettingsContext and provides the
 * resolved Theme object to the app. Components use useTheme() to
 * access theme colors, spacing, typography, etc.
 *
 * Fonts are independent of themes - users can mix any font with any theme.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSettings } from './SettingsContext';
import { getTheme, lightTheme } from '../theme/themes';
import { getFont, fonts } from '../theme/fonts';
import { themeBase } from '../theme/themeBase';
import type { Theme } from '../theme/ThemeTypes';

// Re-export Theme type for consumers
export type { Theme };

/**
 * Combined typography - user-selected font + base sizes/weights
 */
export interface ThemeTypographyValue {
  fontFamily: Theme['typography']['fontFamily'];  // From font setting (not theme)
  webFontFamily: string;  // CSS font-family for WebView
  webFontUrl: string;     // Google Fonts import URL
  fontSize: typeof themeBase.typography.fontSize;
  fontWeight: typeof themeBase.typography.fontWeight;
  lineHeight: typeof themeBase.typography.lineHeight;
}

/**
 * Combined theme object with base values + current theme colors
 */
export interface ThemeContextValue {
  /** Current theme colors and shadows */
  colors: Theme['colors'];
  shadows: Theme['shadows'];

  /** Theme metadata */
  id: string;
  name: string;
  isDark: boolean;

  /** Base values (don't change between themes) */
  spacing: typeof themeBase.spacing;
  borderRadius: typeof themeBase.borderRadius;

  /** Typography - fontFamily from font setting, sizes/weights from base */
  typography: ThemeTypographyValue;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { settings, isLoaded } = useSettings();

  // Get the active theme based on settings
  const activeTheme = useMemo(() => {
    if (!isLoaded) {
      return lightTheme; // Default while loading
    }
    return getTheme(settings.theme);
  }, [settings.theme, isLoaded]);

  // Get the active font based on settings (independent of theme)
  const activeFont = useMemo(() => {
    if (!isLoaded) {
      return fonts[0]; // Inter is default
    }
    return getFont(settings.font);
  }, [settings.font, isLoaded]);

  // Combine theme colors with font and base values
  const value: ThemeContextValue = useMemo(() => ({
    // From active theme
    colors: activeTheme.colors,
    shadows: activeTheme.shadows,
    id: activeTheme.id,
    name: activeTheme.name,
    isDark: activeTheme.isDark,

    // From base (shared across all themes)
    spacing: themeBase.spacing,
    borderRadius: themeBase.borderRadius,

    // Typography: fontFamily from font setting (not theme), sizes/weights from base
    typography: {
      fontFamily: activeFont.fontFamily,
      webFontFamily: activeFont.webFontFamily,
      webFontUrl: activeFont.webFontUrl,
      fontSize: themeBase.typography.fontSize,
      fontWeight: themeBase.typography.fontWeight,
      lineHeight: themeBase.typography.lineHeight,
    },
  }), [activeTheme, activeFont]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access the current theme
 *
 * @example
 * const theme = useTheme();
 * <View style={{ backgroundColor: theme.colors.background.primary }}>
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
