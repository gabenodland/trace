/**
 * LAYER 3: Application Editor Wrapper
 * @see docs/EDITOR_ARCHITECTURE.md for full documentation
 *
 * PURPOSE: Application-level wrapper adding theme, content tracking, and events.
 *
 * PROPS:
 * - onChange: (html: string) => void - Content change callback (NOT L2's signal)
 * - editable?: boolean - Read-only mode (blurs editor when false)
 * - onReady?: () => void - Editor ready callback
 *
 * NOTE: Edit mode is detected via keyboard show event in parent screen,
 * not via tap overlay. This ensures native touch reaches WebView for keyboard.
 *
 * KEY CONCEPTS:
 * - Generates theme CSS from ThemeContext, passes to L2
 * - Transforms L2's signal onChange to content-based onChange
 * - Sanitizes HTML colors via sanitizeHtmlColors() before setContent
 * - Tracks lastKnownContent to dedupe onChange calls
 * - Listens for global 'blurEditors' event (swipe-back gesture)
 *
 * DIRTY TRACKING:
 * - L3 does NOT track dirty state
 * - Parent screen compares original vs current content
 * - L3 just provides onChange(html) for parent to compare
 *
 * AI INSTRUCTIONS:
 * - DO NOT modify L2 behavior (configure via props)
 * - DO NOT track dirty state (parent screen's responsibility)
 * - DO NOT fetch or save data (parent screen's responsibility)
 * - Prefer adding props to L2 over modifying L2 internals
 * - Test with: Settings > RichTextEditor V2 (L3)
 * - Log prefix: [RichTextEditorV2]
 */

import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback, useMemo } from "react";
import { View, StyleSheet, DeviceEventEmitter } from "react-native";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { createScopedLogger } from "../../shared/utils/logger";
import { sanitizeHtmlColors } from "../../shared/utils/htmlUtils";
import { EditorWebBridge, EditorWebBridgeRef, CursorContext } from "./EditorWebBridge";
export type { CursorContext };

const log = createScopedLogger('RichTextEditorV2', '📝');

export interface RichTextEditorV2Ref {
  // Formatting
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  toggleBulletList: () => void;
  toggleOrderedList: () => void;
  toggleTaskList: () => void;
  toggleHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => void;
  indent: () => void;
  outdent: () => void;
  // Content
  setContent: (html: string) => void;
  getHTML: () => Promise<string>;
  /** Get editor content as Markdown (via tiptap-markdown) */
  getMarkdown: () => Promise<string>;
  // Focus
  focus: () => void;
  blur: () => void;
  requestFocusSync: () => void;
  // History
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  /** Set content without adding to undo history - use when loading entries */
  setContentAndClearHistory: (html: string) => void;
  /** Reload the WebView - use when WebView becomes unresponsive */
  reloadWebView: () => void;
  // Table commands
  insertTable: (rows?: number, cols?: number) => void;
  addColumnAfter: () => void;
  addRowAfter: () => void;
  deleteColumn: () => void;
  deleteRow: () => void;
  deleteTable: () => void;
  toggleHeaderRow: () => void;
  goToNextCell: () => void;
  goToPreviousCell: () => void;
  toggleHeaderColumn: () => void;
}

interface RichTextEditorV2Props {
  /** Called when content changes (provides HTML) */
  onChange?: (html: string) => void;
  /** Whether the editor is editable (blurs when false) */
  editable?: boolean;
  /** Called when editor is ready */
  onReady?: () => void;
  /** Called when cursor context changes (e.g. entering/leaving a table cell) */
  onCursorContext?: (ctx: CursorContext) => void;
}

export const RichTextEditorV2 = forwardRef<RichTextEditorV2Ref, RichTextEditorV2Props>(({
  onChange,
  editable = true,
  onReady,
  onCursorContext,
}, ref) => {
  const theme = useTheme();
  const l2Ref = useRef<EditorWebBridgeRef>(null);
  const isMounted = useRef(true);
  const isReady = useRef(false);
  const lastKnownContent = useRef<string>('');

  useEffect(() => {
    isMounted.current = true;
    log.info('V2 mounted');
    return () => {
      isMounted.current = false;
      log.info('V2 unmounted');
    };
  }, []);

  // Generate theme-aware CSS for the editor
  const customCSS = useMemo(() => `
    @import url('${theme.typography.webFontUrl}');
    * {
      line-height: 1.4 !important;
      font-family: ${theme.typography.webFontFamily} !important;
    }
    body {
      background-color: ${theme.colors.background.primary} !important;
      color: ${theme.colors.text.primary} !important;
      font-family: ${theme.typography.webFontFamily} !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    p {
      margin: 0 !important;
      padding: 0 !important;
      color: ${theme.colors.text.primary} !important;
    }
    p + p {
      margin-top: 4px !important;
    }
    h1 {
      font-size: 24px !important;
      font-weight: bold !important;
      margin: 8px 0 4px 0 !important;
      color: ${theme.colors.text.primary} !important;
    }
    h1.entry-title {
      margin: 12px 0 12px 0 !important;
      padding: 0 0 8px 0 !important;
      border-bottom: 1px solid ${theme.colors.border.light} !important;
      min-height: 1.4em !important;
    }
    h1.entry-title.is-empty::before {
      content: 'Title' !important;
      color: ${theme.colors.text.disabled} !important;
      pointer-events: none;
      position: absolute;
    }
    h2 {
      font-size: 20px !important;
      font-weight: bold !important;
      margin: 6px 0 4px 0 !important;
      color: ${theme.colors.text.primary} !important;
    }
    ul, ol {
      padding-left: 20px !important;
      margin: 4px 0 !important;
      color: ${theme.colors.text.primary} !important;
    }
    ul:not([data-type="taskList"]) ul:not([data-type="taskList"]),
    ol ul:not([data-type="taskList"]),
    ul:not([data-type="taskList"]) ol,
    ol ol {
      padding-left: 20px !important;
    }
    ol { list-style-type: decimal !important; }
    ol ol { list-style-type: lower-alpha !important; }
    ol ol ol { list-style-type: lower-roman !important; }
    ul[data-type="taskList"] {
      padding-left: 0 !important;
      margin-left: 0 !important;
      list-style: none !important;
    }
    ul[data-type="taskList"] li {
      display: flex !important;
      align-items: flex-start !important;
    }
    ul[data-type="taskList"] li > label {
      margin-right: 8px !important;
      user-select: none !important;
    }
    ul[data-type="taskList"] li > label input[type="checkbox"] {
      -webkit-appearance: none !important;
      appearance: none !important;
      width: 18px !important;
      height: 18px !important;
      min-width: 18px !important;
      margin: 2px 0 0 0 !important;
      border: 1.5px solid ${theme.colors.border.dark} !important;
      border-radius: 4px !important;
      background-color: ${theme.colors.background.primary} !important;
      cursor: pointer;
      position: relative;
    }
    ul[data-type="taskList"] li > label input[type="checkbox"]:checked {
      background-color: ${theme.colors.functional.accent} !important;
      border-color: ${theme.colors.functional.accent} !important;
    }
    ul[data-type="taskList"] li > label input[type="checkbox"]:checked::after {
      content: '✓' !important;
      position: absolute !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      color: #FFFFFF !important;
      font-size: 12px !important;
      font-weight: 700 !important;
      line-height: 1 !important;
    }
    ul[data-type="taskList"] li[data-checked="true"] > div {
      opacity: 0.6 !important;
    }
    ul[data-type="taskList"] ul[data-type="taskList"],
    li[data-type="taskItem"] ul[data-type="taskList"] {
      padding-left: 20px !important;
      margin-left: 0 !important;
    }
    .ProseMirror {
      -webkit-text-size-adjust: 100%;
      background-color: ${theme.colors.background.primary} !important;
      color: ${theme.colors.text.primary} !important;
      padding: 0 !important;
      padding-bottom: 120px !important;
      margin: 0 !important;
    }
    .ProseMirror p,
    .ProseMirror h1,
    .ProseMirror h2,
    .ProseMirror li,
    .ProseMirror ul,
    .ProseMirror ol {
      scroll-margin-bottom: 120px !important;
    }
    .ProseMirror > h1.entry-title + p.is-empty:last-child::before,
    .ProseMirror > p.is-editor-empty:first-child:last-child::before {
      color: ${theme.colors.text.disabled} !important;
    }
    .ProseMirror > h1.entry-title + p.is-empty:not(:last-child)::before {
      display: none !important;
    }
    a {
      color: ${theme.colors.functional.accent} !important;
    }
    /* Thin, theme-aware scrollbar — subtle on all themes */
    ::-webkit-scrollbar {
      width: 3px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: ${theme.colors.border.light};
      border-radius: 3px;
    }
    /* Table styles - theme-aware overrides */
    .ProseMirror table {
      border-collapse: collapse !important;
    }
    .ProseMirror th,
    .ProseMirror td {
      border: 1px solid ${theme.colors.border.dark} !important;
      color: ${theme.colors.text.primary} !important;
    }
    .ProseMirror th {
      background: ${theme.colors.background.tertiary} !important;
      font-weight: 600 !important;
      white-space: nowrap !important;
    }
    .ProseMirror .selectedCell {
      background: ${theme.isDark ? 'rgba(96, 165, 250, 0.2)' : '#dbeafe'} !important;
    }
    .ProseMirror th.selectedCell {
      background: ${theme.isDark ? 'rgba(96, 165, 250, 0.3)' : '#bfdbfe'} !important;
    }
  `, [theme]);

  // L2's onChange is just a signal - we call getHTML to get content
  const handleL2Change = useCallback(async () => {
    if (!isMounted.current || !l2Ref.current) return;

    // Mark as ready on first onChange
    if (!isReady.current) {
      isReady.current = true;
      log.info('🔄 Editor ready (via L2 onChange) - calling onReady callback', { hasOnReady: !!onReady });
      onReady?.();
    }

    try {
      const html = await l2Ref.current.getHTML();
      if (!isMounted.current) return;

      // Only fire onChange if content actually changed
      if (html !== lastKnownContent.current) {
        log.debug('Content changed', { length: html.length });
        lastKnownContent.current = html;
        onChange?.(html);
      }
    } catch (e) {
      log.warn('getHTML failed in onChange', { error: e instanceof Error ? e.message : 'unknown' });
    }
  }, [onChange, onReady]);

  // Expose methods via ref - delegate to L2
  useImperativeHandle(ref, () => ({
    // Formatting - direct delegation to L2
    toggleBold: () => l2Ref.current?.toggleBold(),
    toggleItalic: () => l2Ref.current?.toggleItalic(),
    toggleUnderline: () => l2Ref.current?.toggleUnderline(),
    toggleBulletList: () => l2Ref.current?.toggleBulletList(),
    toggleOrderedList: () => l2Ref.current?.toggleOrderedList(),
    toggleTaskList: () => l2Ref.current?.toggleTaskList(),
    toggleHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => l2Ref.current?.toggleHeading(level),
    indent: () => l2Ref.current?.sink(),
    outdent: () => l2Ref.current?.lift(),

    // Content - with sanitization
    setContent: (html: string) => {
      const sanitized = sanitizeHtmlColors(html);
      log.info('setContent called', { length: sanitized.length });
      lastKnownContent.current = sanitized;
      l2Ref.current?.setContent(sanitized);
    },
    getHTML: async () => {
      log.debug('getHTML called');
      const html = await l2Ref.current?.getHTML();
      if (html) {
        lastKnownContent.current = html;
      }
      return html || '';
    },
    getMarkdown: async () => {
      log.debug('getMarkdown called');
      const md = await (l2Ref.current as any)?.getMarkdown?.();
      return md || '';
    },

    // Focus
    focus: () => {
      log.debug('focus called', { isReady: isReady.current });
      l2Ref.current?.focus();
    },
    blur: () => l2Ref.current?.blur(),
    requestFocusSync: () => l2Ref.current?.focus(),
    // History
    undo: () => l2Ref.current?.undo(),
    redo: () => l2Ref.current?.redo(),
    clearHistory: () => {
      log.debug('clearHistory called');
      l2Ref.current?.clearHistory();
    },
    setContentAndClearHistory: (html: string) => {
      const sanitized = sanitizeHtmlColors(html);
      log.debug('setContentAndClearHistory called', { length: sanitized.length });
      lastKnownContent.current = sanitized;
      l2Ref.current?.setContentAndClearHistory(sanitized);
    },
    reloadWebView: () => {
      log.info('🔄 reloadWebView called - resetting isReady and reloading');
      // Reset ready state so onReady fires again after reload
      isReady.current = false;
      l2Ref.current?.reloadWebView();
      log.info('🔄 reloadWebView: webview.reload() called, waiting for onReady...');
    },
    // Table commands - delegate to L2
    insertTable: (rows?: number, cols?: number) => l2Ref.current?.insertTable(rows, cols),
    addColumnAfter: () => l2Ref.current?.addColumnAfter(),
    addRowAfter: () => l2Ref.current?.addRowAfter(),
    deleteColumn: () => l2Ref.current?.deleteColumn(),
    deleteRow: () => l2Ref.current?.deleteRow(),
    deleteTable: () => l2Ref.current?.deleteTable(),
    toggleHeaderRow: () => l2Ref.current?.toggleHeaderRow(),
    goToNextCell: () => l2Ref.current?.goToNextCell(),
    goToPreviousCell: () => l2Ref.current?.goToPreviousCell(),
    toggleHeaderColumn: () => l2Ref.current?.toggleHeaderColumn(),
  }), []);

  // Handle read-only mode - blur when becoming read-only
  useEffect(() => {
    if (!editable) {
      l2Ref.current?.blur();
    }
  }, [editable]);

  // Listen for global blur event (swipe-back gesture)
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('blurEditors', () => {
      if (!isMounted.current) return;
      log.debug('Received blurEditors event, blurring');
      l2Ref.current?.blur();
    });
    return () => subscription.remove();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <EditorWebBridge
        ref={l2Ref}
        onChange={handleL2Change}
        onCursorContext={onCursorContext}
        customCSS={customCSS}
        backgroundColor={theme.colors.background.primary}
      />
      {/* No overlay - let native touches go directly to WebView for keyboard to appear */}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
