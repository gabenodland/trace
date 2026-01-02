-- ============================================================================
-- Drop completed_at_requires_completed_status Constraint
-- ============================================================================
-- The constraint was too strict - requiring completed_at to be set for completed
-- statuses and NULL for non-completed statuses. This caused sync failures.
--
-- Making completed_at optional - the app can set it when appropriate.
-- ============================================================================

ALTER TABLE entries DROP CONSTRAINT IF EXISTS completed_at_requires_completed_status;
