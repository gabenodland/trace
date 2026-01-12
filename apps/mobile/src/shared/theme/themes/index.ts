/**
 * Theme Registry
 *
 * Central registry of all available themes.
 * To add a new theme:
 * 1. Create a new file in this directory (e.g., myTheme.ts)
 * 2. Export a Theme object following the Theme interface
 * 3. Import and add it to the themes array below
 */

import type { Theme, ThemeOption } from '../ThemeTypes';
import { lightTheme } from './light';
import { darkTheme } from './dark';
import { sepiaTheme } from './sepia';

/**
 * All available themes
 * Order determines display order in settings
 */
export const themes: Theme[] = [
  lightTheme,
  darkTheme,
  sepiaTheme,
];

/**
 * Theme lookup map for O(1) access
 */
export const themeMap: Record<string, Theme> = themes.reduce((acc, theme) => {
  acc[theme.id] = theme;
  return acc;
}, {} as Record<string, Theme>);

/**
 * Get a theme by ID, falls back to light theme
 */
export function getTheme(id: string): Theme {
  return themeMap[id] || lightTheme;
}

/**
 * Get all theme IDs
 */
export function getThemeIds(): string[] {
  return themes.map(t => t.id);
}

/**
 * Get theme options for display in settings picker
 */
export function getThemeOptions(): ThemeOption[] {
  return themes.map(theme => ({
    id: theme.id,
    name: theme.name,
    description: theme.description,
    preview: {
      background: theme.colors.background.primary,
      text: theme.colors.text.primary,
      accent: theme.colors.functional.accent,
    },
  }));
}

/**
 * Default theme ID
 */
export const DEFAULT_THEME_ID = 'light';

// Re-export individual themes for direct import if needed
export { lightTheme } from './light';
export { darkTheme } from './dark';
export { sepiaTheme } from './sepia';
