/**
 * TitleDocument Extension - Enforces title-first document structure
 *
 * This extends the default Document to require:
 * - First node MUST be 'title' type
 * - Followed by one or more 'block' type nodes
 *
 * Schema: content: 'title block+'
 *
 * This is THE critical piece - it makes the title structurally required,
 * not just a convention. ProseMirror will refuse to create a document
 * without a title node as the first child.
 */

import { Node } from '@tiptap/core';

export const TitleDocument = Node.create({
  name: 'doc',

  // CRITICAL: This schema enforces title must come first
  // 'title' = exactly one title node
  // 'block+' = one or more block nodes (paragraph, heading, etc.)
  content: 'title block+',

  // Top level - no parent
  topNode: true,
});
