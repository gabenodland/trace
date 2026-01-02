-- ============================================================================
-- Fix Triggers Referencing Old category_id Column
-- ============================================================================
-- The category_id column was renamed to stream_id, but several triggers still
-- reference the old column name. This migration fixes them.
-- ============================================================================

-- ============================================================================
-- Step 1: Drop old entry count trigger/function (no longer relevant)
-- ============================================================================

-- Drop ALL possible trigger names first (depends on function)
DROP TRIGGER IF EXISTS trigger_update_category_entry_count ON entries;
DROP TRIGGER IF EXISTS update_category_entry_count ON entries;
DROP TRIGGER IF EXISTS update_category_entry_count_trigger ON entries;

-- Now drop the function (CASCADE to catch any remaining deps)
DROP FUNCTION IF EXISTS update_category_entry_count() CASCADE;

-- ============================================================================
-- Step 2: Fix increment_entry_version function
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_entry_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if actual content fields changed (not just metadata)
  IF (
    OLD.title IS DISTINCT FROM NEW.title OR
    OLD.content IS DISTINCT FROM NEW.content OR
    OLD.tags IS DISTINCT FROM NEW.tags OR
    OLD.mentions IS DISTINCT FROM NEW.mentions OR
    OLD.stream_id IS DISTINCT FROM NEW.stream_id OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.due_date IS DISTINCT FROM NEW.due_date OR
    OLD.completed_at IS DISTINCT FROM NEW.completed_at OR
    OLD.entry_date IS DISTINCT FROM NEW.entry_date OR
    OLD.entry_latitude IS DISTINCT FROM NEW.entry_latitude OR
    OLD.entry_longitude IS DISTINCT FROM NEW.entry_longitude OR
    OLD.location_id IS DISTINCT FROM NEW.location_id OR
    OLD.priority IS DISTINCT FROM NEW.priority OR
    OLD.rating IS DISTINCT FROM NEW.rating OR
    OLD.is_pinned IS DISTINCT FROM NEW.is_pinned OR
    OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
  ) THEN
    NEW.version = COALESCE(OLD.version, 1) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 3: Fix increment_category_version for streams table
-- ============================================================================

-- Rename function to match new table name
CREATE OR REPLACE FUNCTION increment_stream_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if actual content fields changed
  -- Note: full_path and parent_id were removed when categories became streams
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
    OLD.is_private IS DISTINCT FROM NEW.is_private
  ) THEN
    NEW.version = COALESCE(OLD.version, 1) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger (categories was renamed to streams, so trigger only exists on streams)
DROP TRIGGER IF EXISTS increment_categories_version ON streams;
DROP TRIGGER IF EXISTS increment_streams_version ON streams;

-- Create new trigger on streams table
CREATE TRIGGER increment_streams_version
  BEFORE UPDATE ON streams
  FOR EACH ROW
  EXECUTE FUNCTION increment_stream_version();

-- Drop old function
DROP FUNCTION IF EXISTS increment_category_version();

-- ============================================================================
-- Step 4: Update comments
-- ============================================================================

COMMENT ON FUNCTION increment_entry_version IS 'Auto-increments version column on entries when content fields change';
COMMENT ON FUNCTION increment_stream_version IS 'Auto-increments version column on streams when content fields change';
