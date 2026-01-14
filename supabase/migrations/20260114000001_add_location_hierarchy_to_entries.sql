-- Add location hierarchy fields directly to entries
-- This allows each entry to own its location data (immutable snapshot)
-- location_id remains as optional reference to a saved "anchor" location
--
-- Benefits:
-- - Every entry has geographic context even with just GPS (from reverse geocode)
-- - Self-contained entries for export/backup
-- - Entry data doesn't change if anchor location is edited
-- - Can query entries by city/region/country without joins

-- Add hierarchy fields to entries
ALTER TABLE entries ADD COLUMN IF NOT EXISTS place_name TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS subdivision TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS country TEXT;

-- Add indexes for common location queries
CREATE INDEX IF NOT EXISTS idx_entries_place_name ON entries(place_name)
  WHERE place_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entries_city ON entries(user_id, city)
  WHERE city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entries_region ON entries(user_id, region)
  WHERE region IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entries_country ON entries(user_id, country)
  WHERE country IS NOT NULL;

-- Backfill existing entries from their linked locations
UPDATE entries e
SET
  place_name = l.name,
  address = l.address,
  neighborhood = l.neighborhood,
  postal_code = l.postal_code,
  city = l.city,
  subdivision = l.subdivision,
  region = l.region,
  country = l.country
FROM locations l
WHERE e.location_id = l.location_id
  AND e.place_name IS NULL;

-- Add comments explaining field usage
COMMENT ON COLUMN entries.place_name IS 'Named place (e.g., "Starbucks", "Home") - from anchor or user input';
COMMENT ON COLUMN entries.address IS 'Street address';
COMMENT ON COLUMN entries.neighborhood IS 'Neighborhood name';
COMMENT ON COLUMN entries.postal_code IS 'Postal/ZIP code';
COMMENT ON COLUMN entries.city IS 'City name';
COMMENT ON COLUMN entries.subdivision IS 'County/district';
COMMENT ON COLUMN entries.region IS 'State/province';
COMMENT ON COLUMN entries.country IS 'Country name';
COMMENT ON COLUMN entries.location_id IS 'Optional reference to saved anchor location (data is copied, not dependent)';
