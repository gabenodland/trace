// Entry types for rich text capture

import type { Json } from "../../shared/database.types";

export interface Entry {
  entry_id: string;
  user_id: string;
  title: string | null;
  content: string;
  category_id: string | null;
  tags: string[];
  mentions: string[];
  created_at: string;
  updated_at: string;
  entry_date: string | null; // When the memory/event actually happened (can be backdated)
  deleted_at?: string | null; // Soft delete timestamp
  // GPS coordinates captured when entry was created (private, exact, never changes)
  entry_latitude: number | null;
  entry_longitude: number | null;
  location_accuracy: number | null; // GPS accuracy in meters
  // Display coordinates (public, respects privacy)
  location_latitude?: number | null;
  location_longitude?: number | null;
  // Location name
  location_name: string | null;
  location_name_original?: string | null;
  location_name_source?: string | null;
  // Location hierarchy
  location_address?: string | null;
  location_neighborhood?: string | null;
  location_postal_code?: string | null;
  location_city?: string | null;
  location_subdivision?: string | null;
  location_region?: string | null;
  location_country?: string | null;
  // Privacy and metadata
  location_precision?: string | null;
  location_mapbox_place_id?: string | null;
  location_foursquare_fsq_id?: string | null;
  status: "none" | "incomplete" | "in_progress" | "complete";
  due_date: string | null;
  completed_at: string | null;
  attachments: Json;
  // Sync tracking fields (mobile only)
  local_only?: number; // 0 = sync enabled, 1 = local only
  synced?: number; // 0 = needs sync, 1 = synced
  sync_action?: 'create' | 'update' | 'delete' | null;
  sync_error?: string | null;
  // Conflict resolution fields (multi-device sync)
  version?: number; // Increments with each edit - used for conflict detection
  base_version?: number; // Server version this edit is based on - used for 3-way merge
  conflict_status?: 'conflicted' | 'resolved' | null; // Conflict state
  conflict_backup?: string | null; // JSON backup of losing version when conflict detected
  last_edited_by?: string | null; // User email who last edited
  last_edited_device?: string | null; // Device name that last edited
}

export interface CreateEntryInput {
  title?: string | null;
  content: string;
  tags?: string[];
  mentions?: string[];
  category_id?: string | null;
  entry_date?: string | null; // When the memory/event actually happened
  entry_latitude?: number | null;
  entry_longitude?: number | null;
  location_latitude?: number | null;
  location_longitude?: number | null;
  location_accuracy?: number | null;
  location_name?: string | null;
  location_name_source?: string | null;
  location_address?: string | null;
  location_neighborhood?: string | null;
  location_postal_code?: string | null;
  location_city?: string | null;
  location_subdivision?: string | null;
  location_region?: string | null;
  location_country?: string | null;
  status?: "none" | "incomplete" | "in_progress" | "complete";
  due_date?: string | null;
  local_only?: number; // 0 = sync enabled (default), 1 = local only
}

export interface UpdateEntryInput {
  title?: string | null;
  content?: string;
  tags?: string[];
  mentions?: string[];
  category_id?: string | null;
  entry_date?: string | null; // When the memory/event actually happened
  entry_latitude?: number | null;
  entry_longitude?: number | null;
  location_latitude?: number | null;
  location_longitude?: number | null;
  location_accuracy?: number | null;
  location_name?: string | null;
  location_name_source?: string | null;
  location_address?: string | null;
  location_neighborhood?: string | null;
  location_postal_code?: string | null;
  location_city?: string | null;
  location_subdivision?: string | null;
  location_region?: string | null;
  location_country?: string | null;
  status?: "none" | "incomplete" | "in_progress" | "complete";
  due_date?: string | null;
  completed_at?: string | null;
}

export interface EntryFilter {
  category_id?: string | null;
  tags?: string[];
  tag?: string; // Filter by single tag
  mention?: string; // Filter by single mention
  location_name?: string; // Filter by location name
  start_date?: string;
  end_date?: string;
  status?: "none" | "incomplete" | "in_progress" | "complete";
}
