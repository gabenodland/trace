-- RPCs: trash queries
-- Returns soft-deleted entries, streams, and locations for the authenticated user.

-- ============================================================================
-- get_deleted_entries: returns soft-deleted entries with stream name + attachment count
-- ============================================================================

CREATE OR REPLACE FUNCTION get_deleted_entries()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  RETURN COALESCE(
    (SELECT json_agg(row_to_json(t) ORDER BY t.deleted_at DESC)
     FROM (
       SELECT
         e.entry_id AS id,
         e.title,
         s.name AS stream_name,
         e.stream_id,
         e.deleted_at,
         COALESCE(a.attachment_count, 0) AS attachment_count
       FROM entries e
       LEFT JOIN streams s ON s.stream_id = e.stream_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::INT AS attachment_count
         FROM attachments att
         WHERE att.entry_id = e.entry_id
       ) a ON TRUE
       WHERE e.user_id = v_user_id
         AND e.deleted_at IS NOT NULL
     ) t),
    '[]'::json
  );
END;
$$;

COMMENT ON FUNCTION get_deleted_entries IS
  'Returns all soft-deleted entries for the authenticated user, with stream name and attachment count.';

-- ============================================================================
-- get_deleted_streams: returns soft-deleted streams
-- ============================================================================

CREATE OR REPLACE FUNCTION get_deleted_streams()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  RETURN COALESCE(
    (SELECT json_agg(row_to_json(t) ORDER BY t.deleted_at DESC)
     FROM (
       SELECT
         stream_id AS id,
         name,
         deleted_at
       FROM streams
       WHERE user_id = v_user_id
         AND deleted_at IS NOT NULL
     ) t),
    '[]'::json
  );
END;
$$;

COMMENT ON FUNCTION get_deleted_streams IS
  'Returns all soft-deleted streams for the authenticated user.';

-- ============================================================================
-- get_deleted_locations: returns soft-deleted places
-- ============================================================================

CREATE OR REPLACE FUNCTION get_deleted_locations()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  RETURN COALESCE(
    (SELECT json_agg(row_to_json(t) ORDER BY t.deleted_at DESC)
     FROM (
       SELECT
         location_id AS id,
         name AS place_name,
         deleted_at
       FROM locations
       WHERE user_id = v_user_id
         AND deleted_at IS NOT NULL
     ) t),
    '[]'::json
  );
END;
$$;

COMMENT ON FUNCTION get_deleted_locations IS
  'Returns all soft-deleted locations for the authenticated user.';
