-- Auto-increment version on entry updates for conflict detection
-- This ensures version is always incremented regardless of which client makes the update

-- Create function to auto-increment version
CREATE OR REPLACE FUNCTION increment_version_column()
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

-- Create trigger for entries
DROP TRIGGER IF EXISTS increment_entries_version ON entries;
CREATE TRIGGER increment_entries_version
  BEFORE UPDATE ON entries
  FOR EACH ROW
  EXECUTE FUNCTION increment_version_column();

-- Create trigger for categories
DROP TRIGGER IF EXISTS increment_categories_version ON categories;
CREATE TRIGGER increment_categories_version
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION increment_version_column();

COMMENT ON FUNCTION increment_version_column IS 'Auto-increments version column when content fields change, used for sync conflict detection';
