-- Migration: Rename categories to streams and flatten hierarchy
-- This migration:
-- 1. Renames the categories table to streams
-- 2. Renames category_id to stream_id
-- 3. Removes parent hierarchy (parent_id, parent_category_id, depth, full_path)
-- 4. Updates entries.category_id to entries.stream_id
-- 5. Updates RLS policies and functions

-- ============================================================================
-- Step 1: Drop existing foreign key constraints
-- ============================================================================

-- Drop FK from entries to categories
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_category_id_fkey;

-- Drop self-referential FK for parent hierarchy
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_parent_category_id_fkey;

-- ============================================================================
-- Step 2: Drop hierarchy-related columns from categories
-- ============================================================================

ALTER TABLE categories DROP COLUMN IF EXISTS parent_id;
ALTER TABLE categories DROP COLUMN IF EXISTS parent_category_id;
ALTER TABLE categories DROP COLUMN IF EXISTS depth;
ALTER TABLE categories DROP COLUMN IF EXISTS full_path;

-- ============================================================================
-- Step 3: Rename the categories table to streams
-- ============================================================================

ALTER TABLE categories RENAME TO streams;

-- ============================================================================
-- Step 4: Rename primary key column category_id to stream_id
-- ============================================================================

ALTER TABLE streams RENAME COLUMN category_id TO stream_id;

-- ============================================================================
-- Step 5: Rename entries.category_id to entries.stream_id
-- ============================================================================

ALTER TABLE entries RENAME COLUMN category_id TO stream_id;

-- ============================================================================
-- Step 6: Recreate foreign key constraint with new names
-- ============================================================================

ALTER TABLE entries
ADD CONSTRAINT entries_stream_id_fkey
FOREIGN KEY (stream_id) REFERENCES streams(stream_id);

-- ============================================================================
-- Step 7: Update RLS policies for streams table
-- ============================================================================

-- Drop old category policies
DROP POLICY IF EXISTS "Users can view their own categories" ON streams;
DROP POLICY IF EXISTS "Users can create their own categories" ON streams;
DROP POLICY IF EXISTS "Users can update their own categories" ON streams;
DROP POLICY IF EXISTS "Users can delete their own categories" ON streams;

-- Create new stream policies
CREATE POLICY "Users can view their own streams"
  ON streams
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own streams"
  ON streams
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streams"
  ON streams
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own streams"
  ON streams
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Step 8: Update helper functions
-- ============================================================================

-- Drop old function
DROP FUNCTION IF EXISTS is_category_owner(UUID);

-- Create new function
CREATE OR REPLACE FUNCTION is_stream_owner(p_stream_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM streams
    WHERE stream_id = p_stream_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 9: Update table comments
-- ============================================================================

COMMENT ON TABLE streams IS 'Flat organizational structure for entries (like buckets/feeds). Users create streams to organize their captures.';

COMMENT ON COLUMN entries.stream_id IS 'Which stream the entry belongs to. NULL = Inbox (unorganized)';

COMMENT ON POLICY "Users can view their own streams" ON streams IS
  'RLS policy: Ensures users can only SELECT their own streams via user_id = auth.uid()';
