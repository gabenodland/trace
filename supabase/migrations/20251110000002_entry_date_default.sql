-- Add default constraint to entry_date column
-- Ensures entry_date is never null by defaulting to current timestamp

ALTER TABLE entries
ALTER COLUMN entry_date SET DEFAULT CURRENT_TIMESTAMP;

-- Backfill any remaining null values (just in case)
UPDATE entries
SET entry_date = created_at
WHERE entry_date IS NULL;
