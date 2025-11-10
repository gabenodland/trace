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

/**
 * Check if an entry is a task (has incomplete or complete status)
 */
export function isTask(status: "none" | "incomplete" | "complete"): boolean {
  return status === "incomplete" || status === "complete";
}

/**
 * Check if a task is overdue (has due_date in the past and status is incomplete)
 */
export function isTaskOverdue(
  status: "none" | "incomplete" | "complete",
  dueDate: string | null
): boolean {
  if (status !== "incomplete" || !dueDate) return false;

  const due = new Date(dueDate);
  const now = new Date();
  // Set time to start of day for comparison
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  return due < now;
}

/**
 * Check if a due date is today
 */
export function isDueToday(dueDate: string | null): boolean {
  if (!dueDate) return false;

  const due = new Date(dueDate);
  const now = new Date();

  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

/**
 * Check if a due date is within the next 7 days
 */
export function isDueThisWeek(dueDate: string | null): boolean {
  if (!dueDate) return false;

  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const weekFromNow = new Date(now);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  return due >= now && due <= weekFromNow;
}

/**
 * Format due date for display
 * Examples: "Today", "Tomorrow", "Mon, Jan 15", "Overdue by 3 days"
 */
export function formatDueDate(
  dueDate: string | null,
  status: "none" | "incomplete" | "complete"
): string {
  if (!dueDate) return "";

  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Overdue
  if (status === "incomplete" && diffDays < 0) {
    const daysOverdue = Math.abs(diffDays);
    return `Overdue by ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}`;
  }

  // Today
  if (diffDays === 0) return "Today";

  // Tomorrow
  if (diffDays === 1) return "Tomorrow";

  // This week (next 7 days)
  if (diffDays > 1 && diffDays <= 7) {
    return due.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  // Future dates
  return due.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: due.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Get task statistics (completed vs incomplete)
 */
export function getTaskStats(
  entries: Array<{ status: "none" | "incomplete" | "complete" }>
): {
  total: number;
  incomplete: number;
  complete: number;
} {
  const tasks = entries.filter((e) => isTask(e.status));

  return {
    total: tasks.length,
    incomplete: tasks.filter((t) => t.status === "incomplete").length,
    complete: tasks.filter((t) => t.status === "complete").length,
  };
}
