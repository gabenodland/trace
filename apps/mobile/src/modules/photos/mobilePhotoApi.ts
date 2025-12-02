/**
 * Mobile Photo API - Offline-first photo operations
 *
 * Handles local file system operations for photos on mobile.
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
import type { CompressedPhoto, ImageQuality } from '@trace/core';

const log = createScopedLogger('PhotoApi');

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
 * Uses quality 1 to get full resolution - compression happens later in compressPhoto()
 */
export async function capturePhoto(): Promise<{ uri: string; width: number; height: number } | null> {
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
}

/**
 * Pick photo from gallery
 * Uses quality 1 to get full resolution - compression happens later
 */
export async function pickPhotoFromGallery(): Promise<{ uri: string; width: number; height: number } | null> {
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
}

// ============================================================================
// IMAGE PROCESSING
// ============================================================================

/**
 * Compress and resize photo based on quality setting
 */
export async function compressPhoto(uri: string, quality: ImageQuality = 'standard'): Promise<CompressedPhoto> {
  const preset = IMAGE_QUALITY_PRESETS[quality];
  log.debug('Compressing photo', { quality, maxWidth: preset.maxWidth });

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

  log.debug('Photo compressed', {
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
}

/**
 * Generate thumbnail from photo (200x200px)
 */
export async function generateThumbnail(uri: string): Promise<CompressedPhoto> {
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
 * Save photo to local file system
 */
export async function savePhotoToLocalStorage(
  uri: string,
  photoId: string,
  userId: string,
  entryId: string
): Promise<string> {
  const dirPath = `${FileSystem.documentDirectory}photos/${userId}/${entryId}/`;
  await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });

  const targetPath = `${dirPath}${photoId}.jpg`;

  log.debug('Saving photo to local storage', { photoId, targetPath });

  await FileSystem.copyAsync({
    from: uri,
    to: targetPath,
  });

  log.info('Photo saved locally', { photoId });
  return targetPath;
}

/**
 * Delete photo from local file system
 */
export async function deletePhotoFromLocalStorage(localPath: string): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localPath);
      log.debug('Local photo file deleted', { path: localPath });
    } else {
      log.debug('Local photo file not found', { path: localPath });
    }
  } catch (error) {
    log.warn('Could not delete local photo file', { path: localPath, error });
  }
}

/**
 * Delete photo completely (database entry + local file)
 */
export async function deletePhoto(photoId: string): Promise<void> {
  log.info('Deleting photo', { photoId });

  try {
    const photo = await localDB.getPhoto(photoId);
    if (!photo) {
      log.warn('Photo not found in database', { photoId });
      return;
    }

    // Delete local file if exists
    if (photo.local_path) {
      await deletePhotoFromLocalStorage(photo.local_path);
    }

    // Delete database record (marks for sync deletion)
    await localDB.deletePhoto(photoId);

    // Trigger sync in background
    triggerPushSync();

    log.success('Photo deleted', { photoId });
  } catch (error) {
    log.error('Failed to delete photo', error, { photoId });
    throw error;
  }
}

// ============================================================================
// CLOUD OPERATIONS
// ============================================================================

/**
 * Upload photo to Supabase Storage
 */
export async function uploadPhotoToSupabase(
  localPath: string,
  remotePath: string
): Promise<{ url: string; size: number }> {
  log.debug('Uploading photo to Supabase', { remotePath });

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
    .from('photos')
    .upload(remotePath, bytes, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('photos')
    .getPublicUrl(remotePath);

  log.info('Photo uploaded to Supabase', { remotePath, size: bytes.length });

  return {
    url: urlData.publicUrl,
    size: bytes.length,
  };
}

/**
 * Download photo from Supabase to local storage
 */
export async function downloadPhotoToLocal(
  remotePath: string,
  localPath: string
): Promise<void> {
  log.debug('Downloading photo from Supabase', { remotePath });

  const { data, error } = await supabase.storage
    .from('photos')
    .download(remotePath);

  if (error) {
    if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
      throw new Error(`Photo file not found in storage: ${remotePath}`);
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

  log.info('Photo downloaded from Supabase', { remotePath, localPath });
}

// ============================================================================
// PHOTO RETRIEVAL
// ============================================================================

/**
 * Get photo URI (local first, then download from cloud if needed)
 */
export async function getPhotoUri(photoId: string): Promise<string | null> {
  try {
    const photo = await localDB.getPhoto(photoId);
    if (!photo) {
      return null;
    }

    // Check if local file exists
    if (photo.local_path) {
      const fileInfo = await FileSystem.getInfoAsync(photo.local_path);
      if (fileInfo.exists) {
        return photo.local_path;
      }
    }

    // Photo is from cloud but not downloaded yet
    if (photo.file_path && photo.uploaded) {
      log.debug('Photo not local, attempting download', { photoId });
      const localPath = await ensurePhotoDownloaded(photoId);
      if (localPath) {
        return localPath;
      }
      log.debug('Photo file missing - cannot display', { photoId });
      return null;
    }

    // Fallback: Return Supabase signed URL
    if (photo.file_path) {
      try {
        const { data, error } = await supabase.storage
          .from('photos')
          .createSignedUrl(photo.file_path, 3600);

        if (error) {
          log.debug('Photo file not found in storage (orphaned entry)', { photoId });
          return null;
        }

        return data.signedUrl;
      } catch (signedUrlError) {
        log.debug('Could not create signed URL', { photoId });
        return null;
      }
    }

    return null;
  } catch (error) {
    log.error('Error getting photo URI', error, { photoId });
    return null;
  }
}

/**
 * Ensure photo is downloaded locally (on-demand download)
 * Returns local URI if available, downloads from cloud if needed
 */
export async function ensurePhotoDownloaded(photoId: string): Promise<string | null> {
  try {
    const photo = await localDB.getPhoto(photoId);
    if (!photo) {
      log.debug('Photo not found in local DB', { photoId });
      return null;
    }

    // Check if already downloaded
    if (photo.local_path) {
      const fileInfo = await FileSystem.getInfoAsync(photo.local_path);
      if (fileInfo.exists) {
        return photo.local_path;
      }
    }

    // Download from cloud
    log.debug('Downloading photo from cloud', { photoId });

    const dirPath = `${FileSystem.documentDirectory}photos/${photo.user_id}/${photo.entry_id}/`;
    await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });

    const localPath = `${dirPath}${photoId}.jpg`;

    await downloadPhotoToLocal(photo.file_path, localPath);
    await localDB.updatePhoto(photoId, { local_path: localPath });

    log.success('Photo downloaded', { photoId });
    return localPath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorString = typeof error === 'object' ? JSON.stringify(error) : String(error);

    const isNotFound = errorString.includes('"status":400') ||
                       errorString.includes('"status":404') ||
                       errorMessage.includes('not found') ||
                       errorMessage.includes('does not exist');

    if (isNotFound) {
      log.debug('Photo file missing from storage (orphaned DB entry)', { photoId });
      return null;
    }

    log.error('Error downloading photo', error, { photoId });
    return null;
  }
}

/**
 * Download photos in background (for photos pulled from cloud during sync)
 */
export async function downloadPhotosInBackground(limit: number = 10): Promise<void> {
  try {
    const allPhotos = await localDB.getAllPhotos();
    const photosToDownload: any[] = [];

    for (const photo of allPhotos) {
      if (photosToDownload.length >= limit) break;

      if (photo.local_path) {
        const fileInfo = await FileSystem.getInfoAsync(photo.local_path);
        if (fileInfo.exists) {
          continue;
        }
      }

      if (photo.file_path && photo.uploaded) {
        photosToDownload.push(photo);
      }
    }

    if (photosToDownload.length === 0) {
      log.debug('No photos to download in background');
      return;
    }

    log.info('Starting background photo download', { count: photosToDownload.length });

    let successCount = 0;
    let errorCount = 0;

    for (const photo of photosToDownload) {
      try {
        await ensurePhotoDownloaded(photo.photo_id);
        successCount++;
      } catch (error) {
        log.warn('Failed to download photo', { photoId: photo.photo_id, error });
        errorCount++;
      }
    }

    log.success('Background photo download complete', { success: successCount, errors: errorCount });
  } catch (error) {
    log.error('Background photo download failed', error);
  }
}
