// Entry CRUD operations for MCP
// All database queries filter by user_id for security

import type { ToolContext } from "./mod";

// ============================================================================
// HTML <-> Markdown Conversion
// ============================================================================

/**
 * Convert HTML content to Markdown for AI readability
 */
function htmlToMarkdown(html: string): string {
  if (!html) return "";

  let md = html;

  // Handle headings (h1-h6)
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n");
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n");
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n");

  // Handle formatting
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");
  md = md.replace(/<u[^>]*>(.*?)<\/u>/gi, "_$1_");
  md = md.replace(/<s[^>]*>(.*?)<\/s>/gi, "~~$1~~");
  md = md.replace(/<strike[^>]*>(.*?)<\/strike>/gi, "~~$1~~");
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");

  // Handle links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

  // Handle images
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)");
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, "![]($1)");

  // Handle Tiptap task lists (must come before regular lists)
  // Task list items: <li data-type="taskItem" data-checked="true/false">
  md = md.replace(/<li[^>]*data-checked="true"[^>]*>(.*?)<\/li>/gi, "- [x] $1\n");
  md = md.replace(/<li[^>]*data-checked="false"[^>]*>(.*?)<\/li>/gi, "- [ ] $1\n");

  // Handle lists - unordered
  md = md.replace(/<ul[^>]*>/gi, "\n");
  md = md.replace(/<\/ul>/gi, "\n");
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");

  // Handle lists - ordered (basic support)
  md = md.replace(/<ol[^>]*>/gi, "\n");
  md = md.replace(/<\/ol>/gi, "\n");

  // Handle blockquotes
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, content) => {
    const lines = content.trim().split("\n");
    return lines.map((line: string) => `> ${line}`).join("\n") + "\n\n";
  });

  // Handle code blocks
  md = md.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, "```\n$1\n```\n\n");
  md = md.replace(/<pre[^>]*>(.*?)<\/pre>/gis, "```\n$1\n```\n\n");

  // Handle paragraphs
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");

  // Handle line breaks
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // Handle horizontal rules
  md = md.replace(/<hr\s*\/?>/gi, "\n---\n\n");

  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  md = md.replace(/&nbsp;/g, " ");
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&#x27;/g, "'");
  md = md.replace(/&#x2F;/g, "/");

  // Clean up excessive whitespace
  md = md.replace(/\n{3,}/g, "\n\n");
  md = md.trim();

  return md;
}

/**
 * Convert Markdown content to HTML for storage
 */
function markdownToHtml(md: string): string {
  if (!md) return "";

  let html = md;

  // Escape HTML entities first
  html = html.replace(/&/g, "&amp;");
  html = html.replace(/</g, "&lt;");
  html = html.replace(/>/g, "&gt;");

  // Handle code blocks first (to prevent interference)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Handle inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Handle headings
  html = html.replace(/^###### (.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^##### (.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Handle bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");
  html = html.replace(/~~(.+?)~~/g, "<s>$1</s>");

  // Handle links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Handle images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Handle horizontal rules
  html = html.replace(/^---$/gm, "<hr />");
  html = html.replace(/^\*\*\*$/gm, "<hr />");

  // Handle blockquotes
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

  // Handle task list items (checkboxes) - must come before regular lists
  // - [ ] unchecked, - [x] checked
  // Structure must match what Tiptap/TenTap expects: label with checkbox + div with content
  html = html.replace(/^- \[x\] (.+)$/gm, '<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>$1</p></div></li>');
  html = html.replace(/^- \[ \] (.+)$/gm, '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>$1</p></div></li>');

  // Wrap consecutive task items in taskList
  html = html.replace(/(<li data-type="taskItem"[^>]*>.*?<\/li>\n?)+/g, (match) => `<ul data-type="taskList">${match}</ul>`);

  // Handle regular unordered lists (items not already processed as tasks)
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>(?!.*data-type).*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Handle paragraphs (lines not already wrapped)
  const lines = html.split("\n\n");
  html = lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      // Skip if already has block-level tags
      if (/^<(h[1-6]|ul|ol|li|pre|blockquote|hr|p)/.test(trimmed)) {
        return trimmed;
      }
      return `<p>${trimmed}</p>`;
    })
    .filter(Boolean)
    .join("\n");

  return html;
}

// ============================================================================
// Entry Types
// ============================================================================

interface ListEntriesParams {
  stream_id?: string | null;
  tags?: string[];
  status?: string;
  is_archived?: boolean;
  is_pinned?: boolean;
  start_date?: string;
  end_date?: string;
  query?: string;
  limit?: number;
  offset?: number;
  include_content?: boolean; // Default: true. Set to false for lighter responses.
  content_limit?: number; // Truncate content to first N characters (ignored if include_content is false)
}

interface GetEntryParams {
  entry_id: string;
}

interface CreateEntryParams {
  title?: string;
  content: string;
  stream_id?: string | null;
  tags?: string[];
  status?: string;
  entry_date?: string;
  priority?: number;
  rating?: number;
  type?: string | null;
  due_date?: string | null;
}

interface UpdateEntryParams {
  entry_id: string;
  expected_version?: number; // For optimistic locking - only update if version matches
  title?: string;
  content?: string;
  stream_id?: string | null;
  tags?: string[];
  status?: string;
  is_archived?: boolean;
  is_pinned?: boolean;
  priority?: number;
  rating?: number;
  type?: string | null;
  due_date?: string | null;
}

interface DeleteEntryParams {
  entry_id: string;
}

interface SearchEntriesParams {
  query: string;
  limit?: number;
  include_content?: boolean; // Default: true. Set to false for lighter responses.
  content_limit?: number; // Truncate content to first N characters (ignored if include_content is false)
}

// ============================================================================
// Priority Labels (mirrors @trace/core ALL_PRIORITIES)
// ============================================================================

const PRIORITY_LABELS: Record<number, string> = {
  4: "Urgent",
  3: "High",
  2: "Medium",
  1: "Low",
  0: "None",
};

const VALID_PRIORITIES = [0, 1, 2, 3, 4];

function getPriorityLabel(value: number): string {
  return PRIORITY_LABELS[value] || "None";
}

// ============================================================================
// Stream Context for Entries
// ============================================================================

interface StreamSettings {
  stream_id: string;
  name: string;
  entry_use_rating: boolean;
  entry_use_status: boolean;
  entry_use_priority: boolean;
  entry_use_type: boolean;
  entry_use_duedates: boolean;
  entry_types: string[] | null;
  entry_statuses: string[] | null;
  entry_default_status: string | null;
  entry_rating_type: string | null; // "stars" or "numeric"
}

interface StreamContext {
  stream_id: string;
  stream_name: string;
  rating_type: string; // "stars" or "numeric"
  rating_max: number; // 5 for stars, 10 for numeric
  types: string[];
  statuses: string[];
  use_rating: boolean;
  use_status: boolean;
  use_priority: boolean;
  use_type: boolean;
  use_duedates: boolean;
}

/**
 * Convert raw rating (0-10) to display value based on stream rating type
 */
function convertRatingToDisplay(rawRating: number, ratingType: string | null): number {
  if (ratingType === "stars") {
    // Stars are stored as 0-10 internally, display as 0-5
    return Math.round(rawRating / 2);
  }
  // Numeric ratings are displayed as-is (0-10)
  return rawRating;
}

/**
 * Convert display rating to raw storage value based on stream rating type
 */
function convertRatingToRaw(displayRating: number, ratingType: string | null): number {
  if (ratingType === "stars") {
    // Stars: display 0-5 -> storage 0-10
    return displayRating * 2;
  }
  // Numeric ratings are stored as-is (0-10)
  return displayRating;
}

/**
 * Get the maximum valid rating for a stream's rating type
 */
function getMaxRating(ratingType: string | null): number {
  return ratingType === "stars" ? 5 : 10;
}

/**
 * Build stream context from stream settings
 */
function buildStreamContext(stream: StreamSettings): StreamContext {
  const ratingType = stream.entry_rating_type || "numeric";
  return {
    stream_id: stream.stream_id,
    stream_name: stream.name,
    rating_type: ratingType,
    rating_max: getMaxRating(ratingType),
    types: stream.entry_types || [],
    statuses: stream.entry_statuses || [],
    use_rating: stream.entry_use_rating,
    use_status: stream.entry_use_status,
    use_priority: stream.entry_use_priority,
    use_type: stream.entry_use_type ?? false,
    use_duedates: stream.entry_use_duedates,
  };
}

/**
 * Fetch stream settings for one or more stream IDs
 * Returns a map of stream_id -> StreamContext
 */
async function fetchStreamContexts(
  streamIds: (string | null)[],
  ctx: ToolContext
): Promise<Map<string | null, StreamContext>> {
  const contextMap = new Map<string | null, StreamContext>();

  // Filter out nulls (inbox entries) and dedupe
  const uniqueIds = [...new Set(streamIds.filter((id): id is string => id !== null))];

  if (uniqueIds.length === 0) {
    return contextMap;
  }

  const { data: streams, error } = await ctx.supabase
    .from("streams")
    .select("stream_id, name, entry_use_rating, entry_use_status, entry_use_priority, entry_use_type, entry_use_duedates, entry_types, entry_statuses, entry_default_status, entry_rating_type")
    .eq("user_id", ctx.userId)
    .in("stream_id", uniqueIds);

  if (error) {
    console.error("[MCP] Failed to fetch stream contexts:", error);
    return contextMap;
  }

  for (const stream of (streams || []) as StreamSettings[]) {
    contextMap.set(stream.stream_id, buildStreamContext(stream));
  }

  return contextMap;
}

/**
 * Sanitize database error messages to prevent information disclosure.
 * Hides internal constraint names and schema details.
 */
function sanitizeDbError(error: { message: string; code?: string }): string {
  // Known error codes that are safe to pass through with context
  if (error.code === "PGRST116") {
    return "Record not found";
  }
  if (error.code === "23505") {
    return "A record with this identifier already exists";
  }
  if (error.code === "23503") {
    return "Referenced record does not exist";
  }
  if (error.code === "23514") {
    return "Value violates validation constraints";
  }

  // For other errors, return generic message
  // Log the full error server-side for debugging
  console.error("[MCP] Database error:", error);
  return "Database operation failed";
}

// ============================================================================
// Entry Response Transformation
// ============================================================================

interface EntryRow {
  entry_id: string;
  user_id: string;
  title: string | null;
  content: string;
  tags: string[] | null;
  mentions: string[] | null;
  stream_id: string | null;
  status: string;
  type: string | null;
  entry_date: string | null;
  entry_latitude: number | null;
  entry_longitude: number | null;
  place_name: string | null;
  city: string | null;
  country: string | null;
  priority: number;
  rating: number;
  is_pinned: boolean;
  is_archived: boolean;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  last_edited_device: string | null;
  version: number; // For optimistic locking
}

interface AttachmentRow {
  attachment_id: string;
  entry_id: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  position: number;
}

interface TransformOptions {
  includeContent?: boolean; // Default: true
  contentLimit?: number; // Truncate content to first N chars (only if includeContent is true)
}

/**
 * Transform entry row to API response with Markdown content
 * Includes stream context and converted rating values
 * @param options.includeContent - If false, omits content field (default: true)
 */
function transformEntry(
  entry: EntryRow,
  attachments?: AttachmentRow[],
  streamContext?: StreamContext | null,
  options?: TransformOptions
) {
  // Get rating type from stream context, default to "numeric" for inbox
  const ratingType = streamContext?.rating_type || "numeric";
  const ratingMax = streamContext?.rating_max || 10;
  const displayRating = convertRatingToDisplay(entry.rating, ratingType);

  // Default include_content to true for backwards compatibility
  const includeContent = options?.includeContent !== false;
  const contentLimit = options?.contentLimit;

  // Build content field
  let content: string | null = null;
  let contentTruncated = false;
  if (includeContent) {
    const fullContent = htmlToMarkdown(entry.content);
    if (contentLimit && contentLimit > 0 && fullContent.length > contentLimit) {
      content = fullContent.substring(0, contentLimit) + "...";
      contentTruncated = true;
    } else {
      content = fullContent;
    }
  }

  const transformed: Record<string, unknown> = {
    entry_id: entry.entry_id,
    title: entry.title,
    content,
    content_truncated: contentTruncated,
    tags: entry.tags || [],
    mentions: entry.mentions || [],
    stream_id: entry.stream_id,
    status: entry.status,
    type: entry.type,
    entry_date: entry.entry_date,
    location: entry.entry_latitude && entry.entry_longitude
      ? {
          latitude: entry.entry_latitude,
          longitude: entry.entry_longitude,
          place_name: entry.place_name,
          city: entry.city,
          country: entry.country,
        }
      : null,
    priority: entry.priority,
    priority_label: getPriorityLabel(entry.priority),
    // Rating: display value and metadata
    rating: displayRating,
    rating_max: ratingMax,
    rating_type: ratingType,
    rating_raw: entry.rating, // Raw storage value for round-tripping if needed
    is_pinned: entry.is_pinned,
    is_archived: entry.is_archived,
    due_date: entry.due_date,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    last_edited_device: entry.last_edited_device,
    version: entry.version, // For optimistic locking - pass to expected_version on updates
    attachments: attachments?.map((a) => ({
      attachment_id: a.attachment_id,
      mime_type: a.mime_type,
      file_size: a.file_size,
      width: a.width,
      height: a.height,
      position: a.position,
    })),
  };

  // Include stream context if available (not for inbox entries)
  if (streamContext) {
    transformed.stream_context = {
      stream_name: streamContext.stream_name,
      rating_type: streamContext.rating_type,
      rating_max: streamContext.rating_max,
      types: streamContext.types,
      statuses: streamContext.statuses,
      use_rating: streamContext.use_rating,
      use_status: streamContext.use_status,
      use_priority: streamContext.use_priority,
      use_type: streamContext.use_type,
      use_duedates: streamContext.use_duedates,
    };
  }

  return transformed;
}

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * List entries with optional filters
 */
export async function listEntries(
  params: unknown,
  ctx: ToolContext
): Promise<unknown> {
  const p = (params || {}) as ListEntriesParams;

  // Validate and cap limits
  const limit = Math.min(Math.max(1, p.limit || 50), 100);
  const offset = Math.max(0, p.offset || 0);

  let query = ctx.supabase
    .from("entries")
    .select("*")
    .eq("user_id", ctx.userId)
    .is("deleted_at", null) // Exclude soft-deleted
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply filters
  if (p.stream_id !== undefined) {
    if (p.stream_id === null) {
      query = query.is("stream_id", null); // Inbox
    } else {
      query = query.eq("stream_id", p.stream_id);
    }
  }

  if (p.tags && p.tags.length > 0) {
    // Match ANY of the provided tags
    query = query.overlaps("tags", p.tags);
  }

  if (p.status) {
    query = query.eq("status", p.status);
  }

  // Default to non-archived unless explicitly requested
  if (p.is_archived !== undefined) {
    query = query.eq("is_archived", p.is_archived);
  } else {
    query = query.eq("is_archived", false);
  }

  if (p.is_pinned !== undefined) {
    query = query.eq("is_pinned", p.is_pinned);
  }

  if (p.start_date) {
    query = query.gte("entry_date", p.start_date);
  }

  if (p.end_date) {
    query = query.lte("entry_date", p.end_date);
  }

  // Basic text search (case-insensitive on title and content)
  if (p.query) {
    query = query.or(
      `title.ilike.%${p.query}%,content.ilike.%${p.query}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list entries: ${sanitizeDbError(error)}`);
  }

  const entries = data || [];

  // Fetch stream contexts for all entries
  const streamIds = entries.map((e) => (e as EntryRow).stream_id);
  const streamContexts = await fetchStreamContexts(streamIds, ctx);

  // Transform options - include_content defaults to true
  const transformOptions: TransformOptions = {
    includeContent: p.include_content !== false,
    contentLimit: p.content_limit,
  };

  return {
    entries: entries.map((entry) => {
      const e = entry as EntryRow;
      const streamContext = e.stream_id ? streamContexts.get(e.stream_id) : null;
      return transformEntry(e, undefined, streamContext, transformOptions);
    }),
    count: entries.length,
    limit,
    offset,
    include_content: transformOptions.includeContent,
    content_limit: transformOptions.contentLimit || null,
  };
}

/**
 * Get a single entry by ID with attachments
 */
export async function getEntry(
  params: unknown,
  ctx: ToolContext
): Promise<unknown> {
  const p = params as GetEntryParams;

  if (!p?.entry_id) {
    throw new Error("entry_id is required");
  }

  // Fetch entry
  const { data: entry, error: entryError } = await ctx.supabase
    .from("entries")
    .select("*")
    .eq("entry_id", p.entry_id)
    .eq("user_id", ctx.userId) // Security: ensure user owns entry
    .is("deleted_at", null)
    .single();

  if (entryError) {
    if (entryError.code === "PGRST116") {
      throw new Error("Entry not found");
    }
    throw new Error(`Failed to get entry: ${sanitizeDbError(entryError)}`);
  }

  // Fetch attachments for this entry
  const { data: attachments } = await ctx.supabase
    .from("attachments")
    .select("attachment_id, entry_id, file_path, mime_type, file_size, width, height, position")
    .eq("entry_id", p.entry_id)
    .eq("user_id", ctx.userId)
    .order("position", { ascending: true });

  // Fetch stream context if entry belongs to a stream
  const typedEntry = entry as EntryRow;
  let streamContext: StreamContext | null = null;
  if (typedEntry.stream_id) {
    const contexts = await fetchStreamContexts([typedEntry.stream_id], ctx);
    streamContext = contexts.get(typedEntry.stream_id) || null;
  }

  return transformEntry(typedEntry, attachments as AttachmentRow[] || [], streamContext);
}

/**
 * Create a new entry
 */
export async function createEntry(
  params: unknown,
  ctx: ToolContext
): Promise<unknown> {
  const p = params as CreateEntryParams;

  if (!p?.content) {
    throw new Error("content is required");
  }

  // Fetch stream settings for validation if stream_id is provided
  let streamSettings: StreamSettings | null = null;
  if (p.stream_id) {
    const { data: stream } = await ctx.supabase
      .from("streams")
      .select("stream_id, name, entry_use_rating, entry_use_status, entry_use_priority, entry_use_type, entry_use_duedates, entry_types, entry_statuses, entry_default_status, entry_rating_type")
      .eq("stream_id", p.stream_id)
      .eq("user_id", ctx.userId)
      .single();

    if (!stream) {
      throw new Error("Stream not found or not owned by user");
    }
    streamSettings = stream as StreamSettings;
  }

  const now = new Date().toISOString();

  const insertData: Record<string, unknown> = {
    user_id: ctx.userId,
    title: p.title || null,
    content: markdownToHtml(p.content), // Convert Markdown to HTML
    tags: p.tags || null,
    stream_id: p.stream_id || null,
    status: p.status || streamSettings?.entry_default_status || "draft",
    entry_date: p.entry_date || now.split("T")[0],
    created_at: now,
    updated_at: now,
  };

  // Validate and set priority if provided
  if (p.priority !== undefined) {
    if (!VALID_PRIORITIES.includes(p.priority)) {
      throw new Error("priority must be 0 (None), 1 (Low), 2 (Medium), 3 (High), or 4 (Urgent)");
    }
    insertData.priority = p.priority;
  }

  // Validate and set rating if provided
  if (p.rating !== undefined) {
    const ratingType = streamSettings?.entry_rating_type || "numeric";
    const maxRating = getMaxRating(ratingType);

    if (p.rating < 0 || p.rating > maxRating) {
      if (ratingType === "stars") {
        throw new Error(`Rating must be 0-${maxRating} for star-based streams`);
      } else {
        throw new Error(`Rating must be 0-${maxRating}`);
      }
    }

    // Convert display rating to raw storage value
    insertData.rating = convertRatingToRaw(p.rating, ratingType);
  }

  // Set type if provided
  if (p.type !== undefined) {
    insertData.type = p.type;
  }

  // Set due_date if provided
  if (p.due_date !== undefined) {
    insertData.due_date = p.due_date;
  }

  const { data, error } = await ctx.supabase
    .from("entries")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create entry: ${sanitizeDbError(error)}`);
  }

  // Fetch stream context for response
  let streamContext: StreamContext | null = null;
  if (p.stream_id && streamSettings) {
    streamContext = buildStreamContext(streamSettings);
  }

  return transformEntry(data as EntryRow, undefined, streamContext);
}

/**
 * Update an existing entry
 */
export async function updateEntry(
  params: unknown,
  ctx: ToolContext
): Promise<unknown> {
  const p = params as UpdateEntryParams;

  if (!p?.entry_id) {
    throw new Error("entry_id is required");
  }

  // First, fetch current entry to get version and stream_id for validation
  const { data: currentEntry, error: fetchError } = await ctx.supabase
    .from("entries")
    .select("version, stream_id")
    .eq("entry_id", p.entry_id)
    .eq("user_id", ctx.userId)
    .is("deleted_at", null)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      throw new Error("Entry not found or not owned by user");
    }
    throw new Error(`Failed to fetch entry: ${sanitizeDbError(fetchError)}`);
  }

  const currentVersion = (currentEntry as { version: number | null })?.version || 1;

  // OPTIMISTIC LOCKING: If expected_version provided, verify it matches
  if (p.expected_version !== undefined && p.expected_version !== currentVersion) {
    throw new Error(
      `Version conflict: expected version ${p.expected_version} but server has version ${currentVersion}. ` +
      `The entry was modified since you last read it. Please re-fetch the entry and retry your update.`
    );
  }

  // Determine the target stream_id (either new one being set, or existing)
  const targetStreamId = p.stream_id !== undefined ? p.stream_id : (currentEntry as { stream_id: string | null }).stream_id;

  // Fetch stream settings for validation if entry belongs to a stream
  let streamSettings: StreamSettings | null = null;
  if (targetStreamId) {
    const { data: stream } = await ctx.supabase
      .from("streams")
      .select("stream_id, name, entry_use_rating, entry_use_status, entry_use_priority, entry_use_type, entry_use_duedates, entry_types, entry_statuses, entry_default_status, entry_rating_type")
      .eq("stream_id", targetStreamId)
      .eq("user_id", ctx.userId)
      .single();
    streamSettings = stream as StreamSettings | null;
  }

  // Build update object with only provided fields
  // Increment version to trigger sync on mobile app
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    version: currentVersion + 1,
  };

  if (p.title !== undefined) {
    updateData.title = p.title;
  }

  if (p.content !== undefined) {
    updateData.content = markdownToHtml(p.content);
  }

  if (p.stream_id !== undefined) {
    updateData.stream_id = p.stream_id;
  }

  if (p.tags !== undefined) {
    updateData.tags = p.tags;
  }

  if (p.status !== undefined) {
    updateData.status = p.status;
  }

  if (p.is_archived !== undefined) {
    updateData.is_archived = p.is_archived;
  }

  if (p.is_pinned !== undefined) {
    updateData.is_pinned = p.is_pinned;
  }

  if (p.priority !== undefined) {
    if (!VALID_PRIORITIES.includes(p.priority)) {
      throw new Error("priority must be 0 (None), 1 (Low), 2 (Medium), 3 (High), or 4 (Urgent)");
    }
    updateData.priority = p.priority;
  }

  if (p.rating !== undefined) {
    // Validate rating against stream settings
    const ratingType = streamSettings?.entry_rating_type || "numeric";
    const maxRating = getMaxRating(ratingType);

    if (p.rating < 0 || p.rating > maxRating) {
      if (ratingType === "stars") {
        throw new Error(`Rating must be 0-${maxRating} for star-based streams`);
      } else {
        throw new Error(`Rating must be 0-${maxRating}`);
      }
    }

    // Convert display rating to raw storage value
    updateData.rating = convertRatingToRaw(p.rating, ratingType);
  }

  if (p.type !== undefined) {
    updateData.type = p.type;
  }

  if (p.due_date !== undefined) {
    updateData.due_date = p.due_date;
  }

  // Set last_edited_device to identify MCP edits
  updateData.last_edited_device = `MCP:${ctx.keyName}`;

  // Use conditional update with version check to prevent race conditions
  // This ensures another update didn't happen between our version check and now
  const { data, error } = await ctx.supabase
    .from("entries")
    .update(updateData)
    .eq("entry_id", p.entry_id)
    .eq("user_id", ctx.userId) // Security: ensure user owns entry
    .eq("version", currentVersion) // OPTIMISTIC LOCK: only update if version unchanged
    .is("deleted_at", null)
    .select()
    .maybeSingle(); // Use maybeSingle since conditional update may return no rows

  if (error) {
    throw new Error(`Failed to update entry: ${sanitizeDbError(error)}`);
  }

  // If no data returned, it means the version changed between our check and update
  if (!data) {
    // Re-fetch to get current version for error message
    const { data: latestEntry } = await ctx.supabase
      .from("entries")
      .select("version")
      .eq("entry_id", p.entry_id)
      .eq("user_id", ctx.userId)
      .single();

    const latestVersion = (latestEntry as { version: number } | null)?.version || "unknown";
    throw new Error(
      `Version conflict: entry was modified by another source (now at version ${latestVersion}). ` +
      `Please re-fetch the entry and retry your update.`
    );
  }

  // Fetch stream context for response
  let streamContext: StreamContext | null = null;
  if ((data as EntryRow).stream_id) {
    const contexts = await fetchStreamContexts([(data as EntryRow).stream_id], ctx);
    streamContext = contexts.get((data as EntryRow).stream_id) || null;
  }

  return transformEntry(data as EntryRow, undefined, streamContext);
}

/**
 * Soft-delete an entry
 */
export async function deleteEntry(
  params: unknown,
  ctx: ToolContext
): Promise<unknown> {
  const p = params as DeleteEntryParams;

  if (!p?.entry_id) {
    throw new Error("entry_id is required");
  }

  const { data, error } = await ctx.supabase
    .from("entries")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("entry_id", p.entry_id)
    .eq("user_id", ctx.userId) // Security: ensure user owns entry
    .is("deleted_at", null) // Can't delete already deleted
    .select("entry_id")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new Error("Entry not found or already deleted");
    }
    throw new Error(`Failed to delete entry: ${sanitizeDbError(error)}`);
  }

  return {
    deleted: true,
    entry_id: data.entry_id,
  };
}

/**
 * Full-text search across entries
 */
export async function searchEntries(
  params: unknown,
  ctx: ToolContext
): Promise<unknown> {
  const p = params as SearchEntriesParams;

  if (!p?.query) {
    throw new Error("query is required");
  }

  // Validate and cap limits
  const limit = Math.min(Math.max(1, p.limit || 20), 50);

  // Search in title and content
  const { data, error } = await ctx.supabase
    .from("entries")
    .select("*")
    .eq("user_id", ctx.userId)
    .is("deleted_at", null)
    .eq("is_archived", false)
    .or(`title.ilike.%${p.query}%,content.ilike.%${p.query}%`)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Search failed: ${sanitizeDbError(error)}`);
  }

  const entries = data || [];

  // Fetch stream contexts for all entries
  const streamIds = entries.map((e) => (e as EntryRow).stream_id);
  const streamContexts = await fetchStreamContexts(streamIds, ctx);

  // Transform options - include_content defaults to true
  const transformOptions: TransformOptions = {
    includeContent: p.include_content !== false,
    contentLimit: p.content_limit,
  };

  return {
    entries: entries.map((entry) => {
      const e = entry as EntryRow;
      const streamContext = e.stream_id ? streamContexts.get(e.stream_id) : null;
      return transformEntry(e, undefined, streamContext, transformOptions);
    }),
    count: entries.length,
    query: p.query,
    include_content: transformOptions.includeContent,
    content_limit: transformOptions.contentLimit || null,
  };
}
