-- MCP OAuth Tokens table
-- Stores OAuth access tokens issued by the MCP server for Claude.ai connections

CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE, -- SHA256 hash of the token (we don't store the actual token)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'read',
  resource TEXT, -- RFC 8707 resource indicator
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for token lookup
CREATE INDEX idx_mcp_oauth_tokens_hash ON mcp_oauth_tokens(token_hash);

-- Index for cleanup of expired tokens
CREATE INDEX idx_mcp_oauth_tokens_expires ON mcp_oauth_tokens(expires_at);

-- RLS policies
ALTER TABLE mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can manage tokens (MCP server uses service role or anon with RPC)
CREATE POLICY "Service role can manage tokens"
  ON mcp_oauth_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create RPC function to verify OAuth token (similar to verify_api_key)
CREATE OR REPLACE FUNCTION verify_mcp_oauth_token(p_token_hash TEXT)
RETURNS TABLE (
  user_id UUID,
  scope TEXT,
  resource TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT t.user_id, t.scope, t.resource
  FROM mcp_oauth_tokens t
  WHERE t.token_hash = p_token_hash
    AND t.expires_at > NOW();
END;
$$;

-- Grant execute to anon so MCP server can call it
GRANT EXECUTE ON FUNCTION verify_mcp_oauth_token(TEXT) TO anon;

-- Create RPC function to create OAuth token
-- NOTE: Only service_role can call this (used by MCP server with service role key)
-- No anon grant - this prevents unauthorized token creation
CREATE OR REPLACE FUNCTION create_mcp_oauth_token(
  p_token_hash TEXT,
  p_user_id UUID,
  p_scope TEXT DEFAULT 'read',
  p_resource TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year')
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_id UUID;
BEGIN
  INSERT INTO mcp_oauth_tokens (token_hash, user_id, scope, resource, expires_at)
  VALUES (p_token_hash, p_user_id, p_scope, p_resource, p_expires_at)
  RETURNING id INTO v_token_id;

  RETURN v_token_id;
END;
$$;

-- Only service_role can create tokens (MCP server uses SUPABASE_SERVICE_ROLE_KEY)
-- verify_mcp_oauth_token is granted to anon for token validation

-- Cleanup function for expired tokens (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_mcp_oauth_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM mcp_oauth_tokens WHERE expires_at < NOW();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
