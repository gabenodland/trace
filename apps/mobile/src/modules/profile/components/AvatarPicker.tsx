/**
 * Avatar Picker Component
 *
 * Allows users to capture or select a profile avatar
 * Similar UI to PhotoCapture but with 1:1 cropping for profile pictures
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { TopBarDropdownContainer } from '../../../components/layout/TopBarDropdownContainer';
import { theme } from '../../../shared/theme/theme';
import { getDefaultAvatarUrl, AVATAR_MAX_SIZE_BYTES } from '@trace/core';
import { createScopedLogger } from '../../../shared/utils/logger';

const log = createScopedLogger('AvatarPicker');

interface AvatarPickerProps {
  /** Current avatar URL (or null for default) */
  avatarUrl: string | null;
  /** User's name (for default avatar generation) */
  name: string;
  /** Called when user selects a new avatar */
  onAvatarSelected: (imageData: AvatarImageData) => void;
  /** Called when user removes their avatar */
  onAvatarRemoved?: () => void;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Whether an upload is in progress */
  isUploading?: boolean;
  /** Size of the avatar display */
  size?: number;
}

export interface AvatarImageData {
  uri: string;
  base64: string;
  width: number;
  height: number;
  type: string;
}

/**
 * Request camera permissions
 */
async function requestCameraPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * Request gallery permissions
 */
async function requestGalleryPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * Compress and resize avatar image
 * Avatars are resized to 512x512 max and compressed
 */
async function processAvatarImage(uri: string): Promise<AvatarImageData> {
  log.debug('Processing avatar image');

  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 512, height: 512 } }],
    {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  if (!manipResult.base64) {
    throw new Error('Failed to encode image as base64');
  }

  log.debug('Avatar processed', {
    width: manipResult.width,
    height: manipResult.height,
  });

  return {
    uri: manipResult.uri,
    base64: manipResult.base64,
    width: manipResult.width,
    height: manipResult.height,
    type: 'image/jpeg',
  };
}

export function AvatarPicker({
  avatarUrl,
  name,
  onAvatarSelected,
  onAvatarRemoved,
  disabled = false,
  isUploading = false,
  size = 100,
}: AvatarPickerProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const displayUrl = avatarUrl || getDefaultAvatarUrl(name);
  const hasCustomAvatar = !!avatarUrl;

  const handleCameraPress = async () => {
    setShowMenu(false);
    setIsProcessing(true);

    try {
      const hasPermission = await requestCameraPermissions();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Camera permission is needed to take a photo');
        return;
      }

      log.debug('Launching camera for avatar');

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1], // Square crop
        quality: 1,
      });

      if (result.canceled) {
        log.debug('Camera capture cancelled');
        return;
      }

      const asset = result.assets[0];
      log.info('Avatar photo captured', { width: asset.width, height: asset.height });

      const processed = await processAvatarImage(asset.uri);
      onAvatarSelected(processed);
    } catch (error: any) {
      log.error('Camera error', error);
      Alert.alert('Camera Error', error.message || 'Failed to capture photo');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGalleryPress = async () => {
    setShowMenu(false);
    setIsProcessing(true);

    try {
      const hasPermission = await requestGalleryPermissions();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Gallery permission is needed to select a photo');
        return;
      }

      log.debug('Opening gallery picker for avatar');

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1], // Square crop
        quality: 1,
      });

      if (result.canceled) {
        log.debug('Gallery picker cancelled');
        return;
      }

      const asset = result.assets[0];
      log.info('Avatar photo selected', { width: asset.width, height: asset.height });

      const processed = await processAvatarImage(asset.uri);
      onAvatarSelected(processed);
    } catch (error: any) {
      log.error('Gallery error', error);
      Alert.alert('Gallery Error', error.message || 'Failed to select photo');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePress = () => {
    setShowMenu(false);
    if (onAvatarRemoved) {
      Alert.alert(
        'Remove Avatar',
        'Are you sure you want to remove your profile photo?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              log.info('User removing avatar');
              onAvatarRemoved();
            },
          },
        ]
      );
    }
  };

  const isLoading = isProcessing || isUploading;

  return (
    <>
      {/* Avatar Display */}
      <TouchableOpacity
        style={[styles.avatarWrapper, { width: size + 8, height: size + 8 }]}
        onPress={() => setShowMenu(true)}
        disabled={disabled || isLoading}
        activeOpacity={0.7}
      >
        <View style={[styles.avatarContainer, { width: size, height: size, borderRadius: size / 2 }]}>
          <Image
            source={{ uri: displayUrl }}
            style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]}
          />

          {/* Loading overlay */}
          {isLoading && (
            <View style={[styles.loadingOverlay, { borderRadius: size / 2 }]}>
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          )}
        </View>

        {/* Edit badge - outside the clipped container */}
        {!isLoading && (
          <View style={[styles.editBadge, { bottom: 0, right: 0 }]}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
              <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        )}
      </TouchableOpacity>

      {/* Change Photo text */}
      <TouchableOpacity
        onPress={() => setShowMenu(true)}
        disabled={disabled || isLoading}
        activeOpacity={0.7}
      >
        <Text style={styles.changePhotoText}>
          {isUploading ? 'Uploading...' : isProcessing ? 'Processing...' : 'Change Photo'}
        </Text>
      </TouchableOpacity>

      {/* Photo Source Selection Menu */}
      <TopBarDropdownContainer
        visible={showMenu}
        onClose={() => setShowMenu(false)}
      >
        <View style={styles.menuContainer}>
          {/* Header with title and close button */}
          <View style={styles.header}>
            <Text style={styles.title}>Profile Photo</Text>
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

            {/* Remove Photo (only if custom avatar exists) */}
            {hasCustomAvatar && onAvatarRemoved && (
              <TouchableOpacity
                style={[styles.optionButton, styles.removeOption]}
                onPress={handleRemovePress}
                activeOpacity={0.7}
              >
                <View style={styles.optionIcon}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2}>
                    <Path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={[styles.optionText, styles.removeText]}>Remove Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TopBarDropdownContainer>
    </>
  );
}

const styles = StyleSheet.create({
  avatarWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  avatarImage: {
    resizeMode: 'cover',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  changePhotoText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#3b82f6',
  },
  menuContainer: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.secondary,
    gap: theme.spacing.md,
  },
  optionIcon: {
    width: 24,
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
  },
  removeOption: {
    marginTop: theme.spacing.sm,
  },
  removeText: {
    color: '#ef4444',
  },
});
