import { useState, useRef, forwardRef, useImperativeHandle, useCallback, useEffect } from "react";
import { View, StyleSheet } from "react-native";
// Import directly to avoid RichToolbar which has missing image assets
import RichEditor from "react-native-pell-rich-editor/src/RichEditor";
import { actions } from "react-native-pell-rich-editor/src/const";
import { useTheme } from "../../shared/contexts/ThemeContext";

/**
 * PellRichTextEditor - Rich text editor using react-native-pell-rich-editor
 *
 * This editor provides native callbacks for:
 * - onChange: Content changed
 * - onHeightChange: Editor height changed
 * - onCursorPosition: Cursor moved (for scroll handling)
 *
 * Tap anywhere to edit - cursor is placed at tap position.
 * No overlay needed - editor handles taps directly.
 */

interface PellRichTextEditorProps {
  value: string;
  placeholder?: string;
  editable?: boolean;
  onPress?: () => void;
  /** Called once when editor is ready */
  onReady?: (content: string) => void;
  /** Called when content changes */
  onChange?: (html: string) => void;
  /** Called when editor height changes */
  onHeightChange?: (height: number) => void;
  /** Called when cursor position changes (scrollY within editor content) */
  onCursorPosition?: (scrollY: number) => void;
  /** Called when WebView scrolls internally */
  onScroll?: (scrollY: number) => void;
  /** Minimum height for the editor */
  minHeight?: number;
  /** When true, editor fills available space with flex: 1 and scrolls internally */
  fillHeight?: boolean;
  /** POC: When true, first line acts as title with special styling */
  titleAsFirstLine?: boolean;
  /** POC: Called when cursor enters/leaves the title line (first line) */
  onTitleFocusChange?: (isTitleFocused: boolean) => void;
}

export interface PellRichTextEditorRef {
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  toggleBulletList: () => void;
  toggleOrderedList: () => void;
  toggleTaskList: () => void;
  setHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => void;
  toggleHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => void;
  indent: () => void;
  outdent: () => void;
  blur: () => void;
  focus: () => void;
  getHTML: () => string | Promise<string>;
  setContent: (html: string) => void;
  clearPendingFocus: () => void;
  requestFocusSync: () => void;
  markPendingFocus: () => void;
  scrollToCursor: () => void;
  resetInternalScroll: () => void;
  /** POC: Get title from first line (when titleAsFirstLine is enabled) */
  getTitle: () => string;
  /** POC: Get body content without title (when titleAsFirstLine is enabled) */
  getBodyWithoutTitle: () => string;
}

export const PellRichTextEditor = forwardRef<PellRichTextEditorRef, PellRichTextEditorProps>(({
  value,
  placeholder = "Start typing...",
  editable = true,
  onPress,
  onReady,
  onChange,
  onHeightChange,
  onCursorPosition,
  onScroll,
  minHeight = 300,
  fillHeight = false,
  titleAsFirstLine = false,
  onTitleFocusChange,
}, ref) => {
  const theme = useTheme();
  const richTextRef = useRef<RichEditor>(null);
  const contentRef = useRef<string>(value);
  const hasCalledOnReady = useRef(false);
  const isInitialized = useRef(false);

  // Track content height to size container (prevents internal scrolling)
  const [contentHeight, setContentHeight] = useState(minHeight);

  // Keep callbacks in refs to avoid stale closures
  const onReadyRef = useRef(onReady);
  const onChangeRef = useRef(onChange);
  const onHeightChangeRef = useRef(onHeightChange);
  const onCursorPositionRef = useRef(onCursorPosition);
  const onScrollRef = useRef(onScroll);
  const onPressRef = useRef(onPress);
  const editableRef = useRef(editable);
  const onTitleFocusChangeRef = useRef(onTitleFocusChange);

  useEffect(() => {
    onReadyRef.current = onReady;
    onChangeRef.current = onChange;
    onHeightChangeRef.current = onHeightChange;
    onCursorPositionRef.current = onCursorPosition;
    onScrollRef.current = onScroll;
    onPressRef.current = onPress;
    editableRef.current = editable;
    onTitleFocusChangeRef.current = onTitleFocusChange;
  }, [onReady, onChange, onHeightChange, onCursorPosition, onScroll, onPress, editable, onTitleFocusChange]);

  // Custom CSS for theming
  // Note: pell editor uses div as default paragraph separator
  const customCSS = `
    @import url('${theme.typography.webFontUrl}');
    * {
      line-height: 1.5 !important;
      font-family: ${theme.typography.webFontFamily} !important;
      box-sizing: border-box;
    }
    body {
      background-color: ${theme.colors.background.primary} !important;
      color: ${theme.colors.text.primary} !important;
      font-family: ${theme.typography.webFontFamily} !important;
      padding: 8px !important;
      margin: 0 !important;
    }
    #editor {
      min-height: ${minHeight - 20}px !important;
    }
    /* Preserve newlines - divs and p tags should have spacing */
    div, p {
      min-height: 1.5em !important;
      margin: 0 !important;
      padding: 0 !important;
      color: ${theme.colors.text.primary} !important;
    }
    /* Add spacing between paragraphs */
    div + div, p + p, div + p, p + div {
      margin-top: 8px !important;
    }
    /* Preserve line breaks */
    br {
      display: block !important;
      content: "" !important;
      margin-top: 4px !important;
    }
    h1 {
      font-size: 24px !important;
      font-weight: bold !important;
      margin: 12px 0 8px 0 !important;
      color: ${theme.colors.text.primary} !important;
    }
    h2 {
      font-size: 20px !important;
      font-weight: bold !important;
      margin: 10px 0 6px 0 !important;
      color: ${theme.colors.text.primary} !important;
    }
    h3 {
      font-size: 18px !important;
      font-weight: bold !important;
      margin: 8px 0 4px 0 !important;
      color: ${theme.colors.text.primary} !important;
    }
    ul, ol {
      padding-left: 24px !important;
      margin-top: 8px !important;
      margin-bottom: 8px !important;
      color: ${theme.colors.text.primary} !important;
    }
    ul ul, ol ul, ul ol, ol ol {
      padding-left: 20px !important;
      margin-top: 4px !important;
      margin-bottom: 4px !important;
    }
    ol { list-style-type: decimal !important; }
    ol ol { list-style-type: lower-alpha !important; }
    ol ol ol { list-style-type: lower-roman !important; }
    li {
      color: ${theme.colors.text.primary} !important;
      margin-bottom: 4px !important;
    }
    /* Checkbox list: hide bullet when checkbox present (tentap format) */
    ul[data-type="taskList"] {
      list-style: none !important;
      padding-left: 0 !important;
    }
    ul[data-type="taskList"] li {
      display: flex !important;
      align-items: flex-start !important;
    }
    /* Pell checkbox format: list item with checkbox inside */
    li:has(input[type="checkbox"]) {
      list-style: none !important;
    }
    input[type="checkbox"] {
      margin-right: 8px !important;
      width: 18px !important;
      height: 18px !important;
      flex-shrink: 0 !important;
    }
    a {
      color: ${theme.colors.functional.accent} !important;
    }
    .placeholder {
      color: ${theme.colors.text.disabled} !important;
    }
  `;

  // CSS for title-as-first-line mode (POC)
  // Note: Main styling is done via JavaScript for reliability
  // This CSS is minimal backup and handles edge cases
  const titleLineCSS = titleAsFirstLine ? `
    /* Strip inline formatting from title line children */
    [data-title-line] b,
    [data-title-line] strong,
    [data-title-line] i,
    [data-title-line] em,
    [data-title-line] u {
      font-weight: inherit !important;
      font-style: normal !important;
      text-decoration: none !important;
    }
  ` : '';

  // Native onChange callback
  const handleChange = useCallback((html: string) => {
    console.log('[EDITOR] onChange fired, contentLength:', html.length);
    contentRef.current = html;
    onChangeRef.current?.(html);
  }, []);

  // Native height change callback - update container height to prevent internal scroll
  const handleHeightChange = useCallback((height: number) => {
    console.log('[EDITOR] onHeightChange:', height);
    // Add padding for comfortable editing at bottom
    const newHeight = Math.max(minHeight, height + 50);
    setContentHeight(newHeight);
    onHeightChangeRef.current?.(newHeight);
  }, [minHeight]);

  // Called when editor is initialized
  const handleEditorInitialized = useCallback(() => {
    isInitialized.current = true;

    // Inject cursor tracking and scroll tracking JavaScript
    // Let WebView scroll naturally - parent handles collapsing header
    // Note: commandDOM exists on RichEditor but isn't in TypeScript types
    (richTextRef.current as any)?.commandDOM(`
      // Cursor position tracking using Selection API
      // Reports cursor Y position relative to CONTENT top (not viewport)
      var reportCursorPosition = function() {
        try {
          var selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;

          var range = selection.getRangeAt(0);
          var rect = range.getBoundingClientRect();

          // rect.bottom is viewport-relative (bottom of cursor line)
          // Add any internal scroll offset to make it content-relative
          // Check all possible scroll containers: window, body, documentElement, and editor element
          var scrollOffset = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
          var editor = document.getElementById('editor') || document.querySelector('.pell-content') || document.querySelector('#content');
          var editorScroll = editor ? (editor.scrollTop || 0) : 0;
          var totalScroll = scrollOffset + editorScroll;
          var cursorY = rect.bottom + totalScroll;

          console.log('Cursor: rect.bottom=' + Math.round(rect.bottom) + ' winScroll=' + scrollOffset + ' editorScroll=' + editorScroll + ' => cursorY=' + Math.round(cursorY));

          // Post using OFFSET_Y type which pell editor already handles
          // This calls onCursorPosition with our better data
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'OFFSET_Y',
            data: cursorY
          }));
        } catch(e) {
          console.log('Error getting cursor position:', e);
        }
      };

      // Scroll position tracking - reports via OFFSET_Y which pell recognizes
      var lastReportedScroll = -1;
      var reportScrollPosition = function(e) {
        // Get scroll from the element that fired the event, or find the scroll container
        var scrollEl = e && e.target ? e.target : (document.querySelector('#editor') || document.querySelector('.pell') || document.body);
        var scrollY = scrollEl.scrollTop || 0;
        // Also check window scroll as fallback
        if (scrollY === 0) {
          scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        }
        // Only report if changed by more than 3px to reduce noise
        if (Math.abs(scrollY - lastReportedScroll) > 3) {
          lastReportedScroll = scrollY;
          console.log('Scroll: ' + Math.round(scrollY) + ' from ' + (scrollEl.id || scrollEl.className || scrollEl.tagName));
          // Use OFFSET_Y type which pell passes to onCursorPosition
          // We send raw scroll position - parent will use this for header collapse
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'OFFSET_Y',
            data: scrollY
          }));
        }
      };

      // Track cursor on various events
      document.addEventListener('selectionchange', reportCursorPosition);
      document.addEventListener('click', function() { setTimeout(reportCursorPosition, 50); });
      document.addEventListener('keyup', function() { setTimeout(reportCursorPosition, 50); });

      // Track scroll position - attach to all possible scroll containers
      window.addEventListener('scroll', reportScrollPosition, { passive: true });
      document.addEventListener('scroll', reportScrollPosition, { passive: true });
      // Also attach to editor element directly (main scroll container in fillHeight mode)
      var editorEl = document.querySelector('#editor') || document.querySelector('.pell');
      if (editorEl) {
        editorEl.addEventListener('scroll', reportScrollPosition, { passive: true });
        console.log('Attached scroll listener to: ' + (editorEl.id || editorEl.className));
      }
      // Also report initial scroll position
      setTimeout(function() { reportScrollPosition({}); }, 100);

      console.log('Cursor and scroll tracking initialized');
    `);
    console.log('[EDITOR] Initialized - cursor and scroll tracking');

    // POC: Title-as-first-line tracking JavaScript
    // Simpler approach: style first element, track cursor, block formatting
    // NO custom placeholder (use pell's built-in), NO MutationObserver (causes loops)
    if (titleAsFirstLine) {
      (richTextRef.current as any)?.commandDOM(`
        (function() {
          // State
          var lastTitleFocused = null;
          var isApplyingStyles = false; // Prevent recursion

          // Commands to block on title line
          var blockedCommands = ['bold', 'italic', 'underline', 'strikethrough', 'insertorderedlist', 'insertunorderedlist'];

          // Find the content container
          function getContainer() {
            return document.querySelector('.pell-content') || document.querySelector('[contenteditable="true"]');
          }

          // Get the REAL first content element (not a placeholder)
          function getFirstContentElement() {
            var container = getContainer();
            if (!container) return null;

            // Get first element child
            var first = container.firstElementChild;
            if (!first) return null;

            return first;
          }

          // Apply title styling to first element only
          function styleTitleLine() {
            if (isApplyingStyles) return;
            isApplyingStyles = true;

            try {
              var container = getContainer();
              if (!container) return;

              var first = getFirstContentElement();
              if (!first) return;

              // Mark it as title line for identification
              first.setAttribute('data-title-line', 'true');

              // Apply styles inline (more reliable than CSS)
              first.style.fontSize = '22px';
              first.style.fontWeight = '700';
              first.style.lineHeight = '1.4';
              first.style.marginBottom = '8px';
              first.style.paddingBottom = '8px';
              first.style.borderBottom = '1px solid rgba(0,0,0,0.08)';

              // Clear styles from subsequent elements
              var children = container.children;
              for (var i = 1; i < children.length; i++) {
                var child = children[i];
                if (child.getAttribute('data-title-line')) {
                  child.removeAttribute('data-title-line');
                }
                // Reset any inherited title styles
                if (child.style.fontSize === '22px') child.style.fontSize = '';
                if (child.style.fontWeight === '700') child.style.fontWeight = '';
                child.style.borderBottom = '';
                child.style.paddingBottom = '';
              }
            } finally {
              isApplyingStyles = false;
            }
          }

          // Check if cursor is in the first line
          function isCursorInTitle() {
            try {
              var sel = window.getSelection();
              if (!sel || sel.rangeCount === 0) return false;

              var node = sel.getRangeAt(0).startContainer;
              var container = getContainer();
              var first = getFirstContentElement();

              if (!container || !first) return false;

              // Walk up from cursor to find if we're in the first element
              while (node && node !== container) {
                if (node === first) return true;
                if (node.parentNode === container) {
                  // We're at a direct child level - check if it's the first
                  return node === first;
                }
                node = node.parentNode;
              }
              return false;
            } catch(e) {
              return false;
            }
          }

          // Update focus state and notify React Native
          function checkTitleFocus() {
            var inTitle = isCursorInTitle();
            if (inTitle !== lastTitleFocused) {
              lastTitleFocused = inTitle;

              // Notify React Native
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'TITLE_FOCUS',
                  data: inTitle
                }));
              }
            }
          }

          // Initial styling
          setTimeout(styleTitleLine, 50);

          // Re-style periodically (simple alternative to MutationObserver)
          // Only style on actual content changes, not continuously
          var styleDebounce = null;
          function scheduleRestyle() {
            if (styleDebounce) clearTimeout(styleDebounce);
            styleDebounce = setTimeout(styleTitleLine, 100);
          }

          // Event listeners
          document.addEventListener('selectionchange', function() {
            setTimeout(checkTitleFocus, 10);
          });

          document.addEventListener('input', function() {
            scheduleRestyle();
          });

          document.addEventListener('keydown', function(e) {
            // On Enter in title, ensure new line doesn't get title styles
            if (e.key === 'Enter' && isCursorInTitle()) {
              setTimeout(styleTitleLine, 10);
            }
          });

          // Block formatting commands on title line
          var origExec = document.execCommand.bind(document);
          document.execCommand = function(cmd, ui, val) {
            if (isCursorInTitle()) {
              var lowerCmd = cmd.toLowerCase();
              for (var i = 0; i < blockedCommands.length; i++) {
                if (lowerCmd.indexOf(blockedCommands[i]) !== -1) {
                  console.log('[TITLE] Blocked:', cmd);
                  return false;
                }
              }
            }
            return origExec(cmd, ui, val);
          };

          console.log('[TITLE] POC initialized');
        })();
      `);
      console.log('[EDITOR] Initialized - title line tracking');
    }

    if (!hasCalledOnReady.current) {
      hasCalledOnReady.current = true;
      // Small delay to ensure content is loaded
      setTimeout(() => {
        onReadyRef.current?.(contentRef.current);
      }, 100);
    }
  }, []);

  // Handle focus - this fires when user taps the editor
  // Cursor is already at tap position, so we just notify parent to enter edit mode
  const handleFocus = useCallback(() => {
    console.log('[EDITOR] onFocus fired, editable:', editableRef.current);
    // Call onPress to notify parent (enters edit mode, shows toolbar)
    // Cursor is already placed at the tap position by the editor
    if (!editableRef.current && onPressRef.current) {
      onPressRef.current();
    }
  }, []);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    toggleBold: () => richTextRef.current?.sendAction(actions.setBold, 'result'),
    toggleItalic: () => richTextRef.current?.sendAction(actions.setItalic, 'result'),
    toggleUnderline: () => richTextRef.current?.sendAction(actions.setUnderline, 'result'),
    toggleBulletList: () => richTextRef.current?.sendAction(actions.insertBulletsList, 'result'),
    toggleOrderedList: () => richTextRef.current?.sendAction(actions.insertOrderedList, 'result'),
    toggleTaskList: () => richTextRef.current?.sendAction(actions.checkboxList, 'result'),
    setHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => {
      const headingActions: Record<number, string> = {
        1: actions.heading1,
        2: actions.heading2,
        3: actions.heading3,
        4: actions.heading4,
        5: actions.heading5,
        6: actions.heading6,
      };
      richTextRef.current?.sendAction(headingActions[level], 'result');
    },
    toggleHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => {
      const headingActions: Record<number, string> = {
        1: actions.heading1,
        2: actions.heading2,
        3: actions.heading3,
        4: actions.heading4,
        5: actions.heading5,
        6: actions.heading6,
      };
      richTextRef.current?.sendAction(headingActions[level], 'result');
    },
    indent: () => richTextRef.current?.sendAction(actions.indent, 'result'),
    outdent: () => richTextRef.current?.sendAction(actions.outdent, 'result'),
    blur: () => richTextRef.current?.blurContentEditor(),
    focus: () => richTextRef.current?.focusContentEditor(),
    getHTML: () => contentRef.current,
    setContent: (html: string) => {
      contentRef.current = html;
      richTextRef.current?.setContentHTML(html);
    },
    clearPendingFocus: () => {},
    requestFocusSync: () => richTextRef.current?.focusContentEditor(),
    markPendingFocus: () => {},
    scrollToCursor: () => {
      // Pell editor handles this internally via onCursorPosition
    },
    resetInternalScroll: () => {
      // Scroll to top of WebView content
      // Used when parent wants to reveal content that may be scrolled up
      console.log('[EDITOR] resetInternalScroll called');

      // In fillHeight mode, WebView handles scrolling natively
      // Access the underlying WebView ref via pell's webviewBridge property
      const webViewRef = (richTextRef.current as any)?.webviewBridge;
      if (webViewRef?.scrollTo) {
        // Use native WebView scrollTo method
        webViewRef.scrollTo({ x: 0, y: 0, animated: false });
        console.log('[EDITOR] Reset scroll via native WebView.scrollTo');
      }

      // Also try JavaScript-based scroll reset for non-native scroll modes
      (richTextRef.current as any)?.commandDOM(`
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
        var editor = document.getElementById('editor') || document.querySelector('.pell');
        if (editor) editor.scrollTop = 0;
      `);
    },
    // POC: Extract title from first line of content
    getTitle: () => {
      const html = contentRef.current;
      if (!html) return '';

      // Parse HTML and get first block element's text content
      // First block is typically: <div>Title text</div> or <p>Title text</p>
      const firstBlockMatch = html.match(/^<(div|p|h[1-6])[^>]*>(.*?)<\/\1>/i);
      if (firstBlockMatch) {
        // Strip any HTML tags from the title content
        const titleHtml = firstBlockMatch[2];
        const titleText = titleHtml.replace(/<[^>]*>/g, '').trim();
        return titleText;
      }

      // Fallback: if no block element, take text before first newline or <br>
      const plainText = html.replace(/<[^>]*>/g, '').trim();
      const firstLine = plainText.split(/[\n\r]/)[0] || '';
      return firstLine.trim();
    },
    // POC: Get body content without the title (first line)
    getBodyWithoutTitle: () => {
      const html = contentRef.current;
      if (!html) return '';

      // Remove first block element
      const withoutFirst = html.replace(/^<(div|p|h[1-6])[^>]*>.*?<\/\1>\s*/i, '');
      return withoutFirst.trim();
    },
  }));

  // Handle cursor position for scroll - pass to parent for ScrollView coordination
  const handleCursorPosition = useCallback((scrollY: number) => {
    console.log('[EDITOR] onCursorPosition:', scrollY);
    onCursorPositionRef.current?.(scrollY);
  }, []);

  // Handle native WebView scroll events (for fillHeight mode where native scroll is enabled)
  // This captures the actual scroll position when WebView scrolls natively
  const handleNativeScroll = useCallback((event: any) => {
    const scrollY = event?.nativeEvent?.contentOffset?.y ?? 0;
    console.log('[EDITOR] Native onScroll:', Math.round(scrollY));
    // Report scroll position to parent via onCursorPosition callback
    onCursorPositionRef.current?.(scrollY);
  }, []);

  // Handle messages from WebView (including our custom SCROLL_POSITION)
  const handleMessage = useCallback((event: { type: string; data: any }) => {
    if (event.type === 'SCROLL_POSITION') {
      console.log('[EDITOR] onScroll:', event.data);
      onScrollRef.current?.(event.data);
    } else if (event.type === 'TITLE_FOCUS') {
      console.log('[EDITOR] Title focus:', event.data);
      onTitleFocusChangeRef.current?.(event.data);
    }
  }, []);

  // CSS for scrolling - depends on fillHeight mode
  // fillHeight: WebView handles scrolling natively (scrollEnabled={true})
  // !fillHeight: Container grows with content (no internal scroll)
  const scrollCSS = fillHeight ? `
    html, body {
      margin: 0 !important;
      padding: 0 !important;
    }
    .pell-content, #content {
      padding-top: 8px !important;
      padding-bottom: 100px !important;
    }
  ` : `
    html, body {
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
    }
    #editor, .pell, .content {
      height: auto !important;
      min-height: ${minHeight - 20}px !important;
    }
    .pell-content, #content {
      min-height: ${minHeight - 20}px !important;
    }
  `;

  // Container style depends on fillHeight mode
  const containerStyle = fillHeight
    ? [styles.containerFlex, { backgroundColor: theme.colors.background.primary }]
    : [styles.container, { backgroundColor: theme.colors.background.primary, height: contentHeight }];

  const editorStyle = fillHeight
    ? [styles.editorFlex, { backgroundColor: theme.colors.background.primary }]
    : [styles.editor, { backgroundColor: theme.colors.background.primary, height: contentHeight }];

  return (
    <View style={containerStyle}>
      <RichEditor
        ref={richTextRef}
        style={editorStyle}
        initialContentHTML={value}
        placeholder={placeholder}
        initialHeight={fillHeight ? undefined : minHeight}
        editorInitializedCallback={handleEditorInitialized}
        onChange={handleChange}
        onHeightChange={fillHeight ? undefined : handleHeightChange}
        onCursorPosition={handleCursorPosition}
        onMessage={handleMessage}
        onFocus={handleFocus}
        disabled={false}
        useContainer={!fillHeight}
        initialFocus={false}
        // Enable WebView scrolling in fillHeight mode - overrides pell's default scrollEnabled={false}
        // @ts-ignore - these props are passed through to WebView via {...rest}
        scrollEnabled={fillHeight}
        bounces={fillHeight}
        alwaysBounceVertical={fillHeight}
        overScrollMode="always"
        nestedScrollEnabled={fillHeight}
        // Capture native WebView scroll events (works when scrollEnabled={true})
        onScroll={fillHeight ? handleNativeScroll : undefined}
        scrollEventThrottle={16}
        editorStyle={{
          backgroundColor: theme.colors.background.primary,
          color: theme.colors.text.primary,
          placeholderColor: theme.colors.text.disabled,
          contentCSSText: customCSS + scrollCSS + titleLineCSS,
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    // Height is set dynamically based on content
    position: 'relative',
  },
  containerFlex: {
    // fillHeight mode - fill available space
    flex: 1,
  },
  editor: {
    // Height is set dynamically
  },
  editorFlex: {
    // fillHeight mode - fill container
    flex: 1,
  },
});
