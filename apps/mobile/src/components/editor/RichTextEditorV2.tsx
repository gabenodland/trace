/**
 * LAYER 3: Application Editor Wrapper
 * @see docs/EDITOR_ARCHITECTURE.md for full documentation
 *
 * PURPOSE: Application-level wrapper adding theme, content tracking, and events.
 *
 * PROPS:
 * - onChange: (html: string) => void - Content change callback (NOT L2's signal)
 * - editable?: boolean - Read-only mode
 * - onTapWhileReadOnly?: () => void - Tap in read-only callback
 * - onReady?: () => void - Editor ready callback
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
import { View, StyleSheet, DeviceEventEmitter, Pressable } from "react-native";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { createScopedLogger } from "../../shared/utils/logger";
import { EditorWebBridge, EditorWebBridgeRef } from "./EditorWebBridge";

const log = createScopedLogger('RichTextEditorV2', '📝');

// Track when setContent is called to measure WebView round-trip
let setContentTimestamp: number | null = null;

/**
 * Remove inline color styles from HTML to ensure theme colors are used
 */
function sanitizeHtmlColors(html: string): string {
  return html.replace(
    /style="([^"]*)"/gi,
    (match, styleContent) => {
      const cleanedStyle = styleContent
        .replace(/\bcolor\s*:\s*[^;]+;?/gi, '')
        .replace(/background-color\s*:\s*[^;]+;?/gi, '')
        .replace(/background\s*:\s*[^;]+;?/gi, '')
        .trim();

      if (!cleanedStyle) return '';
      return `style="${cleanedStyle}"`;
    }
  );
}

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
  // Focus
  focus: () => void;
  blur: () => void;
  requestFocusSync: () => void;
  // History
  undo: () => void;
  redo: () => void;
}

interface RichTextEditorV2Props {
  /** Called when content changes (provides HTML) */
  onChange?: (html: string) => void;
  /** Whether the editor is editable */
  editable?: boolean;
  /** Called when user taps the editor while in read-only mode */
  onTapWhileReadOnly?: () => void;
  /** Called when editor is ready */
  onReady?: () => void;
}

export const RichTextEditorV2 = forwardRef<RichTextEditorV2Ref, RichTextEditorV2Props>(({
  onChange,
  editable = true,
  onTapWhileReadOnly,
  onReady,
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
  `, [theme]);

  // L2's onChange is just a signal - we call getHTML to get content
  const handleL2Change = useCallback(async () => {
    if (!isMounted.current || !l2Ref.current) return;

    // Measure WebView round-trip if we're tracking
    if (setContentTimestamp !== null) {
      const elapsed = Math.round(performance.now() - setContentTimestamp);
      log.info('⏱️ WebView onChange fired', { elapsedFromSetContent: elapsed });
      setContentTimestamp = null; // Only measure once per setContent
    }

    // Mark as ready on first onChange
    if (!isReady.current) {
      isReady.current = true;
      log.info('Editor ready (via L2 onChange)');
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
      setContentTimestamp = performance.now();
      log.info('⏱️ setContent called', { length: sanitized.length });
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

    // Focus
    focus: () => {
      log.debug('focus called');
      l2Ref.current?.focus();
    },
    blur: () => l2Ref.current?.blur(),
    requestFocusSync: () => l2Ref.current?.focus(),
    // History
    undo: () => l2Ref.current?.undo(),
    redo: () => l2Ref.current?.redo(),
  }), []);

  // Handle read-only mode - blur when becoming read-only
  useEffect(() => {
    if (!editable) {
      l2Ref.current?.blur();
    }
  }, [editable]);

  // Handle tap while in read-only mode
  const handleReadOnlyTap = useCallback(() => {
    if (!editable && onTapWhileReadOnly) {
      log.debug('Tap detected in read-only mode');
      onTapWhileReadOnly();
    }
  }, [editable, onTapWhileReadOnly]);

  // Listen for global blur event (swipe-back gesture)
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('blurEditors', () => {
      if (!isMounted.current) return;
      l2Ref.current?.blur();
    });
    return () => subscription.remove();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <EditorWebBridge
        ref={l2Ref}
        onChange={handleL2Change}
        customCSS={customCSS}
        backgroundColor={theme.colors.background.primary}
      />
      {/* Tap overlay for read-only mode - intercepts taps to trigger edit mode */}
      {!editable && onTapWhileReadOnly && (
        <Pressable
          style={styles.readOnlyOverlay}
          onPress={handleReadOnlyTap}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  readOnlyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
});
