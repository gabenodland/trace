-- Add new geocode_status values: 'snapped' and 'manual'
--
-- Values:
-- NULL = never attempted (legacy data or GPS captured offline)
-- 'pending' = geocoding in progress
-- 'success' = got hierarchy data from Mapbox reverse geocode API
-- 'snapped' = matched to a saved location (no API call needed)
-- 'no_data' = API returned no address data (ocean, wilderness)
-- 'error' = API call failed (can retry later)
-- 'manual' = user manually entered location data

-- Drop the old constraint
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_geocode_status_check;

-- Add updated constraint with new values
ALTER TABLE entries ADD CONSTRAINT entries_geocode_status_check
  CHECK (geocode_status IS NULL OR geocode_status IN ('pending', 'success', 'snapped', 'no_data', 'error', 'manual'));

-- Update comment
COMMENT ON COLUMN entries.geocode_status IS 'Location data source: NULL=never attempted, pending=in progress, success=Mapbox API, snapped=matched saved location, no_data=no address data, error=API failed, manual=user entered';
