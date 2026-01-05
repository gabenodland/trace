/**
 * Attachment Types
 *
 * Types for attachments (photos, documents) attached to entries
 */

export interface Attachment {
  attachment_id: string;
  entry_id: string;
  user_id: string;

  // File paths
  file_path: string;          // Supabase Storage path: {user_id}/{entry_id}/{attachment_id}.jpg
  local_path?: string | null; // Mobile only: Local file system path

  // File metadata
  mime_type: string;          // image/jpeg, image/png, application/pdf, etc.
  file_size?: number | null;  // File size in bytes
  width?: number | null;      // Image width in pixels (null for non-image files)
  height?: number | null;     // Image height in pixels (null for non-image files)

  // Positioning
  position: number;           // Order within entry (0, 1, 2...)

  // Timestamps
  created_at: string;         // ISO 8601 timestamp when record was created
  updated_at: string;         // ISO 8601 timestamp when record was last updated

  // Sync status (local only fields)
  uploaded?: boolean;         // True if file has been uploaded to Supabase Storage
  synced?: number;            // SQLite sync flag (0 = not synced, 1 = synced)
  sync_action?: 'create' | 'update' | 'delete' | null; // Pending sync action
}

/**
 * Attachment creation input (fields required when creating a new attachment)
 */
export interface CreateAttachmentInput {
  entry_id: string;
  user_id: string;
  file_path: string;
  file_size: number;
  local_path?: string;
  mime_type: string;
  position: number;
}

/**
 * Attachment update input (fields that can be updated)
 */
export interface UpdateAttachmentInput {
  file_path?: string;
  position?: number;
  uploaded?: boolean;
  synced?: number;
  sync_action?: 'create' | 'update' | 'delete' | null;
}

/**
 * Attachment with entry reference (for queries that join attachments with entries)
 */
export interface AttachmentWithEntry extends Attachment {
  entry_title?: string;
  entry_content?: string;
}

/**
 * Attachment upload progress
 */
export interface AttachmentUploadProgress {
  attachment_id: string;
  progress: number;  // 0-100
  status: 'uploading' | 'completed' | 'failed';
  error?: string;
}

/**
 * Compressed attachment result (for images)
 */
export interface CompressedAttachment {
  uri: string;
  width: number;
  height: number;
  file_size: number;
  mime_type: string;
}
