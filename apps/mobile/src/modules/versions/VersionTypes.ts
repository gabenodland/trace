export interface EntryVersion {
  version_id: string;
  entry_id: string;
  user_id: string;
  version_number: number;
  trigger: 'session_end' | 'conflict' | 'restore' | 'sync_overwrite' | 'mcp_write';
  snapshot: EntrySnapshot;
  attachment_ids: string[] | null;
  change_summary: string | null;
  device_id: string | null;
  triggered_by_device: string | null;  // For sync_overwrite/conflict: the remote device that caused this snapshot
  device_created_at: string | null;  // ISO string from Supabase, Unix ms in SQLite
  base_entry_version: string | null;
  created_at: string;  // ISO string from Supabase, Unix ms in SQLite
  synced?: number;  // SQLite only: 0 or 1
  sync_action?: string | null;  // SQLite only: 'create' or null
}

// The JSONB snapshot — all substantive entry fields
export interface EntrySnapshot {
  title: string | null;
  content: string | null;
  status: string | null;
  type: string | null;
  priority: number | null;
  rating: number | null;
  tags: string[] | null;
  mentions: string[] | null;
  stream_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  is_pinned: boolean;
  entry_date: string | null;
  entry_latitude: number | null;
  entry_longitude: number | null;
  location_id: string | null;
  geocode_status: string | null;
  place_name: string | null;
  address: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  city: string | null;
  subdivision: string | null;
  region: string | null;
  country: string | null;
}
