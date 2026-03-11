-- Add deleted_at column to attachments table for soft-delete (version history support)
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index for filtering active vs soft-deleted attachments
CREATE INDEX IF NOT EXISTS idx_attachments_deleted_at ON attachments(deleted_at) WHERE deleted_at IS NULL;

COMMENT ON COLUMN attachments.deleted_at IS 'Soft-delete timestamp. Non-null means attachment is deleted but retained for version history.';
