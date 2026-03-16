-- Entry tombstones: lightweight markers for hard-deleted entries.
-- When an entry is permanently deleted, we keep the entry_id so other devices
-- know to remove it during sync (instead of re-uploading stale copies).

CREATE TABLE IF NOT EXISTS entry_tombstones (
  entry_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  hard_deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE entry_tombstones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own tombstones"
  ON entry_tombstones FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own tombstones"
  ON entry_tombstones FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Index for sync pulls (fetch tombstones newer than last pull)
CREATE INDEX idx_entry_tombstones_hard_deleted_at
  ON entry_tombstones(hard_deleted_at);

COMMENT ON TABLE entry_tombstones IS
  'Lightweight markers for permanently deleted entries. Prevents stale devices from re-uploading deleted entries during sync.';

-- Update hard_delete_entry RPC to create a tombstone instead of just deleting
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
  -- Verify ownership and that entry is actually deleted
  IF NOT EXISTS (
    SELECT 1 FROM entries
    WHERE entry_id = p_entry_id
      AND user_id = v_user_id
      AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Entry not found, not owned by user, or not in trash';
  END IF;

  -- Collect attachment file paths for storage cleanup
  SELECT ARRAY_AGG(file_path)
  INTO v_file_paths
  FROM attachments
  WHERE entry_id = p_entry_id AND user_id = v_user_id;

  -- Delete attachment records
  DELETE FROM attachments
  WHERE entry_id = p_entry_id AND user_id = v_user_id;

  -- Delete entry versions
  DELETE FROM entry_versions
  WHERE entry_id = p_entry_id AND user_id = v_user_id;

  -- Delete the entry
  DELETE FROM entries
  WHERE entry_id = p_entry_id AND user_id = v_user_id;

  -- Create tombstone
  INSERT INTO entry_tombstones (entry_id, user_id)
  VALUES (p_entry_id, v_user_id)
  ON CONFLICT (entry_id) DO NOTHING;

  RETURN json_build_object(
    'deleted', TRUE,
    'file_paths', COALESCE(v_file_paths, ARRAY[]::TEXT[])
  );
END;
$$;

COMMENT ON FUNCTION hard_delete_entry IS
  'Permanently deletes an entry, its attachments, and versions. Creates a tombstone for sync propagation. Returns file_paths for storage cleanup.';
