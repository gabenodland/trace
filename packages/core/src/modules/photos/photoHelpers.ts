/**
 * Photo Helpers
 *
 * Pure utility functions for photo operations
 * All functions are side-effect free and can be used anywhere
 */

import type { Photo } from './PhotoTypes';

/**
 * Parse HTML content to extract photo IDs
 * Finds all <img data-photo-id="uuid" /> tags
 */
export function extractPhotoIds(htmlContent: string): string[] {
  if (!htmlContent) return [];

  const photoIdRegex = /<img[^>]+data-photo-id="([^"]+)"[^>]*>/g;
  const photoIds: string[] = [];
  let match;

  while ((match = photoIdRegex.exec(htmlContent)) !== null) {
    photoIds.push(match[1]);
  }

  return photoIds;
}

/**
 * Insert photo reference into HTML content at the end
 */
export function insertPhotoIntoContent(content: string, photoId: string): string {
  // If content is empty, just add the photo
  if (!content || content.trim() === '') {
    return `<img data-photo-id="${photoId}" />`;
  }

  // Add photo at the end with a paragraph break
  return `${content}<p></p><img data-photo-id="${photoId}" />`;
}

/**
 * Remove photo reference from HTML content
 */
export function removePhotoFromContent(content: string, photoId: string): string {
  if (!content) return '';

  // Remove the img tag with this photo ID
  const regex = new RegExp(`<img[^>]+data-photo-id="${photoId}"[^>]*>`, 'g');
  let newContent = content.replace(regex, '');

  // Clean up empty paragraphs
  newContent = newContent.replace(/<p>\s*<\/p>/g, '');
  newContent = newContent.replace(/<p><\/p>/g, '');

  return newContent.trim();
}

/**
 * Replace photo ID placeholder with actual image source
 * Used for rendering photos from references
 */
export function replacePhotoReferences(
  htmlContent: string,
  photos: Photo[],
  getPhotoUrl: (photo: Photo) => string
): string {
  if (!htmlContent || !photos || photos.length === 0) return htmlContent;

  let processedContent = htmlContent;

  photos.forEach((photo) => {
    const photoUrl = getPhotoUrl(photo);
    const regex = new RegExp(`<img([^>]*)data-photo-id="${photo.photo_id}"([^>]*)>`, 'g');

    // Replace with actual src attribute
    processedContent = processedContent.replace(
      regex,
      `<img$1src="${photoUrl}"$2 alt="Photo" />`
    );
  });

  return processedContent;
}

/**
 * Generate Supabase Storage path for photo
 * Format: {user_id}/{entry_id}/{photo_id}.jpg
 */
export function generatePhotoPath(userId: string, entryId: string, photoId: string, extension: string = 'jpg'): string {
  return `${userId}/${entryId}/${photoId}.${extension}`;
}

/**
 * Generate Supabase Storage path for thumbnail
 * Format: {user_id}/{entry_id}/{photo_id}_thumb.jpg
 */
export function generateThumbnailPath(userId: string, entryId: string, photoId: string, extension: string = 'jpg'): string {
  return `${userId}/${entryId}/${photoId}_thumb.${extension}`;
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
  };

  return mimeToExt[mimeType] || 'jpg';
}

/**
 * Format photo file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
}

/**
 * Check if file size is within limit (default 5MB)
 */
export function isFileSizeValid(bytes: number, maxBytes: number = 5242880): boolean {
  return bytes <= maxBytes;
}

/**
 * Sort photos by position
 */
export function sortPhotosByPosition(photos: Photo[]): Photo[] {
  return [...photos].sort((a, b) => a.position - b.position);
}

/**
 * Get photos for a specific entry, sorted by position
 */
export function getPhotosForEntry(photos: Photo[], entryId: string): Photo[] {
  const entryPhotos = photos.filter(photo => photo.entry_id === entryId);
  return sortPhotosByPosition(entryPhotos);
}

/**
 * Calculate next position for a new photo in an entry
 */
export function getNextPhotoPosition(existingPhotos: Photo[]): number {
  if (existingPhotos.length === 0) return 0;

  const maxPosition = Math.max(...existingPhotos.map(p => p.position));
  return maxPosition + 1;
}

/**
 * Check if photo has been uploaded to Supabase Storage
 */
export function isPhotoUploaded(photo: Photo): boolean {
  return photo.uploaded === true;
}

/**
 * Check if photo needs to be synced
 */
export function needsSync(photo: Photo): boolean {
  return photo.synced === 0 || photo.sync_action !== null;
}

/**
 * Get photos that need uploading
 */
export function getPhotosNeedingUpload(photos: Photo[]): Photo[] {
  return photos.filter(photo => !isPhotoUploaded(photo));
}

/**
 * Get photos that need syncing to database
 */
export function getPhotosNeedingSync(photos: Photo[]): Photo[] {
  return photos.filter(photo => needsSync(photo));
}

/**
 * Count photos in HTML content
 */
export function countPhotosInContent(htmlContent: string): number {
  return extractPhotoIds(htmlContent).length;
}

/**
 * Validate photo data before upload
 */
export function validatePhoto(photo: Partial<Photo>): { valid: boolean; error?: string } {
  if (!photo.entry_id) {
    return { valid: false, error: 'Entry ID is required' };
  }

  if (!photo.user_id) {
    return { valid: false, error: 'User ID is required' };
  }

  if (!photo.file_path && !photo.local_path) {
    return { valid: false, error: 'File path or local path is required' };
  }

  if (!photo.mime_type) {
    return { valid: false, error: 'MIME type is required' };
  }

  return { valid: true };
}
