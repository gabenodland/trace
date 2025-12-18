/**
 * Sorting and grouping helpers for entry lists
 */
import type { Entry, EntryStatus } from "./EntryTypes";
import type { Stream } from "../streams/StreamTypes";
import { getStatusLabel } from "./EntryTypes";
import { decimalToStars } from "./ratingHelpers";
import type { EntrySortMode, EntrySortOrder, EntryGroupMode } from "./EntryDisplayTypes";

/**
 * Section data for grouped entry lists
 */
export interface EntrySection {
  title: string;
  count: number;
  data: Entry[];
}

/**
 * Status order for sorting (workflow order, not alphabetical)
 */
const STATUS_ORDER: EntryStatus[] = [
  "new",
  "todo",
  "in_progress",
  "in_review",
  "waiting",
  "on_hold",
  "done",
  "closed",
  "cancelled",
  "none",
];

/**
 * Get the sort index for a status
 */
function getStatusSortIndex(status: EntryStatus): number {
  const index = STATUS_ORDER.indexOf(status);
  return index === -1 ? STATUS_ORDER.length : index;
}

/**
 * Sort entries based on sort mode and order
 * Pinned entries can optionally appear first, controlled by showPinnedFirst parameter
 */
export function sortEntries(
  entries: Entry[],
  sortMode: EntrySortMode,
  streamMap?: Record<string, string>,
  order: EntrySortOrder = "desc",
  showPinnedFirst: boolean = false
): Entry[] {
  const sorted = [...entries];
  const multiplier = order === "asc" ? -1 : 1;

  switch (sortMode) {
    case "title":
      return sorted.sort((a, b) => {
        if (showPinnedFirst) {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
        }
        const titleA = a.title || a.content || "";
        const titleB = b.title || b.content || "";
        return titleA.localeCompare(titleB) * (order === "asc" ? 1 : -1);
      });

    case "stream":
      return sorted.sort((a, b) => {
        if (showPinnedFirst) {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
        }
        const streamA = a.stream_id && streamMap ? streamMap[a.stream_id] || "" : "";
        const streamB = b.stream_id && streamMap ? streamMap[b.stream_id] || "" : "";
        if (streamA === streamB) {
          return (
            (new Date(b.entry_date || b.created_at).getTime() -
              new Date(a.entry_date || a.created_at).getTime()) *
            multiplier
          );
        }
        return streamA.localeCompare(streamB) * (order === "asc" ? 1 : -1);
      });

    case "entry_date":
      return sorted.sort((a, b) => {
        if (showPinnedFirst) {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
        }
        const dateA = new Date(a.entry_date || a.created_at).getTime();
        const dateB = new Date(b.entry_date || b.created_at).getTime();
        return (dateB - dateA) * multiplier;
      });

    case "created_date":
      return sorted.sort((a, b) => {
        if (showPinnedFirst) {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
        }
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return (dateB - dateA) * multiplier;
      });

    case "updated_date":
      return sorted.sort((a, b) => {
        if (showPinnedFirst) {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
        }
        const dateA = new Date(a.updated_at).getTime();
        const dateB = new Date(b.updated_at).getTime();
        return (dateB - dateA) * multiplier;
      });

    case "due_date":
      return sorted.sort((a, b) => {
        if (showPinnedFirst) {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
        }
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        const dateA = new Date(a.due_date).getTime();
        const dateB = new Date(b.due_date).getTime();
        return (dateA - dateB) * multiplier;
      });

    case "priority":
      return sorted.sort((a, b) => {
        if (showPinnedFirst) {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
        }
        const priorityA = a.priority || 0;
        const priorityB = b.priority || 0;
        return (priorityB - priorityA) * multiplier;
      });

    case "rating":
      return sorted.sort((a, b) => {
        if (showPinnedFirst) {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
        }
        const ratingA = a.rating || 0;
        const ratingB = b.rating || 0;
        return (ratingB - ratingA) * multiplier;
      });

    case "status":
      return sorted.sort((a, b) => {
        if (showPinnedFirst) {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
        }
        const statusA = a.status || "none";
        const statusB = b.status || "none";
        const indexA = getStatusSortIndex(statusA as EntryStatus);
        const indexB = getStatusSortIndex(statusB as EntryStatus);
        if (indexA === indexB) {
          return (
            (new Date(b.entry_date || b.created_at).getTime() -
              new Date(a.entry_date || a.created_at).getTime()) *
            multiplier
          );
        }
        return (indexA - indexB) * (order === "asc" ? -1 : 1);
      });

    case "type":
      return sorted.sort((a, b) => {
        if (showPinnedFirst) {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
        }
        const typeA = a.type || "";
        const typeB = b.type || "";
        if (!typeA && !typeB) return 0;
        if (!typeA) return 1;
        if (!typeB) return -1;
        if (typeA === typeB) {
          return (
            (new Date(b.entry_date || b.created_at).getTime() -
              new Date(a.entry_date || a.created_at).getTime()) *
            multiplier
          );
        }
        return typeA.localeCompare(typeB) * (order === "asc" ? 1 : -1);
      });

    default:
      return sorted;
  }
}

/**
 * Group entries by status into sections
 */
export function groupEntriesByStatus(
  entries: Entry[],
  order: EntrySortOrder = "desc",
  showPinnedFirst: boolean = false
): EntrySection[] {
  const sorted = sortEntries(entries, "status", undefined, order, showPinnedFirst);
  const groups = new Map<string, Entry[]>();

  for (const entry of sorted) {
    const status = entry.status || "none";
    if (!groups.has(status)) {
      groups.set(status, []);
    }
    groups.get(status)!.push(entry);
  }

  const sections: EntrySection[] = [];
  const statusOrder = order === "asc" ? [...STATUS_ORDER].reverse() : STATUS_ORDER;

  for (const status of statusOrder) {
    const sectionEntries = groups.get(status);
    if (sectionEntries && sectionEntries.length > 0) {
      sections.push({
        title: getStatusLabel(status as EntryStatus),
        count: sectionEntries.length,
        data: sectionEntries,
      });
    }
  }

  return sections;
}

/**
 * Group entries by type into sections
 */
export function groupEntriesByType(
  entries: Entry[],
  order: EntrySortOrder = "desc",
  showPinnedFirst: boolean = false
): EntrySection[] {
  const sorted = sortEntries(entries, "type", undefined, order, showPinnedFirst);
  const groups = new Map<string, Entry[]>();

  for (const entry of sorted) {
    const type = entry.type || "";
    if (!groups.has(type)) {
      groups.set(type, []);
    }
    groups.get(type)!.push(entry);
  }

  const types = Array.from(groups.keys()).sort((a, b) => {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b) * (order === "asc" ? 1 : -1);
  });

  const sections: EntrySection[] = [];
  for (const type of types) {
    const sectionEntries = groups.get(type);
    if (sectionEntries && sectionEntries.length > 0) {
      sections.push({
        title: type || "No Type",
        count: sectionEntries.length,
        data: sectionEntries,
      });
    }
  }

  return sections;
}

/**
 * Group entries by stream into sections
 */
export function groupEntriesByStream(
  entries: Entry[],
  streamMap: Record<string, string> | undefined,
  order: EntrySortOrder = "desc",
  showPinnedFirst: boolean = false
): EntrySection[] {
  const sorted = sortEntries(entries, "stream", streamMap, order, showPinnedFirst);
  const groups = new Map<string, Entry[]>();

  for (const entry of sorted) {
    const streamName = entry.stream_id && streamMap ? streamMap[entry.stream_id] || "" : "";
    if (!groups.has(streamName)) {
      groups.set(streamName, []);
    }
    groups.get(streamName)!.push(entry);
  }

  const streams = Array.from(groups.keys()).sort((a, b) => {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b) * (order === "asc" ? 1 : -1);
  });

  const sections: EntrySection[] = [];
  for (const stream of streams) {
    const sectionEntries = groups.get(stream);
    if (sectionEntries && sectionEntries.length > 0) {
      sections.push({
        title: stream || "No Stream",
        count: sectionEntries.length,
        data: sectionEntries,
      });
    }
  }

  return sections;
}

/**
 * Due date bucket types for grouping
 */
type DueDateBucket =
  | "overdue"
  | "today"
  | "this_week"
  | "next_week"
  | "this_month"
  | "next_month"
  | "later"
  | "no_date";

const DUE_DATE_LABELS: Record<DueDateBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  this_week: "This Week",
  next_week: "Next Week",
  this_month: "This Month",
  next_month: "Next Month",
  later: "Later",
  no_date: "No Due Date",
};

const DUE_DATE_ORDER: DueDateBucket[] = [
  "overdue",
  "today",
  "this_week",
  "next_week",
  "this_month",
  "next_month",
  "later",
  "no_date",
];

function getDueDateBucket(dueDate: string | null | undefined): DueDateBucket {
  if (!dueDate) return "no_date";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  const endOfThisWeek = new Date(today);
  const dayOfWeek = today.getDay();
  endOfThisWeek.setDate(today.getDate() + (7 - dayOfWeek));

  const endOfNextWeek = new Date(endOfThisWeek);
  endOfNextWeek.setDate(endOfThisWeek.getDate() + 7);

  const endOfThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);

  if (dueDay.getTime() < today.getTime()) return "overdue";
  if (dueDay.getTime() === today.getTime()) return "today";
  if (dueDay.getTime() <= endOfThisWeek.getTime()) return "this_week";
  if (dueDay.getTime() <= endOfNextWeek.getTime()) return "next_week";
  if (dueDay.getTime() <= endOfThisMonth.getTime()) return "this_month";
  if (dueDay.getTime() <= endOfNextMonth.getTime()) return "next_month";
  return "later";
}

/**
 * Group entries by due date into sections
 */
export function groupEntriesByDueDate(
  entries: Entry[],
  order: EntrySortOrder = "desc",
  showPinnedFirst: boolean = false
): EntrySection[] {
  const sorted = sortEntries(entries, "due_date", undefined, order, showPinnedFirst);
  const groups = new Map<DueDateBucket, Entry[]>();

  for (const entry of sorted) {
    const bucket = getDueDateBucket(entry.due_date);
    if (!groups.has(bucket)) {
      groups.set(bucket, []);
    }
    groups.get(bucket)!.push(entry);
  }

  const sections: EntrySection[] = [];
  const bucketOrder = order === "asc" ? [...DUE_DATE_ORDER].reverse() : DUE_DATE_ORDER;

  for (const bucket of bucketOrder) {
    const sectionEntries = groups.get(bucket);
    if (sectionEntries && sectionEntries.length > 0) {
      sections.push({
        title: DUE_DATE_LABELS[bucket],
        count: sectionEntries.length,
        data: sectionEntries,
      });
    }
  }

  return sections;
}

/**
 * Group entries by priority into sections
 */
export function groupEntriesByPriority(
  entries: Entry[],
  order: EntrySortOrder = "desc",
  showPinnedFirst: boolean = false
): EntrySection[] {
  const entriesWithPriority: Entry[] = [];
  const entriesWithoutPriority: Entry[] = [];

  for (const entry of entries) {
    if (entry.priority && entry.priority > 0) {
      entriesWithPriority.push(entry);
    } else {
      entriesWithoutPriority.push(entry);
    }
  }

  const sortedWithPriority = [...entriesWithPriority].sort((a, b) => {
    if (showPinnedFirst) {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
    }
    const priorityA = a.priority || 0;
    const priorityB = b.priority || 0;
    return order === "asc" ? priorityA - priorityB : priorityB - priorityA;
  });

  const sortedWithoutPriority = [...entriesWithoutPriority].sort((a, b) => {
    if (showPinnedFirst) {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
    }
    return (
      new Date(b.entry_date || b.created_at).getTime() -
      new Date(a.entry_date || a.created_at).getTime()
    );
  });

  const sections: EntrySection[] = [];

  if (sortedWithPriority.length > 0) {
    sections.push({
      title: "",
      count: sortedWithPriority.length,
      data: sortedWithPriority,
    });
  }

  if (sortedWithoutPriority.length > 0) {
    sections.push({
      title: "No Priority",
      count: sortedWithoutPriority.length,
      data: sortedWithoutPriority,
    });
  }

  return sections;
}

/**
 * Determine if entries have mixed rating types
 * Returns 'stars' if all are stars, '10base' if any use decimal rating
 */
function determineRatingDisplayMode(
  entries: Entry[],
  streamById?: Record<string, Stream> | null
): "stars" | "10base" {
  if (!streamById) return "stars";

  // Check if any entry's stream uses 10-base rating
  for (const entry of entries) {
    if (entry.stream_id && streamById[entry.stream_id]) {
      const stream = streamById[entry.stream_id];
      const ratingType = stream.entry_rating_type ?? "stars";
      if (ratingType === "decimal" || ratingType === "decimal_whole") {
        return "10base";
      }
    }
  }

  return "stars";
}

/**
 * Get rating label for display based on display mode
 * For stars mode: "5 Stars", "4 Stars", etc. (converts 0-10 to 1-5)
 * For 10base mode: "10/10", "9/10", etc. (shows actual value)
 */
export function getRatingLabel(rating: number, displayMode: "stars" | "10base"): string {
  if (rating === 0) return "No Rating";

  if (displayMode === "10base") {
    // For 10-base mode, show the actual value
    const isWholeNumber = rating === Math.floor(rating);
    if (isWholeNumber) {
      return `${rating}/10`;
    }
    return `${rating.toFixed(1)}/10`;
  }

  // For stars mode, convert 0-10 to 1-5 stars
  const stars = decimalToStars(rating);
  return `${stars} Star${stars !== 1 ? "s" : ""}`;
}

/**
 * Get the grouping key for a rating based on display mode
 * For stars: group by star value (1-5)
 * For 10base: group by whole number (0-10)
 */
function getRatingGroupKey(rating: number, displayMode: "stars" | "10base"): number {
  if (rating === 0) return 0;

  if (displayMode === "10base") {
    // Group by whole number for 10-base
    return Math.floor(rating);
  }

  // Group by star value (1-5) - convert to the star bucket
  return decimalToStars(rating);
}

/**
 * Group entries by rating into sections
 * Returns sections in rating order (highest first for desc) with count
 * Automatically uses 10-base display when entries have mixed rating types
 */
export function groupEntriesByRating(
  entries: Entry[],
  order: EntrySortOrder = "desc",
  showPinnedFirst: boolean = false,
  streamById?: Record<string, Stream> | null
): EntrySection[] {
  // First sort entries by rating
  const sorted = sortEntries(entries, "rating", undefined, order, showPinnedFirst);

  // Determine display mode based on stream rating types
  const displayMode = determineRatingDisplayMode(entries, streamById);

  // Group by rating
  const groups = new Map<number, Entry[]>();

  for (const entry of sorted) {
    const rating = entry.rating || 0;
    const groupKey = getRatingGroupKey(rating, displayMode);

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(entry);
  }

  // Get unique group keys and sort them
  const groupKeys = Array.from(groups.keys()).sort((a, b) => {
    return (b - a) * (order === "asc" ? -1 : 1);
  });

  // Convert to sections
  const sections: EntrySection[] = [];

  for (const groupKey of groupKeys) {
    const groupEntries = groups.get(groupKey);
    if (groupEntries && groupEntries.length > 0) {
      // For the title, use the group key value
      let title: string;
      if (groupKey === 0) {
        title = "No Rating";
      } else if (displayMode === "10base") {
        title = `${groupKey}/10`;
      } else {
        title = `${groupKey} Star${groupKey !== 1 ? "s" : ""}`;
      }

      sections.push({
        title,
        count: groupEntries.length,
        data: groupEntries,
      });
    }
  }

  return sections;
}

/**
 * Group entries based on group mode
 */
export function groupEntries(
  entries: Entry[],
  groupMode: EntryGroupMode,
  streamMap?: Record<string, string>,
  order: EntrySortOrder = "desc",
  showPinnedFirst: boolean = false,
  streamById?: Record<string, Stream> | null
): EntrySection[] {
  switch (groupMode) {
    case "status":
      return groupEntriesByStatus(entries, order, showPinnedFirst);
    case "stream":
      return groupEntriesByStream(entries, streamMap, order, showPinnedFirst);
    case "type":
      return groupEntriesByType(entries, order, showPinnedFirst);
    case "due_date":
      return groupEntriesByDueDate(entries, order, showPinnedFirst);
    case "priority":
      return groupEntriesByPriority(entries, order, showPinnedFirst);
    case "rating":
      return groupEntriesByRating(entries, order, showPinnedFirst, streamById);
    case "none":
    default:
      return [{ title: "", count: entries.length, data: entries }];
  }
}

/**
 * Filter entries by search query
 */
export function filterEntriesBySearch(entries: Entry[], query: string): Entry[] {
  if (!query.trim()) return entries;

  const lowerQuery = query.toLowerCase();

  return entries.filter((entry) => {
    // Search in title
    if (entry.title && entry.title.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // Search in content (stripped of HTML)
    const plainContent = entry.content
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");

    if (plainContent.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // Search in tags
    if (entry.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))) {
      return true;
    }

    // Search in mentions
    if (entry.mentions?.some((mention) => mention.toLowerCase().includes(lowerQuery))) {
      return true;
    }

    // Search in type
    if (entry.type && entry.type.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    return false;
  });
}
