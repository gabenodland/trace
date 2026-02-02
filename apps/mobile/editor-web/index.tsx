/**
 * Custom Editor - Simple title-first TipTap editor
 *
 * Minimal setup: Title + body with only the bridges we need.
 * Build: npm run editor:build
 *
 * BUNDLE SIZE OPTIMIZATION:
 * 1. Using Preact instead of React (~100KB smaller)
 * 2. Using minimal bridge kit instead of TenTapStartKit (only toolbar features)
 * Final bundle: ~530KB (down from ~700KB with full React + all bridges)
 */

import { render } from 'preact/compat';
import { EditorContent } from '@tiptap/react';
import {
  useTenTap,
  // Minimal bridges - only what we need for toolbar
  CoreBridge,
  BoldBridge,
  ItalicBridge,
  HeadingBridge,
  BulletListBridge,
  OrderedListBridge,
  ListItemBridge,
  TaskListBridge,
  HistoryBridge,
  HardBreakBridge,
  LinkBridge,
} from '@10play/tentap-editor/web';
import Placeholder from '@tiptap/extension-placeholder';

// Local extensions for title-first schema
import { Title } from './extensions/Title';
import { TitleDocument } from './extensions/TitleDocument';

declare global {
  interface Window {
    initialContent: string;
    dynamicHeight?: boolean;
  }
}

// Minimal bridge kit - only what toolbar actually uses
// Reduces bundle size by removing unused: Code, Blockquote, Color, Highlight, Image, Strikethrough, Underline
const MinimalBridgeKit = [
  CoreBridge,      // Essential - editor state
  HistoryBridge,   // Undo/redo
  BoldBridge,      // Bold text
  ItalicBridge,    // Italic text
  HeadingBridge,   // H1, H2
  BulletListBridge, // Bullet lists
  OrderedListBridge, // Numbered lists
  ListItemBridge,  // List item handling (indent/outdent)
  TaskListBridge,  // Checkbox lists
  HardBreakBridge, // Line breaks
  LinkBridge,      // Links (for pasted content)
];

function TiptapEditor() {
  const editor = useTenTap({
    bridges: MinimalBridgeKit,
    tiptapOptions: {
      extensions: [
        // Title-first document schema (overrides default Document)
        TitleDocument,
        Title,
        // Our own Placeholder - no bridge conflicts
        Placeholder.configure({
          showOnlyCurrent: false,
          includeChildren: true,
          placeholder: ({ node }) => {
            if (node.type.name === 'title') {
              return 'Title';
            }
            return 'Start writing...';
          },
        }),
      ],
    },
  });

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
  render(<TiptapEditor />, container);
}
