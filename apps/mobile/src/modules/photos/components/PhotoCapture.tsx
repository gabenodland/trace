/**
 * Photo Capture Component (Ref-based)
 *
 * Provides camera and gallery access via ref methods only (no UI).
 * Used by PhotoGallery and AttributesPicker to trigger photo capture.
 */

import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { Alert } from 'react-native';
import { capturePhoto, pickMultiplePhotosFromGallery } from '../../attachments/mobileAttachmentApi';
import { createScopedLogger, LogScopes } from '../../../shared/utils/logger';

const log = createScopedLogger(LogScopes.Photos);

interface PhotoCaptureProps {
  onPhotoSelected: (uri: string, width: number, height: number) => void;
  onMultiplePhotosSelected?: (photos: { uri: string; width: number; height: number }[]) => void;
  onSnackbar?: (message: string) => void;
}

export interface PhotoCaptureRef {
  openCamera: () => void;
  openGallery: () => void;
}

export const PhotoCapture = forwardRef<PhotoCaptureRef, PhotoCaptureProps>(function PhotoCapture({
  onPhotoSelected,
  onMultiplePhotosSelected,
  onSnackbar,
}, ref) {
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCameraPress = async () => {
    if (isCapturing) return; // Prevent double-calls
    setIsCapturing(true);

    try {
      const result = await capturePhoto();
      if (result) {
        onPhotoSelected(result.uri, result.width, result.height);
        onSnackbar?.("Photo captured");
      }
    } catch (error: any) {
      log.error('Camera error', error);
      Alert.alert('Camera Error', error.message || 'Failed to capture photo');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleGalleryPress = async () => {
    if (isCapturing) return; // Prevent double-calls
    setIsCapturing(true);

    try {
      const results = await pickMultiplePhotosFromGallery();
      if (results.length > 0) {
        // If multiple photos callback is provided, use it
        if (onMultiplePhotosSelected) {
          onMultiplePhotosSelected(results);
        } else {
          // Fallback: call single photo callback for each photo
          for (const result of results) {
            onPhotoSelected(result.uri, result.width, result.height);
          }
        }
        onSnackbar?.(results.length === 1 ? "Photo added" : `${results.length} photos added`);
      }
    } catch (error: any) {
      log.error('Gallery error', error);
      Alert.alert('Gallery Error', error.message || 'Failed to pick photos');
    } finally {
      setIsCapturing(false);
    }
  };

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    openCamera: handleCameraPress,
    openGallery: handleGalleryPress,
  }));

  // No UI - ref-based component only
  return null;
});
