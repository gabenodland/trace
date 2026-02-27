/**
 * LAYER 1: Web Editor Bundle
 * @see docs/EDITOR_ARCHITECTURE.md for full documentation
 *
 * PURPOSE: TipTap editor running inside WebView with title-first schema.
 *
 * BUILD: npm run editor:build (from apps/mobile)
 * OUTPUT: editor-web/build/editorHtml.js
 *
 * KEY CONCEPTS:
 * - Uses Preact (NOT React) for smaller bundle (~530KB)
 * - Uses MinimalBridgeKit (NOT TenTapStartKit) to reduce size
 * - Title-first schema: document = title node + body blocks
 * - Custom BodyPlaceholder extension for first paragraph placeholder
 *
 * AI INSTRUCTIONS:
 * - DO NOT add React imports (use Preact)
 * - DO NOT import TenTapStartKit here (that's L2's job)
 * - MUST rebuild after changes: npm run editor:build
 * - Test with: Settings > Editor Test (L1)
 * - Log prefix: [WebEditor]
 */

import { render } from 'preact/compat';
import { useEffect } from 'preact/hooks';
import { EditorContent } from '@tiptap/react';
import {
  useTenTap,
  // Minimal bridges - only what we need for toolbar
  CoreBridge,
  BoldBridge,
  ItalicBridge,
  UnderlineBridge,
  HeadingBridge,
  BulletListBridge,
  OrderedListBridge,
  TaskListBridge,
  HistoryBridge,
  HardBreakBridge,
  LinkBridge,
} from '@10play/tentap-editor/web';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Extension, Editor } from '@tiptap/core';
import { Plugin, PluginKey, EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { DOMParser } from '@tiptap/pm/model';

// Local extensions for title-first schema
import { Title } from './extensions/Title';
import { TitleDocument } from './extensions/TitleDocument';

/**
 * BodyPlaceholder - Adds placeholder to the first empty paragraph after title
 *
 * TipTap's Placeholder extension doesn't work well with our custom TitleDocument schema,
 * so we handle body placeholder ourselves, similar to how Title.ts handles title placeholder.
 */
const BodyPlaceholder = Extension.create({
  name: 'bodyPlaceholder',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('bodyPlaceholder'),
        props: {
          decorations: (state) => {
            const { doc } = state;
            const decorations: Decoration[] = [];

            // Find the first paragraph after the title
            if (doc.childCount > 1) {
              const secondChild = doc.child(1);
              // Check if it's an empty paragraph
              if (secondChild.type.name === 'paragraph' && secondChild.content.size === 0) {
                // Get the position after the title node
                const titleNode = doc.firstChild;
                const pos = titleNode ? titleNode.nodeSize : 0;

                decorations.push(
                  Decoration.node(pos, pos + secondChild.nodeSize, {
                    class: 'is-empty',
                    'data-placeholder': 'Start writing...',
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

/**
 * TrailingParagraph - Ensures there's always a paragraph after the last table
 *
 * Without this, when a table is the last node in the document, users can't
 * place their cursor below it on mobile (no physical arrow keys / gap cursor).
 * This plugin watches every transaction and appends an empty paragraph
 * if the document ends with a table.
 */
const TrailingParagraph = Extension.create({
  name: 'trailingParagraph',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('trailingParagraph'),
        appendTransaction: (_transactions, _oldState, newState) => {
          const { doc } = newState;
          const lastChild = doc.child(doc.childCount - 1);

          if (lastChild.type.name === 'table') {
            const paragraph = newState.schema.nodes.paragraph.create();
            return newState.tr.insert(doc.content.size, paragraph);
          }

          return null;
        },
      }),
    ];
  },
});

declare global {
  interface Window {
    initialContent: string;
    dynamicHeight?: boolean;
    editorCommand: (command: string, payload?: any) => void;
    __editorInstance: Editor | null;
  }
}

// Global editor reference for commands injected from React Native
window.__editorInstance = null;

// Track previous cursor context to only post on changes
let _prevIsInTableCell = false;

/**
 * Table scroll lock — prevents browser's native caret-following from
 * scrolling the body when the cursor is inside a table cell.
 *
 * Root cause: table has display:block + overflow-x:auto, which CSS spec
 * coerces to a scroll container. The browser's native scroll-to-caret
 * miscalculates through this nested scroll context and jumps body.scrollTop
 * to the wrong position. This is NOT ProseMirror's scrollIntoView — it's
 * the browser's input handling, below JavaScript.
 *
 * Fix: on beforeinput, check if cursor is visible. If yes, save scrollTop
 * and restore on the next scroll event (block the bad scroll). If cursor
 * is off-screen, don't lock — let the browser scroll to bring it into view.
 */
let _tableScrollLock: number | null = null;

// Save scroll position before browser processes input in table cells —
// but ONLY if the cursor is already visible on screen. If the cursor is
// off-screen, don't lock — let the browser scroll to bring it into view.
// NOTE: getBoundingClientRect forces a synchronous layout, but this is
// necessary — the check must happen BEFORE the browser scrolls, not after.
document.addEventListener('beforeinput', () => {
  if (!_prevIsInTableCell) return;

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const rect = sel.getRangeAt(0).getBoundingClientRect();
  if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
    _tableScrollLock = document.body.scrollTop;
  }
}, true);

// Restore scroll position after browser's native scroll-to-caret fires.
document.addEventListener('scroll', (e) => {
  if (_tableScrollLock !== null) {
    const target = e.target as HTMLElement;
    if (target === document.body || target === document.documentElement) {
      document.body.scrollTop = _tableScrollLock;
      document.documentElement.scrollTop = _tableScrollLock;
      _tableScrollLock = null;
    }
  }
}, true);

/**
 * Command handler for React Native to call via injectJavaScript
 *
 * Commands:
 * - clearHistory: Clears undo/redo history while keeping current content
 * - setContentAndClearHistory: Sets new content with fresh history (for loading entries)
 */
window.editorCommand = (command: string, payload?: any) => {
  const editor = window.__editorInstance;
  if (!editor) {
    console.error('[WebEditor] editorCommand: No editor instance');
    return;
  }

  try {
    switch (command) {
      case 'clearHistory': {
        const { state, view } = editor;
        const { doc, schema, plugins } = state;

        const newState = EditorState.create({ doc, schema, plugins });
        view.updateState(newState);

        if (window.ReactNativeWebView?.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'historyCleared',
            canUndo: editor.can().undo(),
            canRedo: editor.can().redo(),
          }));
        }
        break;
      }

      case 'setContentAndClearHistory': {
        // Reset scroll lock state for new content
        _prevIsInTableCell = false;
        _tableScrollLock = null;

        const html = payload?.html || '';
        const { view, schema } = editor;

        // Parse HTML into ProseMirror document
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const doc = DOMParser.fromSchema(schema).parse(tempDiv);

        // Create fresh state with new doc and no history
        const newState = EditorState.create({
          doc,
          schema,
          plugins: editor.state.plugins,
        });
        view.updateState(newState);

        if (window.ReactNativeWebView?.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'contentSetWithClearedHistory',
            canUndo: editor.can().undo(),
            canRedo: editor.can().redo(),
            docLength: doc.content.size,
          }));
        }
        break;
      }

      // Indent/outdent — try listItem first, then taskItem
      case 'indent': {
        if (!editor.commands.sinkListItem('listItem')) {
          editor.commands.sinkListItem('taskItem');
        }
        break;
      }
      case 'outdent': {
        if (!editor.commands.liftListItem('listItem')) {
          editor.commands.liftListItem('taskItem');
        }
        break;
      }

      // Table commands
      case 'insertTable': {
        // Don't allow nested tables
        const { $from } = editor.state.selection;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === 'table') return;
        }

        const rows = payload?.rows || 3;
        const cols = payload?.cols || 3;
        // TrailingParagraph plugin handles adding paragraph after table automatically
        editor.chain().focus()
          .insertTable({ rows, cols, withHeaderRow: true })
          .run();
        break;
      }
      case 'addColumnAfter': {
        editor.chain().focus().addColumnAfter().run();
        break;
      }
      case 'addRowAfter': {
        editor.chain().focus().addRowAfter().run();
        break;
      }
      case 'deleteColumn': {
        editor.chain().focus().deleteColumn().run();
        break;
      }
      case 'deleteRow': {
        editor.chain().focus().deleteRow().run();
        break;
      }
      case 'deleteTable': {
        editor.chain().focus().deleteTable().run();
        break;
      }
      case 'toggleHeaderRow': {
        editor.chain().focus().toggleHeaderRow().run();
        break;
      }
      case 'goToNextCell': {
        // If in the last cell, add a new row then move into it
        // Must be separate commands (not chained) so state updates between them
        const moved = editor.commands.goToNextCell();
        if (!moved) {
          editor.commands.addRowAfter();
          editor.commands.goToNextCell();
        }
        break;
      }
      case 'goToPreviousCell': {
        editor.commands.goToPreviousCell();
        break;
      }
      case 'toggleHeaderColumn': {
        editor.commands.toggleHeaderColumn();
        break;
      }

      default:
        console.warn('[WebEditor] Unknown command:', command);
    }
  } catch (err: any) {
    console.error('[WebEditor] editorCommand error:', command, err?.message || String(err));
  }
};

// Watch for ProseMirror to appear in DOM, then signal bridge ready to React Native
const watchForReady = () => {
  const observer = new MutationObserver(() => {
    if (document.querySelector('.ProseMirror')) {
      observer.disconnect();
      // Delay slightly to ensure TenTap bridge is connected
      setTimeout(() => {
        if (window.ReactNativeWebView?.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'bridgeReady' }));
        }
      }, 50);
    }
  });

  const root = document.getElementById('root');
  if (root) {
    observer.observe(root, { childList: true, subtree: true });
  }
};

watchForReady();

// Minimal bridge kit - only what toolbar actually uses
// Reduces bundle size by removing unused: Code, Blockquote, Color, Highlight, Image, Strikethrough
// NOTE: ListItemBridge omitted — indent/outdent uses custom editorCommand handler instead.
// Bridges provide core schema (doc, paragraph, text, listItem, taskItem) — don't re-add in extensions.
const MinimalBridgeKit = [
  CoreBridge,        // Essential - editor state (provides Document, Paragraph, Text)
  HistoryBridge,     // Undo/redo
  BoldBridge,        // Bold text
  ItalicBridge,      // Italic text
  UnderlineBridge,   // Underline text
  HeadingBridge,     // H1, H2
  BulletListBridge,  // Bullet lists (provides ListItem as dep)
  OrderedListBridge, // Numbered lists (provides ListItem as dep)
  TaskListBridge,    // Checkbox lists (provides TaskItem with nested:true as dep)
  HardBreakBridge,   // Line breaks
  LinkBridge,        // Links (for pasted content)
];

function TiptapEditor() {
  const editor = useTenTap({
    bridges: MinimalBridgeKit,
    tiptapOptions: {
      editorProps: {
        // Override ProseMirror's default scroll-to-selection behavior.
        // ProseMirror's scrollRectIntoView walks up every scrollable ancestor,
        // including tables with display:block + overflow-x:auto. CSS coerces
        // overflow-y to auto, making tables vertical scroll containers.
        // ProseMirror then sets table.scrollTop, corrupting the scroll chain
        // and jumping to top. Once corrupted, coords for ALL cells are wrong,
        // causing a cascade where every subsequent selection also jumps.
        // Fix: suppress ProseMirror's scroll only when cursor is in a table.
        // For non-table content, let ProseMirror scroll normally.
        handleScrollToSelection(view) {
          // Check table state directly from selection (not _prevIsInTableCell)
          // because ProseMirror calls this BEFORE onSelectionUpdate fires,
          // so the flag would be stale on the transition frame.
          const { $from } = view.state.selection;
          let inTable = false;
          for (let d = $from.depth; d > 0; d--) {
            const name = $from.node(d).type.name;
            if (name === 'tableCell' || name === 'tableHeader') {
              inTable = true;
              break;
            }
          }
          // Outside tables — let ProseMirror handle scroll normally
          if (!inTable) {
            return false;
          }
          // Inside table — check if cursor is visible
          const { head } = view.state.selection;
          try {
            const coords = view.coordsAtPos(head);
            // Cursor is on-screen: suppress ProseMirror's scroll to prevent
            // it corrupting the table's scrollTop via nested overflow contexts
            if (coords.top >= 0 && coords.bottom <= window.innerHeight) {
              return true;
            }
          } catch {
            // coordsAtPos can throw — fall through to default
          }
          // Cursor is off-screen in a table: let ProseMirror scroll to it.
          // Not ideal (may still corrupt table scroll in some cases) but
          // better than leaving cursor invisible.
          return false;
        },
      },
      onSelectionUpdate: ({ editor: e }) => {
        const { $from } = e.state.selection;
        let isInTableCell = false;
        for (let d = $from.depth; d > 0; d--) {
          const name = $from.node(d).type.name;
          if (name === 'tableCell' || name === 'tableHeader') {
            isInTableCell = true;
            break;
          }
        }
        if (isInTableCell !== _prevIsInTableCell) {
          _prevIsInTableCell = isInTableCell;
          window.ReactNativeWebView?.postMessage?.(JSON.stringify({
            type: 'cursorContext',
            isInTableCell,
          }));
        }
      },
      extensions: [
        // Title-first document schema (overrides CoreBridge's default Document)
        TitleDocument,
        Title,
        // Custom placeholder handling - TipTap's Placeholder doesn't work with our custom schema
        // Title.ts handles title placeholder, BodyPlaceholder handles first paragraph
        BodyPlaceholder,
        // Table editing - no TenTap bridge exists, so we add these directly
        Table.configure({
          resizable: false, // Disable column resizing on mobile for now
          HTMLAttributes: { class: 'trace-table' },
        }),
        TableRow,
        TableCell,
        TableHeader,
        // Ensures users can always type below a table
        TrailingParagraph,
      ],
    },
  });

  // Store editor reference globally for commands from React Native
  useEffect(() => {
    if (editor) {
      window.__editorInstance = editor;

      if (window.ReactNativeWebView?.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'editorCommandsReady',
        }));
      }
    }

    return () => {
      window.__editorInstance = null;
    };
  }, [editor]);

  if (!editor) return null;
  return (
    <EditorContent
      editor={editor}
      className={window.dynamicHeight ? 'dynamic-height' : undefined}
    />
  );
}

// Render immediately using Preact
const container = document.getElementById('root');
if (container) {
  try {
    render(<TiptapEditor />, container);
  } catch (e: any) {
    console.error('[WebEditor] Mount failed:', e?.message || String(e));
  }
}
