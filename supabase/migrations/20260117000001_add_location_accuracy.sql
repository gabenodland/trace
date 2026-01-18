-- Add accuracy column to locations table for GPS accuracy tracking
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS accuracy DOUBLE PRECISION;

COMMENT ON COLUMN locations.accuracy IS 'GPS accuracy/precision in meters when location was captured';
