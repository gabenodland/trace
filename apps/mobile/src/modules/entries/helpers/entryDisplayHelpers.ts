/**
 * Formatting helpers for different entry display modes
 */
import { stripHtml } from '@trace/core';
import type { EntryDisplayMode } from '../types/EntryDisplayMode';

/**
 * Get the first line of text from HTML content (used for title-only mode when no title)
 */
export function getFirstLineOfText(htmlContent: string): string {
  // Strip HTML tags
  let text = htmlContent
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");

  // Get first non-empty line
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const firstLine = lines[0] || '';

  // Truncate if too long
  if (firstLine.length > 100) {
    return firstLine.substring(0, 100).trim() + '...';
  }

  return firstLine;
}

/**
 * Format entry content for "smashed" mode
 * All text smashed together, HTML stripped, add space where tags were
 * Max 2 lines
 */
export function formatSmashedContent(htmlContent: string, maxLength: number = 150): string {
  // Replace block-level closing tags with spaces (not newlines)
  let text = htmlContent
    .replace(/<\/p>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/div>/gi, ' ')
    .replace(/<\/h[1-6]>/gi, ' ')
    .replace(/<\/li>/gi, ' ')
    .replace(/<\/tr>/gi, ' ');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");

  // Normalize whitespace: replace multiple spaces with single space
  text = text.replace(/\s+/g, ' ');

  // Trim
  text = text.trim();

  // Truncate if needed
  if (text.length > maxLength) {
    text = text.substring(0, maxLength).trim() + '...';
  }

  return text;
}

/**
 * Format entry content for "short" mode
 * Shows text with newlines, minimal formatting
 */
export function formatShortContent(htmlContent: string): string {
  // Use existing stripHtml which preserves line breaks
  let text = stripHtml(htmlContent);

  // Limit to reasonable length (e.g., 5 lines or 300 chars)
  const lines = text.split('\n').filter(line => line.trim());

  if (lines.length > 5) {
    text = lines.slice(0, 5).join('\n') + '\n...';
  } else if (text.length > 300) {
    text = text.substring(0, 300).trim() + '...';
  }

  return text;
}

/**
 * Format entry content for "flow" mode
 * Returns HTML for rendering (will be rendered with proper formatting in component)
 */
export function formatFlowContent(htmlContent: string): string {
  // Return the HTML as-is - it will be rendered by RenderHtml component
  return htmlContent;
}

/**
 * Get formatted content based on display mode
 */
export function getFormattedContent(
  htmlContent: string,
  mode: EntryDisplayMode,
  maxLength?: number
): string {
  switch (mode) {
    case 'title':
      return getFirstLineOfText(htmlContent); // For title mode, get first line only
    case 'smashed':
      return formatSmashedContent(htmlContent, maxLength);
    case 'short':
      return formatShortContent(htmlContent);
    case 'flow':
      return formatFlowContent(htmlContent);
    default:
      return formatSmashedContent(htmlContent, maxLength);
  }
}

/**
 * Get number of lines for display mode
 */
export function getDisplayModeLines(mode: EntryDisplayMode): number | undefined {
  switch (mode) {
    case 'title':
      return 1; // Single line for title-only mode
    case 'smashed':
      return 2; // Max 2 lines
    case 'short':
      return 5; // Max 5 lines
    case 'flow':
      return undefined; // No limit, expand to fit
    default:
      return 2;
  }
}
