/**
 * Editor Helpers - Utilities for working with title-first HTML content
 */

/**
 * Split HTML content into title and body
 * Title is extracted from the first h1.entry-title element
 */
export function splitTitleAndBody(html: string): { title: string; body: string } {
  if (!html) {
    return { title: '', body: '' };
  }

  // Trim leading/trailing whitespace from HTML
  const trimmedHtml = html.trim();

  // Match first h1.entry-title tag (must have entry-title class)
  // Use non-greedy match for content to handle potential nested tags
  const entryTitleMatch = trimmedHtml.match(/^<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);

  if (entryTitleMatch) {
    // Extract title text (strip any inner HTML tags)
    const titleHtml = entryTitleMatch[1];
    const title = titleHtml.replace(/<[^>]*>/g, '').trim();

    // Body is everything after the first h1
    const body = trimmedHtml.substring(entryTitleMatch[0].length).trim();

    return { title, body };
  }

  // Fallback: match any h1 at the start (for legacy content without entry-title class)
  const h1Match = trimmedHtml.match(/^<h1[^>]*>([\s\S]*?)<\/h1>/i);

  if (h1Match) {
    const titleHtml = h1Match[1];
    const title = titleHtml.replace(/<[^>]*>/g, '').trim();
    const body = trimmedHtml.substring(h1Match[0].length).trim();

    return { title, body };
  }

  // No h1 found - entire content is body
  return { title: '', body: trimmedHtml };
}

/**
 * Combine title and body into HTML with title-first structure
 */
export function combineTitleAndBody(title: string, body: string): string {
  // Escape title for HTML
  const escapedTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Always include h1 for title (even if empty - shows placeholder)
  const titleHtml = `<h1 class="entry-title">${escapedTitle}</h1>`;

  // Strip any existing h1.entry-title from body to prevent duplication
  // This handles legacy data or sync scenarios where title was embedded in content
  let cleanBody = body || '';
  cleanBody = cleanBody.replace(/^<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>.*?<\/h1>/i, '').trim();

  // Ensure body has at least an empty paragraph
  const bodyHtml = cleanBody || '<p></p>';

  return titleHtml + bodyHtml;
}

/**
 * Extract just the title text from HTML content
 */
export function extractTitle(html: string): string {
  return splitTitleAndBody(html).title;
}

/**
 * Extract just the body HTML from content
 */
export function extractBody(html: string): string {
  return splitTitleAndBody(html).body;
}

/**
 * Strip only <h1 class="entry-title"> from content start.
 * Unlike extractBody, this does NOT fall back to stripping arbitrary h1 tags.
 * Use this when loading entry.content into an editor that has a separate title field,
 * to prevent showing the embedded title duplicate without destroying legitimate user h1s.
 */
export function stripEntryTitleFromContent(html: string): string {
  if (!html) return '';
  const trimmed = html.trim();
  const match = trimmed.match(/^<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>[\s\S]*?<\/h1>/i);
  if (match) {
    return trimmed.substring(match[0].length).trim();
  }
  return trimmed;
}

/**
 * Check if content has a valid title-first structure
 */
export function hasTitleStructure(html: string): boolean {
  if (!html) return false;
  return /^<h1[^>]*>/.test(html.trim());
}

/**
 * CSS for title styling in editor (Web Editor)
 *
 * This function generates CSS for the title-first document structure.
 * It is intended for use in the web editor where dynamic theming is needed.
 *
 * Note: The mobile editor (RichTextEditor.tsx) has its own inline CSS that
 * uses React Native theme colors. When updating title styling, ensure both
 * are kept in sync:
 * - Web: This function (getTitleCSS)
 * - Mobile: apps/mobile/src/components/editor/RichTextEditor.tsx (customCSS)
 *
 * Key styling elements:
 * - Title uses h1.entry-title class
 * - Border-bottom separates title from body
 * - Placeholder shown via is-empty class (added by Title extension)
 *
 * @param options.bodyPlaceholder - Placeholder text for empty body (default: "Write something...")
 * @param options.colors.text - Text color for title
 * @param options.colors.placeholder - Placeholder text color
 * @param options.colors.border - Border color between title and body
 */
export function getTitleCSS(options?: {
  bodyPlaceholder?: string;
  colors?: {
    text?: string;
    placeholder?: string;
    border?: string;
  };
}): string {
  const {
    bodyPlaceholder = 'Write something...',
    colors = {},
  } = options || {};

  const {
    text = '#000000',
    placeholder = '#9ca3af',
    border = '#e5e5e5',
  } = colors;

  return `
    /* Title (first h1) styling */
    .ProseMirror h1.entry-title:first-child {
      font-size: 24px !important;
      font-weight: bold !important;
      margin: 0 0 12px 0 !important;
      padding: 0 0 8px 0 !important;
      border-bottom: 1px solid ${border} !important;
      min-height: 1.4em !important;
      color: ${text} !important;
    }

    /* Title placeholder when empty */
    .ProseMirror h1.entry-title.is-empty::before {
      content: attr(data-placeholder);
      color: ${placeholder} !important;
      pointer-events: none;
      position: absolute;
    }

    /* Body placeholder (first paragraph after title when empty) */
    .ProseMirror > p.is-editor-empty:first-of-type::before {
      content: "${bodyPlaceholder}";
      color: ${placeholder} !important;
      pointer-events: none;
      float: left;
      height: 0;
    }
  `;
}
