-- RPCs: trash actions (restore + hard delete)

-- ============================================================================
-- restore_entry: clears deleted_at on entry + its attachments
-- Falls back to Inbox (null stream_id) if original stream is also deleted
-- ============================================================================

CREATE OR REPLACE FUNCTION restore_entry(p_entry_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_stream_id UUID;
  v_stream_deleted BOOLEAN;
  v_restored_to_inbox BOOLEAN := FALSE;
BEGIN
  -- Verify ownership and that entry is actually deleted
  SELECT stream_id INTO v_stream_id
  FROM entries
  WHERE entry_id = p_entry_id
    AND user_id = v_user_id
    AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entry not found, not owned by user, or not deleted';
  END IF;

  -- Check if the original stream is also deleted
  IF v_stream_id IS NOT NULL THEN
    SELECT (deleted_at IS NOT NULL) INTO v_stream_deleted
    FROM streams
    WHERE stream_id = v_stream_id;

    IF v_stream_deleted THEN
      -- Move to Inbox since original stream is deleted
      v_restored_to_inbox := TRUE;
    END IF;
  END IF;

  -- Restore the entry
  UPDATE entries
  SET deleted_at = NULL,
      stream_id = CASE WHEN v_restored_to_inbox THEN NULL ELSE stream_id END,
      updated_at = now()
  WHERE entry_id = p_entry_id
    AND user_id = v_user_id;

  -- Restore associated attachments
  UPDATE attachments
  SET deleted_at = NULL,
      updated_at = now()
  WHERE entry_id = p_entry_id
    AND user_id = v_user_id
    AND deleted_at IS NOT NULL;

  RETURN json_build_object(
    'restored', TRUE,
    'restored_to_inbox', v_restored_to_inbox
  );
END;
$$;

COMMENT ON FUNCTION restore_entry IS
  'Restores a soft-deleted entry and its attachments. Falls back to Inbox if the original stream is also deleted.';

-- ============================================================================
-- hard_delete_entry: permanently deletes entry + attachments
-- Returns file paths so the caller can delete storage objects via the API
-- ============================================================================

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
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM entries
    WHERE entry_id = p_entry_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Entry not found or not owned by user';
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

COMMENT ON FUNCTION hard_delete_entry IS
  'Permanently deletes an entry and its attachment records. Returns file_paths array for storage cleanup by the caller.';

-- ============================================================================
-- hard_delete_stream: permanently deletes a stream record
-- Does NOT cascade to entries — those appear individually in trash
-- ============================================================================

CREATE OR REPLACE FUNCTION hard_delete_stream(p_stream_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  -- Only allow deleting soft-deleted streams
  IF NOT EXISTS (
    SELECT 1 FROM streams
    WHERE stream_id = p_stream_id
      AND user_id = v_user_id
      AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Stream not found, not owned by user, or not soft-deleted';
  END IF;

  -- Nullify stream_id on any entries still referencing this stream
  UPDATE entries
  SET stream_id = NULL, updated_at = now()
  WHERE stream_id = p_stream_id AND user_id = v_user_id;

  DELETE FROM streams
  WHERE stream_id = p_stream_id AND user_id = v_user_id;

  RETURN json_build_object('deleted', TRUE);
END;
$$;

COMMENT ON FUNCTION hard_delete_stream IS
  'Permanently deletes a soft-deleted stream. Moves any remaining entries to Inbox (null stream_id).';

-- ============================================================================
-- hard_delete_location: permanently deletes a location record
-- Nullifies location_id on entries that reference it
-- ============================================================================

CREATE OR REPLACE FUNCTION hard_delete_location(p_location_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  -- Only allow deleting soft-deleted locations
  IF NOT EXISTS (
    SELECT 1 FROM locations
    WHERE location_id = p_location_id
      AND user_id = v_user_id
      AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Location not found, not owned by user, or not soft-deleted';
  END IF;

  -- Nullify location_id on entries referencing this location
  UPDATE entries
  SET location_id = NULL, updated_at = now()
  WHERE location_id = p_location_id AND user_id = v_user_id;

  DELETE FROM locations
  WHERE location_id = p_location_id AND user_id = v_user_id;

  RETURN json_build_object('deleted', TRUE);
END;
$$;

COMMENT ON FUNCTION hard_delete_location IS
  'Permanently deletes a soft-deleted location. Nullifies location_id on any referencing entries.';
