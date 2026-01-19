-- Make updated_at trigger smarter - only update for substantive changes
-- Don't update timestamp when only denormalized location data changes

DROP TRIGGER IF EXISTS update_entries_updated_at ON entries;

-- Keep the old function for other tables (attachments, profiles)
-- Create a new entries-specific function
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
    OLD.entry_latitude IS DISTINCT FROM NEW.entry_latitude OR
    OLD.entry_longitude IS DISTINCT FROM NEW.entry_longitude OR
    OLD.location_radius IS DISTINCT FROM NEW.location_radius OR

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
  --   subdivision, region, country (denormalized from linked location)
  -- - geocode_status (background geocoding status)

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the smart trigger
CREATE TRIGGER update_entries_updated_at
  BEFORE UPDATE ON entries
  FOR EACH ROW
  EXECUTE FUNCTION update_entries_updated_at_smart();

-- Add comment explaining the behavior
COMMENT ON FUNCTION update_entries_updated_at_smart() IS 'Only updates updated_at when substantive fields change. Skips timestamp update when only denormalized location hierarchy data changes (place_name, address, neighborhood, postal_code, city, subdivision, region, country). This preserves "last edited" semantics when location details are updated.';
