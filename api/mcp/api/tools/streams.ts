// Stream operations for MCP
// All database queries filter by user_id for security

import type { ToolContext } from "./mod";

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Sanitize database error messages to prevent information disclosure.
 */
function sanitizeDbError(error: { message: string; code?: string }): string {
  if (error.code === "PGRST116") {
    return "Record not found";
  }
  if (error.code === "23505") {
    return "A record with this identifier already exists";
  }
  if (error.code === "23503") {
    return "Referenced record does not exist";
  }
  console.error("[MCP] Database error:", error);
  return "Database operation failed";
}

// ============================================================================
// Stream Types
// ============================================================================

interface GetStreamParams {
  stream_id: string;
}

interface StreamRow {
  stream_id: string;
  user_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  entry_count: number;
  entry_use_rating: boolean;
  entry_use_status: boolean;
  entry_use_priority: boolean;
  entry_use_location: boolean;
  entry_use_photos: boolean;
  entry_use_duedates: boolean;
  entry_use_type: boolean | null;
  entry_types: string[] | null;
  entry_statuses: string[] | null;
  entry_default_status: string | null;
  entry_rating_type: string | null;
  entry_content_type: string;
  entry_content_template: string | null;
  entry_title_template: string | null;
  is_private: boolean;
  is_localonly: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Stream Response Transformation
// ============================================================================

/**
 * Transform stream row to API response (summary for list)
 */
function transformStreamSummary(stream: StreamRow) {
  return {
    stream_id: stream.stream_id,
    name: stream.name,
    color: stream.color,
    icon: stream.icon,
    entry_count: stream.entry_count,
    is_private: stream.is_private,
    created_at: stream.created_at,
    updated_at: stream.updated_at,
  };
}

/**
 * Transform stream row to API response (full details)
 */
function transformStreamDetails(stream: StreamRow) {
  return {
    stream_id: stream.stream_id,
    name: stream.name,
    color: stream.color,
    icon: stream.icon,
    entry_count: stream.entry_count,
    is_private: stream.is_private,
    is_localonly: stream.is_localonly,
    created_at: stream.created_at,
    updated_at: stream.updated_at,
    // Entry configuration
    entry_settings: {
      use_rating: stream.entry_use_rating,
      use_status: stream.entry_use_status,
      use_priority: stream.entry_use_priority,
      use_location: stream.entry_use_location,
      use_photos: stream.entry_use_photos,
      use_duedates: stream.entry_use_duedates,
      use_type: stream.entry_use_type,
      types: stream.entry_types,
      statuses: stream.entry_statuses,
      default_status: stream.entry_default_status,
      rating_type: stream.entry_rating_type,
      content_type: stream.entry_content_type,
      content_template: stream.entry_content_template,
      title_template: stream.entry_title_template,
    },
  };
}

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * List all streams for the user
 */
export async function listStreams(
  _params: unknown,
  ctx: ToolContext
): Promise<unknown> {
  const { data, error } = await ctx.supabase
    .from("streams")
    .select("*")
    .eq("user_id", ctx.userId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to list streams: ${sanitizeDbError(error)}`);
  }

  // Calculate total entries across all streams
  const totalEntryCount = (data || []).reduce(
    (sum: number, s: StreamRow) => sum + (s.entry_count || 0),
    0
  );

  return {
    streams: (data || []).map((stream) =>
      transformStreamSummary(stream as StreamRow)
    ),
    count: data?.length || 0,
    total_entry_count: totalEntryCount,
  };
}

/**
 * Get detailed information about a specific stream
 */
export async function getStream(
  params: unknown,
  ctx: ToolContext
): Promise<unknown> {
  const p = params as GetStreamParams;

  if (!p?.stream_id) {
    throw new Error("stream_id is required");
  }

  const { data, error } = await ctx.supabase
    .from("streams")
    .select("*")
    .eq("stream_id", p.stream_id)
    .eq("user_id", ctx.userId) // Security: ensure user owns stream
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new Error("Stream not found");
    }
    throw new Error(`Failed to get stream: ${sanitizeDbError(error)}`);
  }

  return transformStreamDetails(data as StreamRow);
}
