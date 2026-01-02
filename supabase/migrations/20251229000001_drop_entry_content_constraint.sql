-- ============================================================================
-- Drop entry_has_content Constraint
-- ============================================================================
-- Allows entries to be created without title or content.
-- Use cases: photo-only entries, entries created by accident (user can delete)
-- ============================================================================

ALTER TABLE entries DROP CONSTRAINT IF EXISTS entry_has_content;
