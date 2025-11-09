-- Add missing columns to categories table if they don't exist
DO $$
BEGIN
  -- Add parent_id column if it doesn't exist (without FK constraint first)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN parent_id uuid;
  END IF;

  -- Add created_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE categories ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Add foreign key constraint for parent_category_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'categories_parent_category_id_fkey'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_parent_category_id_fkey
      FOREIGN KEY (parent_category_id) REFERENCES categories(category_id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_user_name_parent'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT unique_user_name_parent UNIQUE (user_id, name, parent_id);
  END IF;
END $$;

-- Add indexes for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);

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
