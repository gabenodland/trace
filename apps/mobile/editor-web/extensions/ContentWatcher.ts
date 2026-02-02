/**
 * ContentWatcher - TipTap extension that sends content updates to React Native
 *
 * This extension watches for editor content changes and sends them
 * via postMessage. Added directly to editor extensions (not via BridgeExtension)
 * to ensure it's always active.
 */

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
    (window as any).ReactNativeWebView.postMessage(
      JSON.stringify({
        type: 'ContentUpdate',
        payload: { html },
      })
    );
  }
}

/**
 * TipTap extension that watches for content changes
 */
export const ContentWatcher = Extension.create({
  name: 'contentWatcher',

  onCreate() {
    // Send initial content immediately - RN callbacks are set up synchronously
    const html = this.editor.getHTML();
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
