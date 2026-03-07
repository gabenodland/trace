-- Add devices table to supabase_realtime publication
-- Required for realtime device deactivation (force sign-out)

ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
