-- Guard: prevent entries from being assigned to a soft-deleted stream.
-- If an entry INSERT/UPDATE references a stream with deleted_at set,
-- automatically nullify the stream_id (move to Inbox).

CREATE OR REPLACE FUNCTION guard_entry_deleted_stream()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stream_id IS NOT NULL THEN
    PERFORM 1 FROM streams
      WHERE stream_id = NEW.stream_id
        AND deleted_at IS NOT NULL;
    IF FOUND THEN
      NEW.stream_id = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guard_entry_deleted_stream_trigger
  BEFORE INSERT OR UPDATE OF stream_id ON entries
  FOR EACH ROW
  EXECUTE FUNCTION guard_entry_deleted_stream();

COMMENT ON FUNCTION guard_entry_deleted_stream IS
  'Prevents entries from referencing a soft-deleted stream. Nullifies stream_id if the target stream has deleted_at set.';
