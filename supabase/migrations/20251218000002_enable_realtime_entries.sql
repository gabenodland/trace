-- Enable realtime for entries table
-- This allows clients to subscribe to changes on the entries table

-- Add entries table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE entries;

-- Set REPLICA IDENTITY to FULL so we get the complete row data in change events
-- This is required for RLS-filtered realtime subscriptions
ALTER TABLE entries REPLICA IDENTITY FULL;
