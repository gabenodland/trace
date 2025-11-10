-- Add soft delete support to entries table
-- This allows bidirectional sync to properly handle deletions

-- Add deleted_at column for soft deletes
ALTER TABLE entries
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Add index for performance (filter out deleted entries)
CREATE INDEX IF NOT EXISTS idx_entries_deleted_at ON entries(deleted_at)
WHERE deleted_at IS NULL;

-- Add index for sync queries (find recently changed/deleted entries)
CREATE INDEX IF NOT EXISTS idx_entries_updated_at_deleted ON entries(updated_at DESC, deleted_at);

-- Update RLS policies to exclude deleted entries by default
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own entries" ON entries;
DROP POLICY IF EXISTS "Users can insert their own entries" ON entries;
DROP POLICY IF EXISTS "Users can update their own entries" ON entries;
DROP POLICY IF EXISTS "Users can delete their own entries" ON entries;

-- Recreate policies with deleted_at checks
CREATE POLICY "Users can view their own entries"
  ON entries FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert their own entries"
  ON entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own entries"
  ON entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Soft delete: Update deleted_at instead of hard delete
CREATE POLICY "Users can soft delete their own entries"
  ON entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add function to get all entries including deleted (for sync)
-- This function bypasses RLS for sync operations
CREATE OR REPLACE FUNCTION get_entries_for_sync(
  since_timestamp timestamptz DEFAULT NULL
)
RETURNS TABLE (
  entry_id uuid,
  user_id uuid,
  title text,
  content text,
  tags text[],
  mentions text[],
  category_id uuid,
  location_lat numeric,
  location_lng numeric,
  location_accuracy numeric,
  location_name text,
  status text,
  due_date timestamptz,
  completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  attachments jsonb
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT
    e.entry_id,
    e.user_id,
    e.title,
    e.content,
    e.tags,
    e.mentions,
    e.category_id,
    e.location_lat,
    e.location_lng,
    e.location_accuracy,
    e.location_name,
    e.status,
    e.due_date,
    e.completed_at,
    e.created_at,
    e.updated_at,
    e.deleted_at,
    e.attachments
  FROM entries e
  WHERE e.user_id = auth.uid()
    AND (since_timestamp IS NULL OR e.updated_at > since_timestamp);
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_entries_for_sync(timestamptz) TO authenticated;

-- Comment on the function
COMMENT ON FUNCTION get_entries_for_sync IS
'Returns all entries (including soft-deleted) modified since a timestamp for sync operations. Respects user_id but bypasses deleted_at RLS check.';
