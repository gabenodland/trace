-- Trace Row-Level Security (RLS) Policies
-- This migration enables RLS and creates policies for data isolation
-- Each user can only access their own entries and categories

-- ============================================================================
-- Enable RLS on all tables
-- ============================================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Categories RLS Policies
-- ============================================================================

-- Policy: Users can view only their own categories
CREATE POLICY "Users can view their own categories"
  ON categories
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert categories for themselves
CREATE POLICY "Users can create their own categories"
  ON categories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update only their own categories
CREATE POLICY "Users can update their own categories"
  ON categories
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete only their own categories
CREATE POLICY "Users can delete their own categories"
  ON categories
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Entries RLS Policies
-- ============================================================================

-- Policy: Users can view only their own entries
CREATE POLICY "Users can view their own entries"
  ON entries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert entries for themselves
CREATE POLICY "Users can create their own entries"
  ON entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update only their own entries
CREATE POLICY "Users can update their own entries"
  ON entries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete only their own entries
CREATE POLICY "Users can delete their own entries"
  ON entries
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Additional Security Functions
-- ============================================================================

-- Function to check if a category belongs to the authenticated user
-- Useful for application-level checks
CREATE OR REPLACE FUNCTION is_category_owner(p_category_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM categories
    WHERE category_id = p_category_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if an entry belongs to the authenticated user
CREATE OR REPLACE FUNCTION is_entry_owner(p_entry_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM entries
    WHERE entry_id = p_entry_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON POLICY "Users can view their own categories" ON categories IS
  'RLS policy: Ensures users can only SELECT their own categories via user_id = auth.uid()';

COMMENT ON POLICY "Users can view their own entries" ON entries IS
  'RLS policy: Ensures users can only SELECT their own entries via user_id = auth.uid()';
