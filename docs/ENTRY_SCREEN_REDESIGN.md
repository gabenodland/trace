# Entry Screen Redesign

## Overview

This document captures learnings from the prototype branch `prototype/entry-screen-pell-poc` and outlines the implementation plan for the entry screen redesign.

## Goals

1. **Title as first line of content** - Eliminate separate title input, title is the first line of the rich text editor
2. **Collapsible header/drawer** - Hide metadata when focused on writing, reveal with pull gesture
3. **Combined attribute picker** - Single sheet for status, type, due date, rating, priority (not location/photos)
4. **Better attribute visibility** - See key attributes at a glance even when collapsed

---

## Prototype Learnings

### Pell Editor vs 10tap

We tested `react-native-pell-rich-editor` as an alternative to `@10play/tentap-editor`.

| Aspect | Pell | 10tap (TipTap) |
|--------|------|----------------|
| **Architecture** | WebView + contenteditable | WebView + TipTap/ProseMirror |
| **Title-as-first-line** | Required JavaScript injection | Native node/extension support |
| **Cursor tracking** | Manual via `document.execCommand` override | `editor.$pos()` API |
| **Content structure** | Raw HTML string | JSON document model |
| **Formatting control** | Intercept `execCommand` | `editor.can().toggleBold()` |
| **Stability** | Fragile (caused app freezes) | More robust |

**Decision: Use 10tap** - TipTap was designed for structured documents. Title-as-first-line can be implemented as a custom TipTap extension without JavaScript injection hacks.

### Collapsible Header Implementation

The prototype's collapsible header worked well:

```
┌─────────────────────────────────┐
│ Minimal Header (collapsed)      │  ← Back, chevron, menu only
├─────────────────────────────────┤
│ Editor fills screen             │
│                                 │
│ Pull down at top to expand →    │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Full Header                     │  ← Back, date/time, save indicator
├─────────────────────────────────┤
│ Drawer (metadata)               │  ← Stream, pills, photos, title
├─────────────────────────────────┤
│ Editor                          │
└─────────────────────────────────┘
```

**Key implementation details:**
- `PanResponder` for pull-to-reveal gesture (60px threshold)
- `Animated.timing` for smooth height transitions (200ms)
- `isReadyForDrawer` ref tracks when at scroll top
- Cooldown after expand to prevent immediate re-collapse from layout scroll

**Keep this pattern** - Works well, just needs cleanup.

### Title-as-First-Line Challenges

#### The Core Problem: Backspace Converts H1 to Paragraph

When using a regular `heading` node for the title, pressing backspace at the start of an empty title **converts it to a paragraph**. This is because:

1. ProseMirror/TipTap treats all `heading` nodes identically
2. Default backspace behavior: empty heading → paragraph
3. No schema enforcement that "first node MUST be heading"

```
User types title, deletes all text, presses backspace:
BEFORE: <h1>|</h1><p>body...</p>
AFTER:  <p>|</p><p>body...</p>  ← Title h1 is GONE!
```

#### Why This Happens: Schema Normalization

ProseMirror's default Document schema is `content: 'block+'` - meaning "one or more block nodes". There's no rule saying the first block must be a heading. When you backspace an empty heading, it's valid to convert it to paragraph.

---

#### Solution 1: JavaScript Injection (Current Approach - Imperfect)

The current [TitleBridge.ts](../apps/mobile/src/components/editor/extensions/TitleBridge.ts) uses JS injection to block backspace:

```typescript
// Block backspace at start of title
if (e.key === 'Backspace' && $from.parentOffset === 0) {
  if (!selection.empty) return; // Allow if text selected
  e.preventDefault();
  return;
}
```

**Problems with this approach:**
- Race condition: JS might not inject before user types
- Doesn't prevent programmatic changes
- Schema still allows h1 → p conversion via other means
- Placeholder CSS relies on `:first-child` which can break

---

#### Solution 2: Custom Title Node + TitleDocument (Proper Fix)

The correct solution is to create a **separate Title node type** with a **custom Document schema** that enforces it.

**Key insight from [TipTap discussions](https://dev.to/gles/claude-code-stuck-on-tiptap-v3-title-placeholder-how-i-fixed-it-with-custom-title-node-27ni):**
> "Using `heading` for both title and body creates schema ambiguity. Create a dedicated Title node with its own `group: 'title'` and use `TitleDocument` with `content: 'title block+'`."

**Step 1: Create Title Node Extension**

```typescript
// Title.ts - Custom TipTap extension
import { Heading } from '@tiptap/extension-heading';

export const Title = Heading.extend({
  name: 'title',        // Different from 'heading'
  group: 'title',       // Own group, not 'block'

  // Only parse first-child h1 as title
  parseHTML() {
    return [{ tag: 'h1:first-child' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['h1', { ...HTMLAttributes, class: 'entry-title' }, 0];
  },

  // Prevent backspace from deleting/converting the title
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { $from, empty } = editor.state.selection;

        // Only intercept if in title node at position 0
        if ($from.parent.type.name === 'title' && $from.parentOffset === 0) {
          if (empty) {
            return true; // Block backspace, don't delete node
          }
        }
        return false; // Let default behavior handle
      },

      // Enter in title: move to body, don't create new title
      Enter: ({ editor }) => {
        const { $from } = editor.state.selection;

        if ($from.parent.type.name === 'title') {
          const titleEnd = $from.end();

          // Insert paragraph after title if none exists
          if (editor.state.doc.childCount === 1) {
            editor.chain()
              .insertContentAt(titleEnd + 1, { type: 'paragraph' })
              .setTextSelection(titleEnd + 2)
              .run();
          } else {
            editor.commands.setTextSelection(titleEnd + 2);
          }
          return true;
        }
        return false;
      },
    };
  },
}).configure({
  levels: [1], // Only h1
});
```

**Step 2: Create TitleDocument Extension**

```typescript
// TitleDocument.ts - Enforces title-first structure
import { Document } from '@tiptap/extension-document';

export const TitleDocument = Document.extend({
  // CRITICAL: This enforces "title first, then blocks"
  content: 'title block+',
});
```

**Step 3: Wire into 10tap**

**Problem:** 10tap uses a pre-bundled TipTap editor. Custom extensions require bundling your own web editor.

**Option A: Use CoreBridge.extendExtension (Partial)**

```typescript
// This enforces heading-first but doesn't create separate Title type
const editor = useEditorBridge({
  bridgeExtensions: [
    ...TenTapStartKit,
    CoreBridge.extendExtension({
      content: 'heading block+',  // First node must be heading
    }),
  ],
});
```

**Limitation:** Still uses `heading` type, so schema treats all h1s identically.

**Option B: Bundle Custom Web Editor (Full Solution)**

Per [10tap docs](https://10play.github.io/10tap-editor/docs/mainConcepts):
> "In case you want to add your own tiptap extension / build your own bridgeExtension you will have to bundle the web editor by your own."

1. Clone 10tap's web editor source
2. Add Title + TitleDocument extensions
3. Build custom bundle
4. Create TitleBridge to communicate with RN side

```typescript
// TitleBridge.ts - BridgeExtension for custom Title node
import { BridgeExtension } from '@10play/tentap-editor';
import { Title } from './Title';
import { TitleDocument } from './TitleDocument';

export const TitleBridge = new BridgeExtension({
  tiptapExtension: Title,
  // Also need to swap Document extension
});

// In RichTextEditor:
const editor = useEditorBridge({
  bridgeExtensions: [
    TitleDocument,  // Must replace default Document
    TitleBridge,
    ...TenTapStartKit.filter(ext => ext.name !== 'document'),
  ],
});
```

---

#### Solution 3: Hybrid Approach (Recommended for Now)

Until we bundle a custom web editor, improve the JS injection approach:

**Enhanced keyboard handler:**

```typescript
export function getTitleKeyboardJS(): string {
  return `
    (function() {
      if (window.__titleKeyboardSetup) return;
      window.__titleKeyboardSetup = true;

      const editor = window.editor;
      if (!editor) {
        // Retry if editor not ready
        setTimeout(() => {
          window.__titleKeyboardSetup = false;
          eval(arguments.callee.toString())();
        }, 100);
        return;
      }

      // Override the document content rule via transaction filter
      editor.on('transaction', ({ transaction }) => {
        const firstNode = editor.state.doc.firstChild;

        // If first node is NOT h1, something went wrong - restore it
        if (firstNode && firstNode.type.name !== 'heading') {
          console.warn('[Title] First node converted to', firstNode.type.name);
          // Could dispatch correction here
        }
      });

      document.addEventListener('keydown', function(e) {
        const selection = editor.state.selection;
        const $from = selection.$from;
        const firstNode = editor.state.doc.firstChild;

        const isInTitle = firstNode &&
          $from.depth === 1 &&
          $from.parent === firstNode &&
          firstNode.type.name === 'heading';

        if (!isInTitle) return;

        // BACKSPACE at start: Block completely
        if (e.key === 'Backspace') {
          if ($from.parentOffset === 0 && selection.empty) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
          // If title would become empty, block
          if (firstNode.textContent.length === 1 && selection.empty) {
            // Let it delete the char, but title h1 stays
          }
        }

        // DELETE key: Block if it would merge with next node
        if (e.key === 'Delete') {
          const atEnd = $from.parentOffset === firstNode.content.size;
          if (atEnd && selection.empty) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        }

        // ENTER: Move to body, never create second h1
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const afterTitle = firstNode.nodeSize;

          if (editor.state.doc.childCount > 1) {
            editor.commands.setTextSelection(afterTitle + 1);
          } else {
            editor.chain()
              .insertContentAt(afterTitle, { type: 'paragraph' })
              .setTextSelection(afterTitle + 1)
              .run();
          }
          return false;
        }
      }, true); // Capture phase

      console.log('[TitleBridge] Enhanced keyboard handlers installed');
    })();
    true;
  `;
}
```

**Add transaction monitoring to detect/fix conversions:**

```typescript
// Monitor for title loss and restore
editor.on('transaction', ({ transaction, editor }) => {
  const firstNode = editor.state.doc.firstChild;

  if (!firstNode || firstNode.type.name !== 'heading' || firstNode.attrs.level !== 1) {
    // Title was lost! Restore it
    editor.chain()
      .setNode('heading', { level: 1 })
      .run();
  }
});
```

---

#### Summary: Title Persistence Approaches

| Approach | Effort | Reliability | Notes |
|----------|--------|-------------|-------|
| JS injection (current) | Low | Medium | Can still break via paste, undo |
| CoreBridge.extendExtension | Low | Medium | Enforces heading-first but same type |
| Custom Title node + bundle | High | High | Proper solution, requires build setup |
| Hybrid (enhanced JS + monitoring) | Medium | Medium-High | Best ROI for now |

**References:**
- [TipTap Title Node article](https://dev.to/gles/claude-code-stuck-on-tiptap-v3-title-placeholder-how-i-fixed-it-with-custom-title-node-27ni)
- [Prevent node deletion discussion](https://github.com/ueberdosis/tiptap/discussions/3029)
- [TipTap Keyboard Shortcuts](https://tiptap.dev/docs/editor/core-concepts/keyboard-shortcuts)
- [10tap Custom Extensions](https://10play.github.io/10tap-editor/docs/mainConcepts)
- [10tap Configure Extensions](https://10play.github.io/10tap-editor/docs/examples/configureExtensions)

### Combined Attribute Picker

The `AttributeGridSheet` prototype was functional but had UX issues:
- Too many options visible at once
- No visual hierarchy
- Lost "at a glance" visibility from original MetadataBar

**Refined approach:**
- Keep individual pickers for complex attributes (location, stream, photos)
- Combine only "simple" attributes: status, type, due date, rating, priority
- Show icon summaries in collapsed header for quick scanning
- Grid layout with clear sections

### Metadata Visibility Problem

Original `MetadataBar` showed all attributes at once. Pills hide some behind scroll.

**Solution: Icon strip in collapsed header**
```
┌─────────────────────────────────────────┐
│ ← │ 📁 │ 📍 │ ✓ │ ⭐4 │ 🚩 │ ▼ │ ⋮ │
└─────────────────────────────────────────┘
      │    │    │    │     │
      │    │    │    │     └─ Priority indicator (colored)
      │    │    │    └─ Rating (if set)
      │    │    └─ Status checkmark (if complete)
      │    └─ Location pin (if set)
      └─ Stream color dot

Tap any icon → opens relevant picker
Tap chevron → expands full drawer
```

---

## Implementation Plan

### Phase 1: Title-as-First-Line in 10tap

1. Create `TitleNode` TipTap extension
   - Custom node type that must be first in document
   - Larger font, bold, no formatting allowed
   - Can't be deleted (only content can be cleared)
   - Separated from body by visual divider

2. Update `RichTextEditor` wrapper
   - `getTitle()` - Extract title from first node
   - `getBodyWithoutTitle()` - Get content without title
   - `onTitleFocusChange` callback
   - Block toolbar actions when cursor in title

3. Update `EntryScreen`
   - Remove separate title `TextInput`
   - Initialize editor with title as first line
   - Extract title on save

### Phase 2: Collapsible Header/Drawer

#### Desired Behavior (Scroll-Linked Header)

```
SCROLL UP (content going up):
┌─────────────────────────────────┐
│ Header collapses/hides          │ ← Animates to minimal height
├─────────────────────────────────┤
│ Line 5...                       │ ← Content scrolls normally
│ Line 6...                       │
│ Line 7...                       │
└─────────────────────────────────┘

SCROLL DOWN (content going down):
When scrollY approaches 0 (title becoming visible):
┌─────────────────────────────────┐
│ ← [collapsed header]            │
├─────────────────────────────────┤
│ Title (line 1)                  │ ← ELASTIC STOP HERE
│ Line 2...                       │   (overscroll resistance)
│ Line 3...                       │
└─────────────────────────────────┘

KEEP PULLING DOWN (finger still on screen):
┌─────────────────────────────────┐
│ Full Header (expanding)    ↓↓↓  │ ← Header animates down
├─────────────────────────────────┤
│ Metadata drawer                 │ ← Reveals as you pull
├─────────────────────────────────┤
│ Title (line 1)                  │
│ Line 2...                       │
└─────────────────────────────────┘
```

#### Technical Implementation with 10tap

**Challenge:** 10tap's `RichText` is a WebView. We need to:
1. Get scroll position FROM the WebView
2. Coordinate native gesture handling WITH WebView scrolling
3. Handle overscroll/elastic behavior

**Solution: Inject scroll listener + onMessage bridge**

```typescript
// 1. Inject scroll tracking into WebView
const scrollTrackingJS = `
  (function() {
    if (window.__scrollTrackerInstalled) return;
    window.__scrollTrackerInstalled = true;

    let lastScrollY = 0;
    let ticking = false;

    const proseMirror = document.querySelector('.ProseMirror');
    if (!proseMirror) return;

    proseMirror.addEventListener('scroll', function(e) {
      if (!ticking) {
        requestAnimationFrame(function() {
          const scrollY = proseMirror.scrollTop;
          const scrollHeight = proseMirror.scrollHeight;
          const clientHeight = proseMirror.clientHeight;
          const atTop = scrollY <= 0;
          const direction = scrollY > lastScrollY ? 'up' : 'down';

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'scroll',
            payload: {
              scrollY,
              scrollHeight,
              clientHeight,
              atTop,
              direction,
              velocity: Math.abs(scrollY - lastScrollY)
            }
          }));

          lastScrollY = scrollY;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    // Also track touchstart/touchend for gesture state
    proseMirror.addEventListener('touchstart', function(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'touchState',
        payload: { touching: true }
      }));
    }, { passive: true });

    proseMirror.addEventListener('touchend', function(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'touchState',
        payload: { touching: false }
      }));
    }, { passive: true });
  })();
  true;
`;

// 2. Handle messages in RichText onMessage prop
<RichText
  editor={editor}
  onMessage={(event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'scroll') {
        handleEditorScroll(data.payload);
      } else if (data.type === 'touchState') {
        isTouching.current = data.payload.touching;
      }
    } catch (e) {
      // Not our message, ignore
    }
  }}
/>

// 3. Scroll handler with header collapse logic
const handleEditorScroll = useCallback((scrollData) => {
  const { scrollY, atTop, direction, velocity } = scrollData;

  // Collapse header when scrolling up (content going up)
  if (direction === 'up' && scrollY > COLLAPSE_THRESHOLD && !headerCollapsed) {
    collapseHeader();
  }

  // Track when we're at top for pull-to-reveal
  isAtScrollTop.current = atTop;

  // If at top and user is pulling down (overscroll), start header reveal
  if (atTop && direction === 'down' && isTouching.current) {
    // Calculate pull distance from touch gesture
    // This triggers the "elastic stop" feel
    startHeaderReveal();
  }
}, [headerCollapsed]);
```

**Key States:**
- `headerCollapsed: boolean` - Whether header is in minimal state
- `isAtScrollTop: ref` - Whether WebView scroll is at position 0
- `isTouching: ref` - Whether user's finger is on screen
- `pullDistance: Animated.Value` - How far user has pulled past scroll top

**The "Elastic Stop" Effect:**

When `scrollY === 0` and user keeps pulling down:
1. WebView can't scroll further (at top)
2. We detect continued downward gesture via touch events
3. Apply resistance: `headerReveal = pullDistance * 0.5` (50% resistance)
4. When `pullDistance > THRESHOLD` (60px), snap header open
5. If released before threshold, snap back closed

```typescript
// Elastic resistance calculation
const getHeaderRevealAmount = (pullDistance: number) => {
  if (pullDistance <= 0) return 0;
  // Diminishing returns - feels "elastic"
  return Math.min(pullDistance * 0.5, HEADER_MAX_HEIGHT);
};

// Snap decision on release
const onTouchEnd = () => {
  if (pullDistance.current > SNAP_THRESHOLD) {
    expandHeader(); // Animate to full height
  } else {
    collapseHeader(); // Snap back
  }
};
```

#### Alternative: PanResponder Overlay

If WebView scroll events are unreliable, use a transparent `PanResponder` overlay:

```typescript
// Overlay that captures gestures when at scroll top
<View
  style={[StyleSheet.absoluteFill, { zIndex: isAtScrollTop ? 1 : -1 }]}
  {...panResponder.panHandlers}
/>
```

This intercepts touch when we know WebView is at scroll top, giving native control of the pull gesture.

#### Implementation Steps

1. Port working code from prototype:
   - `headerCollapsed` state
   - `headerAnimValue` for animations
   - `PanResponder` for pull-to-reveal
   - Collapse on scroll down, expand on pull at top

2. Add WebView scroll bridge:
   - Inject scroll tracking JS on editor ready
   - Handle `onMessage` for scroll/touch events
   - Sync `isAtScrollTop` state with WebView

3. Clean up:
   - Remove debug overlay and refs
   - Remove console.log statements
   - Extract collapsed header to component

4. Add icon strip to collapsed header:
   - Stream color indicator
   - Location pin (if set)
   - Status indicator
   - Rating display
   - Priority flag

#### References
- [10tap RichText accepts WebView props](https://github.com/10play/10tap-editor)
- [react-native-webview onMessage pattern](https://github.com/react-native-webview/react-native-webview/issues/374)
- [Scroll tracking with injectedJavaScript](https://github.com/facebook/react-native/issues/1961)

### Phase 3: Combined Attribute Picker

1. Create `SimpleAttributeSheet` component:
   - Status (row of buttons: None, In Progress, Done)
   - Type (row of buttons: Note, Task, Event)
   - Due Date (inline date picker or "Set" button)
   - Rating (5-star row)
   - Priority (None/Low/Medium/High buttons)

2. Trigger from:
   - Menu button in header
   - Tapping attribute icons in collapsed header
   - "More" action in expanded drawer

3. Keep separate:
   - Stream picker (has search, hierarchy)
   - Location picker (has map, search)
   - Photo gallery (has camera, gallery)

### Phase 4: Polish

1. Animations and transitions
2. Keyboard handling with new layout
3. Auto-scroll to cursor
4. Test on iOS and Android
5. Performance optimization

---

## Files to Modify

### Core Changes
- `apps/mobile/src/components/editor/RichTextEditor.tsx` - Add title support
- `apps/mobile/src/modules/entries/components/EntryScreen.tsx` - Collapsible header, remove title input

### New Components
- `apps/mobile/src/components/editor/extensions/TitleNode.ts` - TipTap extension
- `apps/mobile/src/modules/entries/components/CollapsedHeader.tsx` - Icon strip header
- `apps/mobile/src/modules/entries/components/SimpleAttributeSheet.tsx` - Combined picker

### Reference (prototype branch)
- `prototype/entry-screen-pell-poc` branch has working collapsible header code
- `PanResponder` implementation can be ported directly
- Animation values and timing are tuned

---

## Technical Notes

### TipTap Title Extension Skeleton

```typescript
import { Node, mergeAttributes } from '@tiptap/core';

export const TitleNode = Node.create({
  name: 'title',
  group: 'block',
  content: 'inline*',

  parseHTML() {
    return [{ tag: 'h1[data-type="title"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['h1', mergeAttributes(HTMLAttributes, { 'data-type': 'title' }), 0];
  },

  addKeyboardShortcuts() {
    return {
      // Prevent deleting the title node
      Backspace: ({ editor }) => {
        const { $from } = editor.state.selection;
        if ($from.parent.type.name === 'title' && $from.parentOffset === 0) {
          return true; // Block backspace at start of title
        }
        return false;
      },
    };
  },
});
```

### Collapsible Header Animation Values

```typescript
// From prototype - these values are tuned
const PULL_THRESHOLD = 60; // Pixels to pull before expanding
const EXPAND_COOLDOWN_MS = 300; // Prevent re-collapse after expand
const ANIMATION_DURATION = 200; // Smooth but snappy

const headerAnimValue = useRef(new Animated.Value(1)).current;

// Collapse
Animated.timing(headerAnimValue, {
  toValue: 0,
  duration: ANIMATION_DURATION,
  useNativeDriver: false, // Can't use native for height
}).start();

// Expand
Animated.timing(headerAnimValue, {
  toValue: 1,
  duration: ANIMATION_DURATION,
  useNativeDriver: false,
}).start();
```

### Eliminating setInterval Polling (Performance Fix)

**Problem:** Current `RichTextEditor.tsx` uses `setInterval` at 300ms to poll for content changes. This is inefficient - it runs constantly whether content changed or not, and adds latency to change detection.

**Solution:** Use 10tap's built-in event-driven APIs instead.

#### Option 1: `useEditorContent` Hook (Recommended)

The `useEditorContent` hook monitors changes and retrieves content with built-in debouncing:

```typescript
import { useEditorBridge, useEditorContent, RichText } from "@10play/tentap-editor";

function RichTextEditor({ onChange, onTitleChange }) {
  const editor = useEditorBridge({
    initialContent: "...",
    bridgeExtensions: [...TenTapStartKit, CoreBridge.configureCSS(customCSS)],
  });

  // Get content with 300ms debounce (fires only when content actually changes)
  const content = useEditorContent(editor, {
    type: 'html',
    debounceInterval: 300
  });

  // React to content changes
  useEffect(() => {
    if (content) {
      onChange(content);
    }
  }, [content, onChange]);

  return <RichText editor={editor} />;
}
```

**Why this is better:**
- Only fires when content actually changes (not on a timer)
- Built-in debouncing reduces webview<->native traffic
- No cleanup needed (hook handles it)
- `debounceInterval` is configurable (default 10ms, we use 300ms)

#### Option 2: `onChange` Callback

For more control, use the `onChange` param in `useEditorBridge`:

```typescript
const editor = useEditorBridge({
  initialContent: "...",
  onChange: async () => {
    // Called on every keystroke - debounce before getting content
    debouncedContentFetch();
  },
  bridgeExtensions: [...],
});

// Debounced function to get content
const debouncedContentFetch = useMemo(
  () => debounce(async () => {
    const html = await editor.getHTML();
    onChange(html);
  }, 300),
  [editor, onChange]
);
```

#### For Title Mode: Combine Both

When using `titleMode`, we need both content and title tracking:

```typescript
// Content changes (body)
const content = useEditorContent(editor, { type: 'html', debounceInterval: 300 });

// Title requires editor state polling (10tap doesn't expose title-specific events)
// BUT we can use onChange to trigger title check instead of setInterval
const editor = useEditorBridge({
  onChange: () => {
    // Check title state when any change happens
    const state = editor.getEditorState() as any;
    if (state.titleText !== lastTitle.current) {
      lastTitle.current = state.titleText;
      onTitleChange?.(state.titleText);
    }
  },
  // ...
});
```

#### Migration Steps

1. Replace content polling `setInterval` with `useEditorContent` hook
2. Replace focus polling `setInterval` with `onChange` callback
3. Keep only necessary state checks inside `onChange` (title, focus)
4. Remove all `clearInterval` cleanup code

**References:**
- [useEditorContent API](https://10play.github.io/10tap-editor/docs/api/useEditorContent)
- [useEditorBridge API](https://10play.github.io/10tap-editor/docs/api/useEditorBridge)
- [10tap GitHub](https://github.com/10play/10tap-editor)

---

## Success Criteria

1. **Title in content**: First line of editor IS the title, styled distinctly
2. **Quick entry**: Can start typing immediately, title flows into body
3. **Attributes accessible**: All attributes reachable within 2 taps
4. **At-a-glance status**: Key attributes visible in collapsed header icons
5. **Smooth animations**: No jank on collapse/expand
6. **No regressions**: Autosave, photos, location all still work
