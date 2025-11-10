import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { View, StyleSheet, TouchableWithoutFeedback } from "react-native";
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
    ul, ol {
      padding-left: 24px !important;
      margin-top: 4px !important;
      margin-bottom: 4px !important;
    }
    ul ul, ol ul, ul ol, ol ol {
      padding-left: 20px !important;
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
    indent: () => editor.sink(),
    outdent: () => editor.lift(),
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
