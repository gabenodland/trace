-- ============================================================================
-- Add Entry Types Configuration
-- ============================================================================
-- This migration adds user-defined type configuration to streams and entries:
-- - entry_types: Array of custom type names for entries in this stream
-- - entry_use_type: Toggle to enable/disable type feature per stream
-- - type: The selected type on an entry
-- ============================================================================

-- Add entry_types column to streams (array of custom type strings)
-- Default: empty array (types must be configured to be available)
ALTER TABLE streams
ADD COLUMN IF NOT EXISTS entry_types TEXT[] DEFAULT '{}';

-- Add entry_use_type toggle to streams
-- Default: false (disabled until user enables and configures types)
ALTER TABLE streams
ADD COLUMN IF NOT EXISTS entry_use_type BOOLEAN DEFAULT false;

-- Add type column to entries
-- Stores the user-selected type as text (nullable)
ALTER TABLE entries
ADD COLUMN IF NOT EXISTS type TEXT;

-- Create index for type lookups on entries
CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type);

-- Add column comments for documentation
COMMENT ON COLUMN streams.entry_types IS 'Array of custom type names available for entries in this stream. User-defined, stored alphabetically.';
COMMENT ON COLUMN streams.entry_use_type IS 'Whether the type feature is enabled for this stream. Default: false.';
COMMENT ON COLUMN entries.type IS 'User-selected type for this entry. Must be one of the types defined in the stream.';
