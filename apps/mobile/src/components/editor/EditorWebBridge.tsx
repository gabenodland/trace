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

import { forwardRef, useImperativeHandle, useEffect, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import {
  RichText,
  useEditorBridge,
  TenTapStartKit,
  CoreBridge,
} from "@10play/tentap-editor";

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
      console.log(`[EditorWebBridge] Mounted with initialContent: ${initialContent.length} chars`);
      if (initialContent) {
        console.log(`[EditorWebBridge] Content preview: ${initialContent.substring(0, 50)}...`);
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

    // Expose TenTap's native methods directly
    useImperativeHandle(ref, () => ({
      // Content
      setContent: (html: string) => {
        console.log(`[EditorWebBridge] setContent called: ${html.length} chars`);
        editor.setContent(html);
      },
      getHTML: () => {
        console.log(`[EditorWebBridge] getHTML called`);
        return editor.getHTML();
      },
      // Focus
      focus: () => {
        // Request native WebView focus first (required for keyboard to appear)
        const webview = (editor as any).webviewRef?.current;
        console.log('[EditorWebBridge] focus called, webview:', webview ? 'found' : 'null');
        if (webview) {
          console.log('[EditorWebBridge] calling webview.requestFocus()');
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
      // List manipulation
      sink: () => editor.sink(),
      lift: () => editor.lift(),
      // History
      undo: () => editor.undo(),
      redo: () => editor.redo(),
    }), [editor]);

    return (
      <View style={[styles.container, backgroundColor && { backgroundColor }]}>
        <RichText editor={editor} style={[styles.editor, backgroundColor && { backgroundColor }]} />
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
