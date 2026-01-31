/**
 * Focus Extension - Sends focus/blur events to RN side
 *
 * This eliminates the need for polling focus state from RN.
 * Events are sent via ReactNativeWebView.postMessage.
 */

import { Extension } from '@tiptap/core';

export const Focus = Extension.create({
  name: 'focusBridge',

  onCreate() {
    // Send focus events to RN
    this.editor.on('focus', () => {
      (window as any).ReactNativeWebView?.postMessage(
        JSON.stringify({
          type: 'FocusChange',
          payload: { focused: true },
        })
      );
    });

    this.editor.on('blur', () => {
      (window as any).ReactNativeWebView?.postMessage(
        JSON.stringify({
          type: 'FocusChange',
          payload: { focused: false },
        })
      );
    });
  },
});
