/**
 * useEntryPhotos - Photo handling for entry editing
 *
 * Handles:
 * - Photo selection (single and multiple)
 * - Photo compression and storage
 * - Photo deletion
 *
 * Uses EntryFormContext for all state access - no parameters needed.
 */

import { useCallback } from "react";
import { Alert } from "react-native";
import { generateAttachmentPath, type ImageQuality } from "@trace/core";
import * as Crypto from "expo-crypto";
import {
  compressAttachment,
  saveAttachmentToLocalStorage,
  deleteAttachment,
  createAttachment,
} from "../../../attachments/mobileAttachmentApi";
import { useEntryForm } from "../context/EntryFormContext";
import { createScopedLogger } from "../../../../shared/utils/logger";

const log = createScopedLogger('EntryPhotos', '📷');

interface PhotoInfo {
  uri: string;
  width: number;
  height: number;
  fileSize?: number;
  mimeType?: string;
}

/**
 * Provides photo handling functions for the entry screen.
 * All state access is through useEntryForm() context.
 */
export function useEntryPhotos() {
  const {
    userId,
    settings,
    isEditing,
    effectiveEntryId,
    tempEntryId,
    isEditMode,
    enterEditMode,
    photoCount,
    setPhotoCount,
    addPendingPhoto,
    removePendingPhoto,
  } = useEntryForm();

  const imageQuality = settings.imageQuality;

  /**
   * Process a single photo - compress, save to storage, and track
   */
  const processPhoto = useCallback(
    async (
      photo: PhotoInfo,
      position: number
    ): Promise<void> => {
      if (!userId) {
        Alert.alert("Error", "User not authenticated");
        return;
      }

      // Enter edit mode if not already
      if (!isEditMode) {
        enterEditMode();
      }

      try {
        const photoId = Crypto.randomUUID();

        // Compress based on quality setting - returns CompressedAttachment object
        const compressed = await compressAttachment(photo.uri, imageQuality as ImageQuality);

        // Use effective entry ID for existing entries, temp ID for new
        const entryIdForPath = isEditing
          ? effectiveEntryId!
          : tempEntryId;

        const filePath = generateAttachmentPath(
          userId,
          entryIdForPath,
          photoId,
          compressed.mime_type
        );

        // Save to local storage (uri, attachmentId, userId, entryId)
        const localPath = await saveAttachmentToLocalStorage(
          compressed.uri,
          photoId,
          userId,
          entryIdForPath
        );

        if (isEditing && effectiveEntryId) {
          // For existing entries, save directly to DB
          await createAttachment({
            attachment_id: photoId,
            entry_id: effectiveEntryId,
            user_id: userId,
            file_path: filePath,
            local_path: localPath,
            mime_type: compressed.mime_type,
            file_size: compressed.file_size,
            width: compressed.width,
            height: compressed.height,
            position,
            uploaded: false,
          });
          setPhotoCount((prev: number) => prev + 1);
        } else {
          // For new entries, add to pending photos (saved on first save)
          addPendingPhoto({
            photoId,
            localPath,
            filePath,
            mimeType: compressed.mime_type,
            fileSize: compressed.file_size,
            width: compressed.width,
            height: compressed.height,
            position,
          });
          setPhotoCount((prev: number) => prev + 1);
        }
      } catch (error) {
        log.error("Failed to process photo", error);
        Alert.alert(
          "Error",
          `Failed to add photo: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    },
    [
      userId,
      imageQuality,
      isEditing,
      effectiveEntryId,
      tempEntryId,
      isEditMode,
      enterEditMode,
      setPhotoCount,
      addPendingPhoto,
    ]
  );

  /**
   * Handle single photo selection
   */
  const handlePhotoSelected = useCallback(
    async (photo: PhotoInfo): Promise<void> => {
      await processPhoto(photo, photoCount);
    },
    [processPhoto, photoCount]
  );

  /**
   * Handle multiple photo selection (from library picker)
   */
  const handleMultiplePhotosSelected = useCallback(
    async (photos: PhotoInfo[]): Promise<void> => {
      let currentPosition = photoCount;

      for (const photo of photos) {
        await processPhoto(photo, currentPosition);
        currentPosition++;
      }
    },
    [processPhoto, photoCount]
  );

  /**
   * Handle photo deletion
   */
  const handlePhotoDelete = useCallback(
    async (attachmentId: string): Promise<void> => {
      try {
        if (isEditing) {
          // For existing entries, delete from DB and storage
          await deleteAttachment(attachmentId);
          setPhotoCount((prev: number) => Math.max(0, prev - 1));
        } else {
          // For new entries, just remove from pending
          if (!isEditMode) {
            enterEditMode();
          }
          removePendingPhoto(attachmentId);
          setPhotoCount((prev: number) => Math.max(0, prev - 1));
        }
      } catch (error) {
        log.error("Failed to delete photo", error);
        Alert.alert(
          "Error",
          `Failed to delete photo: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    },
    [isEditing, isEditMode, enterEditMode, removePendingPhoto, setPhotoCount]
  );

  return {
    handlePhotoSelected,
    handleMultiplePhotosSelected,
    handlePhotoDelete,
  };
}
