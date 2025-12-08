-- ============================================================================
-- Add Stream Status Configuration Fields
-- ============================================================================
-- This migration adds status customization options to streams:
-- - entry_statuses: Array of allowed statuses for entries in this stream
-- - entry_default_status: Default status for new entries in this stream
-- ============================================================================

-- Add entry_statuses column (array of status strings)
-- Default: ['new', 'todo', 'in_progress', 'done'] when status is enabled
ALTER TABLE streams
ADD COLUMN IF NOT EXISTS entry_statuses TEXT[] DEFAULT ARRAY['new', 'todo', 'in_progress', 'done'];

-- Add entry_default_status column
-- Default: 'new' for workflow-enabled streams
ALTER TABLE streams
ADD COLUMN IF NOT EXISTS entry_default_status TEXT DEFAULT 'new';

-- Add check constraint for valid status values
-- Valid statuses: none, new, todo, in_progress, in_review, waiting, on_hold, done, closed, cancelled
ALTER TABLE streams
ADD CONSTRAINT valid_entry_default_status CHECK (
  entry_default_status IS NULL OR
  entry_default_status IN ('none', 'new', 'todo', 'in_progress', 'in_review', 'waiting', 'on_hold', 'done', 'closed', 'cancelled')
);

-- Create index for default status lookups
CREATE INDEX IF NOT EXISTS idx_streams_entry_default_status ON streams(entry_default_status);

-- Add column comments for documentation
COMMENT ON COLUMN streams.entry_statuses IS 'Array of allowed status values for entries in this stream. Default: [new, todo, in_progress, done]';
COMMENT ON COLUMN streams.entry_default_status IS 'Default status assigned to new entries in this stream when status is enabled. Default: new';
