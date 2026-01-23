-- Add is_archived flag to entries table
ALTER TABLE entries ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for efficient filtering
CREATE INDEX idx_entries_is_archived ON entries(is_archived);
