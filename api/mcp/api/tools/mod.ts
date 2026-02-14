// MCP Tool Registry and Dispatcher
// Central hub for all MCP tool definitions and execution

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { listEntries, getEntry, createEntry, updateEntry, deleteEntry, searchEntries } from "./entries";
import { listStreams, getStream } from "./streams";
import { getAttachmentUrl, getAttachmentData } from "./attachments";
import { getDocs } from "./docs";

// Tool definition interface
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  requiresScope?: "full" | "read";
}

// Tool handler context
export interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
  scope: string;
  keyName: string; // API key name for tracking edits
}

// Tool handler function type
type ToolHandler = (params: unknown, ctx: ToolContext) => Promise<unknown>;

// Tool registry with handlers
const TOOL_HANDLERS: Record<string, { handler: ToolHandler; requiresScope?: "full" }> = {
  list_streams: { handler: listStreams },
  get_stream: { handler: getStream },
  list_entries: { handler: listEntries },
  get_entry: { handler: getEntry },
  create_entry: { handler: createEntry, requiresScope: "full" },
  update_entry: { handler: updateEntry, requiresScope: "full" },
  delete_entry: { handler: deleteEntry, requiresScope: "full" },
  search_entries: { handler: searchEntries },
  get_attachment_url: { handler: getAttachmentUrl },
  get_attachment_data: { handler: getAttachmentData },
  get_docs: { handler: getDocs },
};

// Tool definitions for MCP protocol
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_docs",
    description: "Get comprehensive documentation about Trace - how it works, organization structure (streams/entries), attributes, editing capabilities, and best practices. Call this first to understand how to use Trace effectively.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_streams",
    description: "List all streams (notebooks/collections) for the user. Returns stream names, colors, icons, and entry counts.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_stream",
    description: "Get detailed information about a specific stream including its configuration and entry settings.",
    inputSchema: {
      type: "object",
      properties: {
        stream_id: {
          type: "string",
          description: "The UUID of the stream to retrieve",
        },
      },
      required: ["stream_id"],
    },
  },
  {
    name: "list_entries",
    description: "List entries with optional filters. Returns entries with content converted to Markdown for readability. Excludes soft-deleted entries. Use include_content=false or content_limit for lighter responses when browsing.",
    inputSchema: {
      type: "object",
      properties: {
        stream_id: {
          type: "string",
          description: "Filter by stream ID. Use null or omit for inbox entries.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter entries that have ANY of these tags",
        },
        status: {
          type: "string",
          description: "Filter by status (e.g., 'draft', 'published')",
        },
        is_archived: {
          type: "boolean",
          description: "Filter by archived status. Default: false",
        },
        is_pinned: {
          type: "boolean",
          description: "Filter to only pinned entries",
        },
        start_date: {
          type: "string",
          description: "Filter entries on or after this ISO date (YYYY-MM-DD)",
        },
        end_date: {
          type: "string",
          description: "Filter entries on or before this ISO date (YYYY-MM-DD)",
        },
        query: {
          type: "string",
          description: "Full-text search query on title and content",
        },
        limit: {
          type: "number",
          description: "Maximum entries to return. Default: 50, Max: 100",
        },
        offset: {
          type: "number",
          description: "Number of entries to skip for pagination",
        },
        include_content: {
          type: "boolean",
          description: "Include entry content in response. Default: true. Set to false for lighter responses when browsing metadata only.",
        },
        content_limit: {
          type: "number",
          description: "Truncate content to first N characters (adds '...' if truncated). Use for previews. Ignored if include_content is false.",
        },
      },
    },
  },
  {
    name: "get_entry",
    description: "Get a single entry by ID with full content (as Markdown) and attachment metadata.",
    inputSchema: {
      type: "object",
      properties: {
        entry_id: {
          type: "string",
          description: "The UUID of the entry to retrieve",
        },
      },
      required: ["entry_id"],
    },
  },
  {
    name: "create_entry",
    description: "Create a new entry. Accepts Markdown content which will be stored as HTML. Rating values should be in display format (0-5 for stars, 0-10 for numeric) - they are automatically converted for storage. Call get_stream first to check stream settings. Requires 'full' scope.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Entry title (optional)",
        },
        content: {
          type: "string",
          description: "Entry content in Markdown format",
        },
        stream_id: {
          type: "string",
          description: "Stream to place entry in. Omit for inbox.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags to apply to the entry",
        },
        status: {
          type: "string",
          description: "Entry status (uses stream's default_status if not provided)",
        },
        entry_date: {
          type: "string",
          description: "Date for the entry in ISO format. Defaults to current date.",
        },
        priority: {
          type: "number",
          description: "Priority level: 0=None, 1=Low, 2=Medium, 3=High, 4=Urgent",
        },
        rating: {
          type: "number",
          description: "Rating in DISPLAY format: 0-5 for star-based streams, 0-10 for numeric. Check stream_context.rating_max for valid range.",
        },
        type: {
          type: "string",
          description: "Entry type (e.g., 'Bug', 'Feature'). Check stream_context.types for valid options.",
        },
        due_date: {
          type: "string",
          description: "Due date in ISO format (optional)",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "update_entry",
    description: "Update an existing entry. Accepts Markdown content. Rating values should be in display format (0-5 for stars, 0-10 for numeric). Use expected_version to prevent overwriting concurrent edits. Requires 'full' scope.",
    inputSchema: {
      type: "object",
      properties: {
        entry_id: {
          type: "string",
          description: "The UUID of the entry to update",
        },
        expected_version: {
          type: "number",
          description: "RECOMMENDED: The version you read earlier. Update fails if entry was modified since (prevents overwriting concurrent edits). Get this from the 'version' field in entry responses.",
        },
        title: {
          type: "string",
          description: "New title (optional)",
        },
        content: {
          type: "string",
          description: "New content in Markdown format (optional)",
        },
        stream_id: {
          type: "string",
          description: "Move entry to different stream (optional)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Replace tags (optional)",
        },
        status: {
          type: "string",
          description: "New status (optional)",
        },
        is_archived: {
          type: "boolean",
          description: "Archive/unarchive entry (optional)",
        },
        is_pinned: {
          type: "boolean",
          description: "Pin/unpin entry (optional)",
        },
        priority: {
          type: "number",
          description: "Priority level: 0=None, 1=Low, 2=Medium, 3=High, 4=Urgent",
        },
        rating: {
          type: "number",
          description: "Rating in DISPLAY format: 0-5 for star-based streams, 0-10 for numeric. Check stream_context.rating_max.",
        },
        type: {
          type: "string",
          description: "Entry type (e.g., 'Bug', 'Feature'). Check stream_context.types for valid options.",
        },
        due_date: {
          type: "string",
          description: "Due date in ISO format (optional, null to clear)",
        },
      },
      required: ["entry_id"],
    },
  },
  {
    name: "delete_entry",
    description: "Soft-delete an entry (sets deleted_at timestamp). Requires 'full' scope.",
    inputSchema: {
      type: "object",
      properties: {
        entry_id: {
          type: "string",
          description: "The UUID of the entry to delete",
        },
      },
      required: ["entry_id"],
    },
  },
  {
    name: "search_entries",
    description: "Full-text search across all entries. Returns matching entries with content as Markdown. Use include_content=false or content_limit for lighter responses.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query string",
        },
        limit: {
          type: "number",
          description: "Maximum results. Default: 20, Max: 50",
        },
        include_content: {
          type: "boolean",
          description: "Include entry content in response. Default: true. Set to false for lighter responses when browsing metadata only.",
        },
        content_limit: {
          type: "number",
          description: "Truncate content to first N characters (adds '...' if truncated). Use for previews. Ignored if include_content is false.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_attachment_url",
    description: "Get a signed URL to access an attachment file. URL is valid for 1 hour. Note: Claude cannot fetch URLs directly, use get_attachment_data instead to see the image.",
    inputSchema: {
      type: "object",
      properties: {
        attachment_id: {
          type: "string",
          description: "The UUID of the attachment",
        },
      },
      required: ["attachment_id"],
    },
  },
  {
    name: "get_attachment_data",
    description: "Get an attachment's image data directly (base64 encoded). Use this to VIEW images - Claude can see these images inline. Max file size: 5MB.",
    inputSchema: {
      type: "object",
      properties: {
        attachment_id: {
          type: "string",
          description: "The UUID of the attachment to fetch",
        },
      },
      required: ["attachment_id"],
    },
  },
];

/**
 * Dispatch a tool call to the appropriate handler
 */
export async function dispatchTool(
  name: string,
  params: unknown,
  userId: string,
  scope: string,
  keyName: string = "Unknown"
): Promise<{ result?: unknown; error?: string }> {
  const toolEntry = TOOL_HANDLERS[name];

  if (!toolEntry) {
    return { error: `Unknown tool: ${name}` };
  }

  // Check scope requirements
  if (toolEntry.requiresScope === "full" && scope !== "full") {
    return { error: `Tool '${name}' requires 'full' scope. Current scope: '${scope}'` };
  }

  // Create Supabase client with service role for direct access
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { error: "Server configuration error: missing Supabase credentials" };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const ctx: ToolContext = {
    supabase,
    userId,
    scope,
    keyName,
  };

  try {
    const result = await toolEntry.handler(params, ctx);
    return { result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error occurred";
    console.error(`Tool '${name}' error:`, err);
    return { error: message };
  }
}

/**
 * Get all tool definitions for MCP tools/list response
 */
export function getToolDefinitions(): ToolDefinition[] {
  return TOOL_DEFINITIONS;
}
