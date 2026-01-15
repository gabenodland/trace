// Pure helper functions for entry operations

import type { EntryStatus, LocationHierarchyRow, LocationTreeNode } from "./EntryTypes";

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
 * Get the next status when toggling an entry's completion state
 * - If completed/cancelled → todo (back to actionable)
 * - If actionable → done (mark complete)
 * - If none → none (no change)
 */
export function getNextStatus(currentStatus: EntryStatus): EntryStatus {
  if (currentStatus === "none") return "none";
  if (isCompletedStatus(currentStatus)) return "todo";
  return "done";
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

// ============================================
// AGGREGATION HELPERS
// Pure functions that aggregate data from entry arrays
// ============================================

export interface TagCount {
  tag: string;
  count: number;
}

export interface MentionCount {
  mention: string;
  count: number;
}

export interface LocationCount {
  location_id: string;
  count: number;
}

/**
 * Aggregate all unique tags from entries with their counts
 * Returns sorted by count descending
 */
export function aggregateTags(entries: Array<{ tags?: string[] | null }>): TagCount[] {
  const tagCounts: Record<string, number> = {};

  for (const entry of entries) {
    for (const tag of entry.tags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Aggregate all unique mentions from entries with their counts
 * Returns sorted by count descending
 */
export function aggregateMentions(entries: Array<{ mentions?: string[] | null }>): MentionCount[] {
  const mentionCounts: Record<string, number> = {};

  for (const entry of entries) {
    for (const mention of entry.mentions || []) {
      mentionCounts[mention] = (mentionCounts[mention] || 0) + 1;
    }
  }

  return Object.entries(mentionCounts)
    .map(([mention, count]) => ({ mention, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Aggregate all unique location_ids from entries with their counts
 * Returns sorted by count descending
 */
export function aggregateLocations(entries: Array<{ location_id?: string | null }>): LocationCount[] {
  const locationCounts: Record<string, number> = {};

  for (const entry of entries) {
    if (entry.location_id) {
      locationCounts[entry.location_id] = (locationCounts[entry.location_id] || 0) + 1;
    }
  }

  return Object.entries(locationCounts)
    .map(([location_id, count]) => ({ location_id, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get entry counts summary
 * @param entries - Array of entries to count
 * @returns Object with total count and count of entries without stream
 */
export function getEntryCounts(entries: Array<{ stream_id?: string | null }>): {
  total: number;
  noStream: number;
} {
  let noStream = 0;
  for (const entry of entries) {
    if (!entry.stream_id) {
      noStream++;
    }
  }
  return {
    total: entries.length,
    noStream,
  };
}

// ============================================
// LOCATION HIERARCHY HELPERS
// Build tree structure from flat SQL aggregation results
// ============================================

/**
 * Build a hierarchical location tree from flat SQL aggregation rows
 *
 * Hierarchy: country → region → city → place (no neighborhood level)
 *
 * Each level can have an <unnamed> node showing entries that have
 * that level but no deeper level (e.g., country but no region).
 *
 * @param rows - Flat rows from SQL GROUP BY query
 * @param noLocationCount - Count of entries with no location data
 * @returns Array of root-level nodes (countries + optional "No Location" node)
 */
export function buildLocationTree(
  rows: LocationHierarchyRow[],
  noLocationCount: number = 0
): LocationTreeNode[] {
  // Maps for building hierarchy: key -> node
  const countryMap = new Map<string, LocationTreeNode & { directCount: number }>();
  const regionMap = new Map<string, LocationTreeNode & { directCount: number }>();
  const cityMap = new Map<string, LocationTreeNode & { directCount: number }>();

  for (const row of rows) {
    const { country, region, city, neighborhood, place_name, location_id, entry_count } = row;

    // Skip rows with no location data at all
    if (!country && !region && !city && !place_name) {
      continue;
    }

    // Handle country level
    if (country) {
      if (!countryMap.has(country)) {
        countryMap.set(country, {
          type: 'country',
          value: country,
          displayName: country,
          entryCount: 0,
          directCount: 0,
          children: [],
        });
      }
      const countryNode = countryMap.get(country)!;
      countryNode.entryCount += entry_count;

      // If no deeper level, this is a direct entry for country
      if (!region && !city && !place_name) {
        countryNode.directCount += entry_count;
        continue;
      }

      // Handle region level
      if (region) {
        const regionKey = `${country}|${region}`;
        if (!regionMap.has(regionKey)) {
          const regionNode = {
            type: 'region' as const,
            value: region,
            displayName: region,
            entryCount: 0,
            directCount: 0,
            children: [],
            parentCountry: country,
          };
          regionMap.set(regionKey, regionNode);
          countryNode.children.push(regionNode);
        }
        const regionNode = regionMap.get(regionKey)!;
        regionNode.entryCount += entry_count;

        // If no deeper level, this is a direct entry for region
        if (!city && !place_name) {
          regionNode.directCount += entry_count;
          continue;
        }

        // Handle city level
        if (city) {
          const cityKey = `${country}|${region}|${city}`;
          if (!cityMap.has(cityKey)) {
            const cityNode = {
              type: 'city' as const,
              value: city,
              displayName: city,
              entryCount: 0,
              directCount: 0,
              children: [],
              parentRegion: region,
              parentCountry: country,
            };
            cityMap.set(cityKey, cityNode);
            regionNode.children.push(cityNode);
          }
          const cityNode = cityMap.get(cityKey)!;
          cityNode.entryCount += entry_count;

          // If no place_name, this is a direct entry for city
          if (!place_name) {
            cityNode.directCount += entry_count;
            continue;
          }

          // Place attaches directly to city
          const placeNode: LocationTreeNode = {
            type: 'place',
            value: place_name,
            displayName: place_name,
            entryCount: entry_count,
            children: [],
            locationId: location_id,
            parentNeighborhood: neighborhood,
            parentCity: city,
            parentRegion: region,
            parentCountry: country,
          };
          cityNode.children.push(placeNode);
        } else if (place_name) {
          // Place without city - attach to region
          const placeNode: LocationTreeNode = {
            type: 'place',
            value: place_name,
            displayName: place_name,
            entryCount: entry_count,
            children: [],
            locationId: location_id,
            parentNeighborhood: neighborhood,
            parentRegion: region,
            parentCountry: country,
          };
          regionNode.children.push(placeNode);
        }
      } else if (city) {
        // City without region - create under country directly
        const cityKey = `${country}||${city}`;
        if (!cityMap.has(cityKey)) {
          const cityNode = {
            type: 'city' as const,
            value: city,
            displayName: city,
            entryCount: 0,
            directCount: 0,
            children: [],
            parentCountry: country,
          };
          cityMap.set(cityKey, cityNode);
          countryNode.children.push(cityNode);
        }
        const cityNode = cityMap.get(cityKey)!;
        cityNode.entryCount += entry_count;

        if (!place_name) {
          cityNode.directCount += entry_count;
        } else {
          const placeNode: LocationTreeNode = {
            type: 'place',
            value: place_name,
            displayName: place_name,
            entryCount: entry_count,
            children: [],
            locationId: location_id,
            parentNeighborhood: neighborhood,
            parentCity: city,
            parentCountry: country,
          };
          cityNode.children.push(placeNode);
        }
      } else if (place_name) {
        // Place with only country - attach directly to country
        const placeNode: LocationTreeNode = {
          type: 'place',
          value: place_name,
          displayName: place_name,
          entryCount: entry_count,
          children: [],
          locationId: location_id,
          parentNeighborhood: neighborhood,
          parentCountry: country,
        };
        countryNode.children.push(placeNode);
      }
    }
  }

  // Helper to add <unnamed> node if needed and sort children
  const addUnnamedAndSort = (node: LocationTreeNode & { directCount: number }) => {
    // Add <unnamed> node if there are direct entries and other children exist
    if (node.directCount > 0 && node.children.length > 0) {
      node.children.unshift({
        type: node.type === 'country' ? 'region' :
              node.type === 'region' ? 'city' :
              'place',
        value: null,
        displayName: '<unnamed>',
        entryCount: node.directCount,
        children: [],
        parentCountry: node.parentCountry || (node.type === 'country' ? node.value : undefined),
        parentRegion: node.parentRegion || (node.type === 'region' ? node.value : undefined),
        parentCity: node.parentCity || (node.type === 'city' ? node.value : undefined),
      } as LocationTreeNode);
    }
    // Sort children by entry count (descending), but keep <unnamed> at top
    node.children.sort((a, b) => {
      if (a.displayName === '<unnamed>') return -1;
      if (b.displayName === '<unnamed>') return 1;
      return b.entryCount - a.entryCount;
    });
  };

  // Process all levels and add <unnamed> nodes
  for (const cityNode of cityMap.values()) {
    addUnnamedAndSort(cityNode);
  }
  for (const regionNode of regionMap.values()) {
    addUnnamedAndSort(regionNode);
  }
  for (const countryNode of countryMap.values()) {
    addUnnamedAndSort(countryNode);
  }

  // Build final result array (strip directCount from output)
  const result: LocationTreeNode[] = Array.from(countryMap.values()).map(
    ({ directCount, ...rest }) => rest
  );
  result.sort((a, b) => b.entryCount - a.entryCount);

  // Add "No Location" node if there are entries without location data
  if (noLocationCount > 0) {
    result.push({
      type: 'no_location',
      value: null,
      displayName: 'No Location',
      entryCount: noLocationCount,
      children: [],
    });
  }

  return result;
}

/**
 * Flatten location tree to get total entry count
 * Useful for verifying tree building correctness
 */
export function getLocationTreeTotalCount(nodes: LocationTreeNode[]): number {
  let total = 0;
  for (const node of nodes) {
    if (node.children.length === 0) {
      // Leaf node - count its entries
      total += node.entryCount;
    } else {
      // Branch node - recurse into children
      total += getLocationTreeTotalCount(node.children);
    }
  }
  return total;
}
