// Pure helper functions for stream operations

import { Stream } from "./StreamTypes";

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
