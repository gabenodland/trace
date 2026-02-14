// Documentation tool for MCP
// Returns comprehensive instructions on how to use Trace

import type { ToolContext } from "./mod";

/**
 * Trace Documentation
 */
const TRACE_DOCS = `# Trace - Personal Knowledge & Journal App

## Overview
Trace is a personal knowledge management and journaling app. It helps users capture thoughts, notes, tasks, and memories with rich text, photos, and location data.

## Organization Structure

### Streams (Collections/Notebooks)
Streams are the top-level organizational unit - think of them as notebooks or collections.

- Each stream has a **name**, **color**, **icon**, and **description**
- Streams contain entries (notes/journal entries)
- Users can have multiple streams for different purposes (e.g., "Work Notes", "Personal Journal", "Recipe Ideas")
- **Inbox**: Entries without a stream_id are in the "Inbox" - a default catch-all location

### Entries (Notes/Journal Entries)
Entries are individual pieces of content within streams.

- Each entry has a **title** (optional) and **content** (rich text/markdown)
- Entries belong to one stream (or Inbox if no stream assigned)
- Entries can have attachments (photos/images)
- Entries are dated with **entry_date** (the date the entry is about, not necessarily when it was created)

## Entry Attributes

### Core Fields
- **title**: Optional headline for the entry
- **content**: Main body text (stored as HTML internally, returned as Markdown via MCP)
- **entry_date**: The date this entry represents (YYYY-MM-DD format)
- **stream_id**: Which stream this entry belongs to (null = Inbox)

### Tags
- Free-form text labels attached to entries
- An entry can have multiple tags
- Tags are stored as an array of strings
- Useful for cross-stream categorization and filtering
- Example: ["meeting", "project-alpha", "action-items"]

### Status
- Workflow state of the entry
- Common values: "draft", "published", "review"
- Stream-configurable (each stream can define its own status options)

### Priority
Numeric priority level (0-4):
- 0 = None (default)
- 1 = Low
- 2 = Medium
- 3 = High
- 4 = Urgent

### Rating
Rating value with stream-configurable format:
- **Star-based ("stars")**: Display 0-5, internally stored as 0-10
- **Numeric ("numeric")**: Display and storage both 0-10

**Rating Storage Model:**
- Internally, all ratings are stored on a 0-10 scale
- For star-based streams, values are converted: display 3 stars = stored as 6
- MCP automatically handles this conversion:
  - **Reading**: Returns \`rating\` (display value), \`rating_max\`, \`rating_type\`, and \`rating_raw\` (internal storage)
  - **Writing**: Accept display values (0-5 for stars, 0-10 for numeric) - they are converted automatically
- Check \`stream_context.rating_max\` in entry responses for valid range

### Type
- Entry classification/category
- Examples: "Bug", "Feature", "Note", "Task", "Idea"
- Stream-configurable (each stream can define its own type options)

### Dates
- **entry_date**: The date the entry is about
- **due_date**: Optional deadline (for task-like entries)
- **created_at**: When the entry was created (auto-set)
- **updated_at**: When the entry was last modified (auto-set)

### Flags
- **is_pinned**: Pin important entries to the top
- **is_archived**: Hide completed/old entries without deleting

### Location
- **entry_latitude/entry_longitude**: GPS coordinates
- **place_name**: Human-readable location name
- **city/country**: Geographic context

## Stream Settings

**IMPORTANT:** Each stream controls which attributes are enabled. You MUST call **get_stream** to see the configuration before creating/updating entries in that stream.

### Entry Settings (from get_stream response)

When you call **get_stream**, it returns an \`entry_settings\` object with:

\`\`\`
entry_settings: {
  use_rating: boolean      // Is rating enabled?
  use_status: boolean      // Is status enabled?
  use_priority: boolean    // Is priority enabled?
  use_location: boolean    // Is location enabled?
  use_photos: boolean      // Are photos enabled?
  use_duedates: boolean    // Are due dates enabled?
  use_type: boolean        // Is entry type enabled?
  types: string[]          // Available type options (e.g., ["Bug", "Feature", "Task"])
  statuses: string[]       // Available status options (e.g., ["draft", "in-progress", "done"])
  default_status: string   // Default status for new entries
  rating_type: string      // Rating format: "stars" (0-5) or "numeric" (0-10, may allow decimals)
  content_type: string     // Content format
  content_template: string // Template for new entry content
  title_template: string   // Template for new entry titles
}
\`\`\`

### Rating Configuration

The \`rating_type\` field determines how ratings work:
- **"stars"**: 0-5 whole numbers, displayed as stars in the app
- **"numeric"**: 0-10 scale, may allow decimal values

## Stream Context in Entry Responses

**Entry responses include \`stream_context\`** - you don't need to call get_stream separately!

When you call **list_entries**, **get_entry**, or **search_entries**, each entry includes:

\`\`\`
stream_context: {
  stream_name: string    // Stream display name
  rating_type: string    // "stars" or "numeric"
  rating_max: number     // 5 for stars, 10 for numeric
  types: string[]        // Valid type options
  statuses: string[]     // Valid status options
  use_rating: boolean    // Is rating enabled?
  use_status: boolean    // Is status enabled?
  use_priority: boolean  // Is priority enabled?
  use_type: boolean      // Is type enabled?
  use_duedates: boolean  // Are due dates enabled?
}
\`\`\`

**Note:** Inbox entries (stream_id = null) do not have stream_context.

### Stream Fields
- **name**: Display name
- **color**: Theme color (hex code)
- **icon**: Icon identifier
- **entry_count**: Number of entries (read-only, computed)
- **is_private**: Whether stream is private
- **is_localonly**: Whether stream syncs to server

## Attachments (Photos/Images)

Entries can have attached images:

- **attachment_id**: Unique identifier
- **mime_type**: File type (e.g., "image/jpeg")
- **file_size**: Size in bytes
- **width/height**: Image dimensions
- **position**: Order of attachments on the entry
- **captured_at**: When the photo was taken

### Viewing Attachments
- Use **get_attachment_data** to see images inline (base64 encoded) - Claude can view these
- Use **get_attachment_url** to get a signed URL (for sharing/downloading)

## Rich Text Editing

### Supported Formatting
- **Headings**: H1-H6
- **Bold**, *Italic*, ~~Strikethrough~~
- Bullet lists and numbered lists
- Task lists (checkboxes): - [ ] unchecked, - [x] checked
- Blockquotes
- Code blocks and inline code
- Links and images
- Horizontal rules

### Content Format
- Content is stored as HTML internally
- MCP returns content as **Markdown** for readability
- When creating/updating entries, provide **Markdown** - it will be converted to HTML

## What You Can Do via MCP

### Read Operations
- **list_streams**: See all user's streams
- **get_stream**: Get details of a specific stream
- **list_entries**: Browse entries with filters (by stream, tags, date range, etc.)
- **get_entry**: Get full details of one entry including attachments
- **search_entries**: Full-text search across all entries
- **get_attachment_data**: View an image inline
- **get_attachment_url**: Get a download URL for an attachment

### Write Operations (requires 'full' scope)
- **create_entry**: Create new entries with content, tags, etc.
- **update_entry**: Modify existing entries (content, attributes, move between streams)
- **delete_entry**: Soft-delete entries (can be recovered)

## Versioning & Conflict Prevention

Entries have a **version** field that increments on every update. Use this for optimistic locking:

### How It Works
1. When you **read** an entry, note the \`version\` field (e.g., version: 5)
2. When you **update**, pass \`expected_version: 5\`
3. If someone else edited the entry (now version 6), your update **fails** with a conflict error
4. On conflict: re-fetch the entry, show changes to user, retry with new version

### Why This Matters
- The user may be editing entries on their mobile app while you're working
- Without versioning, you could overwrite their unsaved changes
- With \`expected_version\`, you get a clear error instead of silent data loss

### Example
\`\`\`
// 1. Read entry
get_entry(entry_id: "abc") → { version: 5, content: "old text" }

// 2. Update with version check
update_entry(entry_id: "abc", expected_version: 5, content: "new text")
  → Success: entry updated to version 6

// OR if someone else edited:
update_entry(entry_id: "abc", expected_version: 5, content: "new text")
  → Error: "Version conflict: expected version 5 but server has version 6"
\`\`\`

**Recommendation:** Always pass \`expected_version\` when updating entries to prevent data loss.

## Read-Only Fields (Cannot Be Set via MCP)

These entry fields are readable but cannot be created/updated via MCP:

- **entry_id**: Auto-generated UUID
- **version**: Auto-incremented on every update (use for expected_version checks)
- **created_at / updated_at**: Auto-managed timestamps
- **mentions**: Extracted from content (auto-parsed)
- **location fields** (entry_latitude, entry_longitude, place_name, city, country): Set via mobile app GPS
- **attachments**: Photos must be uploaded via the app
- **last_edited_device**: Auto-set to identify MCP edits

## What's NOT Supported via MCP

- Creating/editing/deleting streams (use the app)
- Uploading new attachments (use the app)
- Setting location data (requires mobile app GPS)
- User account management
- Sharing entries with other users
- Real-time sync/notifications

## Best Practices

### When Creating Entries
1. **FIRST call get_stream** to check which attributes are enabled for that stream
2. Always provide meaningful **content**
3. Set **entry_date** if it's not today
4. Assign to a **stream_id** for organization (or leave null for Inbox)
5. Add relevant **tags** for discoverability
6. Only set attributes that are enabled for the stream (check entry_settings.use_*)

### When Searching
1. Use **search_entries** for keyword lookups
2. Use **list_entries** with filters for browsing (by date, stream, tags)
3. Combine filters: stream_id + date range + tags

### When Updating
1. Only include fields you want to change
2. To clear a field, set it to null (for optional fields like due_date)
3. Tags are replaced entirely (not merged) - include all desired tags

## Response Size Control

Entry content can be large (1KB-100KB+ each). For efficient browsing, control response size:

### include_content Parameter
- **Default: true** (backwards compatible)
- Set to **false** to omit content entirely - returns only metadata
- Use when browsing/scanning entries to find what you need
- Then call **get_entry** for full content of specific entries

### content_limit Parameter
- Truncate content to first N characters
- Adds "..." suffix if truncated
- Response includes \`content_truncated: true\` when truncated
- Use for previews (e.g., \`content_limit: 200\` for brief summaries)

### Recommendations
- **Browsing mode**: Use \`include_content: false\` with \`list_entries\` to scan titles/metadata
- **Preview mode**: Use \`content_limit: 200\` for quick content previews
- **Detail mode**: Use \`get_entry\` for full content of specific entries
- AI context is precious - don't fill it with content you don't need yet

### Example Workflow
\`\`\`
// 1. Browse entries without content (fast, lightweight)
list_entries(stream_id: "...", include_content: false)
  → Returns entries with titles, dates, tags, but no content

// 2. Get preview of interesting entries
list_entries(stream_id: "...", content_limit: 150)
  → Returns first 150 chars of each entry's content

// 3. Get full details of specific entry
get_entry(entry_id: "...")
  → Returns complete entry with full content
\`\`\`

## Tips

- Entries in the **Inbox** (no stream) are like quick captures - organize them later
- Use **is_pinned** to keep important entries visible
- Use **is_archived** to hide completed items without deleting
- The **priority** system is great for task management
- **Tags** work across streams - use them for cross-cutting concerns
- **Always check stream settings first** - each stream has different attributes enabled
- The rating format (stars vs numeric) is stream-specific - check before using
`;

/**
 * Get Trace documentation
 * Returns comprehensive instructions on how to use Trace
 */
export async function getDocs(
  _params: unknown,
  _ctx: ToolContext
): Promise<unknown> {
  return {
    documentation: TRACE_DOCS,
    version: "1.3",
    last_updated: "2026-02-13",
  };
}
