/**
 * AdvancedEditor - Web-side editor with Title-first document structure
 *
 * This runs inside the WebView and uses our custom TitleDocument schema
 * to enforce that the first node is always a Title.
 */

import React, { useCallback, useRef, useEffect } from 'react';
import { EditorContent } from '@tiptap/react';
import {
  useTenTap,
  CoreBridge,
  BoldBridge,
  ItalicBridge,
  UnderlineBridge,
  StrikeBridge,
  HeadingBridge,
  BulletListBridge,
  OrderedListBridge,
  TaskListBridge,
  BlockquoteBridge,
  CodeBridge,
  HighlightBridge,
  ColorBridge,
  LinkBridge,
  HistoryBridge,
  ListItemBridge,
  HardBreakBridge,
  ImageBridge,
} from '@10play/tentap-editor';

// Our custom extensions
import { Title } from './extensions/Title';
import { TitleDocument } from './extensions/TitleDocument';
import { ContentWatcher } from './extensions/ContentWatcher';
import { Focus } from './extensions/Focus';

// Custom bridges - bridge state to RN side
// NOTE: TitleBridge removed - it caused duplicate title notifications
// Title is now extracted from ContentUpdate HTML via splitTitleAndBody() on RN side
import { FocusBridge } from './bridges/FocusBridge';

// Replicate TenTapStartKit but WITHOUT Document (we use TitleDocument)
// Note: Some bridges (HorizontalRuleBridge, CodeBlockBridge, DropCursorBridge)
// are not available in the web export, so we exclude them
const CustomStartKit = [
  CoreBridge, // Includes Document, Paragraph, Text - we'll override Document
  BoldBridge,
  ItalicBridge,
  UnderlineBridge,
  StrikeBridge,
  HeadingBridge,
  BulletListBridge,
  OrderedListBridge,
  TaskListBridge,
  BlockquoteBridge,
  CodeBridge,
  HighlightBridge,
  ColorBridge,
  LinkBridge,
  HistoryBridge,
  ListItemBridge,
  HardBreakBridge,
  ImageBridge,
  FocusBridge, // Focus/blur events bridge
];

// Inner component that renders after content is ready
const EditorWithContent = ({ initialContent }: { initialContent: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if this is a new entry (empty title)
  const isNewEntry = (() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(initialContent, 'text/html');
    const h1 = doc.querySelector('h1');
    return h1 && !h1.textContent?.trim();
  })();

  const editor = useTenTap({
    bridges: CustomStartKit,
    tiptapOptions: {
      extensions: [
        TitleDocument,
        Title,
        ContentWatcher,
        Focus,
      ],
      content: initialContent,
      // Auto-focus on title for new entries - this actually shows the keyboard
      autofocus: isNewEntry ? 1 : false, // Position 1 = inside title node
      // Scroll to cursor on selection changes (keeps cursor visible above keyboard)
      onSelectionUpdate: ({ editor }) => {
        editor.commands.scrollIntoView();
      },
    },
  });

  // Helper to focus in the body (after title node)
  // MUST be defined before the command handler useEffect that references it
  const focusInBody = useCallback(() => {
    if (!editor) return;

    const doc = editor.state.doc;
    const firstNode = doc.firstChild;

    // If first node is title, focus after it in the body
    if (firstNode && firstNode.type.name === 'title') {
      const afterTitle = firstNode.nodeSize;

      // Check if there's content after the title
      if (doc.childCount > 1) {
        // Focus at start of second node (the body)
        editor.commands.setTextSelection(afterTitle + 1);
        editor.commands.focus();
      } else {
        // No body content - insert a paragraph and focus there
        editor.chain()
          .insertContentAt(afterTitle, { type: 'paragraph' })
          .setTextSelection(afterTitle + 1)
          .focus()
          .run();
      }
    } else {
      // No title node - just focus at end
      editor.commands.focus('end');
    }
  }, [editor]);

  // Expose global command handler for RN to call via injectJavaScript
  useEffect(() => {
    if (!editor) return;

    // Global handler that RN calls via: injectJavaScript(`window.editorCommand('focusTitle');true;`)
    (window as any).editorCommand = (type: string, payload?: any) => {
      switch (type) {
        case 'focusTitle':
          editor.commands.setTextSelection(1);
          editor.commands.focus();
          break;

        case 'focusBody':
          focusInBody();
          break;

        case 'blur':
          editor.commands.blur();
          break;

        case 'scrollToCursor':
          editor.commands.scrollIntoView();
          break;

        // Canonical path: EditorWebBridge injects window.editorCommand("indent"/"outdent")
        // which is handled in editor-web/index.tsx. This case is a fallback for
        // direct TenTap bridge calls that bypass EditorWebBridge.
        case 'indent':
          if (!editor.commands.sinkListItem('listItem')) {
            editor.commands.sinkListItem('taskItem');
          }
          break;

        case 'outdent':
          if (!editor.commands.liftListItem('listItem')) {
            editor.commands.liftListItem('taskItem');
          }
          break;

        case 'toggleBold':
          editor.commands.toggleBold();
          break;

        case 'toggleItalic':
          editor.commands.toggleItalic();
          break;

        case 'toggleUnderline':
          editor.commands.toggleUnderline();
          break;

        case 'toggleStrike':
          editor.commands.toggleStrike();
          break;

        case 'toggleBulletList':
          editor.commands.toggleBulletList();
          break;

        case 'toggleOrderedList':
          editor.commands.toggleOrderedList();
          break;

        case 'toggleTaskList':
          editor.commands.toggleTaskList();
          break;

        case 'toggleBlockquote':
          editor.commands.toggleBlockquote();
          break;

        case 'toggleCode':
          editor.commands.toggleCode();
          break;

        case 'setHeading':
          if (payload?.level) {
            editor.commands.toggleHeading({ level: payload.level });
          }
          break;

        case 'undo':
          editor.commands.undo();
          break;

        case 'redo':
          editor.commands.redo();
          break;

        case 'clearHistory':
          // Legacy - use clearHistoryNow instead
          console.log('[AdvancedEditor] clearHistory - use clearHistoryNow instead');
          break;

        case 'clearHistoryNow':
          // TODO: Not yet implemented - need proper ProseMirror history clearing
          console.log('[AdvancedEditor] clearHistoryNow - NOT IMPLEMENTED');
          break;

        case 'setContentAndClearHistory':
          // TODO: History clearing not yet working - just set content for now
          if (payload?.content !== undefined) {
            editor.commands.setContent(payload.content);
            console.log('[AdvancedEditor] setContentAndClearHistory - content set (history NOT cleared)');
          }
          break;
      }
    };

    return () => {
      delete (window as any).editorCommand;
    };
  }, [editor, focusInBody]);

  // Handle clicks on the ::after pseudo-element (empty space below content)
  // ONLY intercept clicks that wouldn't naturally focus - let ProseMirror handle the rest
  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!editor) return;

    const target = e.target as HTMLElement;

    // Only handle clicks directly on ProseMirror container (the ::after area)
    // NOT on any content elements - let those clicks go through normally
    if (target.classList.contains('ProseMirror')) {
      const titleElement = target.querySelector('h1.entry-title');
      if (titleElement) {
        const titleRect = titleElement.getBoundingClientRect();
        // Only if clicking below title (in the ::after pseudo-element area)
        if (e.clientY > titleRect.bottom + 5) {
          e.preventDefault();
          focusInBody();
        }
      }
    }
    // All other clicks (on paragraphs, text, etc.) go through to ProseMirror naturally
  }, [editor, focusInBody]);

  if (!editor) {
    return null;
  }

  return (
    <div ref={containerRef} onClick={handleContainerClick} style={{ height: '100%' }}>
      <EditorContent editor={editor} />
    </div>
  );
};

// Synchronous read - injectedJavaScriptBeforeContentLoaded already ran before any JS executes
export const AdvancedEditor = () => {
  const content = (window as any).initialContent || '<h1 class="entry-title"></h1><p></p>';
  return <EditorWithContent initialContent={content} />;
};
