-- Add triggered_by_device column to entry_versions
-- For sync_overwrite/conflict versions: records the remote device that caused this local snapshot.
-- device_id = the device that owns the snapshot (local), triggered_by_device = the device that triggered the sync.

ALTER TABLE entry_versions ADD COLUMN triggered_by_device text;

COMMENT ON COLUMN entry_versions.triggered_by_device IS 'For sync_overwrite/conflict: the remote device ID that triggered this local snapshot.';
