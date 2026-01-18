-- Rename accuracy columns to location_radius
-- This clarifies that it's a user-selected radius for privacy/generalization,
-- NOT GPS measurement accuracy (which is transient and not stored)

-- Rename on locations table
ALTER TABLE locations RENAME COLUMN accuracy TO location_radius;

COMMENT ON COLUMN locations.location_radius IS 'User-selected radius in meters for location generalization (privacy feature)';

-- Rename on entries table
ALTER TABLE entries RENAME COLUMN location_accuracy TO location_radius;

COMMENT ON COLUMN entries.location_radius IS 'User-selected radius in meters for location generalization (privacy feature)';
