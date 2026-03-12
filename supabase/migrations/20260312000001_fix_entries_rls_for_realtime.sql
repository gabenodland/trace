-- Fix: Remove deleted_at IS NULL from entries SELECT policy
--
-- Problem: Supabase Realtime applies RLS before broadcasting postgres_changes events.
-- When an entry is soft-deleted (deleted_at set), the row no longer matches the SELECT
-- policy, so the realtime event is silently dropped — clients never receive delete
-- notifications. Filtering is moved to the application layer instead.

DROP POLICY IF EXISTS "Users can view their own entries" ON entries;

CREATE POLICY "Users can view their own entries"
  ON entries FOR SELECT
  USING (auth.uid() = user_id);
