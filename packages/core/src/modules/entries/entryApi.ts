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
      category_id: data.category_id || null,
      location_lat: data.location_lat || null,
      location_lng: data.location_lng || null,
      location_name: data.location_name || null,
      status: data.status || "none",
      due_date: data.due_date || null,
    })
    .select()
    .single();

  if (error) throw error;
  return entry as Entry;
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
    .order("created_at", { ascending: false });

  // Apply filters
  if (filter) {
    if (filter.category_id !== undefined) {
      if (filter.category_id === null) {
        query = query.is("category_id", null);
      } else {
        query = query.eq("category_id", filter.category_id);
      }
    }

    if (filter.tags && filter.tags.length > 0) {
      query = query.contains("tags", filter.tags);
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
  return data as Entry[];
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
  return data as Entry;
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
  return data as Entry;
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
