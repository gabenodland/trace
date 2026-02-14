-- ============================================================================
-- API Keys Table Migration
-- ============================================================================
-- Creates API keys for MCP server authentication
-- Users can create keys to access their data via external tools (Claude Desktop, etc.)
-- Keys are hashed for security - only the prefix is stored in plaintext

-- ============================================================================
-- API Keys Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  api_key_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,                    -- bcrypt hash of the full key
  key_prefix TEXT NOT NULL,                  -- first 8 chars for display (e.g., "tr_live_a")
  name TEXT NOT NULL,                        -- user-friendly name ("Claude Desktop")
  scope TEXT NOT NULL DEFAULT 'read',        -- 'read' or 'full'
  last_used_at TIMESTAMPTZ,                  -- updated on each use
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  revoked_at TIMESTAMPTZ,                    -- soft revoke (null = active)

  -- Constraints
  CONSTRAINT api_keys_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
  CONSTRAINT api_keys_name_max_length CHECK (LENGTH(name) <= 100),
  CONSTRAINT api_keys_scope_valid CHECK (scope IN ('read', 'full')),
  CONSTRAINT api_keys_key_prefix_length CHECK (LENGTH(key_prefix) >= 8),
  CONSTRAINT api_keys_key_hash_unique UNIQUE (key_hash)
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Index on user_id for listing user's keys
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);

-- Index on key_prefix for quick lookup during auth
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);

-- Composite index for active keys lookup (used in validation)
CREATE INDEX idx_api_keys_active ON api_keys(key_prefix, revoked_at)
  WHERE revoked_at IS NULL;

-- ============================================================================
-- Safe View (hides sensitive key_hash)
-- ============================================================================

CREATE VIEW api_keys_safe AS
SELECT
  api_key_id,
  user_id,
  key_prefix,
  name,
  scope,
  last_used_at,
  created_at,
  revoked_at
FROM api_keys;

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Users can view their own keys (via the safe view, but policy applies to base table too)
CREATE POLICY "Users can view their own api_keys"
  ON api_keys
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own keys
CREATE POLICY "Users can create their own api_keys"
  ON api_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own keys (only name and revoked_at should change)
CREATE POLICY "Users can update their own api_keys"
  ON api_keys
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own keys
CREATE POLICY "Users can delete their own api_keys"
  ON api_keys
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Validation Function (for MCP server auth)
-- ============================================================================

-- Validates an API key and returns user info if valid
-- Used by the MCP server to authenticate requests
-- SECURITY DEFINER: Runs with owner privileges, bypasses RLS
CREATE OR REPLACE FUNCTION validate_api_key(
  p_key_prefix TEXT,
  p_key_hash TEXT
)
RETURNS TABLE(user_id UUID, scope TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ak.user_id,
    ak.scope
  FROM api_keys ak
  WHERE ak.key_prefix = p_key_prefix
    AND ak.key_hash = p_key_hash
    AND ak.revoked_at IS NULL;
END;
$$;

-- ============================================================================
-- Update Last Used Timestamp Function
-- ============================================================================

-- Updates the last_used_at timestamp for a key
-- Called after successful authentication
CREATE OR REPLACE FUNCTION update_api_key_last_used(p_api_key_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE api_keys
  SET last_used_at = TIMEZONE('utc', NOW())
  WHERE api_key_id = p_api_key_id;
END;
$$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE api_keys IS 'API keys for external service authentication (MCP server, etc.)';
COMMENT ON COLUMN api_keys.api_key_id IS 'Primary key - unique identifier for the key';
COMMENT ON COLUMN api_keys.user_id IS 'References auth.users(id) - owner of the key';
COMMENT ON COLUMN api_keys.key_hash IS 'bcrypt hash of the full API key (never exposed to client)';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 8 characters of key for display and quick lookup';
COMMENT ON COLUMN api_keys.name IS 'User-friendly name for the key (e.g., "Claude Desktop")';
COMMENT ON COLUMN api_keys.scope IS 'Permission scope: read (read-only) or full (read+write)';
COMMENT ON COLUMN api_keys.last_used_at IS 'Timestamp of last successful authentication';
COMMENT ON COLUMN api_keys.created_at IS 'When the key was created';
COMMENT ON COLUMN api_keys.revoked_at IS 'When the key was revoked (null = active)';

COMMENT ON VIEW api_keys_safe IS 'Safe view of api_keys that excludes the sensitive key_hash column';

COMMENT ON FUNCTION validate_api_key IS 'Validates an API key by prefix and hash, returns user_id and scope if valid';
COMMENT ON FUNCTION update_api_key_last_used IS 'Updates the last_used_at timestamp for a key after successful auth';
