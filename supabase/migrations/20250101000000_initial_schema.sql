-- Trace Initial Database Schema
-- This migration creates the core tables: entries and categories
-- Users table is provided by Supabase Auth (auth.users)

-- ============================================================================
-- Categories Table
-- ============================================================================
-- Hierarchical organization structure (like folders)
-- Users create categories on-demand to organize entries
-- Max depth: 5 levels (e.g., Work/Projects/ClientA/Phase2/Tasks)

CREATE TABLE IF NOT EXISTS categories (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  full_path TEXT NOT NULL,
  parent_category_id UUID REFERENCES categories(category_id) ON DELETE CASCADE,
  depth INTEGER NOT NULL DEFAULT 0 CHECK (depth >= 0 AND depth <= 5),
  entry_count INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT category_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT category_path_not_empty CHECK (length(trim(full_path)) > 0),
  UNIQUE(user_id, full_path)  -- Path must be unique per user
);

-- Indexes for categories
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_parent_id ON categories(parent_category_id);
CREATE INDEX idx_categories_full_path ON categories(user_id, full_path);

-- ============================================================================
-- Entries Table
-- ============================================================================
-- The primary data entity - stores all captured content
-- Single flexible model where attributes determine behavior:
--   - status=none, due_date=null → Note
--   - status=incomplete/complete → Task
--   - due_date set → Event/Appointment

CREATE TABLE IF NOT EXISTS entries (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Content
  title TEXT,
  content TEXT NOT NULL,

  -- Organization
  category_id UUID REFERENCES categories(category_id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  mentions TEXT[] DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Location (optional)
  location_lat FLOAT,
  location_lng FLOAT,
  location_name TEXT,

  -- Task/Event attributes
  status TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('none', 'incomplete', 'complete')),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Future: attachments (photos, voice notes, etc.)
  attachments JSONB DEFAULT '[]',

  -- Constraints
  CONSTRAINT entry_has_content CHECK (
    length(trim(COALESCE(title, ''))) > 0 OR
    length(trim(content)) > 0
  ),
  CONSTRAINT completed_at_requires_complete_status CHECK (
    (status = 'complete' AND completed_at IS NOT NULL) OR
    (status != 'complete' AND completed_at IS NULL)
  )
);

-- Indexes for entries
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_entries_category_id ON entries(category_id);
CREATE INDEX idx_entries_created_at ON entries(user_id, created_at DESC);
CREATE INDEX idx_entries_updated_at ON entries(user_id, updated_at DESC);
CREATE INDEX idx_entries_status ON entries(user_id, status);
CREATE INDEX idx_entries_due_date ON entries(user_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_entries_tags ON entries USING GIN(tags);
CREATE INDEX idx_entries_mentions ON entries USING GIN(mentions);
CREATE INDEX idx_entries_content_search ON entries USING GIN(to_tsvector('english', content));

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update updated_at timestamp for categories
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entries_updated_at
  BEFORE UPDATE ON entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update category entry_count when entries are added/removed/moved
CREATE OR REPLACE FUNCTION update_category_entry_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Decrement old category if entry moved
  IF TG_OP = 'UPDATE' AND OLD.category_id IS NOT NULL AND OLD.category_id != NEW.category_id THEN
    UPDATE categories
    SET entry_count = entry_count - 1
    WHERE category_id = OLD.category_id;
  END IF;

  -- Decrement category when entry deleted
  IF TG_OP = 'DELETE' AND OLD.category_id IS NOT NULL THEN
    UPDATE categories
    SET entry_count = entry_count - 1
    WHERE category_id = OLD.category_id;
    RETURN OLD;
  END IF;

  -- Increment new category
  IF (TG_OP = 'INSERT' AND NEW.category_id IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND NEW.category_id IS NOT NULL AND
      (OLD.category_id IS NULL OR OLD.category_id != NEW.category_id)) THEN
    UPDATE categories
    SET entry_count = entry_count + 1
    WHERE category_id = NEW.category_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_entry_category_count
  AFTER INSERT OR UPDATE OR DELETE ON entries
  FOR EACH ROW
  EXECUTE FUNCTION update_category_entry_count();

-- Auto-set completed_at timestamp when status changes to complete
CREATE OR REPLACE FUNCTION auto_set_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Set completed_at when status becomes complete
  IF NEW.status = 'complete' AND (OLD.status IS NULL OR OLD.status != 'complete') THEN
    NEW.completed_at = now();
  END IF;

  -- Clear completed_at when status changes from complete to something else
  IF NEW.status != 'complete' AND OLD.status = 'complete' THEN
    NEW.completed_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_completed_at
  BEFORE UPDATE ON entries
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_completed_at();

-- ============================================================================
-- Comments (Documentation)
-- ============================================================================

COMMENT ON TABLE categories IS 'Hierarchical organization structure for entries (like folders). Users create categories on-demand to organize their captures.';
COMMENT ON TABLE entries IS 'Primary data entity - stores all captured content (notes, tasks, events). Single flexible model where attributes determine behavior.';

COMMENT ON COLUMN entries.status IS 'Determines entry type: none=note, incomplete/complete=task';
COMMENT ON COLUMN entries.due_date IS 'When set, entry appears in calendar views. Tasks can have due dates for deadlines.';
COMMENT ON COLUMN entries.tags IS 'Freeform discovery keywords extracted from inline #tags in content';
COMMENT ON COLUMN entries.mentions IS 'Person references extracted from inline @mentions in content';
COMMENT ON COLUMN entries.category_id IS 'Where entry lives in hierarchy. NULL = Inbox (uncategorized)';
