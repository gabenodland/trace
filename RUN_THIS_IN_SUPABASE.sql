-- ============================================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================================
-- Project: https://supabase.com/dashboard/project/lsszorssvkavegobmqic/editor
--
-- This adds the priority, rating, and is_pinned fields to the entries table
-- ============================================================================

-- Add priority field (integer for future sorting/filtering)
ALTER TABLE entries
ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0 NOT NULL;

-- Add rating field (decimal for future rating system, 0-5 scale)
ALTER TABLE entries
ADD COLUMN IF NOT EXISTS rating numeric(3,2) DEFAULT 0.00 NOT NULL
CHECK (rating >= 0 AND rating <= 5);

-- Add is_pinned field (boolean for pinning important entries)
ALTER TABLE entries
ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false NOT NULL;

-- Create index for pinned entries (for faster queries filtering by pinned status)
CREATE INDEX IF NOT EXISTS idx_entries_is_pinned ON entries(is_pinned) WHERE is_pinned = true;

-- Create index for priority (for future sorting)
CREATE INDEX IF NOT EXISTS idx_entries_priority ON entries(priority DESC);

-- Add comments for documentation
COMMENT ON COLUMN entries.priority IS 'Integer priority level for sorting and filtering (default: 0)';
COMMENT ON COLUMN entries.rating IS 'Decimal rating from 0.00 to 5.00 (default: 0.00)';
COMMENT ON COLUMN entries.is_pinned IS 'Boolean flag to pin important entries to the top (default: false)';

-- ============================================================================
-- AFTER RUNNING THIS SQL, run these commands in your terminal:
-- ============================================================================
-- 1. Regenerate TypeScript types:
--    npx supabase gen types typescript --project-id lsszorssvkavegobmqic > packages/core/src/shared/database.types.ts
--
-- 2. Rebuild core package:
--    cd packages/core && npm run build
--
-- 3. Verify it worked:
--    npx supabase gen types typescript --project-id lsszorssvkavegobmqic | grep -A 2 "priority"
--    (You should see: priority: number)
-- ============================================================================
