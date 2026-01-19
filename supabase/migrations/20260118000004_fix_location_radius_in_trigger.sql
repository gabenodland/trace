-- Fix: location_radius should NOT trigger updated_at changes
-- It's a denormalized field that syncs from linked location records

DROP TRIGGER IF EXISTS update_entries_updated_at ON entries;
DROP FUNCTION IF EXISTS update_entries_updated_at_smart();

-- Fixed function - location_radius is now excluded from substantive changes
CREATE OR REPLACE FUNCTION update_entries_updated_at_smart()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if any substantive fields changed (not just denormalized location data)
  -- Substantive fields: title, content, tags, mentions, stream_id, status, type,
  -- due_date, completed_at, entry_date, priority, rating, is_pinned, entry_latitude,
  -- entry_longitude, location_id (linking to different location)

  -- If ONLY location hierarchy fields changed (denormalized data from linked location),
  -- preserve the original updated_at timestamp
  IF (
    -- Core content fields
    OLD.title IS DISTINCT FROM NEW.title OR
    OLD.content IS DISTINCT FROM NEW.content OR
    OLD.tags IS DISTINCT FROM NEW.tags OR
    OLD.mentions IS DISTINCT FROM NEW.mentions OR
    OLD.stream_id IS DISTINCT FROM NEW.stream_id OR

    -- Task fields
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.type IS DISTINCT FROM NEW.type OR
    OLD.due_date IS DISTINCT FROM NEW.due_date OR
    OLD.completed_at IS DISTINCT FROM NEW.completed_at OR

    -- Metadata fields
    OLD.entry_date IS DISTINCT FROM NEW.entry_date OR
    OLD.priority IS DISTINCT FROM NEW.priority OR
    OLD.rating IS DISTINCT FROM NEW.rating OR
    OLD.is_pinned IS DISTINCT FROM NEW.is_pinned OR

    -- GPS coordinates (actual location where entry was created)
    -- NOTE: location_radius is EXCLUDED - it's denormalized from linked location
    OLD.entry_latitude IS DISTINCT FROM NEW.entry_latitude OR
    OLD.entry_longitude IS DISTINCT FROM NEW.entry_longitude OR

    -- Location link (changing which saved location this entry uses)
    OLD.location_id IS DISTINCT FROM NEW.location_id OR

    -- Soft delete
    OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
  ) THEN
    -- Substantive change - update timestamp
    NEW.updated_at = now();
  END IF;

  -- If only these fields changed, DON'T update timestamp:
  -- - place_name, address, neighborhood, postal_code, city,
  --   subdivision, region, country, location_radius (denormalized from linked location)
  -- - geocode_status (background geocoding status)

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the fixed trigger
CREATE TRIGGER update_entries_updated_at
  BEFORE UPDATE ON entries
  FOR EACH ROW
  EXECUTE FUNCTION update_entries_updated_at_smart();

-- Update comment to include location_radius
COMMENT ON FUNCTION update_entries_updated_at_smart() IS 'Only updates updated_at when substantive fields change. Skips timestamp update when only denormalized location hierarchy data changes (place_name, address, neighborhood, postal_code, city, subdivision, region, country, location_radius). This preserves "last edited" semantics when location details are updated.';
