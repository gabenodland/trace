/**
 * EntryWithRelations - Entry with embedded Stream and Attachment data
 *
 * This is the unified interface used by EntryScreen for rendering and data management.
 * It includes all entry fields plus nested Stream and Attachment objects.
 *
 * Extends BaseEntry (not Entry) so that `attachments` can be `Attachment[]`
 * instead of `Json`. Both Entry and EntryWithRelations share BaseEntry,
 * which is the generic constraint used by sort/group helpers.
 */

import type { BaseEntry, Stream, Attachment } from '@trace/core';

export interface EntryWithRelations extends BaseEntry {
  /** Embedded stream object (readonly, from stream_id) */
  stream?: Stream;

  /** Array of attachment/photo objects (typed, unlike Entry.attachments: Json) */
  attachments: Attachment[];
}
