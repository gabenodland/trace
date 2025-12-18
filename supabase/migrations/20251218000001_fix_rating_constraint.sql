-- ============================================================================
-- Fix Rating Constraint for 0-10 Scale
-- ============================================================================
-- The original rating constraint (20251125) only allowed 0-5 scale.
-- Migration 20251213 changed the design to store ratings on 0-10 scale internally.
-- This migration fixes the constraint to match the new design.
-- ============================================================================

-- Step 1: Drop the old constraint
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_rating_check;

-- Step 2: Update column precision to support 0-10 scale (e.g., 10.00)
ALTER TABLE entries
ALTER COLUMN rating TYPE numeric(4,2);

-- Step 3: Add new constraint for 0-10 scale
ALTER TABLE entries
ADD CONSTRAINT entries_rating_check CHECK (rating >= 0 AND rating <= 10);

-- Step 4: Update comment
COMMENT ON COLUMN entries.rating IS 'Decimal rating from 0.00 to 10.00 (stored internally on 0-10 scale)';
