/**
 * Photo Viewer Component
 *
 * Fullscreen photo viewer with pinch-to-zoom support using react-native-image-viewing
 */

import React from 'react';
import { Alert, View, StyleSheet, TouchableOpacity } from 'react-native';
import ImageViewing from 'react-native-image-viewing';
import { ImageSource } from 'react-native-image-viewing/dist/@types';
import Svg, { Circle, Path } from 'react-native-svg';

interface PhotoItem {
  photoId: string;
  uri: string | null;
}

interface PhotoViewerProps {
  visible: boolean;
  photos: PhotoItem[];
  initialIndex?: number;
  onClose: () => void;
  onDelete?: (photoId: string) => void;
}

export function PhotoViewer({ visible, photos, initialIndex = 0, onClose, onDelete }: PhotoViewerProps) {
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

  // Don't render if no valid photos
  if (images.length === 0) return null;

  // Header with close and delete buttons
  const HeaderComponent = ({ imageIndex }: { imageIndex: number }) => {
    return (
      <View style={styles.headerContainer}>
        {/* Close button on left */}
        <TouchableOpacity
          style={styles.headerButton}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M18 6L6 18M6 6l12 12"
              stroke="#ffffff"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>

        {/* Delete button on right */}
        {onDelete && (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => handleDelete(imageIndex)}
            activeOpacity={0.7}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                stroke="#ffffff"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
        )}
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
      onLongPress={onDelete ? (_, index) => handleDelete(index) : undefined}
      HeaderComponent={HeaderComponent}
      FooterComponent={PaginationFooter}
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
