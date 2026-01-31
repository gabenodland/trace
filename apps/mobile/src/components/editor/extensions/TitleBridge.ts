/**
 * EditorBridge - RN-side support for title-as-first-line in custom bundled editor
 *
 * This module provides:
 * - Helper functions to split/combine title and body from HTML
 * - CSS for title styling (injected via CoreBridge)
 * - Message handlers for receiving content/focus updates from WebView
 *
 * The custom web editor (editor-web/) handles:
 * - Title node schema enforcement (can't be deleted)
 * - Keyboard shortcuts (backspace, enter, delete)
 * - ContentWatcher sends ContentUpdate messages
 * - Focus extension sends FocusChange messages
 */

// Debug flag - enable to see editor bridge logs
const DEBUG_EDITOR = false;
const log = (msg: string, data?: any) => {
  if (DEBUG_EDITOR) {
    console.log(`[EditorBridge] ${msg}`, data !== undefined ? JSON.stringify(data) : '');
  }
};

/**
 * Extract title and body from editor HTML
 * Title is the first h1 element, body is everything after
 */
export function splitTitleAndBody(html: string): { title: string; body: string } {
  if (!html) {
    return { title: '', body: '' };
  }

  // Match first h1 tag (with or without attributes)
  const h1Match = html.match(/^<h1[^>]*>(.*?)<\/h1>/i);

  if (h1Match) {
    // Extract title text (strip any inner HTML tags)
    const titleHtml = h1Match[1];
    const title = titleHtml.replace(/<[^>]*>/g, '').trim();

    // Body is everything after the first h1
    const body = html.substring(h1Match[0].length).trim();

    log('splitTitleAndBody', { title, bodyLen: body.length });
    return { title, body };
  }

  // No h1 found - entire content is body
  log('splitTitleAndBody - no h1 found');
  return { title: '', body: html };
}

/**
 * Combine title and body into editor HTML
 * Creates h1 for title, preserves body HTML
 */
export function combineTitleAndBody(title: string, body: string): string {
  // Escape title for HTML
  const escapedTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Always include h1 for title (even if empty - shows placeholder)
  const titleHtml = `<h1 class="entry-title">${escapedTitle}</h1>`;

  // Ensure body has at least an empty paragraph
  const bodyHtml = body || '<p></p>';

  log('combineTitleAndBody', { titleLen: title.length, bodyLen: body.length });
  return titleHtml + bodyHtml;
}

/**
 * CSS for title styling
 * This should be added to CoreBridge.configureCSS() in RichTextEditor
 */
export function getTitleCSS(titlePlaceholder: string, colors: { text: string; disabled: string; border: string }): string {
  return `
    /* Title (first h1) styling */
    .ProseMirror > h1:first-child,
    .ProseMirror > h1.entry-title:first-child {
      font-size: 24px !important;
      font-weight: bold !important;
      margin: 0 0 12px 0 !important;
      padding: 0 0 8px 0 !important;
      border-bottom: 1px solid ${colors.border} !important;
      min-height: 1.4em !important;
      color: ${colors.text} !important;
    }

    /* Title placeholder when empty */
    .ProseMirror > h1:first-child:empty::before,
    .ProseMirror > h1.entry-title:first-child:empty::before,
    .ProseMirror > h1:first-child.is-empty::before {
      content: "${titlePlaceholder}";
      color: ${colors.disabled} !important;
      pointer-events: none;
      float: left;
      height: 0;
    }
  `;
}

// Message types from web editor (only active message types)
type EditorMessage =
  | { type: 'FocusChange'; payload: { focused: boolean } }
  | { type: 'ContentUpdate'; payload: { html: string } };

// Callbacks for editor events
export interface EditorBridgeCallbacks {
  onFocusChange?: (focused: boolean) => void;
  onContentChange?: (html: string) => void;
}

// Store callbacks globally so bridge can access them
let editorCallbacks: EditorBridgeCallbacks = {};

// Buffer for messages that arrive before callbacks are set
// This handles the race condition where WebView sends ContentUpdate
// before the RN useEffect sets up the callbacks
let messageBuffer: string[] = [];

/**
 * Set callbacks for editor events
 * Call this before using the editor
 */
export function setEditorCallbacks(callbacks: EditorBridgeCallbacks): void {
  editorCallbacks = callbacks;
  log('setEditorCallbacks', {
    hasOnFocusChange: !!callbacks.onFocusChange,
    hasOnContentChange: !!callbacks.onContentChange,
    bufferedMessages: messageBuffer.length,
  });

  // Replay any buffered messages
  if (messageBuffer.length > 0) {
    log('Replaying buffered messages', { count: messageBuffer.length });
    const buffered = [...messageBuffer];
    messageBuffer = [];
    buffered.forEach(msg => handleEditorMessage(msg));
  }
}

/**
 * Clear editor callbacks
 */
export function clearEditorCallbacks(): void {
  editorCallbacks = {};
  messageBuffer = [];
}

/**
 * Handle messages from web editor
 * This function processes all bridge messages (content + focus)
 */
export function handleEditorMessage(message: string): boolean {
  try {
    const data = JSON.parse(message) as EditorMessage;

    switch (data.type) {
      case 'FocusChange':
        log('Received FocusChange', data.payload);
        if (editorCallbacks.onFocusChange) {
          editorCallbacks.onFocusChange(data.payload.focused);
        }
        return true;

      case 'ContentUpdate':
        log('Received ContentUpdate', { htmlLen: data.payload.html?.length });
        if (editorCallbacks.onContentChange) {
          editorCallbacks.onContentChange(data.payload.html);
        } else {
          // Buffer the message - callbacks not set yet (race condition)
          log('Buffering ContentUpdate - callbacks not ready');
          messageBuffer.push(message);
        }
        return true;

      default:
        return false;
    }
  } catch {
    // Not our message
    return false;
  }
}

/**
 * Usage for custom bundle:
 * 1. Call setEditorCallbacks({ onFocusChange, onContentChange })
 * 2. Pass handleEditorMessage to RichText's onMessage prop
 * 3. Messages from the web editor will trigger the registered callbacks
 * 4. Title is extracted from ContentUpdate HTML via splitTitleAndBody()
 */

log('EditorBridge helpers loaded');
