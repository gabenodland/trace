/**
 * Location Database API
 *
 * Supabase database operations for locations.
 * This is the API layer for CRUD operations on the locations table.
 * Internal use only - not exported from module.
 */

import { supabase } from "../../shared/supabase";
import type { LocationEntity, CreateLocationInput } from "./LocationTypes";

/**
 * Get all locations for the current user
 * @returns Array of LocationEntity objects
 */
export async function getLocations(): Promise<LocationEntity[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) throw error;
  // Cast to LocationEntity - database always has these fields populated
  return (data || []) as LocationEntity[];
}

/**
 * Get a single location by ID
 * @param locationId - The location ID to fetch
 * @returns LocationEntity or null if not found
 */
export async function getLocation(locationId: string): Promise<LocationEntity | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("location_id", locationId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }
  return data as LocationEntity;
}

/**
 * Create a new location
 * @param input - CreateLocationInput data
 * @returns The created LocationEntity
 */
export async function createLocation(input: CreateLocationInput): Promise<LocationEntity> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("locations")
    .insert({
      user_id: user.id,
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      source: input.source || null,
      address: input.address || null,
      neighborhood: input.neighborhood || null,
      postal_code: input.postal_code || null,
      city: input.city || null,
      subdivision: input.subdivision || null,
      region: input.region || null,
      country: input.country || null,
      mapbox_place_id: input.mapbox_place_id || null,
      foursquare_fsq_id: input.foursquare_fsq_id || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as LocationEntity;
}

/**
 * Update an existing location
 * @param locationId - The location ID to update
 * @param input - Partial CreateLocationInput with fields to update
 * @returns The updated LocationEntity
 */
export async function updateLocation(
  locationId: string,
  input: Partial<CreateLocationInput>
): Promise<LocationEntity> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("locations")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("location_id", locationId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data as LocationEntity;
}

/**
 * Soft delete a location
 * @param locationId - The location ID to delete
 */
export async function deleteLocation(locationId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("locations")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("location_id", locationId)
    .eq("user_id", user.id);

  if (error) throw error;
}
