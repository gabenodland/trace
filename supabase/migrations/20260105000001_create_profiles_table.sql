-- ============================================================================
-- Profiles Table Migration
-- ============================================================================
-- Creates user profiles with auto-generation on signup via trigger
-- Supports unique usernames and avatar storage

-- ============================================================================
-- Helper Functions (must be created before table/trigger)
-- ============================================================================

-- Check if a username is available (case-insensitive)
CREATE OR REPLACE FUNCTION public.check_username_available(username_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE LOWER(username) = LOWER(username_param)
  );
END;
$$;

-- Generate a unique username from email address
CREATE OR REPLACE FUNCTION public.generate_username_from_email(email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 0;
BEGIN
  -- Extract username part from email (before @)
  base_username := SPLIT_PART(email, '@', 1);

  -- Remove non-alphanumeric characters (keep underscores)
  base_username := REGEXP_REPLACE(base_username, '[^a-zA-Z0-9_]', '', 'g');

  -- Ensure minimum length of 3 characters
  IF LENGTH(base_username) < 3 THEN
    base_username := base_username || 'user';
  END IF;

  -- Truncate if too long (max 30 chars minus space for counter)
  IF LENGTH(base_username) > 25 THEN
    base_username := LEFT(base_username, 25);
  END IF;

  final_username := base_username;

  -- Check if username exists and add number if needed
  WHILE NOT public.check_username_available(final_username) LOOP
    counter := counter + 1;
    final_username := base_username || counter::TEXT;
  END LOOP;

  RETURN final_username;
END;
$$;

-- ============================================================================
-- Profiles Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  profile_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),

  -- Constraints
  CONSTRAINT profiles_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
  CONSTRAINT profiles_name_max_length CHECK (LENGTH(name) <= 50),
  CONSTRAINT profiles_username_not_empty CHECK (LENGTH(TRIM(username)) >= 3),
  CONSTRAINT profiles_username_max_length CHECK (LENGTH(username) <= 30),
  CONSTRAINT profiles_username_format CHECK (username ~ '^[a-zA-Z0-9_]+$')
);

-- Case-insensitive unique index for usernames
CREATE UNIQUE INDEX idx_profiles_username_lower ON profiles(LOWER(username));

-- Index for quick user lookups
CREATE INDEX idx_profiles_user_id ON profiles(id);

-- ============================================================================
-- Auto-create Profile Trigger
-- ============================================================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, username)
  VALUES (
    NEW.id,
    -- Try to get name from Google OAuth metadata, fallback to 'User'
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      'User'
    ),
    public.generate_username_from_email(NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Trigger on auth.users to auto-create profile
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Updated At Trigger
-- ============================================================================

CREATE OR REPLACE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Authenticated users can read all profiles (for username lookups, etc.)
CREATE POLICY "Authenticated users can read all profiles"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can insert their own profile (mainly for the trigger)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE profiles IS 'User profile information with unique usernames and avatar support';
COMMENT ON COLUMN profiles.id IS 'References auth.users(id) - same as user ID';
COMMENT ON COLUMN profiles.name IS 'Display name (from Google OAuth or manually set)';
COMMENT ON COLUMN profiles.username IS 'Unique username (auto-generated from email, can be changed)';
COMMENT ON COLUMN profiles.avatar_url IS 'URL to avatar image in storage bucket';
COMMENT ON COLUMN profiles.profile_complete IS 'Whether user has completed initial profile setup';
COMMENT ON FUNCTION public.check_username_available IS 'RPC function to check if a username is available';
COMMENT ON FUNCTION public.generate_username_from_email IS 'Generates a unique username from an email address';
COMMENT ON FUNCTION public.handle_new_user IS 'Trigger function to auto-create profile on user signup';
