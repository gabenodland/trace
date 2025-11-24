/**
 * Photo API
 *
 * Database and Storage operations for photos
 * Internal use only - not exported to components
 */

import { supabase } from '../../shared/supabase';
import type { Photo, CreatePhotoInput, UpdatePhotoInput } from './PhotoTypes';

/**
 * Get all photos for a user
 */
export async function getPhotos(userId?: string): Promise<Photo[]> {
  let query = supabase
    .from('photos')
    .select('*')
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Get photos for a specific entry
 */
export async function getPhotosForEntry(entryId: string): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('entry_id', entryId)
    .order('position', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get a single photo by ID
 */
export async function getPhoto(photoId: string): Promise<Photo> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('photo_id', photoId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a new photo record in database
 */
export async function createPhoto(input: CreatePhotoInput): Promise<Photo> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const photoData = {
    user_id: input.user_id,
    entry_id: input.entry_id,
    file_path: input.file_path,
    file_size: input.file_size,
    mime_type: input.mime_type,
    position: input.position,
  };

  const { data, error } = await supabase
    .from('photos')
    .insert(photoData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a photo record
 */
export async function updatePhoto(photoId: string, updates: UpdatePhotoInput): Promise<Photo> {
  const { data, error } = await supabase
    .from('photos')
    .update(updates)
    .eq('photo_id', photoId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a photo record from database
 */
export async function deletePhoto(photoId: string): Promise<void> {
  const { error } = await supabase
    .from('photos')
    .delete()
    .eq('photo_id', photoId);

  if (error) throw error;
}

/**
 * Upload photo file to Supabase Storage
 */
export async function uploadPhotoFile(
  filePath: string,
  fileData: Blob | File,
  contentType: string
): Promise<{ path: string; url: string }> {
  const { data, error } = await supabase.storage
    .from('photos')
    .upload(filePath, fileData, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('photos')
    .getPublicUrl(filePath);

  return {
    path: data.path,
    url: urlData.publicUrl,
  };
}

/**
 * Download photo file from Supabase Storage
 */
export async function downloadPhotoFile(filePath: string): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from('photos')
    .download(filePath);

  if (error) throw error;
  return data;
}

/**
 * Delete photo file from Supabase Storage
 */
export async function deletePhotoFile(filePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from('photos')
    .remove([filePath]);

  if (error) throw error;
}

/**
 * Get public URL for a photo
 */
export function getPhotoUrl(filePath: string): string {
  const { data } = supabase.storage
    .from('photos')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Get signed URL for a photo (for private access)
 */
export async function getSignedPhotoUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUrl(filePath, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Delete all photos for an entry (both database records and files)
 */
export async function deletePhotosForEntry(entryId: string): Promise<void> {
  // Get all photos for the entry
  const photos = await getPhotosForEntry(entryId);

  // Delete files from storage
  const filePaths = photos.map(photo => photo.file_path);

  if (filePaths.length > 0) {
    await supabase.storage.from('photos').remove(filePaths);
  }

  // Delete database records (cascade will handle this via foreign key)
  // But we can explicitly delete to ensure cleanup
  const { error } = await supabase
    .from('photos')
    .delete()
    .eq('entry_id', entryId);

  if (error) throw error;
}
