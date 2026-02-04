/**
 * PhotoGallery Component
 *
 * Displays photos for an entry in a horizontal scrollable grid
 * Shows thumbnails with tap-to-view full size functionality
 */

import { useState, useEffect, useRef } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import { getAttachmentUri, ensureAttachmentDownloaded, getAttachmentsForEntry } from '../../attachments/mobileAttachmentApi';
import { PhotoViewer } from './PhotoViewer';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { themeBase } from '../../../shared/theme/themeBase';
import type { Attachment } from '@trace/core';
import { createScopedLogger, LogScopes } from '../../../shared/utils/logger';

const log = createScopedLogger(LogScopes.PhotoGallery);

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
  collapsible?: boolean; // Enable collapse/expand functionality
  isCollapsed?: boolean; // Controlled collapsed state
  onCollapsedChange?: (collapsed: boolean) => void; // Callback when collapsed state changes
  onTakePhoto?: () => void; // Callback to open camera
  onGallery?: () => void; // Callback to open gallery
}

export function PhotoGallery({ entryId, refreshKey, onPhotoCountChange, onPhotoDelete, pendingPhotos, collapsible, isCollapsed, onCollapsedChange, onTakePhoto, onGallery }: PhotoGalleryProps) {
  const dynamicTheme = useTheme();
  const [photos, setPhotos] = useState<Attachment[]>([]);
  const [photoUris, setPhotoUris] = useState<Record<string, string>>({});
  const [photoDownloadStatus, setPhotoDownloadStatus] = useState<Record<string, boolean>>({}); // true = downloaded locally
  const [loading, setLoading] = useState(true);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [downloadingPhotos, setDownloadingPhotos] = useState<Set<string>>(new Set());

  // Track which entryId+refreshKey we're currently loading to prevent duplicate loads
  const loadingKeyRef = useRef<string | null>(null);
  // Track if we've ever loaded photos - used to avoid showing loading spinner on refresh
  const hasInitializedRef = useRef(false);

  // Load photos for this entry (reload when entryId or refreshKey changes)
  // OR use pending photos if provided (for new entries)
  useEffect(() => {
    if (pendingPhotos !== undefined) {
      // Use pending photos (new entry, not saved to DB yet)
      // Note: No logging here to avoid noise on every render
      setLoading(false);
      hasInitializedRef.current = true;

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
    const loadKey = `${entryId}-${refreshKey ?? 0}`;

    // Skip if we're already loading this exact key (prevents duplicate loads)
    if (loadingKeyRef.current === loadKey) {
      return;
    }

    const loadData = async () => {
      if (!mounted) return;
      loadingKeyRef.current = loadKey;
      // Pass isRefresh flag - don't show loading spinner on refresh (prevents flash)
      await loadPhotos(mounted, 0, hasInitializedRef.current);
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [entryId, refreshKey, pendingPhotos]);

  const loadPhotos = async (mounted: boolean = true, retryCount: number = 0, isRefresh: boolean = false) => {
    try {
      // Only show loading spinner on initial load, not on refresh (prevents flash)
      if (!isRefresh) {
        setLoading(true);
      }
      const entryPhotos = await getAttachmentsForEntry(entryId);

      if (!mounted) return; // Prevent setState on unmounted component

      // Sort by position
      entryPhotos.sort((a, b) => (a.position || 0) - (b.position || 0));

      setPhotos(entryPhotos);
      onPhotoCountChange?.(entryPhotos.length);

      // Load URIs and check download status for each photo
      const uris: Record<string, string> = {};
      const downloadStatus: Record<string, boolean> = {};

      for (const photo of entryPhotos) {
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
        downloadStatus[photo.attachment_id] = isDownloaded;

        // Get URI (local or cloud)
        const uri = await getAttachmentUri(photo.attachment_id);
        if (uri) {
          uris[photo.attachment_id] = uri;
        }
        // Note: Removed per-photo logging to reduce noise
      }

      if (!mounted) return; // Final check before setState

      setPhotoUris(uris);
      setPhotoDownloadStatus(downloadStatus);
      // Mark as initialized after first successful load
      hasInitializedRef.current = true;
    } catch (error) {
      // Handle SQLite concurrent access errors with retry
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('shared object that was already released') && retryCount < 2) {
        // Wait a bit and retry (stagger concurrent DB access)
        await new Promise(resolve => setTimeout(resolve, 100 * (retryCount + 1)));
        return loadPhotos(mounted, retryCount + 1, isRefresh);
      }
      log.error('Error loading photos', error);
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
      if (!photoDownloadStatus[photo.attachment_id] && !downloadingPhotos.has(photo.attachment_id)) {
        log.debug('Triggering background download', { attachmentId: photo.attachment_id });
        setDownloadingPhotos(prev => new Set(prev).add(photo.attachment_id));

        try {
          await ensureAttachmentDownloaded(photo.attachment_id);

          // Update download status
          setPhotoDownloadStatus(prev => ({ ...prev, [photo.attachment_id]: true }));
          log.info('Photo downloaded for offline use', { attachmentId: photo.attachment_id });
        } catch (error) {
          log.error('Failed to download photo', error, { attachmentId: photo.attachment_id });
        } finally {
          setDownloadingPhotos(prev => {
            const newSet = new Set(prev);
            newSet.delete(photo.attachment_id);
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

      // Reload photos (isRefresh=true to avoid flash)
      await loadPhotos(true, 0, true);
    } catch (error) {
      log.error('Error deleting photo', error);
    }
  };

  // Determine which photos to display (pending or from DB)
  const displayPhotos = pendingPhotos || photos.map(p => ({ photoId: p.attachment_id }));

  // Show nothing if no photos
  if (!loading && displayPhotos.length === 0) {
    return null;
  }

  // Show loading spinner
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={dynamicTheme.colors.text.tertiary} />
      </View>
    );
  }

  // If collapsed, don't render anything (the parent will show the photo count in metadata)
  if (collapsible && isCollapsed) {
    return null;
  }

  return (
    <>
      <View style={styles.galleryWrapper}>
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
                style={[styles.photoContainer, { backgroundColor: dynamicTheme.colors.background.tertiary }]}
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
                    <ActivityIndicator size="small" color={dynamicTheme.colors.text.tertiary} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Add Photo buttons - stacked camera + gallery */}
          {(onTakePhoto || onGallery) && (
            <View style={styles.addPhotoButtonsContainer}>
              {/* Camera button */}
              {onTakePhoto && (
                <TouchableOpacity
                  style={[styles.addPhotoButton, { borderColor: dynamicTheme.colors.border.medium, backgroundColor: dynamicTheme.colors.background.secondary }]}
                  onPress={onTakePhoto}
                  activeOpacity={0.7}
                >
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
                      stroke={dynamicTheme.colors.text.tertiary}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path
                      d="M12 17a4 4 0 100-8 4 4 0 000 8z"
                      stroke={dynamicTheme.colors.text.tertiary}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </TouchableOpacity>
              )}

              {/* Gallery button */}
              {onGallery && (
                <TouchableOpacity
                  style={[styles.addPhotoButton, { borderColor: dynamicTheme.colors.border.medium, backgroundColor: dynamicTheme.colors.background.secondary }]}
                  onPress={onGallery}
                  activeOpacity={0.7}
                >
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14.5"
                      stroke={dynamicTheme.colors.text.tertiary}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path
                      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6z"
                      stroke={dynamicTheme.colors.text.tertiary}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path
                      d="M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"
                      fill={dynamicTheme.colors.text.tertiary}
                    />
                  </Svg>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>

        {/* Minimal collapse chevron */}
        {collapsible && onCollapsedChange && (
          <TouchableOpacity
            style={styles.collapseButton}
            onPress={() => onCollapsedChange(true)}
            activeOpacity={0.7}
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M18 15l-6-6-6 6"
                stroke={dynamicTheme.colors.text.tertiary}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
        )}
      </View>

      <PhotoViewer
        visible={viewerVisible}
        photos={displayPhotos.map(photo => {
          // For pending photos, get from photo object
          // For DB photos, get from photos array
          const dbPhoto = pendingPhotos === undefined
            ? photos.find(p => p.attachment_id === photo.photoId)
            : null;
          const pendingPhoto = pendingPhotos
            ? pendingPhotos.find(p => p.photoId === photo.photoId)
            : null;

          return {
            photoId: photo.photoId,
            uri: photoUris[photo.photoId] || null,
            width: pendingPhoto?.width ?? dbPhoto?.width,
            height: pendingPhoto?.height ?? dbPhoto?.height,
            fileSize: pendingPhoto?.fileSize ?? dbPhoto?.file_size,
          };
        })}
        initialIndex={selectedPhotoIndex}
        onClose={() => {
          setViewerVisible(false);
          setSelectedPhotoIndex(0);
        }}
        onDelete={onPhotoDelete ? (photoId) => {
          log.debug('Delete callback called', { photoId });
          handlePhotoDelete(photoId);
        } : undefined}
      />
    </>
  );
}

const styles = StyleSheet.create({
  galleryWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: themeBase.spacing.sm,
  },
  container: {
    marginBottom: themeBase.spacing.sm,
    maxHeight: 108,
    flex: 1,
  },
  contentContainer: {
    paddingLeft: themeBase.spacing.lg,
    paddingRight: themeBase.spacing.sm,
    gap: themeBase.spacing.sm,
    alignItems: 'center',
  },
  loadingContainer: {
    padding: themeBase.spacing.sm,
    alignItems: 'center',
  },
  photoContainer: {
    width: 100,
    height: 100,
    borderRadius: themeBase.borderRadius.md,
    overflow: 'hidden',
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
  addPhotoButtonsContainer: {
    gap: 4,
  },
  addPhotoButton: {
    width: 100,
    height: 48,
    borderRadius: themeBase.borderRadius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  collapseButton: {
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: 4,
    marginRight: themeBase.spacing.sm,
  },
});
