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
  location_lat: number | null;
  location_lng: number | null;
  location_accuracy: number | null; // GPS accuracy in meters
  location_name: string | null;
  status: "none" | "incomplete" | "complete";
  due_date: string | null;
  completed_at: string | null;
  attachments: Json;
}

export interface CreateEntryInput {
  title?: string | null;
  content: string;
  tags?: string[];
  mentions?: string[];
  category_id?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_accuracy?: number | null;
  location_name?: string | null;
  status?: "none" | "incomplete" | "complete";
  due_date?: string | null;
}

export interface UpdateEntryInput {
  title?: string | null;
  content?: string;
  tags?: string[];
  mentions?: string[];
  category_id?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_accuracy?: number | null;
  status?: "none" | "incomplete" | "complete";
  due_date?: string | null;
  completed_at?: string | null;
}

export interface EntryFilter {
  category_id?: string | null;
  tags?: string[];
  start_date?: string;
  end_date?: string;
  status?: "none" | "incomplete" | "complete";
}
