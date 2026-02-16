/**
 * Title Extension - Custom TipTap extension for entry titles
 *
 * Key features:
 * - Separate node type from 'heading' (prevents schema ambiguity)
 * - Backspace at start is BLOCKED (can't delete the title node)
 * - Enter key moves cursor to body (doesn't create new title)
 * - Renders as h1 with special class for styling
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface TitleOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    title: {
      /**
       * Set a title node
       */
      setTitle: () => ReturnType;
    };
  }
}

export const Title = Node.create<TitleOptions>({
  name: 'title',

  // Critical: own group, not 'block' - this prevents it being treated like heading
  group: 'title',

  // Inline content only (text, marks) - no nested blocks
  content: 'inline*',

  // DESIGN DECISION: No marks (bold, italic, etc.) allowed in title
  //
  // Rationale:
  // 1. Titles should be plain text for consistent styling across the app
  // 2. The title is stored separately in the database as plain text (entry.title)
  // 3. Allowing marks would require stripping them during save (complexity)
  // 4. Keeps the UI clean - title formatting comes from CSS, not inline marks
  //
  // To enable marks in title, change to: marks: '_' (allows all marks)
  // Then update splitTitleAndBody() to handle marked content in title extraction
  marks: '',

  // Can't be selected as a whole (prevents deletion via selection)
  selectable: false,

  // Parse first-child h1 as title
  parseHTML() {
    return [
      {
        tag: 'h1.entry-title',
        priority: 100, // Higher priority than regular heading
      },
      {
        tag: 'h1:first-child',
        priority: 50,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'h1',
      mergeAttributes(HTMLAttributes, { class: 'entry-title' }),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      // BACKSPACE: Block at start of title to prevent node deletion
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from, empty } = selection;

        // Only act if cursor is in title node
        if ($from.parent.type.name !== 'title') {
          return false;
        }

        // Block backspace at position 0 (would delete the node)
        if ($from.parentOffset === 0 && empty) {
          return true; // Handled - do nothing
        }

        // Allow normal backspace (deleting characters)
        return false;
      },

      // DELETE: Block at end of title to prevent merging with next node
      Delete: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from, empty } = selection;

        if ($from.parent.type.name !== 'title') {
          return false;
        }

        // Block delete at end of title
        const atEnd = $from.parentOffset === $from.parent.content.size;
        if (atEnd && empty) {
          return true;
        }

        return false;
      },

      // ENTER: Move to body, don't create new title
      Enter: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from } = selection;

        if ($from.parent.type.name !== 'title') {
          return false;
        }

        const titleNode = state.doc.firstChild;
        if (!titleNode) return true;

        const afterTitle = titleNode.nodeSize;

        // If there's content after title, move to it
        if (state.doc.childCount > 1) {
          editor.commands.setTextSelection(afterTitle + 1);
        } else {
          // Insert a paragraph and move to it
          editor
            .chain()
            .insertContentAt(afterTitle, { type: 'paragraph' })
            .setTextSelection(afterTitle + 1)
            .run();
        }

        return true;
      },

      // Arrow Up at start: Stay in title (no previous node)
      ArrowUp: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from, empty } = selection;

        if ($from.parent.type.name !== 'title' || !empty) {
          return false;
        }

        // At very start of title, block ArrowUp
        if ($from.parentOffset === 0) {
          return true;
        }

        return false;
      },
    };
  },

  // Markdown serialization for tiptap-markdown
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write('# ');
          state.renderInline(node);
          state.closeBlock(node);
        },
        parse: {
          // handled by markdown-it
        },
      },
    };
  },

  addCommands() {
    return {
      setTitle:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name);
        },
    };
  },

  // Add is-empty class for placeholder styling
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('titlePlaceholder'),
        props: {
          decorations: (state) => {
            const { doc } = state;
            const decorations: Decoration[] = [];

            // Check if first child is a title and is empty
            const firstChild = doc.firstChild;
            if (firstChild && firstChild.type.name === 'title') {
              const isEmpty = firstChild.content.size === 0;

              if (isEmpty) {
                // Add is-empty class AND data-placeholder to the title node
                // We add data-placeholder here because TipTap's Placeholder extension
                // might not recognize our custom 'title' node type (it's in group 'title', not 'block')
                decorations.push(
                  Decoration.node(0, firstChild.nodeSize, {
                    class: 'is-empty',
                    'data-placeholder': 'Title',
                  })
                );
              }
            }

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});
