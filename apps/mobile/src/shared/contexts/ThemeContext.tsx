/**
 * ThemeContext - Provides the active theme to all components
 *
 * Reads the theme setting from SettingsContext and provides the
 * resolved Theme object to the app. Components use useTheme() to
 * access theme colors, spacing, typography, etc.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSettings } from './SettingsContext';
import { getTheme, lightTheme } from '../theme/themes';
import { themeBase } from '../theme/themeBase';
import type { Theme } from '../theme/ThemeTypes';

// Re-export Theme type for consumers
export type { Theme };

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
  typography: typeof themeBase.typography;
  borderRadius: typeof themeBase.borderRadius;
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

  // Combine theme colors with base values
  const value: ThemeContextValue = useMemo(() => ({
    // From active theme
    colors: activeTheme.colors,
    shadows: activeTheme.shadows,
    id: activeTheme.id,
    name: activeTheme.name,
    isDark: activeTheme.isDark,

    // From base (shared across all themes)
    spacing: themeBase.spacing,
    typography: themeBase.typography,
    borderRadius: themeBase.borderRadius,
  }), [activeTheme]);

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
