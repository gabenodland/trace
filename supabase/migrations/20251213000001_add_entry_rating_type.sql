-- ============================================================================
-- Add Entry Rating Type Configuration
-- ============================================================================
-- This migration adds rating type configuration to streams:
-- - entry_rating_type: The type of rating display ('stars' or 'decimal')
--
-- Rating storage:
-- - All ratings stored on 0-10 scale internally
-- - Stars mode: displays as 1-5 stars (thresholds: 0.1-2.5=1, 2.6-4.5=2, etc.)
-- - Decimal mode: displays as 0.0-10.0 with tenths precision
-- ============================================================================

-- Add entry_rating_type column to streams
-- Default: 'stars' (traditional 1-5 star display)
ALTER TABLE streams
ADD COLUMN IF NOT EXISTS entry_rating_type TEXT DEFAULT 'stars';

-- Add constraint to ensure valid rating types
ALTER TABLE streams
ADD CONSTRAINT chk_entry_rating_type CHECK (entry_rating_type IN ('stars', 'decimal_whole', 'decimal'));

-- Add column comment for documentation
COMMENT ON COLUMN streams.entry_rating_type IS 'Rating display type: stars (1-5 stars), decimal_whole (0-10 whole numbers), or decimal (0-10 with tenths). All ratings stored internally on 0-10 scale.';
