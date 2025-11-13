-- Add conflict resolution columns for multi-device sync
-- These columns enable detection and resolution of conflicts when the same entry
-- is edited on multiple devices or through different clients (mobile/web)

-- Add conflict resolution columns to entries table
ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS base_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS conflict_status TEXT CHECK (conflict_status IN ('conflicted', 'resolved') OR conflict_status IS NULL),
  ADD COLUMN IF NOT EXISTS conflict_backup JSONB,
  ADD COLUMN IF NOT EXISTS last_edited_by TEXT,
  ADD COLUMN IF NOT EXISTS last_edited_device TEXT;

-- Add conflict resolution columns to categories table
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS base_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS conflict_status TEXT CHECK (conflict_status IN ('conflicted', 'resolved') OR conflict_status IS NULL),
  ADD COLUMN IF NOT EXISTS conflict_backup JSONB,
  ADD COLUMN IF NOT EXISTS last_edited_by TEXT,
  ADD COLUMN IF NOT EXISTS last_edited_device TEXT;

-- Create indexes for conflict queries
CREATE INDEX IF NOT EXISTS idx_entries_conflict_status ON entries(conflict_status) WHERE conflict_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categories_conflict_status ON categories(conflict_status) WHERE conflict_status IS NOT NULL;

-- Add comments explaining the columns
COMMENT ON COLUMN entries.version IS 'Increments with each edit - used for conflict detection';
COMMENT ON COLUMN entries.base_version IS 'Server version this edit is based on - used for 3-way merge conflict detection';
COMMENT ON COLUMN entries.conflict_status IS 'null (no conflict), conflicted (conflict detected), or resolved (user resolved conflict)';
COMMENT ON COLUMN entries.conflict_backup IS 'JSON backup of losing version when conflict is detected';
COMMENT ON COLUMN entries.last_edited_by IS 'Email of user who last edited this entry';
COMMENT ON COLUMN entries.last_edited_device IS 'Device name that last edited this entry';

COMMENT ON COLUMN categories.version IS 'Increments with each edit - used for conflict detection';
COMMENT ON COLUMN categories.base_version IS 'Server version this edit is based on - used for 3-way merge conflict detection';
COMMENT ON COLUMN categories.conflict_status IS 'null (no conflict), conflicted (conflict detected), or resolved (user resolved conflict)';
COMMENT ON COLUMN categories.conflict_backup IS 'JSON backup of losing version when conflict is detected';
COMMENT ON COLUMN categories.last_edited_by IS 'Email of user who last edited this category';
COMMENT ON COLUMN categories.last_edited_device IS 'Device name that last edited this category';
