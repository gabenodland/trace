-- Replace location_mapbox_json with location_address
-- The address field will store a formatted street address string

-- Add location_address column
ALTER TABLE entries
  ADD COLUMN location_address TEXT;

-- Drop location_mapbox_json column (it was redundant)
ALTER TABLE entries
  DROP COLUMN location_mapbox_json;

-- Add comment to clarify the purpose
COMMENT ON COLUMN entries.location_address IS 'Formatted street address (e.g., "123 Main St")';
