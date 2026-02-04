/**
 * Photo Viewer Component
 *
 * Fullscreen photo viewer with pinch-to-zoom support using react-native-image-viewing
 */

import React, { useEffect } from 'react';
import { Alert, View, StyleSheet, TouchableOpacity, BackHandler } from 'react-native';
import ImageViewing from 'react-native-image-viewing';
import { ImageSource } from 'react-native-image-viewing/dist/@types';
import Svg, { Circle } from 'react-native-svg';
import * as Sharing from 'expo-sharing';
import { Icon } from '../../../shared/components';
import { createScopedLogger, LogScopes } from '../../../shared/utils/logger';

const log = createScopedLogger(LogScopes.Photos);

interface PhotoItem {
  photoId: string;
  uri: string | null;
  width?: number | null;
  height?: number | null;
  fileSize?: number | null;
}

interface PhotoViewerProps {
  visible: boolean;
  photos: PhotoItem[];
  initialIndex?: number;
  onClose: () => void;
  onDelete?: (photoId: string) => void;
}

export function PhotoViewer({ visible, photos, initialIndex = 0, onClose, onDelete }: PhotoViewerProps) {
  // Handle hardware back button when viewer is visible
  useEffect(() => {
    if (!visible) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true; // Prevent default behavior (don't let it bubble up)
    });

    return () => backHandler.remove();
  }, [visible, onClose]);

  // Convert photos to ImageViewing format
  const images: ImageSource[] = photos
    .filter(photo => photo.uri) // Only include photos with URIs
    .map(photo => ({ uri: photo.uri! }));

  const handleDelete = (index: number) => {
    if (!onDelete) return;

    const photo = photos.filter(p => p.uri)[index];
    if (!photo) return;

    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(photo.photoId);
            // If this was the last photo, close the viewer
            if (photos.length <= 1) {
              onClose();
            }
          },
        },
      ]
    );
  };

  // Format file size for display
  const formatFileSize = (bytes?: number | null): string => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleShowInfo = (index: number) => {
    const photo = photos.filter(p => p.uri)[index];
    if (!photo) return;

    const dimensions = photo.width && photo.height
      ? `${photo.width} × ${photo.height} px`
      : 'Unknown';
    const fileSize = formatFileSize(photo.fileSize);

    Alert.alert(
      'Photo Info',
      `Dimensions: ${dimensions}\nFile Size: ${fileSize}`,
      [{ text: 'OK' }]
    );
  };

  const handleShare = async (index: number) => {
    const photo = photos.filter(p => p.uri)[index];
    if (!photo || !photo.uri) return;

    try {
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device.');
        return;
      }

      // Share the photo - user can save to gallery from share sheet
      await Sharing.shareAsync(photo.uri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Save or share photo',
      });
    } catch (error) {
      log.error('Error sharing photo', error);
      Alert.alert('Error', 'Failed to share photo.');
    }
  };

  // Don't render if no valid photos
  if (images.length === 0) return null;

  // Header with close, info, and delete buttons
  const HeaderComponent = ({ imageIndex }: { imageIndex: number }) => {
    return (
      <View style={styles.headerContainer}>
        {/* Close button on left */}
        <TouchableOpacity
          style={styles.headerButton}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Icon name="X" size={24} color="#ffffff" />
        </TouchableOpacity>

        {/* Right side buttons */}
        <View style={styles.headerRightButtons}>
          {/* Info button */}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => handleShowInfo(imageIndex)}
            activeOpacity={0.7}
          >
            <Icon name="Info" size={24} color="#ffffff" />
          </TouchableOpacity>

          {/* Share button */}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => handleShare(imageIndex)}
            activeOpacity={0.7}
          >
            <Icon name="Share2" size={24} color="#ffffff" />
          </TouchableOpacity>

          {/* Delete button */}
          {onDelete && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => handleDelete(imageIndex)}
              activeOpacity={0.7}
            >
              <Icon name="Trash2" size={24} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Pagination dots footer (only show if multiple photos)
  const PaginationFooter = ({ imageIndex }: { imageIndex: number }) => {
    if (images.length <= 1) return null;

    return (
      <View style={styles.paginationContainer}>
        <Svg width={images.length * 16} height={16}>
          {images.map((_, index) => (
            <Circle
              key={index}
              cx={8 + index * 16}
              cy={8}
              r={4}
              fill={index === imageIndex ? '#ffffff' : 'rgba(255, 255, 255, 0.4)'}
            />
          ))}
        </Svg>
      </View>
    );
  };

  return (
    <ImageViewing
      images={images}
      imageIndex={initialIndex}
      visible={visible}
      onRequestClose={onClose}
      swipeToCloseEnabled={true}
      doubleTapToZoomEnabled={true}
      HeaderComponent={HeaderComponent}
      FooterComponent={PaginationFooter}
      presentationStyle="overFullScreen"
    />
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  headerRightButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
});
