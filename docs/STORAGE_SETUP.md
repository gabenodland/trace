# Supabase Storage Setup for Photos

## Manual Setup Required

The photos storage bucket needs to be created manually in the Supabase Dashboard.

### Steps:

1. Go to https://supabase.com/dashboard/project/lsszorssvkavegobmqic/storage/buckets

2. Click "New bucket"

3. Configure:
   - **Name**: `photos`
   - **Public**: OFF (private bucket)
   - **File size limit**: 5 MB (5242880 bytes)
   - **Allowed MIME types**:
     - image/jpeg
     - image/jpg
     - image/png
     - image/webp
     - image/heic

4. Click "Create bucket"

5. Click on the "photos" bucket

6. Go to "Policies" tab

7. The RLS policies are already defined in the migration file (20251112000003_create_photos_storage_bucket.sql) but storage policies must be set up via Dashboard:

   **For SELECT (View):**
   - Target: `storage.objects`
   - Policy name: Users can view their own photos
   - USING: `bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text`

   **For INSERT (Upload):**
   - Target: `storage.objects`
   - Policy name: Users can upload their own photos
   - WITH CHECK: `bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text`

   **For UPDATE:**
   - Target: `storage.objects`
   - Policy name: Users can update their own photos
   - USING & WITH CHECK: `bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text`

   **For DELETE:**
   - Target: `storage.objects`
   - Policy name: Users can delete their own photos
   - USING: `bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text`

## File Path Structure

Photos will be stored at:
```
{user_id}/{entry_id}/{photo_id}.jpg
{user_id}/{entry_id}/{photo_id}_thumb.jpg  (thumbnail)
```

This ensures users can only access their own photos via RLS.
