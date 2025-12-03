-- Auto-increment version on entry updates for conflict detection
-- This ensures version is always incremented regardless of which client makes the update

-- Create function to auto-increment version for ENTRIES
CREATE OR REPLACE FUNCTION increment_entry_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if actual content fields changed (not just metadata)
  IF (
    OLD.title IS DISTINCT FROM NEW.title OR
    OLD.content IS DISTINCT FROM NEW.content OR
    OLD.tags IS DISTINCT FROM NEW.tags OR
    OLD.mentions IS DISTINCT FROM NEW.mentions OR
    OLD.category_id IS DISTINCT FROM NEW.category_id OR
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

-- Create function to auto-increment version for CATEGORIES
CREATE OR REPLACE FUNCTION increment_category_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if actual content fields changed
  IF (
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.full_path IS DISTINCT FROM NEW.full_path OR
    OLD.parent_id IS DISTINCT FROM NEW.parent_id OR
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

-- Drop old generic function if exists
DROP FUNCTION IF EXISTS increment_version_column() CASCADE;

-- Create trigger for entries
DROP TRIGGER IF EXISTS increment_entries_version ON entries;
CREATE TRIGGER increment_entries_version
  BEFORE UPDATE ON entries
  FOR EACH ROW
  EXECUTE FUNCTION increment_entry_version();

-- Create trigger for categories
DROP TRIGGER IF EXISTS increment_categories_version ON categories;
CREATE TRIGGER increment_categories_version
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION increment_category_version();

COMMENT ON FUNCTION increment_entry_version IS 'Auto-increments version column on entries when content fields change';
COMMENT ON FUNCTION increment_category_version IS 'Auto-increments version column on categories when content fields change';
