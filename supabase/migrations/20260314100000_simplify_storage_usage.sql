-- Simplify get_user_storage_usage: only return real attachment_bytes
-- Removes fake data_bytes estimate (row count * 1KB was misleading)

CREATE OR REPLACE FUNCTION get_user_storage_usage()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_attachment_bytes BIGINT;
BEGIN
  -- Sum all non-deleted attachment file sizes
  SELECT COALESCE(SUM(file_size), 0) INTO v_attachment_bytes
  FROM attachments
  WHERE user_id = v_user_id
    AND deleted_at IS NULL;

  RETURN json_build_object(
    'attachment_bytes', v_attachment_bytes
  );
END;
$$;

COMMENT ON FUNCTION get_user_storage_usage IS
  'Returns cloud storage usage (attachment bytes only) for the authenticated user.';
