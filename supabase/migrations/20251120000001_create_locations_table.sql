-- Create locations table for normalized location storage
-- Entries will reference locations via location_id instead of storing all location fields

-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
  location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  source TEXT, -- 'mapbox_poi', 'foursquare', 'user_custom', 'gps'
  address TEXT,
  neighborhood TEXT,
  postal_code TEXT,
  city TEXT,
  subdivision TEXT,
  region TEXT,
  country TEXT,
  mapbox_place_id TEXT,
  foursquare_fsq_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete support
);

-- Create indexes for locations table
CREATE INDEX idx_locations_user_id ON locations(user_id);
CREATE INDEX idx_locations_name ON locations(name);
CREATE INDEX idx_locations_city ON locations(city);
CREATE INDEX idx_locations_coords ON locations(latitude, longitude);
CREATE INDEX idx_locations_deleted_at ON locations(deleted_at);

-- Add location_id to entries table
ALTER TABLE entries ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(location_id);

-- Create index for location_id on entries
CREATE INDEX idx_entries_location_id ON entries(location_id);

-- Drop old location columns from entries (keeping GPS capture fields)
-- We keep entry_latitude, entry_longitude, location_accuracy for GPS capture
ALTER TABLE entries DROP COLUMN IF EXISTS location_latitude;
ALTER TABLE entries DROP COLUMN IF EXISTS location_longitude;
ALTER TABLE entries DROP COLUMN IF EXISTS location_name;
ALTER TABLE entries DROP COLUMN IF EXISTS location_name_original;
ALTER TABLE entries DROP COLUMN IF EXISTS location_name_source;
ALTER TABLE entries DROP COLUMN IF EXISTS location_address;
ALTER TABLE entries DROP COLUMN IF EXISTS location_neighborhood;
ALTER TABLE entries DROP COLUMN IF EXISTS location_postal_code;
ALTER TABLE entries DROP COLUMN IF EXISTS location_city;
ALTER TABLE entries DROP COLUMN IF EXISTS location_subdivision;
ALTER TABLE entries DROP COLUMN IF EXISTS location_region;
ALTER TABLE entries DROP COLUMN IF EXISTS location_country;
ALTER TABLE entries DROP COLUMN IF EXISTS location_precision;
ALTER TABLE entries DROP COLUMN IF EXISTS location_mapbox_place_id;
ALTER TABLE entries DROP COLUMN IF EXISTS location_foursquare_fsq_id;

-- Enable RLS on locations
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- RLS policies for locations
CREATE POLICY "Users can view their own locations"
  ON locations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own locations"
  ON locations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own locations"
  ON locations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own locations"
  ON locations FOR DELETE
  USING (auth.uid() = user_id);

-- Updated at trigger for locations
CREATE OR REPLACE FUNCTION update_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER locations_updated_at_trigger
  BEFORE UPDATE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION update_locations_updated_at();
