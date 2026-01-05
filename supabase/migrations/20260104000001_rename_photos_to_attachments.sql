-- Migration: Rename photos table to attachments
-- Purpose: Future-proof for PDF and document support while keeping UI named "Photos"

-- ============================================
-- 1. RENAME TABLE
-- ============================================
ALTER TABLE photos RENAME TO attachments;

-- ============================================
-- 2. RENAME PRIMARY KEY COLUMN
-- ============================================
ALTER TABLE attachments RENAME COLUMN photo_id TO attachment_id;

-- ============================================
-- 3. RENAME INDEXES
-- ============================================
ALTER INDEX idx_photos_entry_id RENAME TO idx_attachments_entry_id;
ALTER INDEX idx_photos_user_id RENAME TO idx_attachments_user_id;
ALTER INDEX idx_photos_position RENAME TO idx_attachments_position;

-- ============================================
-- 4. DROP OLD RLS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view their own photos" ON attachments;
DROP POLICY IF EXISTS "Users can insert their own photos" ON attachments;
DROP POLICY IF EXISTS "Users can update their own photos" ON attachments;
DROP POLICY IF EXISTS "Users can delete their own photos" ON attachments;

-- ============================================
-- 5. CREATE NEW RLS POLICIES
-- ============================================
CREATE POLICY "Users can view their own attachments"
  ON attachments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attachments"
  ON attachments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attachments"
  ON attachments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own attachments"
  ON attachments FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 6. DROP AND RECREATE TRIGGER
-- ============================================
DROP TRIGGER IF EXISTS update_photos_updated_at ON attachments;

CREATE TRIGGER update_attachments_updated_at
  BEFORE UPDATE ON attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. UPDATE COMMENTS
-- ============================================
COMMENT ON TABLE attachments IS 'Attachments (photos, documents) attached to entries';
COMMENT ON COLUMN attachments.file_path IS 'Path in Supabase Storage bucket';
COMMENT ON COLUMN attachments.position IS 'Order of attachment within entry (0-indexed)';

-- ============================================
-- 8. RENAME PRIMARY KEY CONSTRAINT
-- ============================================
ALTER TABLE attachments RENAME CONSTRAINT photos_pkey TO attachments_pkey;

-- ============================================
-- 9. RENAME FOREIGN KEY CONSTRAINTS
-- ============================================
ALTER TABLE attachments RENAME CONSTRAINT photos_entry_id_fkey TO attachments_entry_id_fkey;
ALTER TABLE attachments RENAME CONSTRAINT photos_user_id_fkey TO attachments_user_id_fkey;
