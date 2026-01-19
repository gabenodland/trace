-- Add sync_error column to locations table for consistent sync pattern
-- This brings locations in line with entries, streams, and attachments

ALTER TABLE locations ADD COLUMN IF NOT EXISTS sync_error TEXT;

COMMENT ON COLUMN locations.sync_error IS 'Error message from last sync attempt. Cleared on successful sync.';
