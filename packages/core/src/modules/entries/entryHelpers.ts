// Pure helper functions for entry operations

import type { EntryStatus } from "./EntryTypes";

// Statuses that indicate work is not started or in progress (actionable)
const ACTIONABLE_STATUSES: EntryStatus[] = ["new", "todo", "in_progress", "in_review", "waiting", "on_hold"];

// Statuses that indicate work is done/completed (terminal)
const COMPLETED_STATUSES: EntryStatus[] = ["done", "closed", "cancelled"];

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
 * Adds spacing between block elements to prevent text from jamming together
 */
export function stripHtml(htmlContent: string): string {
  // Replace block-level elements with newlines before stripping tags
  let text = htmlContent
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n");

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, "");

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");

  // Normalize whitespace: replace multiple consecutive newlines with max 2
  text = text.replace(/\n{3,}/g, "\n\n");

  // Trim leading/trailing whitespace from each line
  text = text
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

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
 * Format date as relative time (without prefix)
 * Examples: "just now", "5 minutes ago", "2 hours ago", "yesterday", "3 days ago", "Jan 15"
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return "just now";
    return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  } else if (diffDays === 1) {
    return "yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    // Format as date for older entries
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}

/**
 * Format date for display (relative or absolute) with "Last edited" prefix
 */
export function formatEntryDate(dateString: string): string {
  return `Last edited ${formatRelativeTime(dateString)}`;
}

/**
 * Format entry date/time for display
 * Shows date + time with AM/PM, or just date if time is hidden (milliseconds === 100)
 */
export function formatEntryDateTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const milliseconds = date.getMilliseconds();
  const hideTime = milliseconds === 100;

  // Check if it's today, yesterday, or another day
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  // Format date part
  let dateStr = "";
  if (isToday) {
    dateStr = "Today";
  } else if (isYesterday) {
    dateStr = "Yesterday";
  } else {
    dateStr = date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }

  // If time is hidden, return just the date
  if (hideTime) {
    return dateStr;
  }

  // Format time part (12-hour with AM/PM)
  const timeStr = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${dateStr} ${timeStr}`;
}

/**
 * Format entry date only (no time) for display
 * Shows "Today", "Yesterday", or formatted date
 */
export function formatEntryDateOnly(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  // Check if it's today, yesterday, or another day
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isToday) {
    return "Today";
  } else if (isYesterday) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}

/**
 * Check if a status indicates an actionable task (not completed/cancelled)
 */
export function isActionableStatus(status: EntryStatus): boolean {
  return ACTIONABLE_STATUSES.includes(status);
}

/**
 * Check if a status indicates completion (done, closed, cancelled)
 */
export function isCompletedStatus(status: EntryStatus): boolean {
  return COMPLETED_STATUSES.includes(status);
}

/**
 * Check if an entry is a task (has any workflow status set)
 */
export function isTask(status: EntryStatus): boolean {
  return status !== "none";
}

/**
 * Check if a task is overdue (has due_date in the past and status is actionable)
 */
export function isTaskOverdue(
  status: EntryStatus,
  dueDate: string | null
): boolean {
  // Only actionable statuses can be overdue
  if (!isActionableStatus(status) || !dueDate) return false;

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
  status: EntryStatus
): string {
  if (!dueDate) return "";

  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Overdue - only for actionable statuses
  if (isActionableStatus(status) && diffDays < 0) {
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
 * Get task statistics
 */
export function getTaskStats(
  entries: Array<{ status: EntryStatus }>
): {
  total: number;
  actionable: number;
  inProgress: number;
  completed: number;
} {
  const tasks = entries.filter((e) => isTask(e.status));

  return {
    total: tasks.length,
    actionable: tasks.filter((t) => isActionableStatus(t.status)).length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => isCompletedStatus(t.status)).length,
  };
}

// ============================================
// TYPE HELPERS
// ============================================

/** Maximum length for type names */
export const MAX_TYPE_NAME_LENGTH = 20;

/**
 * Sort types alphabetically (case-insensitive)
 */
export function sortTypes(types: string[]): string[] {
  return [...types].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

/**
 * Validate a type name
 * @returns Object with valid flag and optional error message
 */
export function validateTypeName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, error: "Type name cannot be empty" };
  }

  if (trimmed.length > MAX_TYPE_NAME_LENGTH) {
    return { valid: false, error: `Type name must be ${MAX_TYPE_NAME_LENGTH} characters or less` };
  }

  return { valid: true };
}

/**
 * Check if a type is a legacy type (not in the allowed list)
 * Used to show warnings when an entry has a type that's no longer in the stream's types
 */
export function isLegacyType(type: string | null, allowedTypes: string[]): boolean {
  if (!type) return false;
  return !allowedTypes.includes(type);
}

/**
 * Check if type feature is available for a stream
 * Types must be enabled AND have at least one type defined
 */
export function isTypeFeatureAvailable(
  useType: boolean | undefined,
  types: string[] | undefined
): boolean {
  return !!useType && Array.isArray(types) && types.length > 0;
}
