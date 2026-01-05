/**
 * Attachment Helpers
 *
 * Pure utility functions for attachment operations
 * All functions are side-effect free and can be used anywhere
 */

import type { Attachment } from './AttachmentTypes';

/**
 * Parse HTML content to extract attachment IDs
 * Finds all <img data-attachment-id="uuid" /> tags
 * Also supports legacy <img data-photo-id="uuid" /> for backwards compatibility
 */
export function extractAttachmentIds(htmlContent: string): string[] {
  if (!htmlContent) return [];

  // Match both new attachment-id and legacy photo-id attributes
  const attachmentIdRegex = /<img[^>]+data-(?:attachment|photo)-id="([^"]+)"[^>]*>/g;
  const attachmentIds: string[] = [];
  let match;

  while ((match = attachmentIdRegex.exec(htmlContent)) !== null) {
    attachmentIds.push(match[1]);
  }

  return attachmentIds;
}

/**
 * Insert attachment reference into HTML content at the end
 */
export function insertAttachmentIntoContent(content: string, attachmentId: string): string {
  // If content is empty, just add the attachment
  if (!content || content.trim() === '') {
    return `<img data-attachment-id="${attachmentId}" />`;
  }

  // Add attachment at the end with a paragraph break
  return `${content}<p></p><img data-attachment-id="${attachmentId}" />`;
}

/**
 * Remove attachment reference from HTML content
 */
export function removeAttachmentFromContent(content: string, attachmentId: string): string {
  if (!content) return '';

  // Remove the img tag with this attachment ID (support both new and legacy formats)
  const regex = new RegExp(`<img[^>]+data-(?:attachment|photo)-id="${attachmentId}"[^>]*>`, 'g');
  let newContent = content.replace(regex, '');

  // Clean up empty paragraphs
  newContent = newContent.replace(/<p>\s*<\/p>/g, '');
  newContent = newContent.replace(/<p><\/p>/g, '');

  return newContent.trim();
}

/**
 * Replace attachment ID placeholder with actual image source
 * Used for rendering attachments from references
 */
export function replaceAttachmentReferences(
  htmlContent: string,
  attachments: Attachment[],
  getAttachmentUrl: (attachment: Attachment) => string
): string {
  if (!htmlContent || !attachments || attachments.length === 0) return htmlContent;

  let processedContent = htmlContent;

  attachments.forEach((attachment) => {
    const attachmentUrl = getAttachmentUrl(attachment);
    // Support both new attachment-id and legacy photo-id
    const regex = new RegExp(`<img([^>]*)data-(?:attachment|photo)-id="${attachment.attachment_id}"([^>]*)>`, 'g');

    // Replace with actual src attribute
    processedContent = processedContent.replace(
      regex,
      `<img$1src="${attachmentUrl}"$2 alt="Attachment" />`
    );
  });

  return processedContent;
}

/**
 * Generate Supabase Storage path for attachment
 * Format: {user_id}/{entry_id}/{attachment_id}.{ext}
 */
export function generateAttachmentPath(userId: string, entryId: string, attachmentId: string, extension: string = 'jpg'): string {
  return `${userId}/${entryId}/${attachmentId}.${extension}`;
}

/**
 * Generate Supabase Storage path for thumbnail
 * Format: {user_id}/{entry_id}/{attachment_id}_thumb.{ext}
 */
export function generateThumbnailPath(userId: string, entryId: string, attachmentId: string, extension: string = 'jpg'): string {
  return `${userId}/${entryId}/${attachmentId}_thumb.${extension}`;
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
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  };

  return mimeToExt[mimeType] || 'bin';
}

/**
 * Check if MIME type is an image
 */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Format file size for display
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
 * Sort attachments by position
 */
export function sortAttachmentsByPosition(attachments: Attachment[]): Attachment[] {
  return [...attachments].sort((a, b) => a.position - b.position);
}

/**
 * Get attachments for a specific entry, sorted by position
 */
export function getAttachmentsForEntry(attachments: Attachment[], entryId: string): Attachment[] {
  const entryAttachments = attachments.filter(attachment => attachment.entry_id === entryId);
  return sortAttachmentsByPosition(entryAttachments);
}

/**
 * Calculate next position for a new attachment in an entry
 */
export function getNextAttachmentPosition(existingAttachments: Attachment[]): number {
  if (existingAttachments.length === 0) return 0;

  const maxPosition = Math.max(...existingAttachments.map(a => a.position));
  return maxPosition + 1;
}

/**
 * Check if attachment has been uploaded to Supabase Storage
 */
export function isAttachmentUploaded(attachment: Attachment): boolean {
  return attachment.uploaded === true;
}

/**
 * Check if attachment needs to be synced
 */
export function needsSync(attachment: Attachment): boolean {
  return attachment.synced === 0 || attachment.sync_action !== null;
}

/**
 * Get attachments that need uploading
 */
export function getAttachmentsNeedingUpload(attachments: Attachment[]): Attachment[] {
  return attachments.filter(attachment => !isAttachmentUploaded(attachment));
}

/**
 * Get attachments that need syncing to database
 */
export function getAttachmentsNeedingSync(attachments: Attachment[]): Attachment[] {
  return attachments.filter(attachment => needsSync(attachment));
}

/**
 * Count attachments in HTML content
 */
export function countAttachmentsInContent(htmlContent: string): number {
  return extractAttachmentIds(htmlContent).length;
}

/**
 * Validate attachment data before upload
 */
export function validateAttachment(attachment: Partial<Attachment>): { valid: boolean; error?: string } {
  if (!attachment.entry_id) {
    return { valid: false, error: 'Entry ID is required' };
  }

  if (!attachment.user_id) {
    return { valid: false, error: 'User ID is required' };
  }

  if (!attachment.file_path && !attachment.local_path) {
    return { valid: false, error: 'File path or local path is required' };
  }

  if (!attachment.mime_type) {
    return { valid: false, error: 'MIME type is required' };
  }

  return { valid: true };
}
