-- Add geo_ fields for immutable geographic data from reverse geocode
-- Display fields (address, city, region, etc.) remain user-editable
-- Geo fields store original geocode data for filtering/sorting

-- Add geo_ fields to entries table
ALTER TABLE entries ADD COLUMN IF NOT EXISTS geo_address TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS geo_neighborhood TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS geo_city TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS geo_subdivision TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS geo_region TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS geo_country TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS geo_postal_code TEXT;

-- Add geo_ fields to locations table
ALTER TABLE locations ADD COLUMN IF NOT EXISTS geo_address TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS geo_neighborhood TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS geo_city TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS geo_subdivision TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS geo_region TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS geo_country TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS geo_postal_code TEXT;

-- Create indexes for geo_ fields (used for filtering/sorting)
CREATE INDEX IF NOT EXISTS idx_entries_geo_city ON entries(user_id, geo_city)
  WHERE geo_city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entries_geo_region ON entries(user_id, geo_region)
  WHERE geo_region IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entries_geo_country ON entries(user_id, geo_country)
  WHERE geo_country IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_locations_geo_city ON locations(geo_city)
  WHERE geo_city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_locations_geo_region ON locations(geo_region)
  WHERE geo_region IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_locations_geo_country ON locations(geo_country)
  WHERE geo_country IS NOT NULL;

-- Backfill geo_ fields from display fields for existing data
-- (Since no user edits have occurred yet, display = geo)
UPDATE entries
SET
  geo_address = address,
  geo_neighborhood = neighborhood,
  geo_city = city,
  geo_subdivision = subdivision,
  geo_region = region,
  geo_country = country,
  geo_postal_code = postal_code
WHERE geo_city IS NULL AND city IS NOT NULL;

UPDATE locations
SET
  geo_address = address,
  geo_neighborhood = neighborhood,
  geo_city = city,
  geo_subdivision = subdivision,
  geo_region = region,
  geo_country = country,
  geo_postal_code = postal_code
WHERE geo_city IS NULL AND city IS NOT NULL;

-- Add comments explaining field usage
COMMENT ON COLUMN entries.geo_address IS 'Original street address from reverse geocode (immutable, for filtering)';
COMMENT ON COLUMN entries.geo_neighborhood IS 'Original neighborhood from reverse geocode (immutable, for filtering)';
COMMENT ON COLUMN entries.geo_city IS 'Original city from reverse geocode (immutable, for filtering)';
COMMENT ON COLUMN entries.geo_subdivision IS 'Original county/district from reverse geocode (immutable, for filtering)';
COMMENT ON COLUMN entries.geo_region IS 'Original state/province from reverse geocode (immutable, for filtering)';
COMMENT ON COLUMN entries.geo_country IS 'Original country from reverse geocode (immutable, for filtering)';
COMMENT ON COLUMN entries.geo_postal_code IS 'Original postal code from reverse geocode (immutable, for filtering)';

COMMENT ON COLUMN locations.geo_address IS 'Original street address from reverse geocode (immutable, for filtering)';
COMMENT ON COLUMN locations.geo_neighborhood IS 'Original neighborhood from reverse geocode (immutable, for filtering)';
COMMENT ON COLUMN locations.geo_city IS 'Original city from reverse geocode (immutable, for filtering)';
COMMENT ON COLUMN locations.geo_subdivision IS 'Original county/district from reverse geocode (immutable, for filtering)';
COMMENT ON COLUMN locations.geo_region IS 'Original state/province from reverse geocode (immutable, for filtering)';
COMMENT ON COLUMN locations.geo_country IS 'Original country from reverse geocode (immutable, for filtering)';
COMMENT ON COLUMN locations.geo_postal_code IS 'Original postal code from reverse geocode (immutable, for filtering)';
