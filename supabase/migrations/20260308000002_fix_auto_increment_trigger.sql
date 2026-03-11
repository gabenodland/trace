-- Fix auto-increment version trigger: category_id -> stream_id, add missing fields
-- The original trigger (20251203000001) references category_id which was renamed to stream_id,
-- and is missing several fields that should trigger version increments.

CREATE OR REPLACE FUNCTION increment_entry_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if actual content fields changed (not just sync metadata)
  IF (
    OLD.title IS DISTINCT FROM NEW.title OR
    OLD.content IS DISTINCT FROM NEW.content OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.type IS DISTINCT FROM NEW.type OR
    OLD.priority IS DISTINCT FROM NEW.priority OR
    OLD.rating IS DISTINCT FROM NEW.rating OR
    OLD.tags IS DISTINCT FROM NEW.tags OR
    OLD.mentions IS DISTINCT FROM NEW.mentions OR
    OLD.stream_id IS DISTINCT FROM NEW.stream_id OR
    OLD.due_date IS DISTINCT FROM NEW.due_date OR
    OLD.completed_at IS DISTINCT FROM NEW.completed_at OR
    OLD.is_pinned IS DISTINCT FROM NEW.is_pinned OR
    OLD.entry_date IS DISTINCT FROM NEW.entry_date OR
    OLD.is_archived IS DISTINCT FROM NEW.is_archived OR
    OLD.entry_latitude IS DISTINCT FROM NEW.entry_latitude OR
    OLD.entry_longitude IS DISTINCT FROM NEW.entry_longitude OR
    OLD.location_id IS DISTINCT FROM NEW.location_id OR
    OLD.geocode_status IS DISTINCT FROM NEW.geocode_status OR
    OLD.place_name IS DISTINCT FROM NEW.place_name OR
    OLD.address IS DISTINCT FROM NEW.address OR
    OLD.neighborhood IS DISTINCT FROM NEW.neighborhood OR
    OLD.postal_code IS DISTINCT FROM NEW.postal_code OR
    OLD.city IS DISTINCT FROM NEW.city OR
    OLD.subdivision IS DISTINCT FROM NEW.subdivision OR
    OLD.region IS DISTINCT FROM NEW.region OR
    OLD.country IS DISTINCT FROM NEW.country
  ) THEN
    NEW.version = COALESCE(OLD.version, 1) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_entry_version IS 'Auto-increments version column on entries when content fields change (fixed: stream_id, added location hierarchy and missing fields)';
