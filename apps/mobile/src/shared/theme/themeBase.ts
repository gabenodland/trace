/**
 * Theme Base - Shared values across all themes
 *
 * These values don't change between themes (spacing, typography, border radius).
 * Only colors and shadows change per theme.
 */

/**
 * Spacing scale (multiples of 4)
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/**
 * Typography
 */
export const typography = {
  // Font family
  fontFamily: {
    regular: 'MavenPro_400Regular',
    medium: 'MavenPro_500Medium',
    semibold: 'MavenPro_600SemiBold',
    bold: 'MavenPro_700Bold',
  },

  // Font sizes
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
  },

  // Font weights
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
} as const;

/**
 * Border radius
 */
export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
} as const;

/**
 * Export combined base theme (non-color values)
 */
export const themeBase = {
  spacing,
  typography,
  borderRadius,
} as const;
