-- RPC: get_user_storage_usage
-- Returns cloud storage usage (attachment bytes + estimated data bytes) for the authenticated user.

CREATE OR REPLACE FUNCTION get_user_storage_usage()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_attachment_bytes BIGINT;
  v_data_bytes BIGINT;
BEGIN
  -- Sum all non-deleted attachment file sizes
  SELECT COALESCE(SUM(file_size), 0) INTO v_attachment_bytes
  FROM attachments
  WHERE user_id = v_user_id
    AND deleted_at IS NULL;

  -- Estimate data size: count rows across tables, ~1KB per entry/stream/location row
  -- This is a rough estimate; actual DB row sizes vary but text data is negligible
  -- compared to attachment storage
  SELECT COALESCE(
    (SELECT COUNT(*) FROM entries WHERE user_id = v_user_id AND deleted_at IS NULL) * 1024 +
    (SELECT COUNT(*) FROM streams WHERE user_id = v_user_id AND deleted_at IS NULL) * 512 +
    (SELECT COUNT(*) FROM locations WHERE user_id = v_user_id AND deleted_at IS NULL) * 512,
    0
  ) INTO v_data_bytes;

  RETURN json_build_object(
    'attachment_bytes', v_attachment_bytes,
    'data_bytes', v_data_bytes,
    'total_bytes', v_attachment_bytes + v_data_bytes
  );
END;
$$;

COMMENT ON FUNCTION get_user_storage_usage IS
  'Returns cloud storage usage breakdown (attachment bytes, estimated data bytes, total) for the authenticated user.';
