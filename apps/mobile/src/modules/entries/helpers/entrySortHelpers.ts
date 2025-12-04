/**
 * Sorting helpers for entry lists
 */
import type { Entry } from '@trace/core';
import type { EntrySortMode } from '../types/EntrySortMode';
import type { EntrySortOrder } from '../types/EntrySortOrder';

/**
 * Sort entries based on sort mode and order
 * Pinned entries can optionally appear first, controlled by showPinnedFirst parameter
 */
export function sortEntries(
  entries: Entry[],
  sortMode: EntrySortMode,
  streamMap?: Record<string, string>,
  order: EntrySortOrder = 'desc',
  showPinnedFirst: boolean = false
): Entry[] {
  const sorted = [...entries];
  const multiplier = order === 'asc' ? -1 : 1;

  switch (sortMode) {
    case 'title':
      return sorted.sort((a, b) => {
        // Optionally, pinned entries come first
        if (showPinnedFirst) {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
        }

        const titleA = a.title || a.content || '';
        const titleB = b.title || b.content || '';
        return titleA.localeCompare(titleB) * (order === 'asc' ? 1 : -1);
      });

    case 'stream':
      return sorted.sort((a, b) => {
        // Optionally, pinned entries come first
        if (showPinnedFirst) {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
        }

        const streamA = a.stream_id && streamMap ? streamMap[a.stream_id] || '' : '';
        const streamB = b.stream_id && streamMap ? streamMap[b.stream_id] || '' : '';
        // Sort by stream, then by entry_date within stream
        if (streamA === streamB) {
          return (new Date(b.entry_date || b.created_at).getTime() - new Date(a.entry_date || a.created_at).getTime()) * multiplier;
        }
        return streamA.localeCompare(streamB) * (order === 'asc' ? 1 : -1);
      });

    case 'entry_date':
      return sorted.sort((a, b) => {
        // Optionally, pinned entries come first
        if (showPinnedFirst) {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
        }

        const dateA = new Date(a.entry_date || a.created_at).getTime();
        const dateB = new Date(b.entry_date || b.created_at).getTime();
        return (dateB - dateA) * multiplier;
      });

    case 'created_date':
      return sorted.sort((a, b) => {
        // Optionally, pinned entries come first
        if (showPinnedFirst) {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
        }

        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return (dateB - dateA) * multiplier;
      });

    case 'updated_date':
      return sorted.sort((a, b) => {
        // Optionally, pinned entries come first
        if (showPinnedFirst) {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
        }

        const dateA = new Date(a.updated_at).getTime();
        const dateB = new Date(b.updated_at).getTime();
        return (dateB - dateA) * multiplier;
      });

    case 'due_date':
      return sorted.sort((a, b) => {
        // Optionally, pinned entries come first
        if (showPinnedFirst) {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
        }

        // Entries with due dates come first, sorted by due date
        // Entries without due dates come last
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;

        const dateA = new Date(a.due_date).getTime();
        const dateB = new Date(b.due_date).getTime();
        return (dateA - dateB) * multiplier;
      });

    case 'priority':
      return sorted.sort((a, b) => {
        // Optionally, pinned entries come first
        if (showPinnedFirst) {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
        }

        const priorityA = a.priority || 0;
        const priorityB = b.priority || 0;
        return (priorityB - priorityA) * multiplier;
      });

    case 'rating':
      return sorted.sort((a, b) => {
        // Optionally, pinned entries come first
        if (showPinnedFirst) {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
        }

        const ratingA = a.rating || 0;
        const ratingB = b.rating || 0;
        return (ratingB - ratingA) * multiplier;
      });

    default:
      return sorted;
  }
}
