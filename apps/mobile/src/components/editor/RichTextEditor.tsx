import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { View, StyleSheet } from "react-native";
import {
  RichText,
  useEditorBridge,
  TenTapStartKit,
  CoreBridge,
} from "@10play/tentap-editor";

// Debug logging for editor focus issues
const DEBUG_FOCUS = false;
const log = (msg: string, data?: any) => {
  if (DEBUG_FOCUS) {
    console.log(`[RichTextEditor] ${msg}`, data ? JSON.stringify(data) : '');
  }
};

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  onDoublePress?: () => void;
  onPress?: (tapCoordinates?: { x: number; y: number }) => void;
}

export const RichTextEditor = forwardRef(({
  value,
  onChange,
  placeholder = "Start typing...",
  editable = true,
  onDoublePress,
  onPress,
}: RichTextEditorProps, ref) => {
  const isLocalChange = useRef(false);
  const lastContent = useRef(value);
  const containerRef = useRef<View>(null);
  const prevEditable = useRef(editable);
  // Track if focus was requested during read-only mode (before editable transition)
  const pendingFocusRequest = useRef(false);
  // Track pending content that needs to be set once editor is ready
  const pendingContent = useRef<string | null>(null);

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
    /* Nested regular lists - exclude task lists */
    ul:not([data-type="taskList"]) ul:not([data-type="taskList"]),
    ol ul:not([data-type="taskList"]),
    ul:not([data-type="taskList"]) ol,
    ol ol {
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
    /* Nested task lists - use same indent as regular bullet nested lists */
    ul[data-type="taskList"] ul[data-type="taskList"],
    li[data-type="taskItem"] ul[data-type="taskList"] {
      padding-left: 20px !important;
      margin-left: 0 !important;
    }
    .ProseMirror {
      -webkit-text-size-adjust: 100%;
    }
    /* Add space before first content element */
    .ProseMirror > *:first-child {
      margin-top: 10px !important;
    }
    .ProseMirror::before {
      content: "";
      display: block;
      height: 10px;
    }
  `;

  // Editor is always editable internally - we control interaction via overlay
  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    initialContent: value,
    editable: true, // Always editable internally
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
    setHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => editor.toggleHeading(level),
    toggleHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => editor.toggleHeading(level),
    indent: () => {
      // Simulate Tab key press for better task list support
      try {
        const webview = (editor as any).webviewRef?.current;
        if (webview && typeof webview.injectJavaScript === 'function') {
          webview.injectJavaScript(`
            (function() {
              const event = new KeyboardEvent('keydown', {
                key: 'Tab',
                code: 'Tab',
                keyCode: 9,
                which: 9,
                bubbles: true,
                cancelable: true
              });
              document.activeElement?.dispatchEvent(event);
            })();
            true;
          `);
        }
      } catch (e) {
        // Fallback to sink
        editor.sink();
      }
    },
    outdent: () => {
      // Simulate Shift+Tab key press for better task list support
      try {
        const webview = (editor as any).webviewRef?.current;
        if (webview && typeof webview.injectJavaScript === 'function') {
          webview.injectJavaScript(`
            (function() {
              const event = new KeyboardEvent('keydown', {
                key: 'Tab',
                code: 'Tab',
                keyCode: 9,
                which: 9,
                shiftKey: true,
                bubbles: true,
                cancelable: true
              });
              document.activeElement?.dispatchEvent(event);
            })();
            true;
          `);
        }
      } catch (e) {
        // Fallback to lift
        editor.lift();
      }
    },
    blur: () => editor.blur(),
    focus: () => editor.focus(),
    getHTML: () => editor.getHTML(),
    setContent: (html: string) => editor.setContent(html),
    // Clear any pending focus request (use when title gets focus instead)
    clearPendingFocus: () => {
      log('clearPendingFocus called');
      pendingFocusRequest.current = false;
    },
    // Request focus synchronously - must be called in user gesture context
    // This triggers the native WebView requestFocus which shows the keyboard
    requestFocusSync: () => {
      log('requestFocusSync called');
      const webview = (editor as any).webviewRef?.current;
      if (webview) {
        // Call requestFocus synchronously to show keyboard (iOS requirement)
        webview.requestFocus();
        // Then focus the editor content
        editor.focus('end');
      }
    },
    // Mark that focus should happen when editable becomes true
    markPendingFocus: () => {
      log('markPendingFocus called');
      pendingFocusRequest.current = true;
    },
    // Force scroll to cursor position
    scrollToCursor: () => {
      // Check if editor has focus - if not, don't scroll (avoid stealing focus from title)
      const editorState = editor.getEditorState();
      if (!editorState.isFocused) {
        log('scrollToCursor: editor not focused, skipping');
        return;
      }

      log('scrollToCursor: scrolling cursor into view');

      // Inject JavaScript to scroll the cursor into view in the webview
      try {
        const webview = (editor as any).webviewRef?.current;
        if (webview && typeof webview.injectJavaScript === 'function') {
          webview.injectJavaScript(`
            (function() {
              // Use ProseMirror's built-in scrollIntoView first
              if (window.editor?.view) {
                window.editor.view.dispatch(
                  window.editor.view.state.tr.scrollIntoView()
                );
              }

              // Also scroll the selection into view
              const selection = window.getSelection();
              if (!selection || selection.rangeCount === 0) return;

              const range = selection.getRangeAt(0);

              // Get the cursor position rect
              const rect = range.getBoundingClientRect();
              if (rect) {
                // Calculate if cursor is visible considering keyboard
                const viewportHeight = window.innerHeight;
                const cursorBottom = rect.bottom;

                // If cursor is below the middle of the viewport, scroll it up
                if (cursorBottom > viewportHeight * 0.6) {
                  const element = range.startContainer.nodeType === 3
                    ? range.startContainer.parentElement
                    : range.startContainer;

                  if (element && element.scrollIntoView) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }
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
  // Uses retry logic to handle race condition when editor isn't ready yet
  useEffect(() => {
    if (!isLocalChange.current && value && value !== lastContent.current) {
      // Store the pending content
      pendingContent.current = value;
      lastContent.current = value;

      // Try to set content with retry logic
      const trySetContent = (attempt: number) => {
        if (pendingContent.current === null || pendingContent.current !== value) {
          // Content changed while retrying, abort
          return;
        }

        try {
          editor.setContent(value);
          pendingContent.current = null;
        } catch (e) {
          // Editor not ready, retry after delay (up to 5 attempts)
          if (attempt < 5) {
            setTimeout(() => trySetContent(attempt + 1), 100 * (attempt + 1));
          } else {
            console.warn('[RichTextEditor] Failed to set content after 5 attempts');
            pendingContent.current = null;
          }
        }
      };

      trySetContent(0);
    }
    isLocalChange.current = false;
  }, [value, editor]);

  // Retry pending content when editor might be ready (check every 200ms)
  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingContent.current !== null) {
        try {
          editor.setContent(pendingContent.current);
          lastContent.current = pendingContent.current;
          pendingContent.current = null;
        } catch (e) {
          // Still not ready, will try again next interval
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [editor]);

  // Handle transition to editable UI mode
  useEffect(() => {
    log('editable useEffect', {
      prevEditable: prevEditable.current,
      editable,
      pendingFocusRequest: pendingFocusRequest.current
    });

    if (!prevEditable.current && editable) {
      // Just became editable UI mode
      // If pendingFocusRequest is set, the editor already has focus from user tap
      // Don't call editor.focus() - it would move cursor to end
      if (pendingFocusRequest.current) {
        pendingFocusRequest.current = false;
        log('Edit mode activated, editor already focused from tap');
        // Editor already has focus and cursor is at tap position - do nothing
      }
    } else if (prevEditable.current && !editable) {
      // Just became read-only - blur the editor
      log('Became read-only, blurring');
      editor.blur();
    }

    prevEditable.current = editable;
  }, [editable, editor]);

  // Subscribe to editor focus state changes
  // When user taps editor in read-only UI mode, detect it and enter edit mode
  useEffect(() => {
    // Check if editor focus changed - if focused while in read-only UI mode, trigger onPress
    const checkFocus = () => {
      const state = editor.getEditorState();
      if (state.isFocused && !editable && onPress) {
        log('Editor focused while in read-only UI mode, triggering onPress');
        // Don't blur - let the focus stay so keyboard shows
        // Cursor is already at tap position - just mark that we triggered edit mode
        pendingFocusRequest.current = true;
        onPress();
      }
    };

    // Poll for focus changes (editor state subscription)
    const interval = setInterval(checkFocus, 100);

    return () => clearInterval(interval);
  }, [editable, editor, onPress]);

  return (
    <View ref={containerRef} style={styles.container}>
      <RichText
        editor={editor}
        showsVerticalScrollIndicator={true}
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
