-- Add location_accuracy column to entries table
ALTER TABLE entries
ADD COLUMN IF NOT EXISTS location_accuracy double precision;

COMMENT ON COLUMN entries.location_accuracy IS 'GPS accuracy/precision in meters';
