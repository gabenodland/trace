-- Create storage bucket for attachments (new bucket, keeping photos bucket as fallback)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,  -- Private bucket, requires authentication
  5242880,  -- 5MB max file size
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
  -- Future: Add 'application/pdf', 'application/msword', etc.
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for attachments bucket

-- Users can view their own attachments
CREATE POLICY "Users can view their own attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can upload their own attachments
CREATE POLICY "Users can upload their own attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can update their own attachments
CREATE POLICY "Users can update their own attachments"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can delete their own attachments
CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- NOTE: The old 'photos' bucket is intentionally kept for rollback safety
-- Delete it manually after confirming the migration is successful
