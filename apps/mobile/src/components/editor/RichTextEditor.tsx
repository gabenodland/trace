import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { View, StyleSheet } from "react-native";
import {
  RichText,
  useEditorBridge,
  TenTapStartKit,
  CoreBridge,
} from "@10play/tentap-editor";
import { useTheme } from "../../shared/contexts/ThemeContext";

/**
 * RichTextEditor - Simplified wrapper around tentap-editor
 *
 * This component does ONE thing: render a rich text editor.
 * Content is accessed via ref.getHTML() when needed (on save).
 * No continuous syncing, no height polling, no interaction tracking.
 */

interface RichTextEditorProps {
  value: string;
  placeholder?: string;
  editable?: boolean;
  onPress?: () => void;
  /** Called once when editor is ready */
  onReady?: (content: string) => void;
  /** Minimum height for the editor */
  minHeight?: number;
}

export const RichTextEditor = forwardRef(({
  value,
  placeholder = "Start typing...",
  editable = true,
  onPress,
  onReady,
  minHeight = 300,
}: RichTextEditorProps, ref) => {
  const theme = useTheme();
  const containerRef = useRef<View>(null);
  const prevEditable = useRef(editable);
  const hasCalledOnReady = useRef(false);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Dynamic CSS with theme colors and fonts
  const customCSS = `
    @import url('${theme.typography.webFontUrl}');
    * {
      line-height: 1.4 !important;
      font-family: ${theme.typography.webFontFamily} !important;
    }
    body {
      background-color: ${theme.colors.background.primary} !important;
      color: ${theme.colors.text.primary} !important;
      font-family: ${theme.typography.webFontFamily} !important;
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
    h2 {
      font-size: 20px !important;
      font-weight: bold !important;
      margin: 6px 0 4px 0 !important;
      color: ${theme.colors.text.primary} !important;
    }
    ul, ol {
      padding-left: 24px !important;
      margin-top: 4px !important;
      margin-bottom: 4px !important;
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
    ol ol ol ol { list-style-type: upper-alpha !important; }
    ol ol ol ol ol { list-style-type: upper-roman !important; }
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
      min-height: ${minHeight - 20}px !important;
    }
    .ProseMirror > *:first-child {
      margin-top: 10px !important;
    }
    .ProseMirror p.is-editor-empty:first-child::before {
      color: ${theme.colors.text.disabled} !important;
    }
    a {
      color: ${theme.colors.functional.accent} !important;
    }
  `;

  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    initialContent: value,
    editable: true,
    bridgeExtensions: [
      ...TenTapStartKit,
      CoreBridge.configureCSS(customCSS),
    ],
  });

  const editorRef = useRef(editor);
  editorRef.current = editor;

  useImperativeHandle(ref, () => ({
    toggleBold: () => editor.toggleBold(),
    toggleItalic: () => editor.toggleItalic(),
    toggleUnderline: () => editor.toggleUnderline(),
    toggleBulletList: () => editor.toggleBulletList(),
    toggleOrderedList: () => editor.toggleOrderedList(),
    toggleTaskList: () => editor.toggleTaskList(),
    setHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => editor.toggleHeading(level),
    toggleHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => editor.toggleHeading(level),
    indent: () => {
      try {
        const webview = (editor as any).webviewRef?.current;
        if (webview?.injectJavaScript) {
          webview.injectJavaScript(`
            (function() {
              const event = new KeyboardEvent('keydown', {
                key: 'Tab', code: 'Tab', keyCode: 9, which: 9,
                bubbles: true, cancelable: true
              });
              document.activeElement?.dispatchEvent(event);
            })();
            true;
          `);
        }
      } catch (e) {
        editor.sink();
      }
    },
    outdent: () => {
      try {
        const webview = (editor as any).webviewRef?.current;
        if (webview?.injectJavaScript) {
          webview.injectJavaScript(`
            (function() {
              const event = new KeyboardEvent('keydown', {
                key: 'Tab', code: 'Tab', keyCode: 9, which: 9,
                shiftKey: true, bubbles: true, cancelable: true
              });
              document.activeElement?.dispatchEvent(event);
            })();
            true;
          `);
        }
      } catch (e) {
        editor.lift();
      }
    },
    blur: () => editor.blur(),
    focus: () => editor.focus(),
    getHTML: () => editor.getHTML(),
    setContent: (html: string) => editor.setContent(html),
    clearPendingFocus: () => {},
    requestFocusSync: () => {
      const webview = (editor as any).webviewRef?.current;
      if (webview) {
        webview.requestFocus();
        editor.focus('end');
      }
    },
    markPendingFocus: () => {},
    scrollToCursor: () => {
      try {
        const webview = (editor as any).webviewRef?.current;
        if (webview?.injectJavaScript) {
          webview.injectJavaScript(`
            (function() {
              const selection = window.getSelection();
              if (!selection || selection.rangeCount === 0) return;
              const range = selection.getRangeAt(0);
              const element = range.startContainer.nodeType === 3
                ? range.startContainer.parentElement
                : range.startContainer;
              if (element?.scrollIntoView) {
                element.scrollIntoView({ behavior: 'auto', block: 'center' });
              }
            })();
            true;
          `);
        }
      } catch (e) {}
    },
  }));

  // Check for editor ready once
  useEffect(() => {
    if (hasCalledOnReady.current) return;

    const checkReady = async () => {
      try {
        const html = await editorRef.current.getHTML();
        if (html !== undefined && !hasCalledOnReady.current) {
          hasCalledOnReady.current = true;
          onReadyRef.current?.(html);
        }
      } catch (e) {}
    };

    const interval = setInterval(checkReady, 100);
    checkReady();

    // Stop checking after 2 seconds
    const timeout = setTimeout(() => clearInterval(interval), 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  // Handle editable changes
  useEffect(() => {
    if (prevEditable.current && !editable) {
      editorRef.current.blur();
    }
    prevEditable.current = editable;
  }, [editable]);

  // Detect tap to enter edit mode
  useEffect(() => {
    if (!onPress) return;

    const checkFocus = () => {
      try {
        const state = editorRef.current.getEditorState();
        if (state.isFocused && !editable) {
          onPress();
        }
      } catch (e) {}
    };

    const interval = setInterval(checkFocus, 100);
    return () => clearInterval(interval);
  }, [editable, onPress]);

  return (
    <View
      ref={containerRef}
      style={[
        styles.container,
        { backgroundColor: theme.colors.background.primary, minHeight }
      ]}
    >
      <RichText
        editor={editor}
        showsVerticalScrollIndicator={true}
        scrollEnabled={true}
        style={{ backgroundColor: theme.colors.background.primary, flex: 1 }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
