-- Rename location_lat/location_lng to entry_latitude/entry_longitude
-- These coordinates represent where the user was when creating the entry (GPS capture)
-- They are separate from the location the user tags/selects for the entry

-- Rename location_lat to entry_latitude
ALTER TABLE entries
  RENAME COLUMN location_lat TO entry_latitude;

-- Rename location_lng to entry_longitude
ALTER TABLE entries
  RENAME COLUMN location_lng TO entry_longitude;

-- Add comments to clarify the difference
COMMENT ON COLUMN entries.entry_latitude IS 'GPS latitude captured when entry was created (exact location of user)';
COMMENT ON COLUMN entries.entry_longitude IS 'GPS longitude captured when entry was created (exact location of user)';
COMMENT ON COLUMN entries.location_name IS 'Name of the location tagged in this entry (may differ from GPS capture location)';
