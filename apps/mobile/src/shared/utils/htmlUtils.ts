/**
 * HTML utility functions shared across the mobile app
 */

/**
 * Remove inline color styles from HTML to ensure theme colors are used.
 * Strips color, background-color, and background properties from style attributes.
 * Handles pasted content that may have hardcoded colors like "color: rgb(0, 0, 0)".
 */
export function sanitizeHtmlColors(html: string): string {
  return html.replace(
    /style="([^"]*)"/gi,
    (_match, styleContent) => {
      const cleanedStyle = styleContent
        .replace(/\bcolor\s*:\s*[^;]+;?/gi, '')
        .replace(/background-color\s*:\s*[^;]+;?/gi, '')
        .replace(/background\s*:\s*[^;]+;?/gi, '')
        .trim();

      if (!cleanedStyle) return '';
      return `style="${cleanedStyle}"`;
    }
  );
}
