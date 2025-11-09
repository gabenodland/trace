-- Create entries table for rich text capture
CREATE TABLE IF NOT EXISTS entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text, -- optional plain text title
  content text NOT NULL, -- HTML format from TipTap editor
  tags text[], -- array of extracted #tags (without the #)
  mentions text[], -- array of extracted @mentions (without the @)
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL, -- null = Inbox
  latitude numeric, -- GPS coordinate
  longitude numeric, -- GPS coordinate
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_category_id ON entries(category_id);

-- Add GIN indexes for array columns (tags and mentions)
CREATE INDEX IF NOT EXISTS idx_entries_tags ON entries USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_entries_mentions ON entries USING GIN(mentions);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at (drop first if exists)
DROP TRIGGER IF EXISTS update_entries_updated_at ON entries;
CREATE TRIGGER update_entries_updated_at
  BEFORE UPDATE ON entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own entries
DROP POLICY IF EXISTS "Users can view their own entries" ON entries;
CREATE POLICY "Users can view their own entries"
  ON entries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own entries" ON entries;
CREATE POLICY "Users can insert their own entries"
  ON entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own entries" ON entries;
CREATE POLICY "Users can update their own entries"
  ON entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own entries" ON entries;
CREATE POLICY "Users can delete their own entries"
  ON entries FOR DELETE
  USING (auth.uid() = user_id);
