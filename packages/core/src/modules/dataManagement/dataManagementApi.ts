// Database operations for data management (NOT exported - internal use only)
// All Supabase RPC calls for storage usage, trash queries, and trash actions.

import { getSupabase } from "../../shared/supabase";
import type {
  CloudStorageUsage,
  TrashEntry,
  TrashStream,
  TrashLocation,
  RestoreEntryResult,
  DeletedEntryDetail,
  DeletedEntryAttachment,
} from "./DataManagementTypes";

/** Lazy RPC call — avoids accessing supabase at module load time */
function rpc(fn: string, params?: Record<string, unknown>) {
  const client = getSupabase();
  return (client.rpc as any)(fn, params);
}

// ============================================================================
// STORAGE
// ============================================================================

/**
 * Get cloud storage usage for the authenticated user.
 */
export async function getCloudStorageUsage(): Promise<CloudStorageUsage> {
  const { data, error } = await rpc("get_user_storage_usage");
  if (error) throw error;
  return data as CloudStorageUsage;
}

// ============================================================================
// TRASH QUERIES
// ============================================================================

/**
 * Get all soft-deleted entries for the authenticated user.
 */
export async function getDeletedEntries(): Promise<TrashEntry[]> {
  const { data, error } = await rpc("get_deleted_entries");
  if (error) throw error;
  return (data as TrashEntry[]) ?? [];
}

/**
 * Get all soft-deleted streams for the authenticated user.
 */
export async function getDeletedStreams(): Promise<TrashStream[]> {
  const { data, error } = await rpc("get_deleted_streams");
  if (error) throw error;
  return (data as TrashStream[]) ?? [];
}

/**
 * Get all soft-deleted locations for the authenticated user.
 */
export async function getDeletedLocations(): Promise<TrashLocation[]> {
  const { data, error } = await rpc("get_deleted_locations");
  if (error) throw error;
  return (data as TrashLocation[]) ?? [];
}

/**
 * Get full detail of a soft-deleted entry + its attachments.
 * Only returns entries with deleted_at IS NOT NULL (trash only).
 */
export async function getDeletedEntryDetail(entryId: string): Promise<DeletedEntryDetail> {
  const client = getSupabase();

  const [entryResult, attachmentsResult] = await Promise.all([
    (client.from as any)("entries")
      .select("entry_id, title, content, entry_date, deleted_at, status, type, priority, rating, tags, mentions, is_pinned, due_date, place_name, city, neighborhood, region, country, location_id, stream_id, streams(name)")
      .eq("entry_id", entryId)
      .not("deleted_at", "is", null)
      .single(),
    (client.from as any)("attachments")
      .select("attachment_id, file_path, mime_type, file_size, width, height, position")
      .eq("entry_id", entryId)
      .order("position", { ascending: true }),
  ]);

  if (entryResult.error) throw entryResult.error;
  const entry = entryResult.data;

  return {
    entry_id: entry.entry_id,
    title: entry.title,
    content: entry.content,
    stream_name: entry.streams?.name ?? null,
    entry_date: entry.entry_date,
    deleted_at: entry.deleted_at,
    status: entry.status,
    type: entry.type,
    priority: entry.priority,
    rating: entry.rating,
    tags: entry.tags,
    mentions: entry.mentions,
    is_pinned: entry.is_pinned ?? false,
    due_date: entry.due_date,
    place_name: entry.place_name,
    city: entry.city,
    neighborhood: entry.neighborhood,
    region: entry.region,
    country: entry.country,
    location_id: entry.location_id,
    attachments: ((attachmentsResult?.data as DeletedEntryAttachment[]) ?? []),
  };
}

// ============================================================================
// TRASH ACTIONS
// ============================================================================

/**
 * Restore a soft-deleted entry and its attachments.
 * Falls back to Inbox if the original stream is also deleted.
 */
export async function restoreEntry(entryId: string): Promise<RestoreEntryResult> {
  const { data, error } = await rpc("restore_entry", {
    p_entry_id: entryId,
  });
  if (error) throw error;
  return data as RestoreEntryResult;
}

/**
 * Permanently delete an entry and its attachment records.
 * Also deletes attachment files from storage.
 */
export async function hardDeleteEntry(entryId: string): Promise<void> {
  const { data, error } = await rpc("hard_delete_entry", {
    p_entry_id: entryId,
  });
  if (error) throw error;

  const result = data as { deleted: boolean; file_paths: string[] };

  // Clean up storage files
  if (result.file_paths.length > 0) {
    const { error: storageError } = await getSupabase().storage
      .from("attachments")
      .remove(result.file_paths);

    if (storageError) {
      // Log but don't throw — DB records are already deleted.
      // Orphaned files remain in storage until manual cleanup.
      console.warn("[DataManagement] Storage cleanup failed for entry", entryId, "—", result.file_paths.length, "files orphaned:", storageError);
    }
  }
}

/**
 * Permanently delete a soft-deleted stream.
 */
export async function hardDeleteStream(streamId: string): Promise<void> {
  const { error } = await rpc("hard_delete_stream", {
    p_stream_id: streamId,
  });
  if (error) throw error;
}

/**
 * Permanently delete a soft-deleted location.
 */
export async function hardDeleteLocation(locationId: string): Promise<void> {
  const { error } = await rpc("hard_delete_location", {
    p_location_id: locationId,
  });
  if (error) throw error;
}
