// Pure helper functions for entry operations

/**
 * Extract hashtags from content (without the # symbol)
 * Matches #word patterns (letters, numbers, underscores)
 */
export function parseHashtags(content: string): string[] {
  const regex = /#(\w+)/g;
  const tags = new Set<string>();
  let match;

  while ((match = regex.exec(content)) !== null) {
    tags.add(match[1].toLowerCase()); // Remove # and normalize to lowercase
  }

  return Array.from(tags);
}

/**
 * Extract mentions from content (without the @ symbol)
 * Matches @word patterns (letters, numbers, underscores)
 */
export function parseMentions(content: string): string[] {
  const regex = /@(\w+)/g;
  const mentions = new Set<string>();
  let match;

  while ((match = regex.exec(content)) !== null) {
    mentions.add(match[1].toLowerCase()); // Remove @ and normalize to lowercase
  }

  return Array.from(mentions);
}

/**
 * Extract both tags and mentions from content
 */
export function extractTagsAndMentions(content: string): {
  tags: string[];
  mentions: string[];
} {
  return {
    tags: parseHashtags(content),
    mentions: parseMentions(content),
  };
}

/**
 * Strip HTML tags from content to get plain text
 * Simple implementation - for preview/search purposes
 */
export function stripHtml(htmlContent: string): string {
  // Remove HTML tags
  let text = htmlContent.replace(/<[^>]*>/g, "");

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");

  return text.trim();
}

/**
 * Get word count from content (strips HTML first)
 */
export function getWordCount(content: string): number {
  const plainText = stripHtml(content);
  if (!plainText) return 0;

  const words = plainText.split(/\s+/).filter((word) => word.length > 0);
  return words.length;
}

/**
 * Get character count from content (strips HTML first)
 */
export function getCharacterCount(content: string): number {
  const plainText = stripHtml(content);
  return plainText.length;
}

/**
 * Get preview text from content (first N characters of plain text)
 */
export function getPreviewText(content: string, maxLength: number = 100): string {
  const plainText = stripHtml(content);

  if (plainText.length <= maxLength) {
    return plainText;
  }

  // Truncate and add ellipsis
  return plainText.substring(0, maxLength).trim() + "...";
}

/**
 * Format date for display (relative or absolute) with "Last edited" prefix
 */
export function formatEntryDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  let timeStr = "";

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) timeStr = "just now";
    else timeStr = `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    timeStr = `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  } else if (diffDays === 1) {
    timeStr = "yesterday";
  } else if (diffDays < 7) {
    timeStr = `${diffDays} days ago`;
  } else {
    // Format as date
    timeStr = date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }

  return `Last edited ${timeStr}`;
}
