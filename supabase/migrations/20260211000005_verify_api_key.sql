-- Verify API key function
-- Compares the provided key against the stored hash using pgcrypto
-- Returns the api key record if valid, null if invalid

CREATE OR REPLACE FUNCTION verify_api_key(p_full_key TEXT)
RETURNS TABLE(
  api_key_id UUID,
  user_id UUID,
  name TEXT,
  key_prefix TEXT,
  scope TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key_prefix TEXT;
  v_record RECORD;
BEGIN
  -- Extract prefix (first 16 chars)
  v_key_prefix := LEFT(p_full_key, 16);

  -- Find the key by prefix
  SELECT ak.* INTO v_record
  FROM api_keys ak
  WHERE ak.key_prefix = v_key_prefix
    AND ak.revoked_at IS NULL;

  -- Not found
  IF v_record IS NULL THEN
    RETURN;
  END IF;

  -- Verify the hash using pgcrypto crypt function
  -- crypt(input, hash) returns the hash if input matches
  IF crypt(p_full_key, v_record.key_hash) = v_record.key_hash THEN
    -- Update last_used_at
    UPDATE api_keys SET last_used_at = NOW()
    WHERE api_keys.api_key_id = v_record.api_key_id;

    -- Return the record
    RETURN QUERY SELECT
      v_record.api_key_id,
      v_record.user_id,
      v_record.name,
      v_record.key_prefix,
      v_record.scope,
      v_record.last_used_at,
      v_record.created_at,
      v_record.revoked_at;
  END IF;

  -- Hash mismatch - return nothing
  RETURN;
END;
$$;

COMMENT ON FUNCTION verify_api_key IS 'Verifies an API key against its stored bcrypt hash, returns key info if valid';
