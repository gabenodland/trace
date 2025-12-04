// Database operations for streams (NOT exported - internal use only)

import { supabase } from "../../shared/supabase";
import { Stream, UpdateStreamInput } from "./StreamTypes";
import { normalizeStreamName } from "./streamHelpers";

/**
 * Get all streams for current user
 */
export async function getStreams(): Promise<Stream[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("streams")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  if (error) throw error;

  return data as Stream[];
}

/**
 * Get a single stream by ID
 */
export async function getStream(id: string): Promise<Stream | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("streams")
    .select("*")
    .eq("stream_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  return data as Stream | null;
}

/**
 * Find or create stream by name
 * Returns the stream ID
 */
export async function findOrCreateStreamByName(name: string): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const normalizedName = normalizeStreamName(name);

  if (!normalizedName) {
    throw new Error("Invalid stream name");
  }

  // Check if stream with this name already exists
  const { data: existing, error: searchError } = await supabase
    .from("streams")
    .select("stream_id")
    .eq("user_id", user.id)
    .eq("name", normalizedName)
    .maybeSingle();

  if (searchError) throw searchError;

  if (existing) {
    return existing.stream_id;
  }

  // Create new stream
  const { data, error } = await supabase
    .from("streams")
    .insert({
      user_id: user.id,
      name: normalizedName,
    })
    .select("stream_id")
    .single();

  if (error) throw error;
  return data.stream_id;
}

/**
 * Create a new stream
 */
export async function createStream(name: string): Promise<Stream> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const normalizedName = normalizeStreamName(name);

  // Check for duplicate
  const { data: existing } = await supabase
    .from("streams")
    .select("stream_id")
    .eq("user_id", user.id)
    .eq("name", normalizedName)
    .maybeSingle();

  if (existing) {
    throw new Error("Stream with this name already exists");
  }

  const { data, error } = await supabase
    .from("streams")
    .insert({
      user_id: user.id,
      name: normalizedName,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Stream;
}

/**
 * Update a stream
 */
export async function updateStream(
  id: string,
  updates: UpdateStreamInput
): Promise<Stream> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const updateData: Partial<Stream> = { ...updates };

  if (updates.name !== undefined) {
    updateData.name = normalizeStreamName(updates.name);
  }

  const { data, error } = await supabase
    .from("streams")
    .update(updateData)
    .eq("stream_id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data as Stream;
}

/**
 * Delete a stream (optionally reassign entries to another stream)
 */
export async function deleteStream(
  id: string,
  reassignToId?: string
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Reassign or nullify entries
  if (reassignToId !== undefined) {
    const { error: updateError } = await supabase
      .from("entries")
      .update({ stream_id: reassignToId })
      .eq("stream_id", id)
      .eq("user_id", user.id);

    if (updateError) throw updateError;
  } else {
    // Move entries to Uncategorized (null stream)
    const { error: updateError } = await supabase
      .from("entries")
      .update({ stream_id: null })
      .eq("stream_id", id)
      .eq("user_id", user.id);

    if (updateError) throw updateError;
  }

  // Delete the stream
  const { error } = await supabase
    .from("streams")
    .delete()
    .eq("stream_id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}
