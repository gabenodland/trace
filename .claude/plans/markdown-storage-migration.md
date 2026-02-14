# Markdown Storage Migration Plan

**Status:** Planning
**Created:** 2026-02-12
**Author:** Claude + User

---

## Executive Summary

Migrate entry content storage from HTML to Markdown to enable:
- Native AI/MCP content generation (no conversion needed)
- Human-readable raw data
- Portable content (easy export)
- Native table support in markdown
- Smaller storage footprint

The WYSIWYG editor experience remains unchanged - users still see rich formatting.

---

## Current State

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   AI / MCP      │     │   Database      │     │   Tiptap        │
│   generates     │ ──► │   stores        │ ──► │   Editor        │
│   markdown      │     │   HTML          │     │   (HTML native) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │  ⚠️ MCP must          │  😬 Not readable     │  ✅ Works
        │  convert MD→HTML      │  Not portable        │
```

**Problems:**
1. MCP/AI generates markdown → must convert to HTML before storing
2. Tables in markdown get destroyed (no table extensions)
3. HTML is verbose, not human-readable
4. Not portable to other systems
5. Larger storage footprint

---

## Target State

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   AI / MCP      │     │   Database      │     │   Tiptap        │
│   generates     │ ──► │   stores        │ ◄─► │   Editor        │
│   markdown      │     │   MARKDOWN      │     │   (HTML native) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ✅ Native               ✅ Readable             │
        No conversion           Portable                │
                                                        │
                               ┌────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │  Conversion Layer   │
                    │  MD ↔ HTML          │
                    │  (markdown-it +     │
                    │   turndown)         │
                    └─────────────────────┘
```

---

## Supported Markdown Features

Only features the editor can handle:

| Feature | Markdown Syntax | Tiptap Extension | Priority |
|---------|-----------------|------------------|----------|
| Bold | `**text**` | Bold ✅ | P0 |
| Italic | `*text*` | Italic ✅ | P0 |
| Headings | `## H2`, `### H3` | Heading ✅ | P0 |
| Bullet list | `- item` | BulletList ✅ | P0 |
| Numbered list | `1. item` | OrderedList ✅ | P0 |
| Task list | `- [ ] todo` | TaskList ✅ | P0 |
| Links | `[text](url)` | Link ✅ | P0 |
| Hard break | `  \n` (2 spaces) | HardBreak ✅ | P0 |
| **Tables** | `\| col \| col \|` | **Need to add** | P0 |
| Paragraphs | blank line | Paragraph ✅ | P0 |

**Not supported (intentionally):**
- Code blocks (``` ```) - not in current bridges
- Blockquotes (`>`) - not in current bridges
- Images (`![](url)`) - handled separately as attachments
- Strikethrough (`~~text~~`) - not in current bridges
- Horizontal rules (`---`) - not needed

---

## Components to Modify

### Phase 1: Core Infrastructure

#### 1.1 Install Dependencies
```bash
cd apps/mobile
npm install markdown-it turndown @types/markdown-it @types/turndown
npm install turndown-plugin-gfm  # For table support
```

#### 1.2 Create Conversion Helpers
**File:** `packages/core/src/modules/editor/markdownHelpers.ts`

```typescript
import MarkdownIt from 'markdown-it';
import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';

// Configure markdown-it for our subset
const md = new MarkdownIt({
  html: false,        // Don't allow raw HTML
  breaks: true,       // Convert \n to <br>
  linkify: false,     // Don't auto-link URLs
});

// Configure turndown for our subset
const turndown = new TurndownService({
  headingStyle: 'atx',           // ## style headings
  bulletListMarker: '-',         // - for bullets
  codeBlockStyle: 'fenced',      // ``` style (if we add later)
});
turndown.use(tables);

export function markdownToHtml(markdown: string): string;
export function htmlToMarkdown(html: string): string;
export function markdownToEditorHtml(title: string, bodyMd: string): string;
export function editorHtmlToMarkdown(html: string): { title: string; body: string };
```

#### 1.3 Add Table Extensions to Editor
**File:** `apps/mobile/editor-web/index.tsx`

```typescript
// Add imports
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

// Add to extensions array
extensions: [
  // ... existing
  Table.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader,
],
```

#### 1.4 Add Table CSS
**File:** `apps/mobile/editor-web/index.html` (or via CoreBridge.configureCSS)

```css
/* Table styling */
.ProseMirror table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}
.ProseMirror th,
.ProseMirror td {
  border: 1px solid #ddd;
  padding: 8px 12px;
  text-align: left;
}
.ProseMirror th {
  background: #f5f5f5;
  font-weight: 600;
}
```

---

### Phase 2: Editor Integration

#### 2.1 Update Editor Load Path
**File:** `apps/mobile/src/components/editor/RichTextEditorV2.tsx` (or EditorWebBridge)

```typescript
// Before: pass HTML directly
const initialContent = entry.content;

// After: convert MD to HTML for editor
import { markdownToEditorHtml } from '@trace/core';
const initialContent = markdownToEditorHtml(entry.title, entry.content);
```

#### 2.2 Update Editor Save Path
**File:** Where content is saved (EntryManagementScreen or similar)

```typescript
// Before: save HTML directly
await updateEntry({ content: editorHtml });

// After: convert HTML to MD before saving
import { editorHtmlToMarkdown } from '@trace/core';
const { title, body } = editorHtmlToMarkdown(editorHtml);
await updateEntry({ title, content: body });
```

---

### Phase 3: API/Sync Layer

#### 3.1 Verify Field Usage
Check all places that read/write `entry.content`:
- [ ] `mobileEntryApi.ts` - createEntry, updateEntry
- [ ] `pullSyncOperations.ts` - sync from server
- [ ] `syncService.ts` - sync to server
- [ ] MCP server - already writes markdown ✅

#### 3.2 Update Content Display (Non-Editor)
Places that display content outside the editor:
- [ ] Entry list preview
- [ ] Search results
- [ ] Any read-only views

These may need `markdownToHtml()` for display, or display raw markdown.

---

### Phase 4: Migration

#### 4.1 Migration Strategy Options

**Option A: Lazy Migration (Recommended)**
- Convert on read: if content looks like HTML, convert to MD and save
- Gradual, no downtime
- Handles edge cases gracefully

```typescript
function getEntryContent(entry: Entry): string {
  if (isHtml(entry.content)) {
    // Legacy HTML - convert and flag for save
    return htmlToMarkdown(entry.content);
  }
  return entry.content; // Already markdown
}

function isHtml(content: string): boolean {
  return content.trim().startsWith('<');
}
```

**Option B: Batch Migration**
- One-time script to convert all entries
- Run during maintenance window
- Cleaner but riskier

**Option C: Dual Storage (Temporary)**
- Store both `content_html` and `content_md`
- Migrate over time
- Most complex

#### 4.2 Migration Script (for Option B)
```sql
-- Pseudocode - actual implementation in TypeScript
UPDATE entries
SET content = html_to_markdown(content)
WHERE content LIKE '<%';
```

---

## Implementation Order

```
Week 1: Foundation
├── [ ] 1.1 Install dependencies
├── [ ] 1.2 Create markdownHelpers.ts
├── [ ] 1.3 Write unit tests for conversion
└── [ ] 1.4 Add table extensions + CSS

Week 2: Editor Integration
├── [ ] 2.1 Update editor load (MD → HTML)
├── [ ] 2.2 Update editor save (HTML → MD)
├── [ ] Build and test editor bundle
└── [ ] Manual testing of round-trips

Week 3: Full Integration
├── [ ] 3.1 Audit all content read/write paths
├── [ ] 3.2 Update non-editor displays
├── [ ] 3.3 Update MCP to write directly (remove conversion if any)
└── [ ] End-to-end testing

Week 4: Migration
├── [ ] 4.1 Implement lazy migration
├── [ ] 4.2 Test with production data copy
├── [ ] 4.3 Deploy to production
└── [ ] Monitor for issues
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Conversion loses formatting | Medium | Unit test all supported formats; accept subset |
| Existing entries break | High | Lazy migration + isHtml() detection |
| Tables don't render | Medium | Test table extension before conversion work |
| Performance (conversion) | Low | Conversion is fast; cache if needed |
| Editor breaks | High | Test extensively; feature flag rollout |

---

## Testing Strategy

### Unit Tests
- [ ] `markdownToHtml()` - all supported syntax
- [ ] `htmlToMarkdown()` - all supported syntax
- [ ] Round-trip: MD → HTML → MD = same result
- [ ] Edge cases: empty, malformed, mixed content

### Integration Tests
- [ ] Load markdown entry → editor shows rich text
- [ ] Edit in editor → save → markdown is correct
- [ ] Tables render correctly
- [ ] Lists, bold, italic, links work

### Manual Testing
- [ ] Create entry via MCP with tables
- [ ] Edit entry in app
- [ ] Verify markdown in database
- [ ] Test all toolbar buttons still work

---

## Rollback Plan

If issues arise after deployment:

1. **Immediate:** Feature flag to disable MD conversion (fall back to HTML)
2. **Short-term:** Script to convert MD back to HTML if needed
3. **Data safety:** No data loss possible - both formats are text

---

## Open Questions

1. **Title handling:** Currently separate field. Keep as-is or include in markdown as `# Title`?
   - Recommendation: Keep separate - simpler, title already extracted

2. **Attachments/Photos:** Currently separate. No change needed.

3. **Should we expose "Markdown mode" toggle to users?**
   - Future enhancement - not in scope for this migration

4. **What about existing templates?** (`entry_content_template`)
   - Convert templates too, or keep HTML?
   - Recommendation: Convert to markdown

---

## Success Criteria

- [ ] All new entries stored as markdown
- [ ] All existing entries readable (lazy migration)
- [ ] Editor UX unchanged (still WYSIWYG)
- [ ] Tables render correctly from AI-generated markdown
- [ ] MCP can write markdown directly
- [ ] No data loss during migration
- [ ] Tests pass for all conversion cases
