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
import Text from '@tiptap/extension-text';
import Paragraph from '@tiptap/extension-paragraph';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

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

declare global {
  interface Window {
    initialContent: string;
    dynamicHeight?: boolean;
  }
}

// Web-side debug logging - shows in Metro console
console.log('[WebEditor] Bundle loaded');
console.log('[WebEditor] DOM state:', document.readyState);

// Check DOM state
const checkDOM = () => {
  const root = document.getElementById('root');
  const proseMirror = document.querySelector('.ProseMirror');
  const tiptap = document.querySelector('.tiptap');

  console.log('[WebEditor] DOM check:', {
    hasRoot: !!root,
    rootChildren: root?.children?.length || 0,
    hasProseMirror: !!proseMirror,
    hasTiptap: !!tiptap,
  });

  return { root, proseMirror, tiptap };
};

// Watch for DOM changes and signal when ready
const watchDOM = () => {
  const observer = new MutationObserver((mutations) => {
    const { proseMirror } = checkDOM();
    if (proseMirror) {
      console.log('[WebEditor] ProseMirror appeared in DOM!');
      observer.disconnect();

      // Signal to RN that the bridge is ready - delay slightly to ensure bridge is connected
      setTimeout(() => {
        try {
          console.log('[WebEditor] setTimeout fired, checking ReactNativeWebView...');
          console.log('[WebEditor] window.ReactNativeWebView:', typeof window.ReactNativeWebView);

          if (window.ReactNativeWebView?.postMessage) {
            console.log('[WebEditor] postMessage exists, sending bridgeReady...');
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'bridgeReady' }));
            console.log('[WebEditor] Sent bridgeReady signal');
          } else {
            console.warn('[WebEditor] ReactNativeWebView not available:', {
              hasWindow: typeof window !== 'undefined',
              hasRNWebView: !!window.ReactNativeWebView,
              postMessageType: window.ReactNativeWebView ? typeof window.ReactNativeWebView.postMessage : 'N/A',
            });
          }
        } catch (err: any) {
          console.error('[WebEditor] Error in bridgeReady:', err?.message || String(err));
        }
      }, 50);
    }
  });

  const root = document.getElementById('root');
  if (root) {
    observer.observe(root, { childList: true, subtree: true });
    console.log('[WebEditor] Watching for ProseMirror...');
  }
};

// Initial check
checkDOM();
watchDOM();

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
  console.log('[WebEditor] TiptapEditor rendering...');

  const editor = useTenTap({
    bridges: MinimalBridgeKit,
    tiptapOptions: {
      extensions: [
        // Core schema types - must be explicitly included to prevent race condition
        Text,
        Paragraph,
        // Title-first document schema (overrides default Document)
        TitleDocument,
        Title,
        // Custom placeholder handling - TipTap's Placeholder doesn't work with our custom schema
        // Title.ts handles title placeholder, BodyPlaceholder handles first paragraph
        BodyPlaceholder,
      ],
    },
  });

  if (!editor) {
    console.log('[WebEditor] Editor not ready yet (null)');
    return null;
  }

  console.log('[WebEditor] Editor ready, rendering EditorContent');
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
  console.log('[WebEditor] Found root container, mounting...');
  try {
    render(<TiptapEditor />, container);
    console.log('[WebEditor] Mount complete');

    // Check DOM after mount
    checkDOM();

    // Check again after a moment to see if ProseMirror rendered
    requestAnimationFrame(() => {
      console.log('[WebEditor] After first frame:');
      checkDOM();
    });
  } catch (e: any) {
    console.error('[WebEditor] Mount failed:',
      e?.message || 'no message',
      e?.stack || 'no stack',
      'raw:', String(e),
      'keys:', Object.keys(e || {}).join(',')
    );
  }
} else {
  console.error('[WebEditor] No root container found!');
}
