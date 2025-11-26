-- ============================================================================
-- Add Category Properties Fields
-- ============================================================================
-- This migration adds customization options to categories:
-- - Template fields for auto-populating new entries
-- - Feature toggles to enable/disable entry features per category
-- - Privacy and sync control flags
-- ============================================================================

-- Add template fields
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS entry_title_template TEXT;

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS entry_content_template TEXT;

-- Add feature toggle fields (default to true for most features to maintain current behavior)
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS entry_use_rating BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS entry_use_priority BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS entry_use_status BOOLEAN DEFAULT true NOT NULL;

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS entry_use_duedates BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS entry_use_location BOOLEAN DEFAULT true NOT NULL;

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS entry_use_photos BOOLEAN DEFAULT true NOT NULL;

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS entry_content_type TEXT DEFAULT 'richformat' NOT NULL
CHECK (entry_content_type IN ('text', 'list', 'richformat', 'bullet'));

-- Add privacy and sync control fields
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS is_localonly BOOLEAN DEFAULT false NOT NULL;

-- Create indexes for commonly filtered fields
CREATE INDEX IF NOT EXISTS idx_categories_is_private ON categories(is_private) WHERE is_private = true;
CREATE INDEX IF NOT EXISTS idx_categories_is_localonly ON categories(is_localonly) WHERE is_localonly = true;

-- Add column comments for documentation
COMMENT ON COLUMN categories.entry_title_template IS 'Template for auto-populating entry titles. Supports variables: {date}, {day}, {month}';
COMMENT ON COLUMN categories.entry_content_template IS 'Template for auto-populating entry content';
COMMENT ON COLUMN categories.entry_use_rating IS 'Enable rating field for entries in this category';
COMMENT ON COLUMN categories.entry_use_priority IS 'Enable priority field for entries in this category';
COMMENT ON COLUMN categories.entry_use_status IS 'Enable status field for entries in this category';
COMMENT ON COLUMN categories.entry_use_duedates IS 'Enable due dates for entries in this category';
COMMENT ON COLUMN categories.entry_use_location IS 'Enable location tracking for entries in this category';
COMMENT ON COLUMN categories.entry_use_photos IS 'Enable photo attachments for entries in this category';
COMMENT ON COLUMN categories.entry_content_type IS 'Content type for entries: text, list, richformat, or bullet (future use)';
COMMENT ON COLUMN categories.is_private IS 'If true, entries only show when viewing this category directly, not in "All" or parent categories';
COMMENT ON COLUMN categories.is_localonly IS 'If true, category and its entries will not sync to cloud';
