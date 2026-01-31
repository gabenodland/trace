/**
 * ContentBridge - Sends editor content updates to React Native
 *
 * This bridge watches for editor content changes and sends them
 * via postMessage. This is necessary because the standard CoreBridge
 * content sync may not work reliably with customSource bundles.
 */

import { BridgeExtension } from '@10play/tentap-editor';
import { Extension } from '@tiptap/core';

// Debounce timeout for content updates
const DEBOUNCE_MS = 150;

let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
let lastContent = '';

/**
 * Send content to React Native
 */
function sendContent(html: string) {
  if (html === lastContent) return;

  lastContent = html;

  if (
    typeof window !== 'undefined' &&
    (window as any).ReactNativeWebView?.postMessage
  ) {
    console.log('[ContentBridge] Sending content update:', html.length, 'bytes');
    (window as any).ReactNativeWebView.postMessage(
      JSON.stringify({
        type: 'ContentUpdate',
        payload: { html },
      })
    );
  }
}

/**
 * TipTap extension that watches for content changes using onUpdate lifecycle
 */
const ContentWatcher = Extension.create({
  name: 'contentWatcher',

  onCreate() {
    // Send initial content
    const html = this.editor.getHTML();
    console.log('[ContentBridge] onCreate, initial content:', html.length, 'bytes');
    sendContent(html);
  },

  onUpdate() {
    // Clear existing timeout
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    // Debounce content updates
    debounceTimeout = setTimeout(() => {
      const html = this.editor.getHTML();
      sendContent(html);
    }, DEBOUNCE_MS);
  },
});

/**
 * ContentBridge - Bridge extension for content sync
 */
export const ContentBridge = new BridgeExtension({
  // No RN-side messages needed, this is one-way (web → RN)
  extendEditorInstance: () => ({}),
  extendEditorState: () => ({}),
  extendCSS: () => '',
  // Add the content watcher extension
  tiptapExtension: ContentWatcher,
});
