/**
 * HTML utility functions shared across the mobile app
 */

/**
 * Fix malformed closing tags produced by TipTap task list serialization.
 * Known corruption: `</spann>` → `</span>`, `</labelel>` etc.
 * Uses a whitelist of known valid HTML tags to avoid corrupting legitimate tags
 * like `</small>` where the last two characters happen to match.
 */
const KNOWN_TAG_FIXES: Record<string, string> = {
  'spann': 'span',
  'strongg': 'strong',
  'labelel': 'label',
};

export function fixMalformedClosingTags(html: string): string {
  return html.replace(/<\/(\w+)>/g, (match, tagName) => {
    const fixed = KNOWN_TAG_FIXES[tagName];
    return fixed ? `</${fixed}>` : match;
  });
}

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
