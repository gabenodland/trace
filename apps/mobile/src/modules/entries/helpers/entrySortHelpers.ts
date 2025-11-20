/**
 * Sorting helpers for entry lists
 */
import type { Entry } from '@trace/core';
import type { EntrySortMode } from '../types/EntrySortMode';
import type { EntrySortOrder } from '../types/EntrySortOrder';

/**
 * Sort entries based on sort mode and order
 */
export function sortEntries(
  entries: Entry[],
  sortMode: EntrySortMode,
  categoryMap?: Record<string, string>,
  order: EntrySortOrder = 'desc'
): Entry[] {
  const sorted = [...entries];
  const multiplier = order === 'asc' ? -1 : 1;

  switch (sortMode) {
    case 'title':
      return sorted.sort((a, b) => {
        const titleA = a.title || a.content || '';
        const titleB = b.title || b.content || '';
        return titleA.localeCompare(titleB) * (order === 'asc' ? 1 : -1);
      });

    case 'category':
      return sorted.sort((a, b) => {
        const catA = a.category_id && categoryMap ? categoryMap[a.category_id] || '' : '';
        const catB = b.category_id && categoryMap ? categoryMap[b.category_id] || '' : '';
        // Sort by category, then by entry_date within category
        if (catA === catB) {
          return (new Date(b.entry_date || b.created_at).getTime() - new Date(a.entry_date || a.created_at).getTime()) * multiplier;
        }
        return catA.localeCompare(catB) * (order === 'asc' ? 1 : -1);
      });

    case 'entry_date':
      return sorted.sort((a, b) => {
        const dateA = new Date(a.entry_date || a.created_at).getTime();
        const dateB = new Date(b.entry_date || b.created_at).getTime();
        return (dateB - dateA) * multiplier;
      });

    case 'created_date':
      return sorted.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return (dateB - dateA) * multiplier;
      });

    case 'updated_date':
      return sorted.sort((a, b) => {
        const dateA = new Date(a.updated_at).getTime();
        const dateB = new Date(b.updated_at).getTime();
        return (dateB - dateA) * multiplier;
      });

    case 'due_date':
      return sorted.sort((a, b) => {
        // Entries with due dates come first, sorted by due date
        // Entries without due dates come last
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;

        const dateA = new Date(a.due_date).getTime();
        const dateB = new Date(b.due_date).getTime();
        return (dateA - dateB) * multiplier;
      });

    default:
      return sorted;
  }
}
