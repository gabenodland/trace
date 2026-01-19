-- Drop unused geo_ fields that were never used for filtering
-- These fields were intended for immutable geographic data but location filtering
-- uses the regular display fields (address, city, region, country, etc.) instead

-- Drop indexes first
DROP INDEX IF EXISTS idx_entries_geo_city;
DROP INDEX IF EXISTS idx_entries_geo_region;
DROP INDEX IF EXISTS idx_entries_geo_country;
DROP INDEX IF EXISTS idx_locations_geo_city;
DROP INDEX IF EXISTS idx_locations_geo_region;
DROP INDEX IF EXISTS idx_locations_geo_country;

-- Drop columns from entries table
ALTER TABLE entries DROP COLUMN IF EXISTS geo_address;
ALTER TABLE entries DROP COLUMN IF EXISTS geo_neighborhood;
ALTER TABLE entries DROP COLUMN IF EXISTS geo_city;
ALTER TABLE entries DROP COLUMN IF EXISTS geo_subdivision;
ALTER TABLE entries DROP COLUMN IF EXISTS geo_region;
ALTER TABLE entries DROP COLUMN IF EXISTS geo_country;
ALTER TABLE entries DROP COLUMN IF EXISTS geo_postal_code;

-- Drop columns from locations table
ALTER TABLE locations DROP COLUMN IF EXISTS geo_address;
ALTER TABLE locations DROP COLUMN IF EXISTS geo_neighborhood;
ALTER TABLE locations DROP COLUMN IF EXISTS geo_city;
ALTER TABLE locations DROP COLUMN IF EXISTS geo_subdivision;
ALTER TABLE locations DROP COLUMN IF EXISTS geo_region;
ALTER TABLE locations DROP COLUMN IF EXISTS geo_country;
ALTER TABLE locations DROP COLUMN IF EXISTS geo_postal_code;
