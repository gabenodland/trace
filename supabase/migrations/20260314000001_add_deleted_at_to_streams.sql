-- Add deleted_at column to streams table for soft-delete support.
-- Enables multi-device stream deletion: other devices pull the soft-deleted
-- stream and remove it locally, instead of re-pushing it.

-- Step 1: Add column
ALTER TABLE streams ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Step 2: Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_streams_deleted_at ON streams(deleted_at) WHERE deleted_at IS NULL;

-- Step 3: Update updated_at trigger to fire on deleted_at changes
-- (so incremental pull picks up soft-deleted streams)
CREATE OR REPLACE FUNCTION update_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.name IS DISTINCT FROM NEW.name OR
      OLD.color IS DISTINCT FROM NEW.color OR
      OLD.icon IS DISTINCT FROM NEW.icon OR
      OLD.deleted_at IS DISTINCT FROM NEW.deleted_at) THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Update version trigger to include deleted_at
CREATE OR REPLACE FUNCTION increment_stream_version()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.color IS DISTINCT FROM NEW.color OR
    OLD.icon IS DISTINCT FROM NEW.icon OR
    OLD.entry_title_template IS DISTINCT FROM NEW.entry_title_template OR
    OLD.entry_content_template IS DISTINCT FROM NEW.entry_content_template OR
    OLD.entry_use_rating IS DISTINCT FROM NEW.entry_use_rating OR
    OLD.entry_use_priority IS DISTINCT FROM NEW.entry_use_priority OR
    OLD.entry_use_status IS DISTINCT FROM NEW.entry_use_status OR
    OLD.entry_use_duedates IS DISTINCT FROM NEW.entry_use_duedates OR
    OLD.entry_use_location IS DISTINCT FROM NEW.entry_use_location OR
    OLD.entry_use_photos IS DISTINCT FROM NEW.entry_use_photos OR
    OLD.entry_content_type IS DISTINCT FROM NEW.entry_content_type OR
    OLD.is_private IS DISTINCT FROM NEW.is_private OR
    OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
  ) THEN
    NEW.version = COALESCE(OLD.version, 1) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN streams.deleted_at IS 'Soft-delete timestamp. Non-null means stream is deleted but retained for multi-device sync.';
