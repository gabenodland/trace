// Entry types for rich text capture

import type { Json } from "../../shared/database.types";

// All available entry statuses
export type EntryStatus =
  | "none"        // No status set
  | "new"         // Newly created, not yet triaged
  | "todo"        // Ready to work on
  | "in_progress" // Currently being worked on
  | "in_review"   // Awaiting review/approval
  | "waiting"     // Blocked/waiting on external input
  | "on_hold"     // Intentionally paused
  | "done"        // Completed successfully
  | "closed"      // Issue resolved/addressed
  | "cancelled";  // Won't be done

// Status metadata for UI rendering
export interface StatusInfo {
  value: EntryStatus;
  label: string;
  color: string;
}

// All statuses with their display info (none first, then workflow statuses)
export const ALL_STATUSES: StatusInfo[] = [
  { value: "none", label: "None", color: "#9ca3af" },         // Gray - no status/optional
  { value: "new", label: "New", color: "#3b82f6" },           // Blue
  { value: "todo", label: "To Do", color: "#6b7280" },        // Gray
  { value: "in_progress", label: "In Progress", color: "#f59e0b" }, // Amber
  { value: "in_review", label: "In Review", color: "#6366f1" },     // Indigo
  { value: "waiting", label: "Waiting", color: "#a855f7" },   // Purple
  { value: "on_hold", label: "On Hold", color: "#64748b" },   // Slate
  { value: "done", label: "Done", color: "#10b981" },         // Green
  { value: "closed", label: "Closed", color: "#14b8a6" },     // Teal
  { value: "cancelled", label: "Cancelled", color: "#ef4444" }, // Red
];

// Default statuses when status feature is enabled on a stream
export const DEFAULT_STREAM_STATUSES: EntryStatus[] = ["new", "todo", "in_progress", "done"];

// Default initial status for new entries in streams with status enabled
export const DEFAULT_INITIAL_STATUS: EntryStatus = "new";

// Helper to get status info by value
export function getStatusInfo(status: EntryStatus): StatusInfo | undefined {
  return ALL_STATUSES.find(s => s.value === status);
}

// Helper to get status label
export function getStatusLabel(status: EntryStatus): string {
  return getStatusInfo(status)?.label || status;
}

// Helper to get status color
export function getStatusColor(status: EntryStatus): string {
  return getStatusInfo(status)?.color || "#6b7280";
}

export interface Entry {
  entry_id: string;
  user_id: string;
  title: string | null;
  content: string;
  stream_id: string | null;
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
  // Location reference (points to locations table)
  location_id: string | null;
  status: EntryStatus;
  type: string | null; // User-defined type from stream's entry_types
  due_date: string | null;
  completed_at: string | null;
  attachments: Json;
  // Priority, rating, and pinning fields
  priority: number; // Integer priority level for sorting (default: 0)
  rating: number; // Decimal rating from 0.00 to 5.00 (default: 0.00)
  is_pinned: boolean; // Boolean flag to pin important entries (default: false)
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
  stream_id?: string | null;
  entry_date?: string | null; // When the memory/event actually happened
  entry_latitude?: number | null;
  entry_longitude?: number | null;
  location_accuracy?: number | null;
  location_id?: string | null;
  status?: EntryStatus;
  type?: string | null; // User-defined type from stream's entry_types
  due_date?: string | null;
  priority?: number;
  rating?: number;
  local_only?: number; // 0 = sync enabled (default), 1 = local only
}

export interface UpdateEntryInput {
  title?: string | null;
  content?: string;
  tags?: string[];
  mentions?: string[];
  stream_id?: string | null;
  entry_date?: string | null; // When the memory/event actually happened
  entry_latitude?: number | null;
  entry_longitude?: number | null;
  location_accuracy?: number | null;
  location_id?: string | null;
  status?: EntryStatus;
  type?: string | null; // User-defined type from stream's entry_types
  due_date?: string | null;
  completed_at?: string | null;
  priority?: number;
  rating?: number;
  is_pinned?: boolean;
}

export interface EntryFilter {
  stream_id?: string | null;
  tags?: string[];
  tag?: string; // Filter by single tag
  mention?: string; // Filter by single mention
  location_id?: string; // Filter by location ID
  start_date?: string;
  end_date?: string;
  status?: EntryStatus;
  type?: string; // Filter by type
}
