/**
 * Version Helpers — pure functions for snapshot building and change summaries
 */

import type { BaseEntry } from '@trace/core';
import type { EntrySnapshot } from './VersionTypes';

/**
 * Parse an array field that may be a JSON string (from SQLite) or already an array.
 * Returns null for empty/falsy values.
 */
function parseArrayField(value: string[] | string | null | undefined): string[] | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }
  return value.length > 0 ? value : null;
}

/**
 * Extract snapshot fields from an entry object.
 * Accepts BaseEntry so it works with both Entry and EntryWithRelations.
 * The snapshot captures all substantive entry fields at a point in time.
 *
 * Note: is_archived is intentionally excluded — archiving is a list-management
 * action (like hiding), not a content change worth versioning.
 */
export function buildSnapshot(entry: BaseEntry): EntrySnapshot {
  return {
    title: entry.title,
    content: entry.content ?? null,
    status: entry.status ?? null,
    type: entry.type ?? null,
    priority: entry.priority ?? null,
    rating: entry.rating ?? null,
    tags: parseArrayField(entry.tags),
    mentions: parseArrayField(entry.mentions),
    stream_id: entry.stream_id ?? null,
    due_date: entry.due_date ?? null,
    completed_at: entry.completed_at ?? null,
    is_pinned: entry.is_pinned ?? false,
    entry_date: entry.entry_date ?? null,
    entry_latitude: entry.entry_latitude ?? null,
    entry_longitude: entry.entry_longitude ?? null,
    location_id: entry.location_id ?? null,
    geocode_status: entry.geocode_status ?? null,
    place_name: entry.place_name ?? null,
    address: entry.address ?? null,
    neighborhood: entry.neighborhood ?? null,
    postal_code: entry.postal_code ?? null,
    city: entry.city ?? null,
    subdivision: entry.subdivision ?? null,
    region: entry.region ?? null,
    country: entry.country ?? null,
  };
}

/**
 * Compare two snapshots and generate a human-readable change summary.
 *
 * - First version (previous is null): returns "initial version"
 * - Scalar changes: "rating 3→4", "status todo→done"
 * - Content changes: "content edited"
 * - Array changes: "tags updated", "mentions updated"
 * - Multiple changes comma-separated
 */
export function generateChangeSummary(
  current: EntrySnapshot,
  previous: EntrySnapshot | null,
  currentAttachmentIds?: string[] | null,
  previousAttachmentIds?: string[] | null,
): string | null {
  if (!previous) return 'initial version';

  const changes: string[] = [];

  // Content — just note it was edited, don't show diff
  if (current.content !== previous.content) {
    changes.push('content changed');
  }

  // Title
  if (current.title !== previous.title) {
    if (!previous.title && current.title) {
      changes.push('title added');
    } else if (previous.title && !current.title) {
      changes.push('title removed');
    } else {
      changes.push('title changed');
    }
  }

  // Scalar fields with value display
  const scalarFields: (keyof EntrySnapshot)[] = [
    'status', 'type', 'priority', 'rating', 'stream_id',
    'due_date', 'completed_at', 'entry_date',
    'location_id', 'place_name', 'city', 'region', 'country',
  ];

  for (const field of scalarFields) {
    const prev = previous[field];
    const curr = current[field];
    if (prev !== curr) {
      if (typeof curr === 'number' && typeof prev === 'number') {
        changes.push(`${field} ${prev}→${curr}`);
      } else if (prev && curr) {
        changes.push(`${field} changed`);
      } else if (!prev && curr) {
        changes.push(`${field} set`);
      } else {
        changes.push(`${field} cleared`);
      }
    }
  }

  // Boolean fields
  if (current.is_pinned !== previous.is_pinned) {
    changes.push(current.is_pinned ? 'pinned' : 'unpinned');
  }
  // Array fields — tags and mentions
  if (!arraysEqual(current.tags, previous.tags)) {
    changes.push('tags updated');
  }
  if (!arraysEqual(current.mentions, previous.mentions)) {
    changes.push('mentions updated');
  }

  // Attachment changes
  if (currentAttachmentIds !== undefined && previousAttachmentIds !== undefined) {
    const currIds = currentAttachmentIds ?? [];
    const prevIds = previousAttachmentIds ?? [];
    const added = currIds.filter(id => !prevIds.includes(id)).length;
    const removed = prevIds.filter(id => !currIds.includes(id)).length;
    if (added > 0) changes.push(`added ${added} photo${added > 1 ? 's' : ''}`);
    if (removed > 0) changes.push(`removed ${removed} photo${removed > 1 ? 's' : ''}`);
  }

  return changes.length > 0 ? changes.join(', ') : null;
}

/** Compare two nullable string arrays for equality */
function arraysEqual(a: string[] | null, b: string[] | null): boolean {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, i) => val === sortedB[i]);
}
