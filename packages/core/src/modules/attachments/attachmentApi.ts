/**
 * Attachment API
 *
 * Database and Storage operations for attachments
 * Internal use only - not exported to components
 */

import { supabase } from '../../shared/supabase';
import type { Attachment, CreateAttachmentInput, UpdateAttachmentInput } from './AttachmentTypes';

/**
 * Get all attachments for a user
 */
export async function getAttachments(userId?: string): Promise<Attachment[]> {
  let query = supabase
    .from('attachments')
    .select('*')
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as Attachment[];
}

/**
 * Get attachments for a specific entry
 */
export async function getAttachmentsForEntry(entryId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('entry_id', entryId)
    .order('position', { ascending: true });

  if (error) throw error;
  return (data || []) as Attachment[];
}

/**
 * Get a single attachment by ID
 */
export async function getAttachment(attachmentId: string): Promise<Attachment> {
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('attachment_id', attachmentId)
    .single();

  if (error) throw error;
  return data as Attachment;
}

/**
 * Create a new attachment record in database
 */
export async function createAttachment(input: CreateAttachmentInput): Promise<Attachment> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const attachmentData = {
    user_id: input.user_id,
    entry_id: input.entry_id,
    file_path: input.file_path,
    file_size: input.file_size,
    mime_type: input.mime_type,
    position: input.position,
  };

  const { data, error } = await supabase
    .from('attachments')
    .insert(attachmentData)
    .select()
    .single();

  if (error) throw error;
  return data as Attachment;
}

/**
 * Update an attachment record
 */
export async function updateAttachment(attachmentId: string, updates: UpdateAttachmentInput): Promise<Attachment> {
  const { data, error } = await supabase
    .from('attachments')
    .update(updates)
    .eq('attachment_id', attachmentId)
    .select()
    .single();

  if (error) throw error;
  return data as Attachment;
}

/**
 * Delete an attachment record from database
 */
export async function deleteAttachment(attachmentId: string): Promise<void> {
  const { error } = await supabase
    .from('attachments')
    .delete()
    .eq('attachment_id', attachmentId);

  if (error) throw error;
}

/**
 * Upload attachment file to Supabase Storage
 */
export async function uploadAttachmentFile(
  filePath: string,
  fileData: Blob | File,
  contentType: string
): Promise<{ path: string; url: string }> {
  const { data, error } = await supabase.storage
    .from('attachments' as any)
    .upload(filePath, fileData, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('attachments' as any)
    .getPublicUrl(filePath);

  return {
    path: data.path,
    url: urlData.publicUrl,
  };
}

/**
 * Download attachment file from Supabase Storage
 */
export async function downloadAttachmentFile(filePath: string): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from('attachments' as any)
    .download(filePath);

  if (error) throw error;
  return data;
}

/**
 * Delete attachment file from Supabase Storage
 */
export async function deleteAttachmentFile(filePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from('attachments' as any)
    .remove([filePath]);

  if (error) throw error;
}

/**
 * Get public URL for an attachment
 */
export function getAttachmentUrl(filePath: string): string {
  const { data } = supabase.storage
    .from('attachments' as any)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Get signed URL for an attachment (for private access)
 */
export async function getSignedAttachmentUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from('attachments' as any)
    .createSignedUrl(filePath, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Delete all attachments for an entry (both database records and files)
 */
export async function deleteAttachmentsForEntry(entryId: string): Promise<void> {
  // Get all attachments for the entry
  const attachments = await getAttachmentsForEntry(entryId);

  // Delete files from storage
  const filePaths = attachments.map(attachment => attachment.file_path);

  if (filePaths.length > 0) {
    await supabase.storage.from('attachments' as any).remove(filePaths);
  }

  // Delete database records (cascade will handle this via foreign key)
  // But we can explicitly delete to ensure cleanup
  const { error } = await supabase
    .from('attachments')
    .delete()
    .eq('entry_id', entryId);

  if (error) throw error;
}
