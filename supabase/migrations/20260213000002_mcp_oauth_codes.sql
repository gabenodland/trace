-- MCP OAuth Authorization Codes table
-- Stores short-lived auth codes for the OAuth code exchange flow

CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL UNIQUE, -- SHA256 hash of the code
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'read',
  resource TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for code lookup
CREATE INDEX idx_mcp_oauth_codes_hash ON mcp_oauth_codes(code_hash);

-- RLS policies
ALTER TABLE mcp_oauth_codes ENABLE ROW LEVEL SECURITY;

-- Service role can manage codes
CREATE POLICY "Service role can manage codes"
  ON mcp_oauth_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create RPC to store auth code
CREATE OR REPLACE FUNCTION create_mcp_oauth_code(
  p_code_hash TEXT,
  p_user_id UUID,
  p_code_challenge TEXT,
  p_code_challenge_method TEXT,
  p_redirect_uri TEXT,
  p_scope TEXT DEFAULT 'read',
  p_resource TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes')
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_id UUID;
BEGIN
  INSERT INTO mcp_oauth_codes (code_hash, user_id, code_challenge, code_challenge_method, redirect_uri, scope, resource, expires_at)
  VALUES (p_code_hash, p_user_id, p_code_challenge, p_code_challenge_method, p_redirect_uri, p_scope, p_resource, p_expires_at)
  RETURNING id INTO v_code_id;

  RETURN v_code_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_mcp_oauth_code(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO anon;

-- Create RPC to verify and consume auth code (single use)
CREATE OR REPLACE FUNCTION verify_mcp_oauth_code(p_code_hash TEXT)
RETURNS TABLE (
  user_id UUID,
  code_challenge TEXT,
  code_challenge_method TEXT,
  redirect_uri TEXT,
  scope TEXT,
  resource TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Get and delete the code in one transaction (single use)
  DELETE FROM mcp_oauth_codes c
  WHERE c.code_hash = p_code_hash
    AND c.expires_at > NOW()
  RETURNING c.user_id, c.code_challenge, c.code_challenge_method, c.redirect_uri, c.scope, c.resource
  INTO v_result;

  IF v_result IS NOT NULL THEN
    RETURN QUERY SELECT v_result.user_id, v_result.code_challenge, v_result.code_challenge_method, v_result.redirect_uri, v_result.scope, v_result.resource;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_mcp_oauth_code(TEXT) TO anon;

-- Cleanup expired codes
CREATE OR REPLACE FUNCTION cleanup_expired_mcp_oauth_codes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM mcp_oauth_codes WHERE expires_at < NOW();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
