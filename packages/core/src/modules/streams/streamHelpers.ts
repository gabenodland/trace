// Pure helper functions for stream operations

import { Stream } from "./StreamTypes";
import type { RatingType } from "../entries/ratingHelpers";

/**
 * Normalize stream name to lowercase, trim whitespace
 */
export function normalizeStreamName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " "); // Replace multiple spaces with single
}

/**
 * Capitalize stream name for display
 * "my stream" → "My Stream"
 */
export function displayStreamName(name: string): string {
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Filter streams by search query (case-insensitive)
 */
export function filterStreamsByQuery(
  streams: Stream[],
  query: string
): Stream[] {
  if (!query.trim()) return streams;

  const lowerQuery = query.toLowerCase();

  return streams.filter((stream) =>
    stream.name.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Sort streams alphabetically by name
 */
export function sortStreamsByName(streams: Stream[]): Stream[] {
  return [...streams].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Sort streams by entry count (descending)
 */
export function sortStreamsByCount(streams: Stream[]): Stream[] {
  return [...streams].sort((a, b) => b.entry_count - a.entry_count);
}

/**
 * Get total entry count across all streams
 */
export function getTotalEntryCount(streams: Stream[]): number {
  return streams.reduce((total, stream) => total + stream.entry_count, 0);
}

/**
 * Attribute visibility settings for a stream
 */
export interface StreamAttributeVisibility {
  showStatus: boolean;
  showType: boolean;
  showDueDate: boolean;
  showRating: boolean;
  showPriority: boolean;
  showLocation: boolean;
  showPhotos: boolean;
  availableTypes: string[];
  ratingType: RatingType;
}

/**
 * Get attribute visibility settings for a stream
 * If no stream provided, all attributes are visible (default behavior)
 *
 * @param stream - The stream to check, or null/undefined for no stream
 * @returns Object with visibility flags for each attribute
 */
export function getStreamAttributeVisibility(stream: Stream | null | undefined): StreamAttributeVisibility {
  // If no stream, show all attributes (default)
  if (!stream) {
    return {
      showStatus: true,
      showType: false, // Types require stream configuration
      showDueDate: true,
      showRating: true,
      showPriority: true,
      showLocation: true,
      showPhotos: true,
      availableTypes: [],
      ratingType: 'stars',
    };
  }

  return {
    showStatus: stream.entry_use_status !== false,
    showType: stream.entry_use_type === true && Array.isArray(stream.entry_types) && stream.entry_types.length > 0,
    showDueDate: stream.entry_use_duedates === true,
    showRating: stream.entry_use_rating === true,
    showPriority: stream.entry_use_priority === true,
    showLocation: stream.entry_use_location !== false,
    showPhotos: stream.entry_use_photos !== false,
    availableTypes: stream.entry_types ?? [],
    ratingType: stream.entry_rating_type ?? 'stars',
  };
}
