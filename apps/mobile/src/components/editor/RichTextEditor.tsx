import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { View, StyleSheet } from "react-native";
import {
  RichText,
  useEditorBridge,
  TenTapStartKit,
  CoreBridge,
} from "@10play/tentap-editor";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  onDoublePress?: () => void;
}

export const RichTextEditor = forwardRef(({
  value,
  onChange,
  placeholder = "Start typing...",
  editable = true,
  onDoublePress,
}: RichTextEditorProps, ref) => {
  const isLocalChange = useRef(false);
  const lastContent = useRef(value);
  const lastTap = useRef<number | null>(null);
  const wasReadOnly = useRef(!editable);

  const customCSS = `
    * {
      line-height: 1.4 !important;
    }
    p {
      margin: 0 !important;
      padding: 0 !important;
    }
    p + p {
      margin-top: 4px !important;
    }
    h1 {
      font-size: 24px !important;
      font-weight: bold !important;
      margin: 8px 0 4px 0 !important;
    }
    h2 {
      font-size: 20px !important;
      font-weight: bold !important;
      margin: 6px 0 4px 0 !important;
    }
    ul, ol {
      padding-left: 24px !important;
      margin-top: 4px !important;
      margin-bottom: 4px !important;
    }
    ul ul, ol ul, ul ol, ol ol {
      padding-left: 20px !important;
    }
    /* Numbered list hierarchy: 1 -> a -> i -> A -> I (5 levels) */
    ol {
      list-style-type: decimal !important;
    }
    ol ol {
      list-style-type: lower-alpha !important;
    }
    ol ol ol {
      list-style-type: lower-roman !important;
    }
    ol ol ol ol {
      list-style-type: upper-alpha !important;
    }
    ol ol ol ol ol {
      list-style-type: upper-roman !important;
    }
    /* Task list (checkbox) styling */
    ul[data-type="taskList"] {
      padding-left: 0 !important;
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
    ul[data-type="taskList"] ul[data-type="taskList"] {
      padding-left: 24px !important;
    }
    .ProseMirror {
      -webkit-text-size-adjust: 100%;
    }
  `;

  const editor = useEditorBridge({
    autofocus: editable,
    avoidIosKeyboard: true,
    initialContent: value,
    editable: editable,
    bridgeExtensions: [
      ...TenTapStartKit,
      CoreBridge.configureCSS(customCSS),
    ],
  });

  useImperativeHandle(ref, () => ({
    toggleBold: () => editor.toggleBold(),
    toggleItalic: () => editor.toggleItalic(),
    toggleUnderline: () => editor.toggleUnderline(),
    toggleBulletList: () => editor.toggleBulletList(),
    toggleOrderedList: () => editor.toggleOrderedList(),
    toggleTaskList: () => editor.toggleTaskList(),
    setHeading: (level: number) => editor.setHeading(level),
    toggleHeading: (level: number) => editor.toggleHeading(level),
    indent: () => {
      // TenTap's sink() works for all list types including task lists
      editor.sink();
    },
    outdent: () => {
      // TenTap's lift() works for all list types including task lists
      editor.lift();
    },
    blur: () => editor.blur(),
    getHTML: () => editor.getHTML(),
    setContent: (html: string) => editor.setContent(html),
    // Force scroll to cursor position
    scrollToCursor: () => {
      editor.focus();

      // Inject JavaScript to scroll the cursor into view in the webview
      try {
        const webview = (editor as any).webviewRef?.current;
        if (webview && typeof webview.injectJavaScript === 'function') {
          webview.injectJavaScript(`
            (function() {
              const selection = window.getSelection();
              if (!selection || selection.rangeCount === 0) return;

              const range = selection.getRangeAt(0);
              const element = range.startContainer.nodeType === 3
                ? range.startContainer.parentElement
                : range.startContainer;

              if (element && element.scrollIntoView) {
                element.scrollIntoView({ behavior: 'auto', block: 'center' });
              }

              // Also try ProseMirror scrollIntoView
              if (window.editor?.view) {
                window.editor.view.dispatch(
                  window.editor.view.state.tr.scrollIntoView()
                );
              }
            })();
            true;
          `);
        }
      } catch (e) {
        // Silently fail
      }
    },
  }));

  // Double-press handler for entering edit mode from read-only
  const handlePress = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300; // ms

    if (lastTap.current && (now - lastTap.current) < DOUBLE_PRESS_DELAY) {
      // Double press detected
      if (onDoublePress) {
        onDoublePress();
      }
      lastTap.current = null;
    } else {
      // Single press
      lastTap.current = now;
    }
  };

  useEffect(() => {
    // Subscribe to content changes with debouncing
    const interval = setInterval(async () => {
      const html = await editor.getHTML();
      if (html !== lastContent.current) {
        lastContent.current = html;
        isLocalChange.current = true;
        onChange(html);
      }
    }, 300); // Poll every 300ms

    return () => {
      clearInterval(interval);
    };
  }, [editor, onChange]);

  // Update editor when value changes externally (not from typing)
  useEffect(() => {
    if (!isLocalChange.current && value && value !== lastContent.current) {
      editor.setContent(value);
      lastContent.current = value;
    }
    isLocalChange.current = false;
  }, [value, editor]);

  // Focus editor when transitioning from read-only to editable
  useEffect(() => {
    if (wasReadOnly.current && editable) {
      editor.focus();
      wasReadOnly.current = false;
    } else if (!editable) {
      wasReadOnly.current = true;
    }
  }, [editable, editor]);

  // Handle touch events for double-tap detection without blocking scroll
  const handleTouchEnd = (e: any) => {
    if (!editable && onDoublePress) {
      handlePress();
    }
  };

  return (
    <View style={styles.container} onTouchEnd={handleTouchEnd}>
      <RichText
        editor={editor}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
