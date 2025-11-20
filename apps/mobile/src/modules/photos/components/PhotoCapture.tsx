/**
 * Photo Capture Component
 *
 * Allows users to capture photos from camera or pick from gallery
 */

import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import {  capturePhoto, pickPhotoFromGallery } from '../mobilePhotoApi';

interface PhotoCaptureProps {
  onPhotoSelected: (uri: string, width: number, height: number) => void;
  disabled?: boolean;
  showButton?: boolean; // Whether to show the camera button (default true)
}

export interface PhotoCaptureRef {
  openMenu: () => void;
}

export const PhotoCapture = forwardRef<PhotoCaptureRef, PhotoCaptureProps>(function PhotoCapture({ onPhotoSelected, disabled = false, showButton = true }, ref) {
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
      }
    } catch (error: any) {
      Alert.alert('Camera Error', error.message || 'Failed to capture photo');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleGalleryPress = async () => {
    setShowMenu(false);
    setIsCapturing(true);

    try {
      const result = await pickPhotoFromGallery();
      if (result) {
        onPhotoSelected(result.uri, result.width, result.height);
      }
    } catch (error: any) {
      Alert.alert('Gallery Error', error.message || 'Failed to pick photo');
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

      {/* Photo Source Selection Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleCameraPress}
              activeOpacity={0.7}
            >
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth={2}>
                <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={12} cy={13} r={3} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.menuItemText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleGalleryPress}
              activeOpacity={0.7}
            >
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth={2}>
                <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.menuItemText}>Choose from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemCancel]}
              onPress={() => setShowMenu(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuItemCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  buttonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    marginBottom: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  menuItemCancel: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  menuItemCancelText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
    flex: 1,
  },
});
