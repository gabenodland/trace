/**
 * TitleBridge - Bridges the Title extension to React Native
 *
 * This BridgeExtension:
 * - Registers the Title TipTap extension on the web side
 * - Provides methods to get/set title from RN side
 * - Sends title updates to RN when content changes
 */

import { BridgeExtension } from '@10play/tentap-editor';
import type { Editor } from '@tiptap/core';
import { Title } from '../extensions/Title';

// Message types for RN communication
type TitleMessage =
  | { type: 'TitleUpdate'; payload: { title: string } }
  | { type: 'GetTitle' }
  | { type: 'SetTitle'; payload: { title: string } }
  | { type: 'TitleFocus'; payload: { inTitle: boolean } };

/**
 * Extract title text from editor
 */
function getTitleText(editor: Editor): string {
  const firstNode = editor.state.doc.firstChild;
  if (firstNode && firstNode.type.name === 'title') {
    return firstNode.textContent || '';
  }
  return '';
}

/**
 * Set title text in editor
 */
function setTitleText(editor: Editor, text: string): void {
  const { state, view } = editor;
  const firstNode = state.doc.firstChild;

  if (!firstNode || firstNode.type.name !== 'title') {
    return;
  }

  // Create transaction to replace title content
  const tr = state.tr;

  // Delete existing title content
  if (firstNode.content.size > 0) {
    tr.delete(1, 1 + firstNode.content.size);
  }

  // Insert new text
  if (text) {
    tr.insertText(text, 1);
  }

  view.dispatch(tr);
}

/**
 * Check if cursor is in title
 */
function isInTitle(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  return $from.parent.type.name === 'title';
}

export const TitleBridge = new BridgeExtension<TitleMessage, TitleMessage, 'Title'>({
  // The TipTap extension this bridge wraps
  tiptapExtension: Title,
  // Unique name for the bridge
  name: 'Title',

  // Handle messages from RN side
  onBridgeMessage: (editor, message) => {
    if (!editor) return false;

    switch (message.type) {
      case 'GetTitle':
        // RN is requesting current title - send it back
        const title = getTitleText(editor);
        // This will be sent via the bridge's messaging system
        (window as any).ReactNativeWebView?.postMessage(
          JSON.stringify({
            type: 'TitleUpdate',
            payload: { title },
          })
        );
        return true;

      case 'SetTitle':
        // RN wants to set title text
        setTitleText(editor, message.payload.title);
        return true;

      default:
        return false;
    }
  },

  // Track editor state changes and send to RN
  onEditorReady: (editor) => {
    let lastTitle = '';
    let lastInTitle = false;

    // Send title updates on content changes
    editor.on('update', () => {
      const currentTitle = getTitleText(editor);
      if (currentTitle !== lastTitle) {
        lastTitle = currentTitle;
        (window as any).ReactNativeWebView?.postMessage(
          JSON.stringify({
            type: 'TitleUpdate',
            payload: { title: currentTitle },
          })
        );
      }
    });

    // Send focus state on selection changes
    editor.on('selectionUpdate', () => {
      const inTitle = isInTitle(editor);
      if (inTitle !== lastInTitle) {
        lastInTitle = inTitle;
        (window as any).ReactNativeWebView?.postMessage(
          JSON.stringify({
            type: 'TitleFocus',
            payload: { inTitle },
          })
        );
      }
    });

    // Send initial title
    const initialTitle = getTitleText(editor);
    if (initialTitle) {
      lastTitle = initialTitle;
      (window as any).ReactNativeWebView?.postMessage(
        JSON.stringify({
          type: 'TitleUpdate',
          payload: { title: initialTitle },
        })
      );
    }
  },
});
