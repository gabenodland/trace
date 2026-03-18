/**
 * Mobile Attachment API - Offline-first attachment operations
 *
 * Handles local file system operations for attachments on mobile.
 * Includes image compression, thumbnail generation, and file management.
 *
 * Architecture:
 * Components → Hooks → API (this file) → LocalDB + FileSystem
 *                                      ↓
 *                                  SyncService (background upload)
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase, IMAGE_QUALITY_PRESETS } from '@trace/core';
import { localDB } from '../../shared/db/localDB';
import { triggerPushSync } from '../../shared/sync/syncTrigger';
import { createScopedLogger } from '../../shared/utils/logger';
import { isNetworkError } from '../../shared/utils/networkUtils';
import type { CompressedAttachment, ImageQuality } from '@trace/core';

const log = createScopedLogger('AttachmentApi');

// ============================================================================
// DETERMINISTIC LOCAL PATH
// ============================================================================

/**
 * Compute the local filesystem path for an attachment.
 * Always deterministic — no DB lookup needed.
 */
export function getAttachmentLocalPath(userId: string, entryId: string, attachmentId: string): string {
  return `${FileSystem.documentDirectory}attachments/${userId}/${entryId}/${attachmentId}.jpg`;
}

/**
 * Check if an attachment file exists on disk at its deterministic path.
 */
export async function isAttachmentOnDisk(userId: string, entryId: string, attachmentId: string): Promise<boolean> {
  const path = getAttachmentLocalPath(userId, entryId, attachmentId);
  const info = await FileSystem.getInfoAsync(path);
  return info.exists;
}

// ============================================================================
// PERMISSIONS
// ============================================================================

/**
 * Request camera permissions
 */
export async function requestCameraPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * Request gallery permissions
 */
export async function requestGalleryPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

// ============================================================================
// CAPTURE & PICK
// ============================================================================

/**
 * Launch camera to capture a photo
 * Uses quality 1 to get full resolution - compression happens later in compressAttachment()
 */
export async function capturePhoto(): Promise<{ uri: string; width: number; height: number } | null> {
  try {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) {
      throw new Error('Camera permission not granted');
    }

    log.debug('Launching camera');

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
      exif: true,
    });

    if (result.canceled) {
      log.debug('Camera capture cancelled');
      return null;
    }

    const asset = result.assets[0];
    log.info('Photo captured', { width: asset.width, height: asset.height });

    return {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    };
  } catch (error) {
    log.error('Failed to capture photo', error);
    throw error;
  }
}

/**
 * Pick photo from gallery (single selection)
 * Uses quality 1 to get full resolution - compression happens later
 */
export async function pickPhotoFromGallery(): Promise<{ uri: string; width: number; height: number } | null> {
  try {
    const hasPermission = await requestGalleryPermissions();
    if (!hasPermission) {
      throw new Error('Gallery permission not granted');
    }

    log.debug('Opening gallery picker');

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 1,
      exif: true,
    });

    if (result.canceled) {
      log.debug('Gallery picker cancelled');
      return null;
    }

    const asset = result.assets[0];
    log.info('Photo picked from gallery', { width: asset.width, height: asset.height });

    return {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    };
  } catch (error) {
    log.error('Failed to pick photo from gallery', error);
    throw error;
  }
}

/**
 * Pick multiple photos from gallery
 * Uses quality 1 to get full resolution - compression happens later
 */
export async function pickMultiplePhotosFromGallery(): Promise<{ uri: string; width: number; height: number }[]> {
  try {
    const hasPermission = await requestGalleryPermissions();
    if (!hasPermission) {
      throw new Error('Gallery permission not granted');
    }

    log.debug('Opening gallery picker (multi-select)');

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 1,
      exif: true,
      selectionLimit: 10, // Reasonable limit to avoid memory issues
    });

    if (result.canceled) {
      log.debug('Gallery picker cancelled');
      return [];
    }

    const photos = result.assets.map(asset => ({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    }));

    log.info('Photos picked from gallery', { count: photos.length });

    return photos;
  } catch (error) {
    log.error('Failed to pick photos from gallery', error);
    throw error;
  }
}

// ============================================================================
// IMAGE PROCESSING
// ============================================================================

/**
 * Compress and resize photo based on quality setting
 */
export async function compressAttachment(uri: string, quality: ImageQuality = 'standard'): Promise<CompressedAttachment> {
  try {
    const preset = IMAGE_QUALITY_PRESETS[quality];
    log.debug('Compressing attachment', { quality, maxWidth: preset.maxWidth, uri: uri.substring(0, 50) });

    // For full quality, skip manipulation entirely
    if (quality === 'full') {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const size = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

      const infoResult = await ImageManipulator.manipulateAsync(uri, [], {
        format: ImageManipulator.SaveFormat.JPEG,
      });

      log.debug('Full quality - no compression', { size, width: infoResult.width, height: infoResult.height });

      return {
        uri: uri,
        width: infoResult.width,
        height: infoResult.height,
        file_size: size,
        mime_type: uri.toLowerCase().includes('.heic') ? 'image/heic' :
                   uri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg',
      };
    }

    // Build manipulation actions
    const actions: ImageManipulator.Action[] = [];
    if (preset.maxWidth !== null) {
      actions.push({ resize: { width: preset.maxWidth } });
    }

    const manipResult = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: preset.compress,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    const fileInfo = await FileSystem.getInfoAsync(manipResult.uri);
    const size = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

    log.debug('Attachment compressed', {
      width: manipResult.width,
      height: manipResult.height,
      size,
    });

    return {
      uri: manipResult.uri,
      width: manipResult.width,
      height: manipResult.height,
      file_size: size,
      mime_type: 'image/jpeg',
    };
  } catch (error) {
    log.error('Failed to compress attachment', error, { uri: uri.substring(0, 50), quality });
    throw error;
  }
}

/**
 * Generate thumbnail from attachment (200x200px)
 */
export async function generateThumbnail(uri: string): Promise<CompressedAttachment> {
  log.debug('Generating thumbnail');

  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 200, height: 200 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
  );

  const fileInfo = await FileSystem.getInfoAsync(manipResult.uri);
  const size = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

  return {
    uri: manipResult.uri,
    width: manipResult.width,
    height: manipResult.height,
    file_size: size,
    mime_type: 'image/jpeg',
  };
}

// ============================================================================
// LOCAL FILE OPERATIONS
// ============================================================================

/**
 * Save attachment to local file system
 */
export async function saveAttachmentToLocalStorage(
  uri: string,
  attachmentId: string,
  userId: string,
  entryId: string
): Promise<string> {
  const dirPath = `${FileSystem.documentDirectory}attachments/${userId}/${entryId}/`;
  await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });

  const targetPath = `${dirPath}${attachmentId}.jpg`;

  log.debug('Saving attachment to local storage', { attachmentId, targetPath });

  await FileSystem.copyAsync({
    from: uri,
    to: targetPath,
  });

  log.info('Attachment saved locally', { attachmentId });
  return targetPath;
}

/**
 * Delete attachment from local file system
 */
export async function deleteAttachmentFromLocalStorage(localPath: string): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localPath);
      log.debug('Local attachment file deleted', { path: localPath });
    } else {
      log.debug('Local attachment file not found', { path: localPath });
    }
  } catch (error) {
    log.warn('Could not delete local attachment file', { path: localPath, error });
  }
}

/**
 * Create attachment input type
 */
export interface CreateAttachmentInput {
  attachment_id: string;
  entry_id: string;
  user_id: string;
  file_path: string;
  local_path: string;
  mime_type: string;
  file_size: number;
  width: number;
  height: number;
  position: number;
  uploaded: boolean;
}

/**
 * Create an attachment record in the local database
 * This is the proper API function for creating attachments - components should use this instead of localDB directly
 */
export async function createAttachment(data: CreateAttachmentInput): Promise<void> {
  log.info('Creating attachment', { attachmentId: data.attachment_id, entryId: data.entry_id });

  await localDB.createAttachment({
    attachment_id: data.attachment_id,
    entry_id: data.entry_id,
    user_id: data.user_id,
    file_path: data.file_path,
    local_path: data.local_path,
    mime_type: data.mime_type,
    file_size: data.file_size,
    width: data.width,
    height: data.height,
    position: data.position,
    uploaded: data.uploaded,
  });

  // Trigger sync in background
  triggerPushSync();

  log.success('Attachment created', { attachmentId: data.attachment_id });
}

/**
 * Get all attachments for an entry
 */
export async function getAttachmentsForEntry(entryId: string): Promise<any[]> {
  log.debug('Getting attachments for entry', { entryId });
  return await localDB.getAttachmentsForEntry(entryId);
}

/**
 * Get attachment counts per entry (for filtering by "has photos")
 * Returns a map of entry_id -> attachment count
 */
export async function getEntryAttachmentCounts(): Promise<Record<string, number>> {
  return await localDB.getEntryAttachmentCounts();
}

/**
 * Soft-delete attachment (marks deleted_at, keeps local file for version history)
 */
export async function deleteAttachment(attachmentId: string): Promise<void> {
  log.info('deleteAttachment called (soft-delete)', { attachmentId });

  try {
    const attachment = await localDB.getAttachment(attachmentId);
    if (!attachment) {
      log.warn('Attachment not found in database', { attachmentId });
      return;
    }

    log.info('Attachment found, soft-deleting', { attachmentId, entryId: attachment.entry_id, synced: attachment.synced });

    // Soft-delete: set deleted_at + sync_action, keep local file for version history (C5)
    await localDB.deleteAttachment(attachmentId);
    log.info('Attachment soft-deleted in localDB', { attachmentId });

    // Trigger sync in background
    triggerPushSync();

    log.success('Attachment soft-delete initiated', { attachmentId });
  } catch (error) {
    log.error('Failed to soft-delete attachment', error, { attachmentId });
    throw error;
  }
}

/**
 * Permanently delete attachment (SQLite row + local file)
 * Called only by cleanup jobs — not for normal user-facing deletion.
 */
export async function permanentlyDeleteAttachment(attachmentId: string): Promise<void> {
  log.info('permanentlyDeleteAttachment called', { attachmentId });

  try {
    const attachment = await localDB.getAttachment(attachmentId);

    // Delete local file at deterministic path
    if (attachment) {
      const localPath = getAttachmentLocalPath(attachment.user_id, attachment.entry_id, attachmentId);
      try {
        await deleteAttachmentFromLocalStorage(localPath);
      } catch (err) {
        log.debug('Could not delete local file (may not exist)', { attachmentId, error: err });
      }
    }

    // Hard-delete from SQLite
    await localDB.permanentlyDeleteAttachment(attachmentId);
    log.success('Attachment permanently deleted', { attachmentId });
  } catch (error) {
    log.error('Failed to permanently delete attachment', error, { attachmentId });
    throw error;
  }
}

// ============================================================================
// CLOUD OPERATIONS
// ============================================================================

/**
 * Upload attachment to Supabase Storage
 */
export async function uploadAttachmentToSupabase(
  localPath: string,
  remotePath: string
): Promise<{ url: string; size: number }> {
  log.debug('Uploading attachment to Supabase', { remotePath });

  const fileInfo = await FileSystem.getInfoAsync(localPath);
  if (!fileInfo.exists) {
    throw new Error('Local file does not exist');
  }

  const base64 = await FileSystem.readAsStringAsync(localPath, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { data, error } = await supabase.storage
    .from('attachments')
    .upload(remotePath, bytes, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('attachments')
    .getPublicUrl(remotePath);

  log.info('Attachment uploaded to Supabase', { remotePath, size: bytes.length });

  return {
    url: urlData.publicUrl,
    size: bytes.length,
  };
}

/**
 * Download attachment from Supabase to local storage
 */
export async function downloadAttachmentToLocal(
  remotePath: string,
  localPath: string
): Promise<void> {
  log.debug('Downloading attachment from Supabase', { remotePath });

  const { data, error } = await supabase.storage
    .from('attachments')
    .download(remotePath);

  if (error) {
    if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
      throw new Error(`Attachment file not found in storage: ${remotePath}`);
    }
    throw error;
  }

  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve, reject) => {
    reader.onloadend = () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
  });

  reader.readAsDataURL(data);
  const base64Data = await base64Promise;

  await FileSystem.writeAsStringAsync(localPath, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });

  log.info('Attachment downloaded from Supabase', { remotePath, localPath });
}

// ============================================================================
// ATTACHMENT RETRIEVAL
// ============================================================================

/**
 * Get attachment URI (local first, then download from cloud if needed)
 */
export async function getAttachmentUri(attachmentId: string): Promise<string | null> {
  try {
    const attachment = await localDB.getAttachment(attachmentId);
    if (!attachment) {
      return null;
    }

    // Check deterministic local path first
    const localPath = getAttachmentLocalPath(attachment.user_id, attachment.entry_id, attachmentId);
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      return localPath;
    }

    // Not on disk — try to download from cloud
    if (attachment.file_path && attachment.uploaded) {
      const downloaded = await ensureAttachmentDownloaded(attachmentId);
      if (downloaded) {
        return downloaded;
      }
    }

    // Fallback: Return Supabase signed URL
    if (attachment.file_path) {
      try {
        const { data, error } = await supabase.storage
          .from('attachments')
          .createSignedUrl(attachment.file_path, 3600);

        if (error) {
          log.debug('Attachment file not found in storage (orphaned entry)', { attachmentId });
          return null;
        }

        return data.signedUrl;
      } catch (signedUrlError) {
        log.debug('Could not create signed URL', { attachmentId });
        return null;
      }
    }

    return null;
  } catch (error) {
    if (isNetworkError(error)) {
      log.debug('Attachment URI skipped (offline)', { attachmentId });
    } else {
      log.error('Error getting attachment URI', error, { attachmentId });
    }
    return null;
  }
}

/**
 * Ensure attachment is downloaded locally (on-demand download)
 * Returns local URI if available, downloads from cloud if needed
 */
export async function ensureAttachmentDownloaded(attachmentId: string): Promise<string | null> {
  try {
    const attachment = await localDB.getAttachment(attachmentId);
    if (!attachment) {
      log.debug('Attachment not found in local DB', { attachmentId });
      return null;
    }

    // Check if already on disk at the deterministic path
    const localPath = getAttachmentLocalPath(attachment.user_id, attachment.entry_id, attachmentId);
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      return localPath;
    }

    // Not on disk — download from cloud
    if (!attachment.file_path || !attachment.uploaded) {
      return null;
    }

    log.debug('Downloading attachment from cloud', { attachmentId });

    const dirPath = `${FileSystem.documentDirectory}attachments/${attachment.user_id}/${attachment.entry_id}/`;
    await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });

    await downloadAttachmentToLocal(attachment.file_path, localPath);

    log.success('Attachment downloaded', { attachmentId });
    return localPath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorString = typeof error === 'object' ? JSON.stringify(error) : String(error);

    const isNotFound = errorString.includes('"status":400') ||
                       errorString.includes('"status":404') ||
                       errorMessage.includes('not found') ||
                       errorMessage.includes('does not exist');

    if (isNotFound) {
      log.debug('Attachment file missing from storage (orphaned DB entry)', { attachmentId });
      return null;
    }

    if (isNetworkError(error)) {
      log.debug('Attachment download skipped (offline)', { attachmentId });
      return null;
    }

    log.error('Error downloading attachment', error, { attachmentId });
    return null;
  }
}

/**
 * Download missing attachments in background.
 * Uses deterministic paths — compares DB manifest against filesystem.
 * No reliance on local_path column.
 */
export async function downloadAttachmentsInBackground(): Promise<void> {
  try {
    const allAttachments = await localDB.getAllAttachments();
    const missing: any[] = [];
    let onDisk = 0;

    for (const att of allAttachments) {
      // Only downloadable attachments (uploaded to cloud, not deleted)
      if (!att.file_path || !att.uploaded) continue;

      const localPath = getAttachmentLocalPath(att.user_id, att.entry_id, att.attachment_id);
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists) {
        onDisk++;
      } else {
        missing.push(att);
      }
    }

    log.info('Attachment sync', {
      total: allAttachments.length,
      onDisk,
      missing: missing.length,
    });

    if (missing.length === 0) return;

    log.info('Starting background attachment download', { count: missing.length });

    let successCount = 0;
    let errorCount = 0;

    for (const att of missing) {
      try {
        await ensureAttachmentDownloaded(att.attachment_id);
        successCount++;
      } catch (error) {
        log.warn('Failed to download attachment', { attachmentId: att.attachment_id, error });
        errorCount++;
      }
    }

    log.success('Background attachment download complete', { success: successCount, errors: errorCount });
  } catch (error) {
    log.error('Background attachment download failed', error);
  }
}
