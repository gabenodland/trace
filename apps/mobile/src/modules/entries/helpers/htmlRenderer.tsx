/**
 * HTML renderer for React Native using react-native-render-html
 * Handles formatting: bold, italic, bullets, nested lists, paragraphs, line breaks
 * Also renders inline photos with tap-to-view functionality
 */
import { useWindowDimensions, Image, TouchableOpacity, ActivityIndicator, View } from 'react-native';
import RenderHtml from 'react-native-render-html';
import React, { useState, useEffect, useMemo } from 'react';
import { extractPhotoIds } from '@trace/core';
import { getPhotoUri } from '../../photos/mobilePhotoApi';
import { PhotoViewer } from '../../photos/components/PhotoViewer';

interface HtmlRendererProps {
  html: string;
  style?: any;
  strikethrough?: boolean;
}

/**
 * Render HTML content using react-native-render-html
 */
export function HtmlRenderer({ html, style, strikethrough }: HtmlRendererProps) {
  const { width } = useWindowDimensions();
  const [photoUris, setPhotoUris] = useState<Record<string, string>>({});
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // Load photo URIs when HTML changes
  useEffect(() => {
    async function loadPhotos() {
      const extractedIds = extractPhotoIds(html);
      if (extractedIds.length === 0) return;

      setPhotoIds(extractedIds);
      setLoadingPhotos(true);
      const uris: Record<string, string> = {};

      for (const photoId of extractedIds) {
        const uri = await getPhotoUri(photoId);
        if (uri) {
          uris[photoId] = uri;
        }
      }

      setPhotoUris(uris);
      setLoadingPhotos(false);
    }

    loadPhotos();
  }, [html]);

  // Memoize custom renderer for img tags with data-photo-id
  // This prevents RenderHtml from doing expensive tree rerenders
  const customRenderers = useMemo(() => ({
    img: ({ TDefaultRenderer, ...props }: any) => {
      const photoId = props.tnode?.attributes?.['data-photo-id'];

      // If this is a photo reference
      if (photoId) {
        const uri = photoUris[photoId];

        // Still loading
        if (loadingPhotos && !uri) {
          return (
            <View style={{
              width: '100%',
              height: 200,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: '#f3f4f6',
              marginVertical: 8,
              borderRadius: 8,
            }}>
              <ActivityIndicator size="large" color="#6b7280" />
            </View>
          );
        }

        // Photo loaded
        if (uri) {
          return (
            <TouchableOpacity
              onPress={() => {
                const index = photoIds.indexOf(photoId);
                setSelectedPhotoIndex(index >= 0 ? index : 0);
                setViewerVisible(true);
              }}
              activeOpacity={0.8}
              style={{
                marginVertical: 8,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <Image
                source={{ uri }}
                style={{
                  width: '100%',
                  height: 200,
                  resizeMode: 'cover',
                }}
              />
            </TouchableOpacity>
          );
        }

        // Photo not found - show gray placeholder
        return (
          <View style={{
            width: '100%',
            height: 200,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#f3f4f6',
            marginVertical: 8,
            borderRadius: 8,
          }}>
            <View style={{
              width: 64,
              height: 64,
              backgroundColor: '#d1d5db',
              borderRadius: 8,
            }} />
          </View>
        );
      }

      // Regular img tag - use default renderer
      return <TDefaultRenderer {...props} />;
    },
  }), [photoUris, loadingPhotos, photoIds]);

  // Memoize base styles for rendering
  // This prevents RenderHtml from doing expensive tree rerenders
  const baseStyle = useMemo(() => ({
    body: {
      fontSize: 15,
      lineHeight: 22,
      color: '#111827',
      ...(strikethrough && {
        textDecorationLine: 'line-through' as const,
        opacity: 0.6,
      }),
    },
    p: {
      marginTop: 0,
      marginBottom: 8,
    },
    ul: {
      marginTop: 0,
      marginBottom: 8,
      paddingLeft: 16,
    },
    ol: {
      marginTop: 0,
      marginBottom: 8,
      paddingLeft: 16,
    },
    li: {
      marginBottom: 4,
    },
    strong: {
      fontWeight: '600' as const,
    },
    b: {
      fontWeight: '600' as const,
    },
    em: {
      fontStyle: 'italic' as const,
    },
    i: {
      fontStyle: 'italic' as const,
    },
    img: {
      marginVertical: 8,
    },
  }), [strikethrough]);

  return (
    <>
      <RenderHtml
        contentWidth={width - 32} // Account for padding
        source={{ html }}
        tagsStyles={baseStyle}
        renderers={customRenderers}
      />
      <PhotoViewer
        visible={viewerVisible}
        photos={photoIds.map(id => ({
          photoId: id,
          uri: photoUris[id] || null,
        }))}
        initialIndex={selectedPhotoIndex}
        onClose={() => {
          setViewerVisible(false);
          setSelectedPhotoIndex(0);
        }}
      />
    </>
  );
}
