/**
 * LAYER 2: TenTap Bridge Wrapper
 * @see docs/EDITOR_ARCHITECTURE.md for full documentation
 *
 * PURPOSE: Minimal TenTap wrapper exposing editor methods to React Native.
 *
 * PROPS:
 * - initialContent: string - Initial HTML content
 * - onChange: () => void - Signal callback (NO args, L3 calls getHTML)
 * - customCSS?: string - Theme CSS to inject via CoreBridge
 * - backgroundColor?: string - Native background color (prevents dark mode flash)
 *
 * KEY CONCEPTS:
 * - Uses TenTapStartKit for bridge extensions
 * - Imports custom editorHtml bundle from L1
 * - CSS injection: filter placeholder bridges, append CoreBridge.configureCSS
 * - Stateless bridge - all state management belongs in L3
 *
 * AI INSTRUCTIONS:
 * - DO NOT add business logic (belongs in L3)
 * - DO NOT add theme awareness (L3 passes theme via props)
 * - DO NOT change onChange signature (L3 expects no args)
 * - DO NOT add state tracking (L2 is a stateless bridge)
 * - Test with: Settings > TenTap Test (L2)
 * - Log prefix: [EditorWebBridge]
 */

import { forwardRef, useImperativeHandle, useEffect, useMemo, useRef, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import {
  RichText,
  useEditorBridge,
  TenTapStartKit,
  CoreBridge,
} from "@10play/tentap-editor";
import type { WebViewMessageEvent } from "react-native-webview";
import { setTableTouched } from "../../shared/hooks/useSwipeBackGesture";
import { createScopedLogger, LogScopes } from "../../shared/utils/logger";

const log = createScopedLogger(LogScopes.Editor);

// Our custom editor bundle with title-first schema
// @ts-ignore - JS file
import { editorHtml } from "../../../editor-web/build/editorHtml.js";

export interface EditorWebBridgeRef {
  // Content
  setContent: (html: string) => void;
  getHTML: () => Promise<string>;
  // Focus
  focus: () => void;
  blur: () => void;
  // Formatting
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  toggleBulletList: () => void;
  toggleOrderedList: () => void;
  toggleTaskList: () => void;
  toggleHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => void;
  // List manipulation (indent/outdent)
  sink: () => void;
  lift: () => void;
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

interface EditorWebBridgeProps {
  /** Initial content (optional) */
  initialContent?: string;
  /** Called when content changes */
  onChange?: () => void;
  /** Custom CSS to inject (theme styles) */
  customCSS?: string;
  /** Background color for WebView (prevents white flash in dark mode) */
  backgroundColor?: string;
}

export const EditorWebBridge = forwardRef<EditorWebBridgeRef, EditorWebBridgeProps>(
  ({ initialContent = "", onChange, customCSS, backgroundColor }, ref) => {
    // Debug: log what content we receive on mount
    useEffect(() => {
      log.debug(`[EditorWebBridge] Mounted with initialContent: ${initialContent.length} chars`);
      if (initialContent) {
        log.debug(`[EditorWebBridge] Content preview: ${initialContent.substring(0, 50)}...`);
      }
    }, []);

    // Build bridge extensions - filter placeholder and add CSS if provided (v1 pattern)
    const bridgeExtensions = useMemo(() => {
      if (!customCSS) {
        return TenTapStartKit;
      }
      // Filter out placeholder bridges (they conflict with CoreBridge.configureCSS)
      const bridgesWithoutPlaceholder = TenTapStartKit.filter((bridge: any) => {
        const name = bridge?.name || bridge?.tiptapExtension?.name || '';
        return !name.toLowerCase().includes('placeholder');
      });
      // Append CoreBridge with our custom CSS
      return [...bridgesWithoutPlaceholder, CoreBridge.configureCSS(customCSS)];
    }, [customCSS]);

    const editor = useEditorBridge({
      autofocus: false,
      avoidIosKeyboard: true,
      initialContent,
      bridgeExtensions,
      customSource: editorHtml,
      onChange,
    });

    // Track previous CSS to detect theme changes
    const previousCSSRef = useRef(customCSS);

    // Re-inject CSS when theme changes (customCSS prop changes)
    useEffect(() => {
      if (customCSS && customCSS !== previousCSSRef.current) {
        log.debug('[EditorWebBridge] Theme changed, injecting new CSS');
        editor.injectCSS(customCSS, 'theme-styles');
        previousCSSRef.current = customCSS;
      }
    }, [customCSS, editor]);

    // Expose TenTap's native methods directly
    useImperativeHandle(ref, () => ({
      // Content
      setContent: (html: string) => {
        log.debug(`[EditorWebBridge] setContent called: ${html.length} chars`);
        editor.setContent(html);
      },
      getHTML: () => {
        log.debug(`[EditorWebBridge] getHTML called`);
        return editor.getHTML();
      },
      // Focus
      focus: () => {
        // Request native WebView focus first (required for keyboard to appear)
        const webview = (editor as any).webviewRef?.current;
        log.debug('[EditorWebBridge] focus called, webview:', { found: !!webview });
        if (webview) {
          log.debug('[EditorWebBridge] calling webview.requestFocus()');
          webview.requestFocus();
        }
        editor.focus('end');
      },
      blur: () => editor.blur(),
      // Formatting
      toggleBold: () => editor.toggleBold(),
      toggleItalic: () => editor.toggleItalic(),
      toggleUnderline: () => editor.toggleUnderline(),
      toggleBulletList: () => editor.toggleBulletList(),
      toggleOrderedList: () => editor.toggleOrderedList(),
      toggleTaskList: () => editor.toggleTaskList(),
      toggleHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => editor.toggleHeading(level),
      // List manipulation — route through custom command handler to support both listItem and taskItem
      sink: () => {
        (editor as any).webviewRef?.current?.injectJavaScript(`window.editorCommand('indent');true;`);
      },
      lift: () => {
        (editor as any).webviewRef?.current?.injectJavaScript(`window.editorCommand('outdent');true;`);
      },
      // History
      undo: () => editor.undo(),
      redo: () => editor.redo(),
      clearHistory: () => {
        // Inject JS to call our custom command handler
        const webview = (editor as any).webviewRef?.current;
        if (webview) {
          log.debug('[EditorWebBridge] clearHistory: Injecting command to WebView');
          webview.injectJavaScript(`window.editorCommand('clearHistory');true;`);
        } else {
          log.warn('[EditorWebBridge] clearHistory: webview ref not available');
        }
      },
      setContentAndClearHistory: (html: string) => {
        const webview = (editor as any).webviewRef?.current;
        if (webview) {
          log.debug('[EditorWebBridge] setContentAndClearHistory called', { length: html.length });
          // Escape the HTML for safe injection into JavaScript
          const escapedHtml = JSON.stringify(html);
          const script = `window.editorCommand('setContentAndClearHistory', { html: ${escapedHtml} });true;`;
          log.debug('[EditorWebBridge] Injecting setContentAndClearHistory script');
          webview.injectJavaScript(script);
        } else {
          log.warn('[EditorWebBridge] setContentAndClearHistory: webview ref not available, falling back to setContent');
          editor.setContent(html);
        }
      },
      reloadWebView: () => {
        const webview = (editor as any).webviewRef?.current;
        if (webview) {
          log.debug('[EditorWebBridge] reloadWebView called');
          webview.reload();
        } else {
          log.warn('[EditorWebBridge] reloadWebView: webview ref not available');
        }
      },
      // Table commands - injected via editorCommand since no TenTap bridge exists
      insertTable: (rows = 3, cols = 3) => {
        const webview = (editor as any).webviewRef?.current;
        if (webview) {
          webview.injectJavaScript(`window.editorCommand('insertTable', { rows: ${rows}, cols: ${cols} });true;`);
        }
      },
      addColumnAfter: () => {
        const webview = (editor as any).webviewRef?.current;
        if (webview) webview.injectJavaScript(`window.editorCommand('addColumnAfter');true;`);
      },
      addRowAfter: () => {
        const webview = (editor as any).webviewRef?.current;
        if (webview) webview.injectJavaScript(`window.editorCommand('addRowAfter');true;`);
      },
      deleteColumn: () => {
        const webview = (editor as any).webviewRef?.current;
        if (webview) webview.injectJavaScript(`window.editorCommand('deleteColumn');true;`);
      },
      deleteRow: () => {
        const webview = (editor as any).webviewRef?.current;
        if (webview) webview.injectJavaScript(`window.editorCommand('deleteRow');true;`);
      },
      deleteTable: () => {
        const webview = (editor as any).webviewRef?.current;
        if (webview) webview.injectJavaScript(`window.editorCommand('deleteTable');true;`);
      },
      toggleHeaderRow: () => {
        const webview = (editor as any).webviewRef?.current;
        if (webview) webview.injectJavaScript(`window.editorCommand('toggleHeaderRow');true;`);
      },
      goToNextCell: () => {
        const webview = (editor as any).webviewRef?.current;
        if (webview) webview.injectJavaScript(`window.editorCommand('goToNextCell');true;`);
      },
      goToPreviousCell: () => {
        const webview = (editor as any).webviewRef?.current;
        if (webview) webview.injectJavaScript(`window.editorCommand('goToPreviousCell');true;`);
      },
      toggleHeaderColumn: () => {
        const webview = (editor as any).webviewRef?.current;
        if (webview) webview.injectJavaScript(`window.editorCommand('toggleHeaderColumn');true;`);
      },
    }), [editor]);

    // Clean up table touch flag on unmount (prevents stuck swipe-back blocking)
    useEffect(() => {
      return () => setTableTouched(false);
    }, []);

    // Handle messages from WebView (table touch events + console forwarding)
    const handleMessage = useCallback((event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'tableTouchStart') {
          setTableTouched(true);
        } else if (data.type === 'tableTouchEnd') {
          setTableTouched(false);
        } else if (data.type === 'console') {
          // Forward WebView console logs to RN console
          const prefix = '[WebView]';
          if (data.level === 'error') log.error(`${prefix} ${data.message}`);
          else if (data.level === 'warn') log.warn(`${prefix} ${data.message}`);
          else log.debug(`${prefix} ${data.message}`);
        }
      } catch {
        // Not JSON or not our message — TenTap handles its own messages
      }
    }, []);

    return (
      <View style={[styles.container, backgroundColor && { backgroundColor }]}>
        <RichText
          editor={editor}
          style={[styles.editor, backgroundColor && { backgroundColor }]}
          overScrollMode="never"
          nestedScrollEnabled={true}
          onMessage={handleMessage}
          exclusivelyUseCustomOnMessage={false}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  editor: {
    flex: 1,
  },
});
