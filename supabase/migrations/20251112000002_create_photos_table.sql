-- Create photos table for inline photo support
CREATE TABLE photos (
  photo_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES entries(entry_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- File paths
  file_path TEXT NOT NULL,           -- Supabase Storage path: {user_id}/{entry_id}/{photo_id}.jpg
  thumbnail_path TEXT,                -- Thumbnail path: {user_id}/{entry_id}/{photo_id}_thumb.jpg

  -- File metadata
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  file_size INTEGER NOT NULL,         -- Size in bytes
  width INTEGER,
  height INTEGER,

  -- Positioning and ordering
  position INTEGER NOT NULL DEFAULT 0, -- Order within entry (0, 1, 2...)

  -- Timestamps
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Users can only see their own photos
CREATE POLICY "Users can view their own photos"
  ON photos FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own photos
CREATE POLICY "Users can insert their own photos"
  ON photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own photos
CREATE POLICY "Users can update their own photos"
  ON photos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own photos
CREATE POLICY "Users can delete their own photos"
  ON photos FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_photos_entry_id ON photos(entry_id);
CREATE INDEX idx_photos_user_id ON photos(user_id);
CREATE INDEX idx_photos_position ON photos(entry_id, position);

-- Update trigger for updated_at
CREATE TRIGGER update_photos_updated_at
  BEFORE UPDATE ON photos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE photos IS 'Photos attached to journal entries, stored inline within entry content';
COMMENT ON COLUMN photos.file_path IS 'Path in Supabase Storage bucket';
COMMENT ON COLUMN photos.position IS 'Order of photo within entry content (0-indexed)';
