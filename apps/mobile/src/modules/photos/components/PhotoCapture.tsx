/**
 * Photo Capture Component
 *
 * Allows users to capture photos from camera or pick from gallery
 * Styled to match other picker components (StatusPicker, RatingPicker, etc.)
 */

import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { TopBarDropdownContainer } from '../../../components/layout/TopBarDropdownContainer';
import { theme } from '../../../shared/theme/theme';
import { capturePhoto, pickMultiplePhotosFromGallery } from '../mobilePhotoApi';

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

export const PhotoCapture = forwardRef<PhotoCaptureRef, PhotoCaptureProps>(function PhotoCapture({ onPhotoSelected, onMultiplePhotosSelected, disabled = false, showButton = true, onSnackbar }, ref) {
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
      console.error('📸 [PhotoCapture] Camera error:', error);
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
      console.error('📸 [PhotoCapture] Gallery error:', error);
      Alert.alert('Gallery Error', error.message || 'Failed to pick photos');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <>
      {showButton && (
        <TouchableOpacity
          style={[styles.button, disabled && styles.buttonDisabled]}
          onPress={() => setShowMenu(true)}
          disabled={disabled || isCapturing}
          activeOpacity={0.7}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
            <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={12} cy={13} r={3} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      )}

      {/* Photo Source Selection Picker */}
      <TopBarDropdownContainer
        visible={showMenu}
        onClose={() => setShowMenu(false)}
      >
        <View style={styles.container}>
          {/* Header with title and close button */}
          <View style={styles.header}>
            <Text style={styles.title}>Select Image</Text>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowMenu(false)}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
                <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Options */}
          <View style={styles.optionsContainer}>
            {/* Take Photo */}
            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleCameraPress}
              activeOpacity={0.7}
            >
              <View style={styles.optionIcon}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                  <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={12} cy={13} r={3} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={styles.optionText}>Take Photo</Text>
            </TouchableOpacity>

            {/* Choose from Gallery */}
            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleGalleryPress}
              activeOpacity={0.7}
            >
              <View style={styles.optionIcon}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                  <Path d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6z" strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={8.5} cy={8.5} r={1.5} fill="#6b7280" stroke="none" />
                </Svg>
              </View>
              <Text style={styles.optionText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TopBarDropdownContainer>
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
    backgroundColor: '#f3f4f6',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  container: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  optionsContainer: {
    gap: theme.spacing.sm,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.secondary,
    gap: theme.spacing.md,
  },
  optionIcon: {
    width: 24,
    alignItems: "center",
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
  },
});
