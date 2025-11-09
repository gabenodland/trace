-- Add full_path and depth columns to categories table for efficient querying
DO $$
BEGIN
  -- Add full_path column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'full_path'
  ) THEN
    ALTER TABLE categories ADD COLUMN full_path text NOT NULL DEFAULT '';
  END IF;

  -- Add depth column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'depth'
  ) THEN
    ALTER TABLE categories ADD COLUMN depth integer NOT NULL DEFAULT 1;
  END IF;

  -- Add entry_count column if it doesn't exist (for caching)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'entry_count'
  ) THEN
    ALTER TABLE categories ADD COLUMN entry_count integer NOT NULL DEFAULT 0;
  END IF;

  -- Add color column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'color'
  ) THEN
    ALTER TABLE categories ADD COLUMN color text;
  END IF;

  -- Add icon column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'icon'
  ) THEN
    ALTER TABLE categories ADD COLUMN icon text;
  END IF;

  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE categories ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Add unique constraint on full_path per user (allows same names at different levels)
-- This replaces the name+parent constraint with a more comprehensive full_path constraint
DO $$
BEGIN
  -- Drop old unique_user_name_parent constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_user_name_parent'
  ) THEN
    ALTER TABLE categories DROP CONSTRAINT unique_user_name_parent;
  END IF;

  -- Add new unique constraint on full_path per user
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_user_full_path'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT unique_user_full_path UNIQUE (user_id, full_path);
  END IF;
END $$;

-- Create index on full_path for performance
CREATE INDEX IF NOT EXISTS idx_categories_full_path ON categories(user_id, full_path);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_categories_updated_at();

-- Function to update entry_count for categories
CREATE OR REPLACE FUNCTION update_category_entry_count()
RETURNS TRIGGER AS $$
BEGIN
  -- When entry is inserted/updated with a category
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.category_id IS NOT NULL THEN
    UPDATE categories
    SET entry_count = (
      SELECT COUNT(*) FROM entries WHERE category_id = NEW.category_id
    )
    WHERE category_id = NEW.category_id;
  END IF;

  -- When entry is deleted or category is removed
  IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') AND OLD.category_id IS NOT NULL THEN
    UPDATE categories
    SET entry_count = (
      SELECT COUNT(*) FROM entries WHERE category_id = OLD.category_id
    )
    WHERE category_id = OLD.category_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_category_entry_count_trigger ON entries;
CREATE TRIGGER update_category_entry_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON entries
  FOR EACH ROW
  EXECUTE FUNCTION update_category_entry_count();
