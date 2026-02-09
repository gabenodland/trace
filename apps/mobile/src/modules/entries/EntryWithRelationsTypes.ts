/**
 * EntryWithRelations - Entry with embedded Stream and Attachment data
 *
 * This is the unified interface used by EntryScreen for rendering and data management.
 * It includes all entry fields plus nested Stream and Attachment objects.
 */

import type { Entry, Stream } from '@trace/core';
import type { Attachment } from '@trace/core';

/**
 * Entry with all relations embedded
 * Used as the single source of truth for EntryScreen
 */
export interface EntryWithRelations extends Entry {
  /** Embedded stream object (readonly, from stream_id) */
  stream?: Stream;

  /** Array of attachment/photo objects */
  attachments?: Attachment[];
}
