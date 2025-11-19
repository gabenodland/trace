-- Add comprehensive location tracking fields to entries table
-- Migration: Add location fields for GPS privacy, hierarchy, and API integration

-- Add new location fields
ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS location_latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS location_longitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS location_name_original VARCHAR(255),
  ADD COLUMN IF NOT EXISTS location_name_source VARCHAR(20),
  ADD COLUMN IF NOT EXISTS location_neighborhood VARCHAR(100),
  ADD COLUMN IF NOT EXISTS location_postal_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS location_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS location_subdivision VARCHAR(100),
  ADD COLUMN IF NOT EXISTS location_region VARCHAR(100),
  ADD COLUMN IF NOT EXISTS location_country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS location_precision VARCHAR(20),
  ADD COLUMN IF NOT EXISTS location_mapbox_place_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS location_foursquare_fsq_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS location_mapbox_json JSONB;

-- Add indexes for performance on common location queries
CREATE INDEX IF NOT EXISTS idx_entries_location_coords ON entries(location_latitude, location_longitude)
  WHERE location_latitude IS NOT NULL AND location_longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entries_gps_coords ON entries(location_lat, location_lng)
  WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entries_foursquare_id ON entries(location_foursquare_fsq_id)
  WHERE location_foursquare_fsq_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entries_location_city ON entries(user_id, location_city)
  WHERE location_city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entries_location_precision ON entries(location_precision)
  WHERE location_precision IS NOT NULL;

-- Add constraint for location_name_source enum values
ALTER TABLE entries
  ADD CONSTRAINT entries_location_name_source_check
  CHECK (location_name_source IN ('mapbox_poi', 'foursquare_poi', 'google_poi', 'user_custom', NULL));

-- Add constraint for location_precision enum values
ALTER TABLE entries
  ADD CONSTRAINT entries_location_precision_check
  CHECK (location_precision IN ('coords', 'poi', 'address', 'neighborhood', 'city', 'region', 'country', NULL));

-- Add comment explaining field usage
COMMENT ON COLUMN entries.location_lat IS 'Private GPS latitude - exact capture point, never changes, never shared';
COMMENT ON COLUMN entries.location_lng IS 'Private GPS longitude - exact capture point, never changes, never shared';
COMMENT ON COLUMN entries.location_latitude IS 'Public display latitude - respects privacy precision level';
COMMENT ON COLUMN entries.location_longitude IS 'Public display longitude - respects privacy precision level';
COMMENT ON COLUMN entries.location_name IS 'Current display name (user-editable)';
COMMENT ON COLUMN entries.location_name_original IS 'Original name from API (readonly, for matching)';
COMMENT ON COLUMN entries.location_name_source IS 'Source of location name: mapbox_poi, foursquare_poi, google_poi, user_custom';
COMMENT ON COLUMN entries.location_precision IS 'Privacy precision level: coords, poi, address, neighborhood, city, region, country';
COMMENT ON COLUMN entries.location_mapbox_json IS 'Full Mapbox API response for future feature use';
