// Types for data management — storage usage, trash, and data inventory

// ============================================================================
// STORAGE
// ============================================================================

/** Cloud storage usage returned by get_user_storage_usage RPC */
export interface CloudStorageUsage {
  /** Total bytes used by attachments in cloud storage */
  attachment_bytes: number;
}

/** Device-local storage usage (mobile only — calculated from SQLite + filesystem) */
export interface DeviceStorageUsage {
  /** SQLite database file size in bytes */
  database_bytes: number;
  /** Total size of local attachment files in bytes */
  attachment_bytes: number;
  /** Combined total bytes */
  total_bytes: number;
}

/** Storage warning level based on usage percentage */
export type StorageWarningLevel = 'normal' | 'warning' | 'critical' | 'exceeded';

// ============================================================================
// DATA INVENTORY
// ============================================================================

/** Entity counts for the data inventory cards */
export interface EntityCounts {
  /** Total count on this device (or cloud) */
  total: number;
  /** Count synced to cloud */
  cloud: number;
  /** Count in local-only (private) streams */
  private: number;
  /** Count of soft-deleted items on server */
  trash: number;
}

/** All four entity types' counts bundled together */
export interface DataInventory {
  entries: EntityCounts;
  streams: EntityCounts;
  places: EntityCounts;
  attachments: EntityCounts;
}

// ============================================================================
// TRASH
// ============================================================================

/** A soft-deleted entry as returned by the trash query */
export interface TrashEntry {
  id: string;
  title: string | null;
  stream_name: string | null;
  stream_id: string | null;
  deleted_at: string;
  attachment_count: number;
}

/** A soft-deleted stream as returned by the trash query */
export interface TrashStream {
  id: string;
  name: string;
  deleted_at: string;
}

/** A soft-deleted place as returned by the trash query */
export interface TrashLocation {
  id: string;
  place_name: string | null;
  deleted_at: string;
}

/** Full detail of a soft-deleted entry for the detail view */
export interface DeletedEntryDetail {
  entry_id: string;
  title: string | null;
  content: string | null;
  stream_name: string | null;
  entry_date: string | null;
  deleted_at: string;
  status: string | null;
  type: string | null;
  priority: number | null;
  rating: number | null;
  tags: string[] | null;
  mentions: string[] | null;
  is_pinned: boolean;
  due_date: string | null;
  place_name: string | null;
  city: string | null;
  neighborhood: string | null;
  region: string | null;
  country: string | null;
  location_id: string | null;
  attachments: DeletedEntryAttachment[];
}

/** Attachment info for a deleted entry */
export interface DeletedEntryAttachment {
  attachment_id: string;
  file_path: string;
  mime_type: string;
  file_size: number | null;
  width: number | null;
  height: number | null;
  position: number;
}

// ============================================================================
// PRIVACY
// ============================================================================

// ============================================================================
// TRASH ACTIONS
// ============================================================================

/** Result of restoring a soft-deleted entry */
export interface RestoreEntryResult {
  restored: boolean;
  restored_to_inbox: boolean;
}

/** A local-only stream with its content counts for the privacy summary */
export interface PrivateStreamSummary {
  id: string;
  name: string;
  entry_count: number;
  attachment_count: number;
}
