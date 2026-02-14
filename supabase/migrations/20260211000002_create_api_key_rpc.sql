-- ============================================================================
-- Create API Key RPC Function
-- ============================================================================
-- Creates a new API key for the authenticated user
-- Hashes the key server-side using pgcrypto, stores only the hash

-- Enable pgcrypto extension for bcrypt hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION create_api_key(
  p_name TEXT,
  p_scope TEXT,
  p_full_key TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_key_hash TEXT;
  v_key_prefix TEXT;
  v_api_key_id UUID;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Get the authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate inputs
  IF LENGTH(TRIM(p_name)) = 0 THEN
    RAISE EXCEPTION 'Name cannot be empty';
  END IF;

  IF p_scope NOT IN ('read', 'full') THEN
    RAISE EXCEPTION 'Scope must be "read" or "full"';
  END IF;

  -- Hash the key using bcrypt (pgcrypto)
  v_key_hash := crypt(p_full_key, gen_salt('bf', 10));

  -- Extract prefix (first 16 chars, e.g., "tr_live_abcd1234")
  v_key_prefix := LEFT(p_full_key, 16);

  -- Insert the new key
  INSERT INTO api_keys (
    user_id,
    key_hash,
    key_prefix,
    name,
    scope
  ) VALUES (
    v_user_id,
    v_key_hash,
    v_key_prefix,
    TRIM(p_name),
    p_scope
  )
  RETURNING api_key_id, created_at INTO v_api_key_id, v_created_at;

  -- Return the created key info (never return the hash!)
  RETURN json_build_object(
    'api_key_id', v_api_key_id,
    'key_prefix', v_key_prefix,
    'name', TRIM(p_name),
    'scope', p_scope,
    'created_at', v_created_at
  );
END;
$$;

COMMENT ON FUNCTION create_api_key IS 'Creates a new API key, hashes it server-side, returns metadata';
