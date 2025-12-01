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
  const lastTap = useRef<number | null>(null);
  const wasReadOnly = useRef(!editable);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const containerRef = useRef<View>(null);
  const containerLayout = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

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

  const editor = useEditorBridge({
    autofocus: false, // Never autofocus - we manage focus manually to avoid stealing from title input
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
    // Focus editor and place cursor at given coordinates (relative to editor)
    focusAtPosition: (x: number, y: number) => {
      editor.focus();
      // Inject JavaScript to simulate a click at the coordinates to place cursor
      try {
        const webview = (editor as any).webviewRef?.current;
        if (webview && typeof webview.injectJavaScript === 'function') {
          webview.injectJavaScript(`
            (function() {
              // Get the element at the coordinates
              const element = document.elementFromPoint(${x}, ${y});
              if (!element) return;

              // Try to use caretPositionFromPoint (standard) or caretRangeFromPoint (webkit)
              let range;
              if (document.caretPositionFromPoint) {
                const pos = document.caretPositionFromPoint(${x}, ${y});
                if (pos) {
                  range = document.createRange();
                  range.setStart(pos.offsetNode, pos.offset);
                  range.collapse(true);
                }
              } else if (document.caretRangeFromPoint) {
                range = document.caretRangeFromPoint(${x}, ${y});
              }

              if (range) {
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);

                // Also update ProseMirror's selection if available
                if (window.editor?.view) {
                  const view = window.editor.view;
                  const pos = view.posAtCoords({ left: ${x}, top: ${y} });
                  if (pos) {
                    const tr = view.state.tr.setSelection(
                      view.state.selection.constructor.near(view.state.doc.resolve(pos.pos))
                    );
                    view.dispatch(tr);
                  }
                }
              }
            })();
            true;
          `);
        }
      } catch (e) {
        // Silently fail, editor is still focused
      }
    },
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

  // Track editable state transitions (don't auto-focus - let user tap where they want)
  useEffect(() => {
    if (wasReadOnly.current && editable) {
      // Don't auto-focus here - user may be focusing title input or another element
      // They can tap the editor to focus it
      wasReadOnly.current = false;
    } else if (!editable) {
      wasReadOnly.current = true;
    }
  }, [editable, editor]);

  // Track touch start position to differentiate taps from scrolls
  const handleTouchStart = (e: any) => {
    const touch = e.nativeEvent.touches?.[0] || e.nativeEvent;
    touchStartX.current = touch.pageX;
    touchStartY.current = touch.pageY;
  };

  // Handle touch events for tap detection without triggering on scroll
  const handleTouchEnd = (e: any) => {
    if (!editable) {
      const touch = e.nativeEvent.changedTouches?.[0] || e.nativeEvent;
      const endX = touch.pageX;
      const endY = touch.pageY;

      // Calculate distance moved - if significant, it was a scroll not a tap
      const SCROLL_THRESHOLD = 10; // pixels
      const deltaX = Math.abs(endX - (touchStartX.current || 0));
      const deltaY = Math.abs(endY - (touchStartY.current || 0));

      // Only trigger edit mode if it was a tap (minimal movement)
      if (deltaX < SCROLL_THRESHOLD && deltaY < SCROLL_THRESHOLD) {
        if (onPress) {
          // Calculate coordinates relative to container for cursor positioning
          const layout = containerLayout.current;
          if (layout) {
            const relativeX = endX - layout.x;
            const relativeY = endY - layout.y;
            onPress({ x: relativeX, y: relativeY });
          } else {
            onPress();
          }
        } else if (onDoublePress) {
          // Fallback to double-press behavior if onPress not provided
          handlePress();
        }
      }
    }

    // Reset touch tracking
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Capture container layout for coordinate calculations
  const handleLayout = () => {
    containerRef.current?.measureInWindow((x, y, width, height) => {
      containerLayout.current = { x, y, width, height };
    });
  };

  return (
    <View
      ref={containerRef}
      style={styles.container}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onLayout={handleLayout}
    >
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
