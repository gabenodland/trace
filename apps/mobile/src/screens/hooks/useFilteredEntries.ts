/**
 * useFilteredEntries - Handles entry filtering and section computation
 * Extracts filtering logic from EntryListScreen
 */

import { useMemo } from 'react';
import type { Entry, EntrySection, EntrySortMode, EntrySortOrder, Stream, StreamViewFilter, DueDatePreset } from '@trace/core';
import {
  sortEntries,
  groupEntriesByStatus,
  groupEntriesByType,
  groupEntriesByStream,
  groupEntriesByPriority,
  groupEntriesByRating,
  groupEntriesByDueDate,
  extractAttachmentIds,
} from '@trace/core';

/**
 * Check if a date matches a due date preset
 */
function matchesDueDatePreset(dueDate: string | null, preset: DueDatePreset, customStart: string | null, customEnd: string | null): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (preset) {
    case 'all':
      return true;

    case 'overdue':
      if (!dueDate) return false;
      return new Date(dueDate) < today;

    case 'today': {
      if (!dueDate) return false;
      const due = new Date(dueDate);
      due.setHours(0, 0, 0, 0);
      return due.getTime() === today.getTime();
    }

    case 'this_week': {
      if (!dueDate) return false;
      const due = new Date(dueDate);
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return due >= weekStart && due <= weekEnd;
    }

    case 'next_week': {
      if (!dueDate) return false;
      const due = new Date(dueDate);
      const nextWeekStart = new Date(today);
      nextWeekStart.setDate(today.getDate() + (7 - today.getDay()));
      const nextWeekEnd = new Date(nextWeekStart);
      nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
      nextWeekEnd.setHours(23, 59, 59, 999);
      return due >= nextWeekStart && due <= nextWeekEnd;
    }

    case 'has_due_date':
      return dueDate !== null;

    case 'no_due_date':
      return dueDate === null;

    case 'custom': {
      if (!customStart && !customEnd) return true;
      if (!dueDate) return false;
      const due = new Date(dueDate);
      if (customStart && due < new Date(customStart)) return false;
      if (customEnd && due > new Date(customEnd)) return false;
      return true;
    }

    default:
      return true;
  }
}

/**
 * Check if entry date falls within range
 */
function matchesEntryDateRange(entryDate: string | null, startDate: string | null, endDate: string | null): boolean {
  if (!startDate && !endDate) return true;
  if (!entryDate) return !startDate && !endDate; // No entry date: only match if no filter

  const date = new Date(entryDate);

  if (startDate && date < new Date(startDate)) return false;
  if (endDate && date > new Date(endDate)) return false;

  return true;
}

/**
 * Check if entry has photos using pre-loaded attachment counts
 * Falls back to checking content for attachment references (legacy)
 */
function entryHasPhotos(entry: Entry, attachmentCounts: Record<string, number>): boolean {
  // First check the attachment counts map (preferred - accurate)
  const count = attachmentCounts[entry.entry_id];
  if (count !== undefined) {
    return count > 0;
  }
  // Fallback: check content for attachment references (legacy entries)
  const attachmentIds = extractAttachmentIds(entry.content);
  return attachmentIds.length > 0;
}

interface UseFilteredEntriesOptions {
  entries: Entry[];
  streams: Stream[];
  sortMode: EntrySortMode;
  orderMode: EntrySortOrder;
  showPinnedFirst: boolean;
  streamFilter: StreamViewFilter;
  searchQuery: string;
  attachmentCounts?: Record<string, number>;
}

export function useFilteredEntries({
  entries,
  streams,
  sortMode,
  orderMode,
  showPinnedFirst,
  streamFilter,
  searchQuery,
  attachmentCounts = {},
}: UseFilteredEntriesOptions) {
  // Create stream map for sorting
  const streamMap = useMemo(() => {
    return streams.reduce((map, s) => {
      map[s.stream_id] = s.name;
      return map;
    }, {} as Record<string, string>);
  }, [streams]);

  // Create stream by ID map for attribute visibility
  const streamById = useMemo(() => {
    return streams.reduce((map, stream) => {
      map[stream.stream_id] = stream;
      return map;
    }, {} as Record<string, Stream>);
  }, [streams]);

  // Sort entries
  const sortedEntries = useMemo(() => {
    return sortEntries(entries, sortMode, streamMap, orderMode, showPinnedFirst);
  }, [entries, sortMode, streamMap, orderMode, showPinnedFirst]);

  // Compute sections when sorting by status, type, stream, priority, rating, or due date
  const entrySections = useMemo((): EntrySection[] | undefined => {
    if (sortMode === 'status') {
      return groupEntriesByStatus(entries, orderMode, showPinnedFirst);
    }
    if (sortMode === 'type') {
      return groupEntriesByType(entries, orderMode, showPinnedFirst);
    }
    if (sortMode === 'stream') {
      return groupEntriesByStream(entries, streamMap, orderMode, showPinnedFirst);
    }
    if (sortMode === 'priority') {
      return groupEntriesByPriority(entries, orderMode, showPinnedFirst);
    }
    if (sortMode === 'rating') {
      return groupEntriesByRating(entries, orderMode, showPinnedFirst, streamById);
    }
    if (sortMode === 'due_date') {
      return groupEntriesByDueDate(entries, orderMode, showPinnedFirst);
    }
    return undefined;
  }, [entries, sortMode, streamMap, streamById, orderMode, showPinnedFirst]);

  // Filter function that applies all settings drawer filters
  const applyFilters = useMemo(() => {
    return (entry: Entry): boolean => {
      // Archive filter (default: hide archived)
      if (!streamFilter.showArchived && entry.is_archived) return false;

      // Status filter (empty = show all)
      if (streamFilter.statuses.length > 0 && !streamFilter.statuses.includes(entry.status)) return false;

      // Priority filter (empty = show all)
      if (streamFilter.priorities.length > 0) {
        // Check if entry's priority matches any selected priority
        // entry.priority is the numeric value (0-4)
        if (!streamFilter.priorities.includes(entry.priority as 0 | 1 | 2 | 3 | 4)) return false;
      }

      // Type filter (empty = show all)
      if (streamFilter.types.length > 0) {
        // entry.type is null or string
        if (entry.type === null || !streamFilter.types.includes(entry.type)) return false;
      }

      // Rating filter (null = no filter)
      // Rating is stored as 0-10 (normalized)
      if (streamFilter.ratingMin !== null) {
        // For rating 0, only exclude if min is set and rating is exactly 0 (unrated)
        if (entry.rating < streamFilter.ratingMin) return false;
      }
      if (streamFilter.ratingMax !== null) {
        if (entry.rating > streamFilter.ratingMax) return false;
      }

      // Photos filter (null = show all)
      if (streamFilter.hasPhotos !== null) {
        const hasPhotos = entryHasPhotos(entry, attachmentCounts);
        if (streamFilter.hasPhotos && !hasPhotos) return false;
        if (!streamFilter.hasPhotos && hasPhotos) return false;
      }

      // Due date filter
      if (!matchesDueDatePreset(entry.due_date, streamFilter.dueDatePreset, streamFilter.dueDateStart, streamFilter.dueDateEnd)) {
        return false;
      }

      // Entry date filter
      if (!matchesEntryDateRange(entry.entry_date, streamFilter.entryDateStart, streamFilter.entryDateEnd)) {
        return false;
      }

      return true;
    };
  }, [streamFilter, attachmentCounts]);

  // Filter entries by settings drawer filter + search query
  const filteredEntries = useMemo(() => {
    // First apply settings drawer filters
    let result = sortedEntries.filter(applyFilters);

    // Then apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(entry => {
        // Search in title
        if (entry.title?.toLowerCase().includes(query)) {
          return true;
        }
        // Search in content (strip HTML tags for plain text search)
        const plainContent = entry.content.replace(/<[^>]*>/g, '').toLowerCase();
        if (plainContent.includes(query)) {
          return true;
        }
        return false;
      });
    }

    return result;
  }, [sortedEntries, searchQuery, applyFilters]);

  // Filter sections by settings drawer filter + search query
  const filteredSections = useMemo((): EntrySection[] | undefined => {
    if (!entrySections) return undefined;

    // Filter function that applies both settings filter and search query
    const filterEntry = (entry: Entry) => {
      // Apply settings drawer filters
      if (!applyFilters(entry)) return false;

      // Apply search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        if (entry.title?.toLowerCase().includes(query)) return true;
        const plainContent = entry.content.replace(/<[^>]*>/g, '').toLowerCase();
        return plainContent.includes(query);
      }

      return true;
    };

    return entrySections
      .map(section => ({
        ...section,
        data: section.data.filter(filterEntry),
        count: 0, // Will be recalculated below
      }))
      .map(section => ({ ...section, count: section.data.length }))
      .filter(section => section.data.length > 0);
  }, [entrySections, searchQuery, applyFilters]);

  return {
    sortedEntries,
    filteredEntries,
    filteredSections,
    streamMap,
    streamById,
  };
}
