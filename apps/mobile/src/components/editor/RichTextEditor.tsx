import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { View, StyleSheet } from "react-native";
import {
  RichText,
  useEditorBridge,
  TenTapStartKit,
  CoreBridge,
} from "@10play/tentap-editor";
import { useTheme } from "../../shared/contexts/ThemeContext";

// Debug logging for editor content/focus issues
const DEBUG_FOCUS = false;
const DEBUG_SCROLL = true; // Set to true to log scroll events (very verbose)
const log = (msg: string, data?: any) => {
  if (DEBUG_FOCUS) {
    console.log(`[RichTextEditor] ${msg}`, data ? JSON.stringify(data) : '');
  }
};

// =============================================================================
// SHARED JS SNIPPETS FOR WEBVIEW INJECTION
// =============================================================================
// These JS code snippets are injected into the WebView. Centralizing them here
// ensures consistency across all injection points.

/**
 * JS code to reset all scroll targets to position 0.
 * Used for Content Lock (CL) enforcement.
 * MUST target all scrollable containers: window, documentElement, body, .ProseMirror, and its parent.
 */
const JS_RESET_ALL_SCROLL = `
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  var pm = document.querySelector('.ProseMirror');
  if (pm) pm.scrollTop = 0;
  if (pm && pm.parentElement) pm.parentElement.scrollTop = 0;
`;

/**
 * JS code to unlock scroll (remove CSS lock and clear flag).
 * Used when transitioning from CL to HL.
 */
const JS_UNLOCK_SCROLL = `
  window._scrollLocked = false;
  var lockStyle = document.getElementById('scroll-lock-style');
  if (lockStyle) lockStyle.remove();
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  var pm = document.querySelector('.ProseMirror');
  if (pm) pm.style.overflow = '';
  if (pm && pm.parentElement) pm.parentElement.style.overflow = '';
`;

/**
 * Remove inline color styles from HTML to ensure theme colors are used
 * This handles pasted content that may have hardcoded colors like "color: rgb(0, 0, 0)"
 */
function sanitizeHtmlColors(html: string): string {
  return html.replace(
    /style="([^"]*)"/gi,
    (match, styleContent) => {
      // Remove color and background-color properties from the style
      const cleanedStyle = styleContent
        .replace(/\bcolor\s*:\s*[^;]+;?/gi, '')
        .replace(/background-color\s*:\s*[^;]+;?/gi, '')
        .replace(/background\s*:\s*[^;]+;?/gi, '')
        .trim();

      // If style is now empty, remove the attribute entirely
      if (!cleanedStyle) {
        return '';
      }
      return `style="${cleanedStyle}"`;
    }
  );
}

/**
 * =============================================================================
 * SCROLL COORDINATION WITH ENTRYSCREEN
 * =============================================================================
 *
 * This editor works with EntryScreen's unified scroll system. Key concepts:
 *
 * CONTENT LOCK (CL): When header is NOT fully collapsed, content scroll MUST
 * stay at position 0. The header "absorbs" any scroll gestures.
 *
 * HEADER LOCK (HL): When header IS fully collapsed, content can scroll freely.
 * The header is "locked" in place and won't move.
 *
 * The scrollLocked prop controls CL:
 *   - scrollLocked=true  → CL active, content locked at 0
 *   - scrollLocked=false → CL inactive (HL reached), content can scroll
 *
 * CRITICAL IMPLEMENTATION NOTES (learned from failed simplification attempts):
 *
 * 1. SCROLL LOCK NEEDS BOTH CSS AND JS:
 *    - CSS (overflow:hidden) prevents user scroll
 *    - JS scroll event handler resets scroll to 0 if it somehow moves
 *    - Using ONLY CSS was insufficient - content could still drift
 *    - Using ONLY JS event blocking broke touch events entirely
 *
 * 2. scrollBy() MUST UNLOCK BEFORE SCROLLING:
 *    - When PanResponder crosses HL threshold and calls scrollBy(),
 *      the scroll lock CSS is still in place (React state hasn't updated)
 *    - scrollBy() must remove CSS lock IMMEDIATELY via JS injection
 *    - Otherwise: hard stop at crossover, scroll doesn't work
 *
 * 3. NATIVE scrollEnabled PROP:
 *    - scrollEnabled must ALWAYS be true so JS scroll events can fire
 *    - The JS/CSS lock handles CL enforcement, reports scroll attempts to RN
 *    - Don't use scrollEnabled={false} for CL - it blocks ALL scroll including
 *      programmatic scrollBy(), causing hard stops at transitions
 *
 * 4. MULTIPLE SCROLL TARGETS:
 *    - WebView has multiple scrollable elements: window, body, .ProseMirror
 *    - Must target ALL of them when locking/scrolling for consistency
 * =============================================================================
 */
interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  onDoublePress?: () => void;
  onPress?: (tapCoordinates?: { x: number; y: number }) => void;
  /** Called once when editor is ready with its actual (possibly normalized) content */
  onReady?: (content: string) => void;
  /** Called when scroll position changes - scrollTop is pixels from top */
  onScroll?: (scrollTop: number) => void;
  /**
   * When true, scrolling is disabled and scroll position is locked at 0.
   * This implements Content Lock (CL) - see scroll coordination notes above.
   */
  scrollLocked?: boolean;
}

export const RichTextEditor = forwardRef(({
  value,
  onChange,
  placeholder = "Start typing...",
  editable = true,
  onDoublePress,
  onPress,
  onReady,
  onScroll,
  scrollLocked = false,
}: RichTextEditorProps, ref) => {
  const theme = useTheme();
  const isLocalChange = useRef(false);
  // Initialize to null - first poll will sync to editor's normalized content
  const lastContent = useRef<string | null>(null);
  const hasCalledOnReady = useRef(false);
  const containerRef = useRef<View>(null);
  const prevEditable = useRef(editable);
  // Track if focus was requested during read-only mode (before editable transition)
  const pendingFocusRequest = useRef(false);
  // Track pending content that needs to be set once editor is ready
  const pendingContent = useRef<string | null>(null);

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
      background-color: ${theme.colors.background.primary} !important;
      color: ${theme.colors.text.primary} !important;
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
    /* Placeholder styling */
    .ProseMirror p.is-editor-empty:first-child::before {
      color: ${theme.colors.text.disabled} !important;
    }
    /* Link styling */
    a {
      color: ${theme.colors.functional.accent} !important;
    }
  `;

  // Editor is always editable internally - we control interaction via overlay
  // Sanitize initial content to remove inline color styles from pasted content
  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    initialContent: sanitizeHtmlColors(value),
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
    /**
     * Force scroll to cursor position.
     *
     * CRITICAL: Must unlock CSS scroll lock BEFORE attempting to scroll!
     * Same timing issue as scrollBy() - see that method's comment for details.
     *
     * Without immediate unlock: scrollIntoView triggers scroll event → scroll handler
     * sees lock active → resets to 0 → reports to RN → triggers another collapse
     * → scrollToCursor called again → LOOP (header flickers show/hide repeatedly)
     */
    scrollToCursor: () => {
      // Call focus first - this triggers tentap's built-in scroll handling
      editor.focus();

      // Inject JavaScript with IMMEDIATE unlock before scroll
      try {
        const webview = (editor as any).webviewRef?.current;
        if (webview && typeof webview.injectJavaScript === 'function') {
          webview.injectJavaScript(`
            (function() {
              // MUST unlock BEFORE scrolling - prevents loop with scroll handler
              ${JS_UNLOCK_SCROLL}

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
    /**
     * Scroll to top of editor content AND move cursor to start.
     * Used when user taps "reveal header" chevron - resets everything.
     */
    scrollToTop: () => {
      editor.focus('start');
    },

    /**
     * Reset scroll position to 0 WITHOUT moving cursor.
     *
     * CRITICAL: This is different from scrollToTop()!
     * - scrollToTop(): Moves cursor to start (changes user's editing position)
     * - resetScroll(): Only resets scroll view (preserves cursor position)
     *
     * Used for Content Lock (CL) enforcement:
     * - When header is absorbing scroll, content must stay at position 0
     * - But we don't want to move the user's cursor
     *
     * Must target ALL scrollable containers in WebView for reliability.
     */
    resetScroll: () => {
      try {
        const webview = (editor as any).webviewRef?.current;
        if (webview && typeof webview.injectJavaScript === 'function') {
          webview.injectJavaScript(`(function() { ${JS_RESET_ALL_SCROLL} })(); true;`);
        }
      } catch (e) {
        // Silently fail
      }
    },

    /**
     * Scroll content by a delta amount (for coordinated scroll handoff).
     *
     * Called by EntryScreen's PanResponder when gesture crosses HL threshold.
     * The gesture continues scrolling content seamlessly after header collapses.
     *
     * CRITICAL TIMING ISSUE (learned the hard way):
     * When this is called, scrollLocked React state may still be true because:
     *   1. PanResponder detects crossing HL
     *   2. Calls scrollBy() immediately
     *   3. React state update (setIsHeaderCollapsed) is async
     *   4. CSS scroll lock is still in place!
     *
     * SOLUTION: scrollBy() must IMMEDIATELY unlock via JS injection.
     * Can't wait for React state → CSS update cycle.
     *
     * If we don't do this: HARD STOP at the CL→HL transition.
     * User swipes up, header collapses, then scroll freezes until
     * React re-renders and removes the CSS lock. Very jarring.
     */
    scrollBy: (deltaY: number) => {
      try {
        const webview = (editor as any).webviewRef?.current;
        if (webview && typeof webview.injectJavaScript === 'function') {
          // MUST unlock BEFORE scrolling - see header comment for explanation
          webview.injectJavaScript(`
            (function() {
              ${JS_UNLOCK_SCROLL}
              // Now scroll - target multiple containers for reliability
              window.scrollBy(0, ${deltaY});
              document.documentElement.scrollTop += ${deltaY};
              document.body.scrollTop += ${deltaY};
              var pm = document.querySelector('.ProseMirror');
              if (pm) pm.scrollTop += ${deltaY};
              if (pm && pm.parentElement) pm.parentElement.scrollTop += ${deltaY};
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
      if (lastContent.current === null) {
        // First poll - editor is ready with its (possibly normalized) content
        lastContent.current = html;
        if (!hasCalledOnReady.current && onReady) {
          hasCalledOnReady.current = true;
          onReady(html);
        }
        return;
      }
      if (html !== lastContent.current) {
        lastContent.current = html;
        isLocalChange.current = true;
        onChange(html);
      }
    }, 300); // Poll every 300ms

    return () => {
      clearInterval(interval);
    };
  }, [editor, onChange, onReady]);

  /**
   * ==========================================================================
   * SCROLL LOCK EFFECT - Implements Content Lock (CL)
   * ==========================================================================
   *
   * When scrollLocked=true (CL active), content MUST stay at scroll position 0.
   * This is enforced via MULTIPLE mechanisms (all are necessary):
   *
   * 1. CSS: overflow:hidden on html, body, .ProseMirror
   *    - Prevents user from scrolling via touch
   *    - overscroll-behavior:none prevents micro-nudge during swipes
   *
   * 2. JS scroll event handler: Resets scroll to 0 if it somehow moves
   *    - Catches edge cases where CSS alone isn't sufficient
   *    - Uses window._scrollLocked flag for immediate control
   *
   * 3. Initial reset: Forces scroll to 0 when lock is applied
   *
   * FAILED APPROACHES (don't try these again):
   *
   * - CSS only (overflow:hidden): Content could still drift in some cases
   *
   * - touchmove.preventDefault(): Blocked PanResponder events entirely,
   *   causing touch to become unresponsive for 1-2 seconds
   *
   * - Using ONLY scrollEnabled prop: Blocked programmatic scrollBy() too,
   *   causing hard stops at CL→HL transition. Also blocked JS scroll events
   *   so we couldn't detect scroll attempts for CL enforcement.
   *
   * - Simple flag without CSS: User could still scroll content
   *
   * The combination of CSS + JS scroll handler gives the most reliable lock
   * while still allowing programmatic control AND detecting scroll attempts.
   * CRITICAL: scrollEnabled must stay TRUE so JS events fire.
   *
   * When scrollLocked=false (HL reached), we also check content height:
   * - If content fits in viewport: Keep scroll disabled (no bouncing)
   * - If content overflows: Allow normal scrolling
   * ==========================================================================
   */
  useEffect(() => {
    try {
      const webview = (editor as any).webviewRef?.current;
      if (webview && typeof webview.injectJavaScript === 'function') {
        if (scrollLocked) {
          // CL ACTIVE: Lock content at position 0
          webview.injectJavaScript(`
            (function() {
              // Define helper function for resetting scroll (called by handler and initial reset)
              // This ensures consistent behavior across all reset points
              if (!window._resetAllScroll) {
                window._resetAllScroll = function() {
                  ${JS_RESET_ALL_SCROLL}
                };
              }

              // CSS lock - prevents user scroll
              // NOTE: Do NOT use touch-action:none - it blocks taps!
              if (!document.getElementById('scroll-lock-style')) {
                const style = document.createElement('style');
                style.id = 'scroll-lock-style';
                style.textContent = 'html, body, .ProseMirror { overflow: hidden !important; overscroll-behavior: none !important; }';
                document.head.appendChild(style);
              }

              // Force scroll to 0 on all containers
              window._resetAllScroll();

              // JS lock flag - checked by scroll handler
              window._scrollLocked = true;

              // Scroll event handler - CRITICAL for cursor visibility
              // When content tries to scroll while locked, we:
              // 1. Report the scroll to RN (so EntryScreen can collapse header)
              // 2. Then reset scroll to 0
              // This allows typing to trigger header collapse when cursor goes off-screen
              if (!window._scrollLockHandler) {
                window._scrollLockHandler = function(e) {
                  console.log('[CL-DEBUG] JS scroll handler fired, locked=' + window._scrollLocked);
                  if (window._scrollLocked) {
                    // Get current scroll position before resetting
                    var scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
                    var pm = document.querySelector('.ProseMirror');
                    if (pm && pm.scrollTop > scrollTop) scrollTop = pm.scrollTop;
                    if (pm && pm.parentElement && pm.parentElement.scrollTop > scrollTop) scrollTop = pm.parentElement.scrollTop;

                    console.log('[CL-DEBUG] Scroll positions: window=' + window.scrollY + ', pm=' + (pm ? pm.scrollTop : 'null') + ', final=' + scrollTop);

                    // Report scroll attempt to RN if significant (> threshold)
                    // This triggers CL enforcement which collapses header and scrolls to cursor
                    if (scrollTop > 2) {
                      console.log('[CL-DEBUG] Posting editor-scroll to RN, scrollTop=' + scrollTop);
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'editor-scroll',
                        payload: { scrollTop: scrollTop }
                      }));
                    } else {
                      console.log('[CL-DEBUG] scrollTop <= 2, NOT posting to RN');
                    }

                    // Reset scroll to 0
                    window._resetAllScroll();
                  }
                };
                window.addEventListener('scroll', window._scrollLockHandler, { capture: true, passive: false });
              }
            })();
            true;
          `);
        } else {
          // CL INACTIVE (HL reached): Remove lock, allow scroll if content overflows
          webview.injectJavaScript(`
            (function() {
              // Remove CSS lock
              const style = document.getElementById('scroll-lock-style');
              if (style) style.remove();

              // Clear JS lock flag
              window._scrollLocked = false;

              // Smart overflow control: only allow scroll if content is taller than viewport
              // This prevents bounce/jitter when content fits on screen
              const checkOverflow = function() {
                const prosemirror = document.querySelector('.ProseMirror');
                const body = document.body;
                const contentHeight = prosemirror ? prosemirror.scrollHeight : body.scrollHeight;
                const viewportHeight = window.innerHeight;

                let overflowStyle = document.getElementById('overflow-control-style');
                if (contentHeight <= viewportHeight) {
                  // Content fits - disable scrolling to prevent bounce
                  if (!overflowStyle) {
                    overflowStyle = document.createElement('style');
                    overflowStyle.id = 'overflow-control-style';
                    document.head.appendChild(overflowStyle);
                  }
                  overflowStyle.textContent = 'html, body { overflow: hidden !important; }';
                } else {
                  // Content overflows - allow normal scrolling
                  if (overflowStyle) overflowStyle.remove();
                }
              };

              // Check immediately and on resize
              checkOverflow();
              window._overflowChecker = checkOverflow;
              window.addEventListener('resize', checkOverflow);
            })();
            true;
          `);
        }
      }
    } catch (e) {
      // Silently fail
    }
  }, [scrollLocked, editor]);

  /**
   * Backup scroll detection via injected JavaScript.
   *
   * The native onScroll prop on RichText should handle most cases, but
   * WebView scroll events can be unreliable. This JS injection adds
   * listeners to multiple scroll targets and posts messages back.
   *
   * Both native and JS scroll detection feed into the same onScroll callback.
   * EntryScreen uses this for:
   * - CL enforcement (absorbing scroll into header collapse)
   * - Momentum transfer (revealing header when content hits top with velocity)
   * - Tracking isAtTop for pull-to-reveal gesture detection
   */
  useEffect(() => {
    if (!onScroll) return;

    const injectScrollDetection = () => {
      try {
        const webview = (editor as any).webviewRef?.current;
        if (webview && typeof webview.injectJavaScript === 'function') {
          webview.injectJavaScript(`
            (function() {
              if (window._scrollListenerAdded) return;
              window._scrollListenerAdded = true;

              let lastScrollTop = 0;
              let ticking = false;

              // Try multiple scroll targets
              const scrollTargets = [window, document, document.querySelector('.ProseMirror')];

              scrollTargets.forEach((target) => {
                if (!target) return;
                target.addEventListener('scroll', function() {
                  if (!ticking) {
                    window.requestAnimationFrame(function() {
                      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
                      if (Math.abs(scrollTop - lastScrollTop) > 2) {
                        lastScrollTop = scrollTop;
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'editor-scroll',
                          payload: { scrollTop: scrollTop }
                        }));
                      }
                      ticking = false;
                    });
                    ticking = true;
                  }
                }, { passive: true, capture: true });
              });

            })();
            true;
          `);
        }
      } catch (e) {
        // Editor not ready yet - ignore
      }
    };

    // Try to inject after delay (editor needs to be ready)
    const timeout = setTimeout(injectScrollDetection, 1000);

    return () => {
      clearTimeout(timeout);
    };
  }, [editor, onScroll]);

  // Update editor when value changes externally (not from typing)
  // Uses retry logic to handle race condition when editor isn't ready yet
  useEffect(() => {
    // Sanitize incoming value to remove inline color styles
    const sanitizedValue = value ? sanitizeHtmlColors(value) : value;

    if (!isLocalChange.current && sanitizedValue && sanitizedValue !== lastContent.current) {
      // DEBUG: Log when external content update is triggered
      console.log('📝 [RichTextEditor] EXTERNAL CONTENT UPDATE', {
        isLocalChange: isLocalChange.current,
        valueLength: sanitizedValue?.length,
        lastContentLength: lastContent.current?.length,
        valueDifferent: sanitizedValue !== lastContent.current,
      });

      // Store the pending content (don't update lastContent until setContent succeeds)
      pendingContent.current = sanitizedValue;

      // Try to set content with retry logic
      const trySetContent = async (attempt: number) => {
        if (pendingContent.current === null || pendingContent.current !== sanitizedValue) {
          // Content changed while retrying, abort
          return;
        }

        try {
          editor.setContent(sanitizedValue);
          // Read back what the editor actually has after normalization
          const actualContent = await editor.getHTML();
          lastContent.current = actualContent;
          pendingContent.current = null;
          // Move cursor to start after external update (prevents jump to end)
          if (editable) {
            editor.focus('start');
          }
          log('setContent succeeded', { attempt, sentLength: sanitizedValue.length, actualLength: actualContent.length });
        } catch (e) {
          // Editor not ready, retry after delay (up to 10 attempts over ~5 seconds)
          if (attempt < 10) {
            const delay = Math.min(100 * (attempt + 1), 500);
            log('setContent failed, retrying', { attempt, delay });
            setTimeout(() => trySetContent(attempt + 1), delay);
          } else {
            console.warn('[RichTextEditor] Failed to set content after 10 attempts');
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
    const interval = setInterval(async () => {
      if (pendingContent.current !== null) {
        try {
          editor.setContent(pendingContent.current);
          // Read back the editor's normalized content
          const actualContent = await editor.getHTML();
          lastContent.current = actualContent;
          log('Interval retry succeeded', { sentLength: pendingContent.current.length, actualLength: actualContent.length });
          pendingContent.current = null;
          // Move cursor to start after external update (prevents jump to end)
          if (editable) {
            editor.focus('start');
          }
        } catch (e) {
          // Still not ready, will try again next interval
          log('Interval retry failed, will retry');
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

  // Handle messages from WebView (including scroll events from injected JS)
  const handleWebViewMessage = (event: any) => {
    try {
      const data = event.nativeEvent?.data;
      if (typeof data !== 'string') return;

      const message = JSON.parse(data);

      if (message.type === 'editor-scroll' && onScroll) {
        const scrollTop = message.payload?.scrollTop ?? 0;
        if (DEBUG_SCROLL) console.log('[RichTextEditor] 📜 JS SCROLL:', scrollTop > 0 ? 'COLLAPSE' : 'EXPAND', { scrollTop });
        onScroll(scrollTop);
      }
    } catch (e) {
      // Not a JSON message - ignore
    }
  };

  // Handle native WebView scroll events
  const handleNativeScroll = (event: any) => {
    if (!onScroll) return;
    const scrollTop = event.nativeEvent?.contentOffset?.y ?? 0;
    if (DEBUG_SCROLL) console.log('[RichTextEditor] 📜 NATIVE SCROLL:', scrollTop > 0 ? 'COLLAPSE' : 'EXPAND', { scrollTop });
    onScroll(scrollTop);
  };

  return (
    <View ref={containerRef} style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <RichText
        editor={editor}
        showsVerticalScrollIndicator={true}
        overScrollMode="never"
        // CRITICAL: Always keep scrollEnabled={true} so scroll events fire
        // The JS/CSS lock handles CL enforcement and reports scroll attempts to RN
        // Using scrollEnabled={false} blocks events at native level before JS sees them
        scrollEnabled={true}
        style={{ backgroundColor: theme.colors.background.primary }}
        onScroll={handleNativeScroll}
        // Receive custom messages from injected JS (e.g., scroll events for CL enforcement)
        onMessage={handleWebViewMessage}
        // false = our handler fires AND internal tentap handler fires (for height updates etc)
        exclusivelyUseCustomOnMessage={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
