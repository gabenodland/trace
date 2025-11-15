/**
 * Mobile Photo API
 *
 * Local file system operations for photos on mobile
 * Includes image compression, thumbnail generation, and file management
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@trace/core';
import { localDB } from '../../shared/db/localDB';
import { generatePhotoPath, generateThumbnailPath, getExtensionFromMimeType } from '@trace/core';
import type { CompressedPhoto } from '@trace/core';

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

/**
 * Launch camera to capture a photo
 */
export async function capturePhoto(): Promise<{ uri: string; width: number; height: number } | null> {
  const hasPermission = await requestCameraPermissions();
  if (!hasPermission) {
    throw new Error('Camera permission not granted');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.8,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
  };
}

/**
 * Pick photo from gallery
 */
export async function pickPhotoFromGallery(): Promise<{ uri: string; width: number; height: number } | null> {
  const hasPermission = await requestGalleryPermissions();
  if (!hasPermission) {
    throw new Error('Gallery permission not granted');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    quality: 0.8,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
  };
}

/**
 * Compress and resize photo
 * Target: 1280px max width, 70% quality
 */
export async function compressPhoto(uri: string): Promise<CompressedPhoto> {
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }], // Resize to max 1280px width (maintains aspect ratio)
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  // Get file size
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

/**
 * Generate thumbnail from photo
 * Target: 200x200px
 */
export async function generateThumbnail(uri: string): Promise<CompressedPhoto> {
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 200, height: 200 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
  );

  // Get file size
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

/**
 * Save photo to local file system
 * SIMPLE: Just copy the file to document/photos/{userId}/{entryId}/{photoId}.jpg
 * Returns the local file path
 */
export async function savePhotoToLocalStorage(
  uri: string,
  photoId: string,
  userId: string,
  entryId: string
): Promise<string> {
  // Create directory path: document/photos/{userId}/{entryId}/
  const dirPath = `${FileSystem.documentDirectory}photos/${userId}/${entryId}/`;

  // Ensure directory exists
  await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });

  // Target file path
  const targetPath = `${dirPath}${photoId}.jpg`;

  console.log(`📸 Copying photo: ${uri} → ${targetPath}`);

  // Copy file (handles both file:// URIs and paths)
  await FileSystem.copyAsync({
    from: uri,
    to: targetPath,
  });

  console.log(`✅ Photo saved`);
  return targetPath;
}

/**
 * Delete photo from local file system
 * Silently ignores if file doesn't exist
 */
export async function deletePhotoFromLocalStorage(localPath: string): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localPath);
      console.log(`🗑️ Deleted local photo: ${localPath}`);
    } else {
      console.log(`ℹ️ Local photo file not found (already deleted): ${localPath}`);
    }
  } catch (error) {
    // Silently ignore errors - file may not exist or be inaccessible
    console.log(`ℹ️ Could not delete local photo file (ignoring): ${localPath}`, error);
  }
}

/**
 * Delete photo completely (database entry + local file)
 * Always deletes the database entry even if file doesn't exist
 */
export async function deletePhoto(photoId: string): Promise<void> {
  try {
    // Get photo record to find local_path
    const photo = await localDB.getPhoto(photoId);

    if (!photo) {
      console.warn(`⚠️ Photo ${photoId} not found in database`);
      return;
    }

    // Try to delete local file if it exists (ignores errors)
    if (photo.local_path) {
      try {
        await deletePhotoFromLocalStorage(photo.local_path);
      } catch (error) {
        // Ignore file deletion errors - continue to delete DB entry
        console.log(`ℹ️ Local file deletion failed (continuing): ${photo.local_path}`);
      }
    }

    // Always delete database record (marks for sync deletion)
    // This is the critical step - do this even if file deletion failed
    await localDB.deletePhoto(photoId);

    console.log(`✅ Photo ${photoId} deleted from database successfully`);
  } catch (error) {
    console.error(`❌ Failed to delete photo ${photoId} from database:`, error);
    throw error;
  }
}

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
        // Return local file URI
        return photo.local_path;
      }
    }

    // Photo is from cloud but not downloaded yet - try to download it
    if (photo.file_path && photo.uploaded) {
      console.log(`📥 Photo ${photoId} not local, attempting download...`);
      const localPath = await ensurePhotoDownloaded(photoId);
      if (localPath) {
        return localPath;
      }
      // If download failed (file missing), don't try signed URL - it will also fail
      console.log(`ℹ️ Photo ${photoId} file missing - cannot display`);
      return null;
    }

    // Fallback: Return Supabase signed URL (for viewing without downloading)
    // Only try this if we haven't already failed to download (which means file doesn't exist)
    if (photo.file_path) {
      try {
        const { data, error } = await supabase.storage
          .from('photos')
          .createSignedUrl(photo.file_path, 3600); // 1 hour expiration

        if (error) {
          // File doesn't exist in storage - this is an orphaned DB entry
          console.log(`ℹ️ Photo ${photoId} file not found in storage (orphaned entry)`);
          return null;
        }

        return data.signedUrl;
      } catch (signedUrlError) {
        console.log(`ℹ️ Could not create signed URL for ${photoId} (file may not exist)`);
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error getting photo URI for ${photoId}:`, error);
    return null;
  }
}

/**
 * Upload photo to Supabase Storage
 */
export async function uploadPhotoToSupabase(
  localPath: string,
  remotePath: string
): Promise<{ url: string; size: number }> {
  // Check if file exists
  const fileInfo = await FileSystem.getInfoAsync(localPath);
  if (!fileInfo.exists) {
    throw new Error('Local file does not exist');
  }

  // Read file as base64
  const base64 = await FileSystem.readAsStringAsync(localPath, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Convert base64 to binary
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Upload to Supabase
  const { data, error } = await supabase.storage
    .from('photos')
    .upload(remotePath, bytes, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('photos')
    .getPublicUrl(remotePath);

  return {
    url: urlData.publicUrl,
    size: bytes.length,
  };
}

/**
 * Download photo from Supabase to local storage
 * Throws error if file doesn't exist in storage
 */
export async function downloadPhotoToLocal(
  remotePath: string,
  localPath: string
): Promise<void> {
  const { data, error } = await supabase.storage
    .from('photos')
    .download(remotePath);

  if (error) {
    // If file not found (400/404), throw specific error
    if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
      throw new Error(`Photo file not found in storage: ${remotePath}`);
    }
    throw error;
  }

  // Convert blob to base64
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve, reject) => {
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data URL prefix
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
  });

  reader.readAsDataURL(data);
  const base64Data = await base64Promise;

  // Write to local file system
  await FileSystem.writeAsStringAsync(localPath, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });

  console.log(`📥 Downloaded photo to: ${localPath}`);
}

/**
 * Ensure photo is downloaded locally (on-demand download)
 * Returns local URI if available, downloads from cloud if needed
 * Returns null if file is missing from storage (orphaned DB entry)
 */
export async function ensurePhotoDownloaded(photoId: string): Promise<string | null> {
  try {
    const photo = await localDB.getPhoto(photoId);
    if (!photo) {
      console.log(`ℹ️ Photo ${photoId} not found in local DB`);
      return null;
    }

    // Check if already downloaded and file exists
    if (photo.local_path) {
      const fileInfo = await FileSystem.getInfoAsync(photo.local_path);
      if (fileInfo.exists) {
        return photo.local_path;
      }
    }

    // Need to download from cloud
    console.log(`📥 Downloading photo ${photoId} from cloud...`);

    // Create directory path
    const dirPath = `${FileSystem.documentDirectory}photos/${photo.user_id}/${photo.entry_id}/`;
    await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });

    // Local path
    const localPath = `${dirPath}${photoId}.jpg`;

    // Download from Supabase Storage
    await downloadPhotoToLocal(photo.file_path, localPath);

    // Update local DB with local_path
    await localDB.updatePhoto(photoId, { local_path: localPath });

    console.log(`✅ Photo ${photoId} downloaded successfully`);
    return localPath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorString = typeof error === 'object' ? JSON.stringify(error) : String(error);

    // Check if this is a 400/404 error (file not found)
    const isNotFound = errorString.includes('"status":400') ||
                       errorString.includes('"status":404') ||
                       errorMessage.includes('not found') ||
                       errorMessage.includes('does not exist');

    if (isNotFound) {
      // File missing from storage - this is expected for orphaned entries
      console.log(`ℹ️ Photo ${photoId} file missing from storage (orphaned DB entry)`);
      return null;
    }

    // Other errors (network, permissions, etc.)
    console.error(`❌ Error downloading photo ${photoId}:`, errorMessage);
    return null;
  }
}

/**
 * Download photos in background (for photos pulled from cloud during sync)
 * Downloads photos that don't have local files yet
 */
export async function downloadPhotosInBackground(limit: number = 10): Promise<void> {
  try {
    // Get photos that need downloading (have file_path but no local_path or file doesn't exist)
    const allPhotos = await localDB.getAllPhotos();
    const photosToDownload: any[] = [];

    for (const photo of allPhotos) {
      if (photosToDownload.length >= limit) break;

      // Skip if already has local_path and file exists
      if (photo.local_path) {
        const fileInfo = await FileSystem.getInfoAsync(photo.local_path);
        if (fileInfo.exists) {
          continue; // Already downloaded
        }
      }

      // Needs download
      if (photo.file_path && photo.uploaded) {
        photosToDownload.push(photo);
      }
    }

    if (photosToDownload.length === 0) {
      console.log('📸 No photos to download in background');
      return;
    }

    console.log(`📸 Downloading ${photosToDownload.length} photos in background...`);

    let successCount = 0;
    let errorCount = 0;

    for (const photo of photosToDownload) {
      try {
        await ensurePhotoDownloaded(photo.photo_id);
        successCount++;
      } catch (error) {
        console.error(`Failed to download photo ${photo.photo_id}:`, error);
        errorCount++;
      }
    }

    console.log(`✅ Background photo download complete: ${successCount} success, ${errorCount} errors`);
  } catch (error) {
    console.error('Background photo download failed:', error);
  }
}
