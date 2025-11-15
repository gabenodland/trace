/**
 * PhotoGallery Component
 *
 * Displays photos for an entry in a horizontal scrollable grid
 * Shows thumbnails with tap-to-view full size functionality
 */

import { useState, useEffect } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Text } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { localDB } from '../../../shared/db/localDB';
import { getPhotoUri, ensurePhotoDownloaded } from '../mobilePhotoApi';
import { PhotoViewer } from './PhotoViewer';
import type { Photo } from '@trace/core';

interface PendingPhoto {
  photoId: string;
  localPath: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  position: number;
}

interface PhotoGalleryProps {
  entryId: string;
  refreshKey?: number; // Change this to trigger a reload
  onPhotoCountChange?: (count: number) => void;
  onPhotoDelete?: (photoId: string) => void;
  pendingPhotos?: PendingPhoto[]; // For new entries: photos stored in state (not DB yet)
}

export function PhotoGallery({ entryId, refreshKey, onPhotoCountChange, onPhotoDelete, pendingPhotos }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoUris, setPhotoUris] = useState<Record<string, string>>({});
  const [photoDownloadStatus, setPhotoDownloadStatus] = useState<Record<string, boolean>>({}); // true = downloaded locally
  const [loading, setLoading] = useState(true);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [downloadingPhotos, setDownloadingPhotos] = useState<Set<string>>(new Set());

  // Load photos for this entry (reload when entryId or refreshKey changes)
  // OR use pending photos if provided (for new entries)
  useEffect(() => {
    if (pendingPhotos !== undefined) {
      // Use pending photos (new entry, not saved to DB yet)
      console.log('📸 PhotoGallery using', pendingPhotos.length, 'pending photos from state');
      setLoading(false);

      // Build URIs map from pending photos
      const uris = pendingPhotos.reduce((acc, photo) => ({
        ...acc,
        [photo.photoId]: photo.localPath,
      }), {});

      setPhotoUris(uris);
      onPhotoCountChange?.(pendingPhotos.length);
      return;
    }

    // Load from DB (existing entry)
    let mounted = true;

    const loadData = async () => {
      if (!mounted) return;
      await loadPhotos(mounted);
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [entryId, refreshKey, pendingPhotos]);

  const loadPhotos = async (mounted: boolean = true) => {
    try {
      setLoading(true);
      const entryPhotos = await localDB.getPhotosForEntry(entryId);

      if (!mounted) return; // Prevent setState on unmounted component

      // Sort by position
      entryPhotos.sort((a, b) => (a.position || 0) - (b.position || 0));

      setPhotos(entryPhotos);
      onPhotoCountChange?.(entryPhotos.length);

      // Load URIs and check download status for each photo
      const uris: Record<string, string> = {};
      const downloadStatus: Record<string, boolean> = {};

      for (const photo of entryPhotos) {
        console.log(`🖼️ PhotoGallery loading photo ${photo.photo_id}...`);

        // Check if photo is downloaded locally
        let isDownloaded = false;
        if (photo.local_path) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(photo.local_path);
            isDownloaded = fileInfo.exists;
          } catch (error) {
            isDownloaded = false;
          }
        }
        downloadStatus[photo.photo_id] = isDownloaded;

        // Get URI (local or cloud)
        const uri = await getPhotoUri(photo.photo_id);
        if (uri) {
          uris[photo.photo_id] = uri;
          console.log(`✅ PhotoGallery got URI for ${photo.photo_id} (${isDownloaded ? 'local' : 'cloud'})`);
        } else {
          console.log(`ℹ️ PhotoGallery could not get URI for ${photo.photo_id} (file may be missing)`);
        }
      }

      console.log(`🖼️ PhotoGallery loaded ${Object.keys(uris).length} of ${entryPhotos.length} photos`);

      if (!mounted) return; // Final check before setState

      setPhotoUris(uris);
      setPhotoDownloadStatus(downloadStatus);
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      if (mounted) {
        setLoading(false);
      }
    }
  };

  // Download photo on demand when user taps it
  const handlePhotoPress = async (photoIndex: number) => {
    setSelectedPhotoIndex(photoIndex);
    setViewerVisible(true);

    // Only download for DB photos (not pending photos which are already local)
    if (pendingPhotos === undefined && photos.length > 0) {
      const photo = photos[photoIndex];

      // If photo is not downloaded yet, download it in background for offline use
      if (!photoDownloadStatus[photo.photo_id] && !downloadingPhotos.has(photo.photo_id)) {
        console.log(`📥 Triggering background download for photo ${photo.photo_id}`);
        setDownloadingPhotos(prev => new Set(prev).add(photo.photo_id));

        try {
          await ensurePhotoDownloaded(photo.photo_id);

          // Update download status
          setPhotoDownloadStatus(prev => ({ ...prev, [photo.photo_id]: true }));
          console.log(`✅ Photo ${photo.photo_id} downloaded for offline use`);
        } catch (error) {
          console.error(`Failed to download photo ${photo.photo_id}:`, error);
        } finally {
          setDownloadingPhotos(prev => {
            const newSet = new Set(prev);
            newSet.delete(photo.photo_id);
            return newSet;
          });
        }
      }
    }
  };

  const handlePhotoDelete = async (photoId: string) => {
    try {
      // Call parent callback
      if (onPhotoDelete) {
        await onPhotoDelete(photoId);
      }

      // Reload photos
      await loadPhotos();
    } catch (error) {
      console.error('Error deleting photo:', error);
    }
  };

  // Determine which photos to display (pending or from DB)
  const displayPhotos = pendingPhotos || photos.map(p => ({ photoId: p.photo_id }));

  // Show nothing if no photos
  if (!loading && displayPhotos.length === 0) {
    return null;
  }

  // Show loading spinner
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#6b7280" />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        {displayPhotos.map((photo, index) => {
          const uri = photoUris[photo.photoId];

          return (
            <TouchableOpacity
              key={photo.photoId}
              style={styles.photoContainer}
              onPress={() => handlePhotoPress(index)}
              activeOpacity={0.8}
            >
              {uri ? (
                <Image
                  source={{ uri }}
                  style={styles.photo}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <ActivityIndicator size="small" color="#6b7280" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <PhotoViewer
        visible={viewerVisible}
        photos={displayPhotos.map(photo => ({
          photoId: photo.photoId,
          uri: photoUris[photo.photoId] || null,
        }))}
        initialIndex={selectedPhotoIndex}
        onClose={() => {
          setViewerVisible(false);
          setSelectedPhotoIndex(0);
        }}
        onDelete={onPhotoDelete ? (photoId) => {
          console.log('📸 PhotoGallery delete callback called for:', photoId);
          handlePhotoDelete(photoId);
        } : undefined}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
    maxHeight: 88, // Fixed height to prevent layout issues
  },
  contentContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  loadingContainer: {
    padding: 8,
    alignItems: 'center',
  },
  photoContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
