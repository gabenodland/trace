# Rich Text Editor Documentation

This document describes the custom TipTap/TenTap rich text editor implementation used in the Trace mobile app.

## Overview

The editor uses a **title-first document schema** where every entry has:
1. A required title (h1) as the first element
2. Body content (paragraphs, lists, etc.) following the title

This schema is enforced at the ProseMirror level, meaning the editor will not allow documents without a title.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Native App                              │
├─────────────────────────────────────────────────────────────────────┤
│  EntryScreen.tsx                                                     │
│    │                                                                 │
│    ├── formData.title ←── useCaptureFormState                        │
│    ├── formData.content                                              │
│    │                                                                 │
│    └── editorValue = combineTitleAndBody(title, content)             │
│              │                                                       │
│              ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  RichTextEditor.tsx (React Native component)                 │    │
│  │    │                                                         │    │
│  │    ├── useEditorBridge (TenTap)                              │    │
│  │    │                                                         │    │
│  │    └── <RichText> (WebView wrapper)                          │    │
│  │              │                                               │    │
│  │              ▼                                               │    │
│  │    ┌─────────────────────────────────────────────────┐      │    │
│  │    │  WebView (editor-web/build/index.html)          │      │    │
│  │    │    │                                            │      │    │
│  │    │    ├── Preact + TipTap                          │      │    │
│  │    │    │                                            │      │    │
│  │    │    ├── Custom Extensions:                       │      │    │
│  │    │    │   ├── TitleDocument (schema)               │      │    │
│  │    │    │   └── Title (node type)                    │      │    │
│  │    │    │                                            │      │    │
│  │    │    └── ProseMirror Editor                       │      │    │
│  │    └─────────────────────────────────────────────────┘      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│    onChange(html) ───► splitTitleAndBody(html)                       │
│                              │                                       │
│                              └──► updateField("title", ...)          │
│                                   updateField("content", ...)        │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `apps/mobile/editor-web/index.tsx` | WebView editor entry point |
| `apps/mobile/editor-web/vite.config.ts` | Build config (Preact, aliases) |
| `apps/mobile/editor-web/extensions/Title.ts` | Title node extension |
| `apps/mobile/editor-web/extensions/TitleDocument.ts` | Document schema |
| `apps/mobile/src/components/editor/RichTextEditor.tsx` | React Native wrapper |
| `packages/core/src/modules/editor/editorHelpers.ts` | Title parsing utilities |

## Title-First Document Schema

### TitleDocument Extension

The `TitleDocument` extension (`editor-web/extensions/TitleDocument.ts`) defines the document schema:

```typescript
export const TitleDocument = Node.create({
  name: 'doc',
  content: 'title block+',  // Exactly one title, then one or more blocks
  topNode: true,
});
```

This enforces:
- **Exactly one `title` node** as the first child
- **One or more `block` nodes** (paragraphs, lists, etc.) after

### Title Extension

The `Title` extension (`editor-web/extensions/Title.ts`) defines the title node:

```typescript
export const Title = Node.create({
  name: 'title',
  group: 'title',      // Own group (not 'block')
  content: 'inline*',  // Only inline content (text)
  marks: '',           // No marks allowed (plain text only)
  selectable: false,   // Can't select entire node
});
```

**Key behaviors:**
- **Backspace at start**: Blocked (prevents deleting title node)
- **Delete at end**: Blocked (prevents merging with body)
- **Enter key**: Moves cursor to body (doesn't create new title)
- **Arrow Up at start**: Blocked (no node above)
- **Placeholder**: Shows via `is-empty` class decoration

**Design Decision - No Marks:**
The title does not allow formatting (bold, italic, etc.) because:
1. Titles should be plain text for consistent styling
2. The title is stored separately in the database as `entry.title`
3. Allows simple text extraction without parsing marks

## Title Parsing Functions

### `splitTitleAndBody(html)`

Extracts title and body from HTML content:

```typescript
const { title, body } = splitTitleAndBody(
  '<h1 class="entry-title">My Title</h1><p>Body text</p>'
);
// title: "My Title"
// body: "<p>Body text</p>"
```

**Algorithm:**
1. Trim whitespace from HTML
2. Match `<h1 class="entry-title">...</h1>` at start
3. Fallback: Match any `<h1>` at start (legacy content)
4. Strip HTML tags from title content
5. Return remaining HTML as body

### `combineTitleAndBody(title, body)`

Combines title and body into HTML:

```typescript
const html = combineTitleAndBody("My Title", "<p>Body text</p>");
// '<h1 class="entry-title">My Title</h1><p>Body text</p>'
```

**Features:**
- Escapes HTML entities in title (`<`, `>`, `&`)
- Strips duplicate `h1.entry-title` from body (prevents duplication)
- Ensures body has at least `<p></p>` if empty

### Other Helpers

- `extractTitle(html)` - Returns just the title string
- `extractBody(html)` - Returns just the body HTML
- `hasTitleStructure(html)` - Checks if HTML starts with h1

## Bundle Optimizations

The editor WebView bundle has been optimized to reduce size:

| Optimization | Savings | Details |
|--------------|---------|---------|
| **Preact instead of React** | ~163KB (24%) | Aliased in vite.config.ts |
| **Minimal bridge kit** | N/A | Tree-shaking not effective |

**Final bundle:** 532KB / 167KB gzipped (down from 695KB / 217KB)

### Bridges Included

Only bridges needed for toolbar functionality:
- CoreBridge (essential)
- HistoryBridge (undo/redo)
- BoldBridge, ItalicBridge
- HeadingBridge (H1, H2)
- BulletListBridge, OrderedListBridge, ListItemBridge
- TaskListBridge (checkboxes)
- HardBreakBridge (line breaks)
- LinkBridge (for pasted content)

### Bridges Removed

Not used by toolbar:
- CodeBridge, BlockquoteBridge
- ColorBridge, HighlightBridge
- ImageBridge (images handled separately)
- StrikeBridge, UnderlineBridge
- PlaceholderBridge (custom implementation)
- DropCursorBridge

## CSS Styling

### Title Styling

The title is styled with the `entry-title` class:

```css
h1.entry-title {
  margin: 12px 0 12px 0;
  padding: 0 0 8px 0;
  border-bottom: 1px solid #e5e5e5;
  min-height: 1.4em;
}
```

### Placeholder

Placeholders are shown using CSS `:before` pseudo-elements:

```css
/* Title placeholder when empty */
h1.entry-title.is-empty::before {
  content: attr(data-placeholder);
  color: #9ca3af;
}

/* Body placeholder - only when truly empty */
.ProseMirror > h1.entry-title + p.is-empty:last-child::before {
  content: "What's on your mind?";
  color: #9ca3af;
}
```

The `is-empty` class is added by the Title extension's ProseMirror plugin.

### Scroll Behavior

To keep the cursor visible above the keyboard:

```css
.ProseMirror p, .ProseMirror h1, .ProseMirror h2, .ProseMirror li {
  scroll-margin-bottom: 120px;
}
```

This ensures `scrollIntoView()` leaves clearance below the cursor.

## Keeping CSS in Sync

Title CSS exists in two places:

1. **Mobile:** `RichTextEditor.tsx` - Uses React Native theme colors
2. **Web:** `editorHelpers.ts` → `getTitleCSS()` - For future web editor

When updating title styling, ensure both are kept in sync.

## Building the Editor

```bash
# From apps/mobile directory
npm run editor:build

# Output: editor-web/build/index.html (single file with inlined JS/CSS)
```

The build uses:
- Vite with `vite-plugin-singlefile` for single HTML output
- Preact aliases for smaller bundle
- Custom TipTap extensions

## Testing

Unit tests for editor helpers:

```bash
# From repo root
npm run test:run

# Tests in: packages/core/src/modules/editor/editorHelpers.test.ts
```

Tests cover:
- `splitTitleAndBody` - Various HTML inputs
- `combineTitleAndBody` - Title escaping, body stripping
- `extractTitle` / `extractBody` - Convenience functions
- `hasTitleStructure` - Schema detection
- Roundtrip tests - Split then combine preserves content

## Troubleshooting

### Title appears duplicated in editor

**Cause:** Body content already contains an `h1.entry-title` from legacy data or sync.

**Fix:** `combineTitleAndBody()` now strips duplicate titles from body before combining.

### Placeholder not showing

**Cause:** The `is-empty` class is not being added to the title node.

**Check:** Ensure the Title extension's ProseMirror plugin is included in the editor.

### Keyboard covers cursor

**Cause:** `scroll-margin-bottom` not applied or value too small.

**Fix:** Ensure CSS has `scroll-margin-bottom: 120px` on content elements.

### Editor bundle too large

Current bundle is ~530KB. Main contributors:
- ProseMirror core (~300KB) - Required for rich text
- TipTap extensions (~150KB) - Required for features
- Preact (~10KB) - Already optimized from React

Further optimization would require removing features or using a simpler editor.
