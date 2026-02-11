/**
 * useEntryManagementPhotos - Photo handling for EntryManagementScreen
 *
 * Simplified photo hook that works with the new screen's state model.
 * Uses mobileAttachmentApi for camera/gallery access and file operations.
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import * as Crypto from 'expo-crypto';
import { generateAttachmentPath, type ImageQuality, type Attachment } from '@trace/core';
import {
  capturePhoto,
  pickPhotoFromGallery,
  pickMultiplePhotosFromGallery,
  compressAttachment,
  saveAttachmentToLocalStorage,
  createAttachment,
  deleteAttachment,
} from '../../../attachments/mobileAttachmentApi';
import { useAuth } from '../../../../shared/contexts/AuthContext';
import { useSettings } from '../../../../shared/contexts/SettingsContext';
import { createScopedLogger } from '../../../../shared/utils/logger';
import type { EntryWithRelations } from '../../EntryWithRelationsTypes';

const log = createScopedLogger('EntryPhotos', '📷');

interface UseEntryManagementPhotosProps {
  entry: EntryWithRelations | null;
  setEntry: React.Dispatch<React.SetStateAction<EntryWithRelations | null>>;
  isNewEntry: boolean;
}

/**
 * Photo handling hook for EntryManagementScreen
 */
export function useEntryManagementPhotos({
  entry,
  setEntry,
  isNewEntry,
}: UseEntryManagementPhotosProps) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const imageQuality = settings.imageQuality as ImageQuality;

  /**
   * Process and add a photo to the entry
   */
  const addPhoto = useCallback(
    async (photoUri: string, width: number, height: number) => {
      if (!user?.id || !entry) {
        Alert.alert('Error', 'Cannot add photo - entry not ready');
        return;
      }

      try {
        const photoId = Crypto.randomUUID();
        const entryId = entry.entry_id;
        const position = entry.attachments?.length || 0;

        log.debug('Processing photo', { photoId, entryId, position });

        // Compress the photo
        const compressed = await compressAttachment(photoUri, imageQuality);

        // Generate file path for storage
        const filePath = generateAttachmentPath(
          user.id,
          entryId,
          photoId,
          compressed.mime_type
        );

        // Save to local storage
        const localPath = await saveAttachmentToLocalStorage(
          compressed.uri,
          photoId,
          user.id,
          entryId
        );

        const now = new Date().toISOString();

        // Create attachment record
        const newAttachment: Attachment = {
          attachment_id: photoId,
          entry_id: entryId,
          user_id: user.id,
          file_path: filePath,
          local_path: localPath,
          mime_type: compressed.mime_type,
          file_size: compressed.file_size,
          width: compressed.width,
          height: compressed.height,
          position,
          created_at: now,
          updated_at: now,
          uploaded: false,
          synced: 0,
          sync_action: 'create',
        };

        // For existing entries, save to DB immediately
        if (!isNewEntry) {
          await createAttachment({
            attachment_id: photoId,
            entry_id: entryId,
            user_id: user.id,
            file_path: filePath,
            local_path: localPath,
            mime_type: compressed.mime_type,
            file_size: compressed.file_size,
            width: compressed.width,
            height: compressed.height,
            position,
            uploaded: false,
          });
        }

        // Update entry state with new attachment
        setEntry(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            attachments: [...(prev.attachments || []), newAttachment],
          };
        });

        log.info('Photo added successfully', { photoId });
      } catch (error) {
        log.error('Failed to add photo', error);
        Alert.alert(
          'Error',
          `Failed to add photo: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
    [user?.id, entry, imageQuality, isNewEntry, setEntry]
  );

  /**
   * Take a photo with the camera
   */
  const handleTakePhoto = useCallback(async () => {
    try {
      log.debug('Opening camera');
      const result = await capturePhoto();

      if (result) {
        await addPhoto(result.uri, result.width, result.height);
      }
    } catch (error) {
      log.error('Camera error', error);
      Alert.alert(
        'Camera Error',
        error instanceof Error ? error.message : 'Failed to open camera'
      );
    }
  }, [addPhoto]);

  /**
   * Pick photos from gallery
   */
  const handleGallery = useCallback(async () => {
    try {
      log.debug('Opening gallery');
      const results = await pickMultiplePhotosFromGallery();

      for (const photo of results) {
        await addPhoto(photo.uri, photo.width, photo.height);
      }
    } catch (error) {
      log.error('Gallery error', error);
      Alert.alert(
        'Gallery Error',
        error instanceof Error ? error.message : 'Failed to open gallery'
      );
    }
  }, [addPhoto]);

  /**
   * Delete a photo from the entry
   */
  const handleDeletePhoto = useCallback(
    async (attachmentId: string) => {
      try {
        log.info('Deleting photo', { attachmentId });

        // For existing entries, delete from DB
        if (!isNewEntry) {
          await deleteAttachment(attachmentId);
        }

        // Update entry state
        setEntry(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            attachments: (prev.attachments || []).filter(
              a => a.attachment_id !== attachmentId
            ),
          };
        });

        log.info('Photo deleted', { attachmentId });
      } catch (error) {
        log.error('Failed to delete photo', error);
        Alert.alert(
          'Error',
          `Failed to delete photo: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
    [isNewEntry, setEntry]
  );

  return {
    handleTakePhoto,
    handleGallery,
    handleDeletePhoto,
    photoCount: entry?.attachments?.length || 0,
  };
}
