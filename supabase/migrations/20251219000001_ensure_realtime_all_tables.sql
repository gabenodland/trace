-- Enable realtime for all tables (entries, streams, photos, locations)
-- This migration is idempotent - safe to run even if configuration already exists
--
-- The supabase_realtime publication must include tables for realtime to work.
-- REPLICA IDENTITY FULL is required for RLS-filtered realtime subscriptions.

-- Function to safely add table to publication (handles "already exists" error)
DO $$
BEGIN
    -- Add entries table to publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.entries;
        RAISE NOTICE 'Added entries to supabase_realtime publication';
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'entries already in supabase_realtime publication';
    END;

    -- Add streams table to publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.streams;
        RAISE NOTICE 'Added streams to supabase_realtime publication';
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'streams already in supabase_realtime publication';
    END;

    -- Add photos table to publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;
        RAISE NOTICE 'Added photos to supabase_realtime publication';
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'photos already in supabase_realtime publication';
    END;

    -- Add locations table to publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
        RAISE NOTICE 'Added locations to supabase_realtime publication';
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'locations already in supabase_realtime publication';
    END;
END;
$$;

-- Set REPLICA IDENTITY to FULL for all tables
-- This is required for RLS-filtered realtime to see full row data
ALTER TABLE public.entries REPLICA IDENTITY FULL;
ALTER TABLE public.streams REPLICA IDENTITY FULL;
ALTER TABLE public.photos REPLICA IDENTITY FULL;
ALTER TABLE public.locations REPLICA IDENTITY FULL;

-- Log what's in the publication for verification
DO $$
DECLARE
    table_rec RECORD;
BEGIN
    RAISE NOTICE 'Tables in supabase_realtime publication:';
    FOR table_rec IN
        SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
    LOOP
        RAISE NOTICE '  - %', table_rec.tablename;
    END LOOP;
END;
$$;
