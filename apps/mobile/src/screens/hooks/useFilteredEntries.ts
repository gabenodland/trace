/**
 * useFilteredEntries - Handles entry filtering and section computation
 * Extracts filtering logic from EntryListScreen
 */

import { useMemo } from 'react';
import type { Entry, EntrySection, EntrySortMode, EntrySortOrder, Stream } from '@trace/core';
import {
  sortEntries,
  groupEntriesByStatus,
  groupEntriesByType,
  groupEntriesByStream,
  groupEntriesByPriority,
  groupEntriesByRating,
  groupEntriesByDueDate,
} from '@trace/core';

interface StreamFilter {
  showArchived: boolean;
  statuses: string[];
}

interface UseFilteredEntriesOptions {
  entries: Entry[];
  streams: Stream[];
  sortMode: EntrySortMode;
  orderMode: EntrySortOrder;
  showPinnedFirst: boolean;
  streamFilter: StreamFilter;
  searchQuery: string;
}

export function useFilteredEntries({
  entries,
  streams,
  sortMode,
  orderMode,
  showPinnedFirst,
  streamFilter,
  searchQuery,
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

  // Filter entries by settings drawer filter + search query
  const filteredEntries = useMemo(() => {
    // First apply settings drawer filters
    let result = sortedEntries.filter(entry => {
      // Archive filter (default: hide archived)
      if (!streamFilter.showArchived && entry.is_archived) return false;

      // Status filter (empty = show all)
      if (streamFilter.statuses.length > 0 && !streamFilter.statuses.includes(entry.status)) return false;

      return true;
    });

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
  }, [sortedEntries, searchQuery, streamFilter]);

  // Filter sections by settings drawer filter + search query
  const filteredSections = useMemo((): EntrySection[] | undefined => {
    if (!entrySections) return undefined;

    // Filter function that applies both settings filter and search query
    const filterEntry = (entry: Entry) => {
      // Apply settings drawer filters
      if (!streamFilter.showArchived && entry.is_archived) return false;
      if (streamFilter.statuses.length > 0 && !streamFilter.statuses.includes(entry.status)) return false;

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
  }, [entrySections, searchQuery, streamFilter]);

  return {
    sortedEntries,
    filteredEntries,
    filteredSections,
    streamMap,
    streamById,
  };
}
