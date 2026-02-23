// Database operations for entries (NOT exported - internal use only)

import { supabase } from "../../shared/supabase";
import { Entry, CreateEntryInput, EntryFilter } from "./EntryTypes";

/**
 * Create a new entry
 */
export async function createEntry(data: CreateEntryInput): Promise<Entry> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Prepare insert data (exclude entry_id, created_at, updated_at, attachments, completed_at)
  const { data: entry, error } = await supabase
    .from("entries")
    .insert({
      user_id: user.id,
      title: data.title || null,
      content: data.content,
      tags: data.tags || [],
      mentions: data.mentions || [],
      stream_id: data.stream_id || null,
      entry_date: data.entry_date || null,
      entry_latitude: data.entry_latitude ?? null,
      entry_longitude: data.entry_longitude ?? null,
      location_id: data.location_id || null,
      status: data.status || "none",
      due_date: data.due_date || null,
    })
    .select()
    .single();

  if (error) throw error;
  return entry as unknown as Entry;
}

/**
 * Get entries with optional filters
 */
export async function getEntries(filter?: EntryFilter): Promise<Entry[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let query = supabase
    .from("entries")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  // Apply filters
  if (filter) {
    if (filter.stream_id !== undefined) {
      if (filter.stream_id === null) {
        query = query.is("stream_id", null);
      } else {
        query = query.eq("stream_id", filter.stream_id);
      }
    }

    if (filter.tags && filter.tags.length > 0) {
      query = query.contains("tags", filter.tags);
    }

    // Single tag filter (for tag navigation)
    if (filter.tag) {
      query = query.contains("tags", [filter.tag]);
    }

    // Single mention filter (for mention navigation)
    if (filter.mention) {
      query = query.contains("mentions", [filter.mention]);
    }

    // Location filter
    if (filter.location_id) {
      query = query.eq("location_id", filter.location_id);
    }

    // Type filter
    if (filter.type) {
      query = query.eq("type", filter.type);
    }

    if (filter.status) {
      query = query.eq("status", filter.status);
    }

    if (filter.start_date) {
      query = query.gte("created_at", filter.start_date);
    }

    if (filter.end_date) {
      query = query.lte("created_at", filter.end_date);
    }
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as unknown as Entry[];
}

/**
 * Get a single entry by ID
 */
export async function getEntry(id: string): Promise<Entry> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .eq("entry_id", id)
    .eq("user_id", user.id)
    .single();

  if (error) throw error;
  return data as unknown as Entry;
}

/**
 * Update an entry
 */
export async function updateEntry(
  id: string,
  updates: Partial<Entry>
): Promise<Entry> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Exclude read-only fields
  const { entry_id, user_id, created_at, updated_at, attachments, ...allowedUpdates } = updates;

  const { data, error } = await supabase
    .from("entries")
    .update(allowedUpdates)
    .eq("entry_id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Entry;
}

/**
 * Delete an entry (hard delete for MVP)
 */
export async function deleteEntry(id: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("entries")
    .delete()
    .eq("entry_id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}

/**
 * Archive or unarchive an entry
 */
export async function archiveEntry(id: string, archived: boolean): Promise<Entry> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("entries")
    .update({ is_archived: archived })
    .eq("entry_id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Entry;
}
