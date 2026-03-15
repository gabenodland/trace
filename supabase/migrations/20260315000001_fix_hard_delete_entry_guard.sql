-- Fix: Add deleted_at IS NOT NULL guard to hard_delete_entry
-- Prevents accidentally permanently deleting live (non-trashed) entries.
-- Both hard_delete_stream and hard_delete_location already had this guard.

CREATE OR REPLACE FUNCTION hard_delete_entry(p_entry_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_file_paths TEXT[];
BEGIN
  -- Verify ownership AND that entry is soft-deleted
  IF NOT EXISTS (
    SELECT 1 FROM entries
    WHERE entry_id = p_entry_id AND user_id = v_user_id AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Entry not found, not owned by user, or not deleted';
  END IF;

  -- Collect attachment file paths for storage cleanup
  SELECT ARRAY_AGG(file_path)
  INTO v_file_paths
  FROM attachments
  WHERE entry_id = p_entry_id AND user_id = v_user_id;

  -- Delete attachment records
  DELETE FROM attachments
  WHERE entry_id = p_entry_id AND user_id = v_user_id;

  -- Delete the entry
  DELETE FROM entries
  WHERE entry_id = p_entry_id AND user_id = v_user_id;

  RETURN json_build_object(
    'deleted', TRUE,
    'file_paths', COALESCE(v_file_paths, ARRAY[]::TEXT[])
  );
END;
$$;
