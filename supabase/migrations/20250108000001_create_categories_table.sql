-- Create categories table for hierarchical category organization
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL, -- lowercase, just leaf name (e.g., "filter")
  parent_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate siblings (same name under same parent for same user)
  CONSTRAINT unique_user_name_parent UNIQUE (user_id, name, parent_id)
);

-- Add indexes for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

-- Enable Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own categories
DROP POLICY IF EXISTS "Users can view their own categories" ON categories;
CREATE POLICY "Users can view their own categories"
  ON categories FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own categories" ON categories;
CREATE POLICY "Users can insert their own categories"
  ON categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own categories" ON categories;
CREATE POLICY "Users can update their own categories"
  ON categories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own categories" ON categories;
CREATE POLICY "Users can delete their own categories"
  ON categories FOR DELETE
  USING (auth.uid() = user_id);

-- Function to build full category path recursively
CREATE OR REPLACE FUNCTION get_category_path(category_id uuid)
RETURNS text AS $$
DECLARE
  path text := '';
  current_id uuid := category_id;
  current_name text;
  current_parent_id uuid;
BEGIN
  LOOP
    SELECT name, parent_id INTO current_name, current_parent_id
    FROM categories
    WHERE id = current_id;

    IF current_name IS NULL THEN
      EXIT;
    END IF;

    IF path = '' THEN
      path := current_name;
    ELSE
      path := current_name || '/' || path;
    END IF;

    IF current_parent_id IS NULL THEN
      EXIT;
    END IF;

    current_id := current_parent_id;
  END LOOP;

  RETURN path;
END;
$$ LANGUAGE plpgsql STABLE;
