-- ============================================================================
-- Sync Manifest RPC Functions
-- ============================================================================
-- Provides lightweight manifest queries for efficient client-side sync.
-- Client fetches manifest (IDs + versions), diffs locally, then batch-fetches
-- only the entries/attachments that differ.
--
-- Design: single atomic RPC returns both hash and manifest in one call.
-- Hash allows fast skip when nothing changed. Manifest enables precise diffing.
-- ============================================================================

-- ============================================================================
-- ENTRY SYNC MANIFEST
-- ============================================================================

-- Returns hash + manifest atomically for entries.
-- Excludes soft-deleted entries (handled separately by the deleted entry pull path).
-- Hash is MD5 of all entry_id:version pairs sorted by entry_id.
-- Client compares hash to local hash — if match, nothing changed, skip everything.
-- If mismatch, client diffs the manifest against local state.
CREATE OR REPLACE FUNCTION get_entries_sync_manifest()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH manifest AS (
    SELECT entry_id, COALESCE(version, 1) as version, deleted_at
    FROM entries
    WHERE user_id = auth.uid()
    ORDER BY entry_id
  ),
  hash AS (
    SELECT md5(
      COALESCE(
        string_agg(entry_id::text || ':' || version::text, ',' ORDER BY entry_id),
        ''
      )
    ) as hash
    FROM manifest
  )
  SELECT jsonb_build_object(
    'hash', (SELECT hash FROM hash),
    'entries', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'entry_id', entry_id,
        'version', version,
        'deleted_at', deleted_at
      )) FROM manifest),
      '[]'::jsonb
    )
  );
$$;

COMMENT ON FUNCTION get_entries_sync_manifest IS
  'Returns atomic {hash, entries} for sync manifest comparison. Hash covers ALL entries including soft-deleted. Manifest includes all entries.';

-- ============================================================================
-- ATTACHMENT SYNC MANIFEST
-- ============================================================================

CREATE OR REPLACE FUNCTION get_attachments_sync_manifest()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH manifest AS (
    SELECT attachment_id, entry_id, updated_at, deleted_at
    FROM attachments
    WHERE user_id = auth.uid()
    ORDER BY attachment_id
  ),
  hash AS (
    SELECT md5(
      COALESCE(
        string_agg(
          attachment_id::text || ':' || extract(epoch from COALESCE(updated_at, now()))::bigint::text,
          ',' ORDER BY attachment_id
        ),
        ''
      )
    ) as hash
    FROM manifest
    WHERE deleted_at IS NULL
  )
  SELECT jsonb_build_object(
    'hash', (SELECT hash FROM hash),
    'attachments', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'attachment_id', attachment_id,
        'entry_id', entry_id,
        'updated_at', updated_at,
        'deleted_at', deleted_at
      )) FROM manifest),
      '[]'::jsonb
    )
  );
$$;

COMMENT ON FUNCTION get_attachments_sync_manifest IS
  'Returns atomic {hash, attachments} for sync manifest comparison. Hash covers live attachments only.';

-- ============================================================================
-- COVERING INDEXES (optimize manifest and hash queries)
-- ============================================================================

-- Entries: covering index for manifest + hash (index-only scan on user_id)
CREATE INDEX IF NOT EXISTS idx_entries_user_manifest
  ON entries(user_id, entry_id) INCLUDE (version, deleted_at);

-- Attachments: covering index for manifest + hash
CREATE INDEX IF NOT EXISTS idx_attachments_user_manifest
  ON attachments(user_id, attachment_id) INCLUDE (updated_at, deleted_at, entry_id);
