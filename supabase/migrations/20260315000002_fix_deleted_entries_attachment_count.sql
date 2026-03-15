-- Fix: Exclude soft-deleted attachments from trash entry attachment count

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
           AND att.deleted_at IS NULL
       ) a ON TRUE
       WHERE e.user_id = v_user_id
         AND e.deleted_at IS NOT NULL
     ) t),
    '[]'::json
  );
END;
$$;
