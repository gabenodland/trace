-- Fix stream entry_count trigger
-- The old category trigger was dropped during the rename and never recreated for streams

-- ============================================================================
-- Step 1: Create the trigger function for stream entry counts
-- ============================================================================

CREATE OR REPLACE FUNCTION update_stream_entry_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT: increment new stream count
  IF TG_OP = 'INSERT' THEN
    IF NEW.stream_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
      UPDATE streams
      SET entry_count = (
        SELECT COUNT(*) FROM entries
        WHERE stream_id = NEW.stream_id AND deleted_at IS NULL
      )
      WHERE stream_id = NEW.stream_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle DELETE: decrement old stream count
  IF TG_OP = 'DELETE' THEN
    IF OLD.stream_id IS NOT NULL THEN
      UPDATE streams
      SET entry_count = (
        SELECT COUNT(*) FROM entries
        WHERE stream_id = OLD.stream_id AND deleted_at IS NULL
      )
      WHERE stream_id = OLD.stream_id;
    END IF;
    RETURN OLD;
  END IF;

  -- Handle UPDATE: recalc both old and new stream if changed
  IF TG_OP = 'UPDATE' THEN
    -- If stream changed or deleted_at changed, update both
    IF (OLD.stream_id IS DISTINCT FROM NEW.stream_id) OR
       (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at) THEN

      -- Update old stream count
      IF OLD.stream_id IS NOT NULL THEN
        UPDATE streams
        SET entry_count = (
          SELECT COUNT(*) FROM entries
          WHERE stream_id = OLD.stream_id AND deleted_at IS NULL
        )
        WHERE stream_id = OLD.stream_id;
      END IF;

      -- Update new stream count
      IF NEW.stream_id IS NOT NULL THEN
        UPDATE streams
        SET entry_count = (
          SELECT COUNT(*) FROM entries
          WHERE stream_id = NEW.stream_id AND deleted_at IS NULL
        )
        WHERE stream_id = NEW.stream_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 2: Create the trigger
-- ============================================================================

DROP TRIGGER IF EXISTS update_stream_entry_count_trigger ON entries;
CREATE TRIGGER update_stream_entry_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON entries
  FOR EACH ROW
  EXECUTE FUNCTION update_stream_entry_count();

-- ============================================================================
-- Step 3: Recalculate all stream entry counts (fix existing data)
-- ============================================================================

UPDATE streams s
SET entry_count = (
  SELECT COUNT(*)
  FROM entries e
  WHERE e.stream_id = s.stream_id
    AND e.deleted_at IS NULL
);

COMMENT ON FUNCTION update_stream_entry_count IS 'Maintains entry_count on streams table when entries are created, moved, or deleted';
