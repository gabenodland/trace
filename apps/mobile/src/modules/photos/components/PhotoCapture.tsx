/**
 * Photo Capture Component
 * Uses PickerBottomSheet for consistent bottom sheet presentation
 *
 * Allows users to capture photos from camera or pick from gallery
 */

import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { PickerBottomSheet } from '../../../components/sheets';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { themeBase } from '../../../shared/theme/themeBase';
import { capturePhoto, pickMultiplePhotosFromGallery } from '../../attachments/mobileAttachmentApi';
import { createScopedLogger, LogScopes } from '../../../shared/utils/logger';

const log = createScopedLogger(LogScopes.Photos);

interface PhotoCaptureProps {
  onPhotoSelected: (uri: string, width: number, height: number) => void;
  onMultiplePhotosSelected?: (photos: { uri: string; width: number; height: number }[]) => void;
  disabled?: boolean;
  showButton?: boolean; // Whether to show the camera button (default true)
  onSnackbar?: (message: string) => void;
}

export interface PhotoCaptureRef {
  openMenu: () => void;
}

export const PhotoCapture = forwardRef<PhotoCaptureRef, PhotoCaptureProps>(function PhotoCapture({
  onPhotoSelected,
  onMultiplePhotosSelected,
  disabled = false,
  showButton = true,
  onSnackbar,
}, ref) {
  const dynamicTheme = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // Expose openMenu method to parent
  useImperativeHandle(ref, () => ({
    openMenu: () => setShowMenu(true),
  }));

  const handleCameraPress = async () => {
    setShowMenu(false);
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
    setShowMenu(false);
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

  return (
    <>
      {showButton && (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: dynamicTheme.colors.background.secondary }, disabled && styles.buttonDisabled]}
          onPress={() => setShowMenu(true)}
          disabled={disabled || isCapturing}
          activeOpacity={0.7}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.secondary} strokeWidth={2}>
            <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={12} cy={13} r={3} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      )}

      {/* Photo Source Selection Bottom Sheet */}
      <PickerBottomSheet
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        title="Add Photo"
      >
        <View style={styles.optionsContainer}>
          {/* Take Photo */}
          <TouchableOpacity
            style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
            onPress={handleCameraPress}
            activeOpacity={0.7}
          >
            <View style={styles.optionIcon}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.secondary} strokeWidth={2}>
                <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={12} cy={13} r={3} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={[styles.optionText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary }]}>Take Photo</Text>
          </TouchableOpacity>

          {/* Choose from Gallery */}
          <TouchableOpacity
            style={[styles.optionButton, { backgroundColor: dynamicTheme.colors.background.secondary }]}
            onPress={handleGalleryPress}
            activeOpacity={0.7}
          >
            <View style={styles.optionIcon}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.secondary} strokeWidth={2}>
                <Path d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6z" strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={8.5} cy={8.5} r={1.5} fill={dynamicTheme.colors.text.secondary} stroke="none" />
              </Svg>
            </View>
            <Text style={[styles.optionText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary }]}>Choose from Gallery</Text>
          </TouchableOpacity>
        </View>
      </PickerBottomSheet>
    </>
  );
});

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  optionsContainer: {
    gap: themeBase.spacing.sm,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
    gap: themeBase.spacing.md,
  },
  optionIcon: {
    width: 24,
    alignItems: "center",
  },
  optionText: {
    flex: 1,
    fontSize: 16,
  },
});
