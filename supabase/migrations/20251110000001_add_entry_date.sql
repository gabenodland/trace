-- Add entry_date column to entries table
-- This represents when the memory/event actually happened (not when it was created)
-- Defaults to created_at for existing entries, allowing backdating for memories

ALTER TABLE entries
ADD COLUMN IF NOT EXISTS entry_date TIMESTAMPTZ;

-- Set default to created_at for existing entries
UPDATE entries
SET entry_date = created_at
WHERE entry_date IS NULL;

-- Create index for sorting/filtering by entry_date
CREATE INDEX IF NOT EXISTS idx_entries_entry_date ON entries(user_id, entry_date DESC);

COMMENT ON COLUMN entries.entry_date IS 'The date when the memory/event actually occurred. Can be backdated for past memories. Defaults to created_at if not specified.';
