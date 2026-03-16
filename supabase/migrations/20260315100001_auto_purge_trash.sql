-- Auto-purge: permanently delete entries that have been in trash for 30+ days.
-- Designed to be called by pg_cron or an Edge Function on a daily schedule.
-- Creates tombstones for each purged entry so devices can sync the deletion.

CREATE OR REPLACE FUNCTION auto_purge_trash(p_retention_days INTEGER DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := now() - (p_retention_days || ' days')::INTERVAL;
  v_entry RECORD;
  v_total_purged INTEGER := 0;
  v_total_files INTEGER := 0;
  v_file_paths TEXT[];
BEGIN
  -- Find all entries past retention
  FOR v_entry IN
    SELECT entry_id, user_id
    FROM entries
    WHERE deleted_at IS NOT NULL
      AND deleted_at < v_cutoff
  LOOP
    -- Collect file paths for this entry
    SELECT ARRAY_AGG(file_path)
    INTO v_file_paths
    FROM attachments
    WHERE entry_id = v_entry.entry_id;

    v_total_files := v_total_files + COALESCE(array_length(v_file_paths, 1), 0);

    -- Delete attachments
    DELETE FROM attachments WHERE entry_id = v_entry.entry_id;

    -- Delete versions
    DELETE FROM entry_versions WHERE entry_id = v_entry.entry_id;

    -- Delete entry
    DELETE FROM entries WHERE entry_id = v_entry.entry_id;

    -- Create tombstone
    INSERT INTO entry_tombstones (entry_id, user_id)
    VALUES (v_entry.entry_id, v_entry.user_id)
    ON CONFLICT (entry_id) DO NOTHING;

    v_total_purged := v_total_purged + 1;
  END LOOP;

  -- Note: Storage file cleanup must be done by the caller (Edge Function)
  -- since storage API isn't available from within plpgsql.

  RETURN json_build_object(
    'purged', v_total_purged,
    'orphaned_files', v_total_files
  );
END;
$$;

COMMENT ON FUNCTION auto_purge_trash IS
  'Permanently deletes entries in trash for longer than retention period. Creates tombstones for sync. Storage file cleanup must be done by caller.';
