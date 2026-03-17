-- Fix: Include deleted entries in the manifest hash.
-- Without this, deleted entries are invisible to the hash comparison,
-- causing devices missing deleted entries to never detect the gap.

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
