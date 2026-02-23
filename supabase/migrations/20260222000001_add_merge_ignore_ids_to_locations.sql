-- Add merge_ignore_ids column to locations table
-- Stores a JSON array of location_ids to suppress merge suggestions between saved places.
-- Used when the user explicitly marks two nearby places as "not a duplicate".

ALTER TABLE locations ADD COLUMN merge_ignore_ids TEXT;

COMMENT ON COLUMN locations.merge_ignore_ids IS 'JSON array of location_ids to suppress merge suggestions with';
