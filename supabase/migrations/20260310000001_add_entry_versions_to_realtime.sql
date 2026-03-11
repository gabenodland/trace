-- Add entry_versions table to supabase_realtime publication
-- Required for cross-device instant sync of version history

ALTER PUBLICATION supabase_realtime ADD TABLE public.entry_versions;
ALTER TABLE public.entry_versions REPLICA IDENTITY FULL;
