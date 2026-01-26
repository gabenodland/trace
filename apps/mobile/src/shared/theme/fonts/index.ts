/**
 * Font Registry
 *
 * Central registry of all available fonts.
 * Fonts are independent of themes - users can mix any font with any theme.
 */

import type { ThemeTypography } from '../ThemeTypes';

/**
 * Font definition - contains font family mappings for all weights
 */
export interface FontDefinition {
  id: string;
  name: string;
  description?: string;
  /** Whether this font requires Pro subscription (default: false = free) */
  isPro?: boolean;
  fontFamily: ThemeTypography['fontFamily'];
  webFontFamily: string;
  webFontUrl: string;
}

/**
 * Font option for display in settings picker
 */
export interface FontOption {
  id: string;
  name: string;
  description?: string;
  isPro?: boolean;
  /** Sample text font family (regular weight) for preview */
  previewFont: string;
}

/**
 * All available fonts
 * Order determines display order in settings
 */
export const fonts: FontDefinition[] = [
  // Sans-serif fonts
  {
    id: 'inter',
    name: 'Inter',
    description: 'Clean and modern',
    fontFamily: {
      regular: 'Inter_400Regular',
      medium: 'Inter_500Medium',
      semibold: 'Inter_600SemiBold',
      bold: 'Inter_700Bold',
    },
    webFontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
  {
    id: 'roboto',
    name: 'Roboto',
    description: 'Google standard',
    fontFamily: {
      regular: 'Roboto_400Regular',
      medium: 'Roboto_500Medium',
      semibold: 'Roboto_500Medium', // Roboto has no 600
      bold: 'Roboto_700Bold',
    },
    webFontFamily: "'Roboto', system-ui, sans-serif",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
  },
  {
    id: 'opensans',
    name: 'Open Sans',
    description: 'Highly legible',
    fontFamily: {
      regular: 'OpenSans_400Regular',
      medium: 'OpenSans_500Medium',
      semibold: 'OpenSans_600SemiBold',
      bold: 'OpenSans_700Bold',
    },
    webFontFamily: "'Open Sans', system-ui, sans-serif",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap',
  },
  {
    id: 'poppins',
    name: 'Poppins',
    description: 'Geometric modern',
    isPro: true,
    fontFamily: {
      regular: 'Poppins_400Regular',
      medium: 'Poppins_500Medium',
      semibold: 'Poppins_600SemiBold',
      bold: 'Poppins_700Bold',
    },
    webFontFamily: "'Poppins', system-ui, sans-serif",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
  },
  {
    id: 'nunito',
    name: 'Nunito',
    description: 'Rounded and friendly',
    isPro: true,
    fontFamily: {
      regular: 'Nunito_400Regular',
      medium: 'Nunito_500Medium',
      semibold: 'Nunito_600SemiBold',
      bold: 'Nunito_700Bold',
    },
    webFontFamily: "'Nunito', system-ui, sans-serif",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap',
  },
  {
    id: 'montserrat',
    name: 'Montserrat',
    description: 'Bold geometric',
    isPro: true,
    fontFamily: {
      regular: 'Montserrat_400Regular',
      medium: 'Montserrat_500Medium',
      semibold: 'Montserrat_600SemiBold',
      bold: 'Montserrat_700Bold',
    },
    webFontFamily: "'Montserrat', system-ui, sans-serif",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap',
  },
  {
    id: 'raleway',
    name: 'Raleway',
    description: 'Elegant thin',
    isPro: true,
    fontFamily: {
      regular: 'Raleway_400Regular',
      medium: 'Raleway_500Medium',
      semibold: 'Raleway_600SemiBold',
      bold: 'Raleway_700Bold',
    },
    webFontFamily: "'Raleway', system-ui, sans-serif",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&display=swap',
  },
  {
    id: 'maven',
    name: 'Maven Pro',
    description: 'Friendly curves',
    isPro: true,
    fontFamily: {
      regular: 'MavenPro_400Regular',
      medium: 'MavenPro_500Medium',
      semibold: 'MavenPro_600SemiBold',
      bold: 'MavenPro_700Bold',
    },
    webFontFamily: "'Maven Pro', system-ui, sans-serif",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=Maven+Pro:wght@400;500;600;700&display=swap',
  },
  {
    id: 'atkinson',
    name: 'Atkinson Hyperlegible',
    description: 'High readability',
    isPro: true,
    fontFamily: {
      regular: 'AtkinsonHyperlegible_400Regular',
      medium: 'AtkinsonHyperlegible_400Regular',
      semibold: 'AtkinsonHyperlegible_700Bold',
      bold: 'AtkinsonHyperlegible_700Bold',
    },
    webFontFamily: "'Atkinson Hyperlegible', sans-serif",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap',
  },
  // Serif fonts
  {
    id: 'lora',
    name: 'Lora',
    description: 'Classic serif',
    isPro: true,
    fontFamily: {
      regular: 'Lora_400Regular',
      medium: 'Lora_500Medium',
      semibold: 'Lora_600SemiBold',
      bold: 'Lora_700Bold',
    },
    webFontFamily: "'Lora', Georgia, serif",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap',
  },
  {
    id: 'newsreader',
    name: 'Newsreader',
    description: 'Editorial serif',
    isPro: true,
    fontFamily: {
      regular: 'Newsreader_400Regular',
      medium: 'Newsreader_500Medium',
      semibold: 'Newsreader_600SemiBold',
      bold: 'Newsreader_700Bold',
    },
    webFontFamily: "'Newsreader', Georgia, serif",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=Newsreader:wght@400;500;600;700&display=swap',
  },
  // Monospace fonts
  {
    id: 'jetbrains',
    name: 'JetBrains Mono',
    description: 'Developer monospace',
    isPro: true,
    fontFamily: {
      regular: 'JetBrainsMono_400Regular',
      medium: 'JetBrainsMono_500Medium',
      semibold: 'JetBrainsMono_600SemiBold',
      bold: 'JetBrainsMono_700Bold',
    },
    webFontFamily: "'JetBrains Mono', monospace",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
  },
  // Futuristic / Synthwave fonts
  {
    id: 'oxanium',
    name: 'Oxanium',
    description: 'Synthwave futuristic',
    isPro: true,
    fontFamily: {
      regular: 'Oxanium_400Regular',
      medium: 'Oxanium_500Medium',
      semibold: 'Oxanium_600SemiBold',
      bold: 'Oxanium_700Bold',
    },
    webFontFamily: "'Oxanium', sans-serif",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=Oxanium:wght@400;500;600;700&display=swap',
  },
  {
    id: 'play',
    name: 'Play',
    description: '80s gaming',
    isPro: true,
    fontFamily: {
      regular: 'Play_400Regular',
      medium: 'Play_400Regular',
      semibold: 'Play_700Bold',
      bold: 'Play_700Bold',
    },
    webFontFamily: "'Play', sans-serif",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=Play:wght@400;700&display=swap',
  },
  {
    id: 'exo2',
    name: 'Exo 2',
    description: 'Sci-fi geometric',
    isPro: true,
    fontFamily: {
      regular: 'Exo2_400Regular',
      medium: 'Exo2_500Medium',
      semibold: 'Exo2_600SemiBold',
      bold: 'Exo2_700Bold',
    },
    webFontFamily: "'Exo 2', sans-serif",
    webFontUrl: 'https://fonts.googleapis.com/css2?family=Exo+2:wght@400;500;600;700&display=swap',
  },
];

/**
 * Font lookup map for O(1) access
 */
export const fontMap: Record<string, FontDefinition> = fonts.reduce((acc, font) => {
  acc[font.id] = font;
  return acc;
}, {} as Record<string, FontDefinition>);

/**
 * Get a font by ID, falls back to Inter
 */
export function getFont(id: string): FontDefinition {
  return fontMap[id] || fonts[0]; // Inter is first/default
}

/**
 * Get all font IDs
 */
export function getFontIds(): string[] {
  return fonts.map(f => f.id);
}

/**
 * Get font options for display in settings picker
 */
export function getFontOptions(): FontOption[] {
  return fonts.map(font => ({
    id: font.id,
    name: font.name,
    description: font.description,
    isPro: font.isPro,
    previewFont: font.fontFamily.regular,
  }));
}

/**
 * Default font ID
 */
export const DEFAULT_FONT_ID = 'inter';
