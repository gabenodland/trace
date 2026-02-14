-- Security fix: Ensure anon cannot call create_mcp_oauth_token
-- This is idempotent - won't fail if the grant doesn't exist
-- Only service_role should be able to create OAuth tokens

DO $$
BEGIN
  -- Revoke if the grant exists (no error if it doesn't)
  EXECUTE 'REVOKE EXECUTE ON FUNCTION create_mcp_oauth_token(TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ) FROM anon';
EXCEPTION
  WHEN undefined_function THEN
    -- Function doesn't exist yet, that's fine
    NULL;
  WHEN OTHERS THEN
    -- Any other error (including "no privilege"), ignore
    NULL;
END;
$$;
