/**
 * TitleDocument Extension - Enforces title-first document structure
 *
 * Schema: content: 'title block+'
 * - First node MUST be 'title' type
 * - Followed by one or more 'block' type nodes
 *
 * This makes the title structurally required - ProseMirror will refuse
 * to create a document without a title node as the first child.
 *
 * Use with Title extension.
 */

import { Node } from '@tiptap/core';

export const TitleDocument = Node.create({
  name: 'doc',

  // Schema: exactly one title, then one or more blocks
  content: 'title block+',

  topNode: true,
});
