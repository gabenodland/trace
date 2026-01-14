-- Add geocode_status field to track reverse geocode lookup state
-- This prevents redundant geocode API calls for entries that have already been processed
--
-- Values:
-- NULL = never attempted (legacy data or GPS captured offline)
-- 'pending' = geocoding in progress
-- 'success' = got hierarchy data (city/region/country)
-- 'no_data' = attempted but location has no address data (ocean, wilderness)
-- 'error' = API call failed (can retry later)

ALTER TABLE entries ADD COLUMN IF NOT EXISTS geocode_status TEXT;

-- Add check constraint for valid status values
ALTER TABLE entries ADD CONSTRAINT entries_geocode_status_check
  CHECK (geocode_status IS NULL OR geocode_status IN ('pending', 'success', 'no_data', 'error'));

-- Add index for finding entries that need geocoding
CREATE INDEX IF NOT EXISTS idx_entries_geocode_pending ON entries(user_id)
  WHERE geocode_status IS NULL AND entry_latitude IS NOT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN entries.geocode_status IS 'Reverse geocode lookup state: NULL=never attempted, pending=in progress, success=got data, no_data=no address data available, error=API failed';
