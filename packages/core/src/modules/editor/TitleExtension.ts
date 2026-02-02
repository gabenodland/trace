/**
 * Title Extension - Custom Tiptap extension for entry titles
 *
 * Features:
 * - Separate node type from 'heading' (prevents schema ambiguity)
 * - Backspace at start is BLOCKED (can't delete the title node)
 * - Enter key moves cursor to body (doesn't create new title)
 * - Delete at end is blocked (prevents merging with body)
 * - No marks allowed (bold/italic disabled in title)
 * - Renders as h1 with special class for styling
 *
 * Use with TitleDocument extension to enforce title-first schema.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface TitleOptions {
  HTMLAttributes: Record<string, any>;
  placeholder: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    title: {
      setTitle: () => ReturnType;
    };
  }
}

export const Title = Node.create<TitleOptions>({
  name: 'title',

  // Own group, not 'block' - prevents being treated like heading
  group: 'title',

  // Text only - no inline nodes like hardBreak (<br>)
  content: 'text*',

  // No marks allowed in title (no bold/italic)
  marks: '',

  // Can't be selected as a whole (prevents deletion via selection)
  selectable: false,

  addOptions() {
    return {
      HTMLAttributes: {},
      placeholder: 'Title',
    };
  },

  parseHTML() {
    return [
      {
        tag: 'h1.entry-title',
        priority: 100,
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
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: 'entry-title' }),
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

        if ($from.parent.type.name !== 'title') {
          return false;
        }

        // Block backspace at position 0 (would delete the node)
        if ($from.parentOffset === 0 && empty) {
          return true;
        }

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

        if (state.doc.childCount > 1) {
          editor.commands.setTextSelection(afterTitle + 1);
        } else {
          editor
            .chain()
            .insertContentAt(afterTitle, { type: 'paragraph' })
            .setTextSelection(afterTitle + 1)
            .run();
        }

        return true;
      },

      // SHIFT+ENTER: Block in title (no line breaks allowed)
      'Shift-Enter': ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;

        if ($from.parent.type.name !== 'title') {
          return false;
        }

        // Block shift+enter in title - no <br> allowed
        return true;
      },

      // Arrow Up at start: Stay in title
      ArrowUp: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from, empty } = selection;

        if ($from.parent.type.name !== 'title' || !empty) {
          return false;
        }

        if ($from.parentOffset === 0) {
          return true;
        }

        return false;
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
    const placeholder = this.options.placeholder;

    return [
      new Plugin({
        key: new PluginKey('titlePlaceholder'),
        props: {
          decorations: (state) => {
            const { doc } = state;
            const decorations: Decoration[] = [];

            const firstChild = doc.firstChild;
            if (firstChild && firstChild.type.name === 'title') {
              const isEmpty = firstChild.content.size === 0;

              if (isEmpty) {
                decorations.push(
                  Decoration.node(0, firstChild.nodeSize, {
                    class: 'is-empty',
                    'data-placeholder': placeholder,
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
