/**
 * Avatar Picker Component
 *
 * Allows users to capture or select a profile avatar
 * Uses PickerBottomSheet for consistent bottom sheet presentation
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { PickerBottomSheet } from '../../../components/sheets';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { themeBase } from '../../../shared/theme/themeBase';
import { getDefaultAvatarUrl } from '@trace/core';
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
  const dynamicTheme = useTheme();
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
        <View style={[styles.avatarContainer, { width: size, height: size, borderRadius: size / 2, backgroundColor: dynamicTheme.colors.background.tertiary }]}>
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
          <View style={[styles.editBadge, { bottom: 0, right: 0, backgroundColor: dynamicTheme.colors.functional.accent }]}>
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
        <Text style={[styles.changePhotoText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.functional.accent }]}>
          {isUploading ? 'Uploading...' : isProcessing ? 'Processing...' : 'Change Photo'}
        </Text>
      </TouchableOpacity>

      {/* Photo Source Selection Bottom Sheet */}
      <PickerBottomSheet
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        title="Profile Photo"
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

          {/* Remove Photo (only if custom avatar exists) */}
          {hasCustomAvatar && onAvatarRemoved && (
            <TouchableOpacity
              style={[styles.optionButton, styles.removeOption, { backgroundColor: dynamicTheme.colors.background.secondary }]}
              onPress={handleRemovePress}
              activeOpacity={0.7}
            >
              <View style={styles.optionIcon}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.functional.overdue} strokeWidth={2}>
                  <Path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={[styles.optionText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.functional.overdue }]}>Remove Photo</Text>
            </TouchableOpacity>
          )}
        </View>
      </PickerBottomSheet>
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
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  changePhotoText: {
    marginTop: themeBase.spacing.sm,
    fontSize: 14,
  },
  optionsContainer: {
    gap: themeBase.spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
    gap: themeBase.spacing.md,
  },
  optionIcon: {
    width: 24,
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
  },
  removeOption: {
    marginTop: themeBase.spacing.sm,
  },
});
