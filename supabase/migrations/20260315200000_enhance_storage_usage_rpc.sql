-- Enhance get_user_storage_usage to return full breakdown:
--   active_content_bytes:    entry text + title + version snapshots for non-deleted entries
--   active_attachment_bytes: attachment file sizes for non-deleted entries
--   trash_content_bytes:     entry text + title + version snapshots for deleted entries
--   trash_attachment_bytes:  attachment file sizes for deleted entries
--
-- All computed on the fly via OCTET_LENGTH — no stored columns, no sync implications.

CREATE OR REPLACE FUNCTION get_user_storage_usage()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_active_content BIGINT;
  v_active_attachment BIGINT;
  v_trash_content BIGINT;
  v_trash_attachment BIGINT;
  v_active_versions BIGINT;
  v_trash_versions BIGINT;
BEGIN
  -- Entry content + title bytes, split by active vs deleted
  SELECT
    COALESCE(SUM(CASE WHEN deleted_at IS NULL THEN
      OCTET_LENGTH(COALESCE(content, '')) + OCTET_LENGTH(COALESCE(title, ''))
    ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN deleted_at IS NOT NULL THEN
      OCTET_LENGTH(COALESCE(content, '')) + OCTET_LENGTH(COALESCE(title, ''))
    ELSE 0 END), 0)
  INTO v_active_content, v_trash_content
  FROM entries
  WHERE user_id = v_user_id;

  -- Attachment file sizes, split by parent entry's deleted_at
  SELECT
    COALESCE(SUM(CASE WHEN e.deleted_at IS NULL THEN a.file_size ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN e.deleted_at IS NOT NULL THEN a.file_size ELSE 0 END), 0)
  INTO v_active_attachment, v_trash_attachment
  FROM attachments a
  JOIN entries e ON e.entry_id = a.entry_id
  WHERE a.user_id = v_user_id;

  -- Version snapshot bytes, split by parent entry's deleted_at
  SELECT
    COALESCE(SUM(CASE WHEN e.deleted_at IS NULL THEN
      OCTET_LENGTH(v.snapshot::text)
    ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN e.deleted_at IS NOT NULL THEN
      OCTET_LENGTH(v.snapshot::text)
    ELSE 0 END), 0)
  INTO v_active_versions, v_trash_versions
  FROM entry_versions v
  JOIN entries e ON e.entry_id = v.entry_id
  WHERE v.user_id = v_user_id;

  RETURN json_build_object(
    'active_content_bytes', v_active_content + v_active_versions,
    'active_attachment_bytes', v_active_attachment,
    'trash_content_bytes', v_trash_content + v_trash_versions,
    'trash_attachment_bytes', v_trash_attachment
  );
END;
$$;
