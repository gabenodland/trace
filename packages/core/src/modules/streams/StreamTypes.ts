// Stream types for flat organization (no hierarchy)

import type { EntryStatus } from "../entries/EntryTypes";

export interface Stream {
  stream_id: string;
  user_id: string;
  name: string;
  entry_count: number;
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;

  // Template fields for auto-populating new entries
  entry_title_template?: string | null;
  entry_content_template?: string | null;

  // Feature toggles - enable/disable features per stream
  entry_use_rating?: boolean;
  entry_rating_type?: 'stars' | 'decimal_whole' | 'decimal'; // Rating display type: stars (1-5), decimal_whole (0-10), or decimal (0.0-10.0)
  entry_use_priority?: boolean;
  entry_use_status?: boolean;
  entry_use_duedates?: boolean;
  entry_use_location?: boolean;
  entry_use_photos?: boolean;
  entry_content_type?: string; // 'text' | 'list' | 'richformat' | 'bullet'

  // Status configuration (when entry_use_status is true)
  entry_statuses?: EntryStatus[]; // Which statuses are available for this stream
  entry_default_status?: EntryStatus; // Default status for new entries

  // Type configuration (when entry_use_type is true)
  entry_use_type?: boolean; // Enable/disable type feature
  entry_types?: string[]; // Custom type names for this stream (alphabetically sorted)

  // Privacy and sync controls
  is_private?: boolean;
  is_localonly?: boolean;
}

export interface CreateStreamInput {
  name: string;
  color?: string | null;
  icon?: string | null;
}

export interface UpdateStreamInput {
  name?: string;
  color?: string | null;
  icon?: string | null;

  // Template fields
  entry_title_template?: string | null;
  entry_content_template?: string | null;

  // Feature toggles
  entry_use_rating?: boolean;
  entry_rating_type?: 'stars' | 'decimal_whole' | 'decimal';
  entry_use_priority?: boolean;
  entry_use_status?: boolean;
  entry_use_duedates?: boolean;
  entry_use_location?: boolean;
  entry_use_photos?: boolean;
  entry_content_type?: string;

  // Status configuration
  entry_statuses?: EntryStatus[];
  entry_default_status?: EntryStatus;

  // Type configuration
  entry_use_type?: boolean;
  entry_types?: string[];

  // Privacy and sync controls
  is_private?: boolean;
  is_localonly?: boolean;
}
