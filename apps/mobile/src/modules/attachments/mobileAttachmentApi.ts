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
import { triggerPushSync } from '../../shared/sync';
import { createScopedLogger } from '../../shared/utils/logger';
import type { CompressedAttachment, ImageQuality } from '@trace/core';

const log = createScopedLogger('AttachmentApi');

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
 * Delete attachment completely (database entry + local file)
 */
export async function deleteAttachment(attachmentId: string): Promise<void> {
  log.info('📎 deleteAttachment called', { attachmentId });

  try {
    const attachment = await localDB.getAttachment(attachmentId);
    if (!attachment) {
      log.warn('📎 Attachment not found in database', { attachmentId });
      return;
    }

    log.info('📎 Attachment found, marking for deletion', { attachmentId, entryId: attachment.entry_id, synced: attachment.synced });

    // Delete local file if exists
    if (attachment.local_path) {
      await deleteAttachmentFromLocalStorage(attachment.local_path);
    }

    // Delete database record (marks for sync deletion)
    await localDB.deleteAttachment(attachmentId);
    log.info('📎 Attachment marked for sync deletion in localDB', { attachmentId });

    // Trigger sync in background
    log.info('📎 Triggering push sync for attachment deletion');
    triggerPushSync();

    log.success('📎 Attachment delete initiated', { attachmentId });
  } catch (error) {
    log.error('📎 Failed to delete attachment', error, { attachmentId });
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

    // Check if local file exists
    if (attachment.local_path) {
      const fileInfo = await FileSystem.getInfoAsync(attachment.local_path);
      if (fileInfo.exists) {
        return attachment.local_path;
      }
    }

    // Attachment is from cloud but not downloaded yet
    if (attachment.file_path && attachment.uploaded) {
      log.debug('Attachment not local, attempting download', { attachmentId });
      const localPath = await ensureAttachmentDownloaded(attachmentId);
      if (localPath) {
        return localPath;
      }
      log.debug('Attachment file missing - cannot display', { attachmentId });
      return null;
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
    log.error('Error getting attachment URI', error, { attachmentId });
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

    // Check if already downloaded
    if (attachment.local_path) {
      const fileInfo = await FileSystem.getInfoAsync(attachment.local_path);
      if (fileInfo.exists) {
        return attachment.local_path;
      }
    }

    // Download from cloud
    log.debug('Downloading attachment from cloud', { attachmentId });

    const dirPath = `${FileSystem.documentDirectory}attachments/${attachment.user_id}/${attachment.entry_id}/`;
    await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });

    const localPath = `${dirPath}${attachmentId}.jpg`;

    await downloadAttachmentToLocal(attachment.file_path, localPath);
    await localDB.updateAttachment(attachmentId, { local_path: localPath });

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

    log.error('Error downloading attachment', error, { attachmentId });
    return null;
  }
}

/**
 * Download attachments in background (for attachments pulled from cloud during sync)
 */
export async function downloadAttachmentsInBackground(limit: number = 10): Promise<void> {
  try {
    const allAttachments = await localDB.getAllAttachments();
    const attachmentsToDownload: any[] = [];

    for (const attachment of allAttachments) {
      if (attachmentsToDownload.length >= limit) break;

      if (attachment.local_path) {
        const fileInfo = await FileSystem.getInfoAsync(attachment.local_path);
        if (fileInfo.exists) {
          continue;
        }
      }

      if (attachment.file_path && attachment.uploaded) {
        attachmentsToDownload.push(attachment);
      }
    }

    if (attachmentsToDownload.length === 0) {
      log.debug('No attachments to download in background');
      return;
    }

    log.info('Starting background attachment download', { count: attachmentsToDownload.length });

    let successCount = 0;
    let errorCount = 0;

    for (const attachment of attachmentsToDownload) {
      try {
        await ensureAttachmentDownloaded(attachment.attachment_id);
        successCount++;
      } catch (error) {
        log.warn('Failed to download attachment', { attachmentId: attachment.attachment_id, error });
        errorCount++;
      }
    }

    log.success('Background attachment download complete', { success: successCount, errors: errorCount });
  } catch (error) {
    log.error('Background attachment download failed', error);
  }
}
