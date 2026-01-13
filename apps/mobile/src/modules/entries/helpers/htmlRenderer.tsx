/**
 * HTML renderer for React Native using react-native-render-html
 * Handles formatting: bold, italic, bullets, nested lists, paragraphs, line breaks
 * Also renders inline photos with tap-to-view functionality
 * Supports task lists with checkbox rendering
 */
import { useWindowDimensions, Image, TouchableOpacity, ActivityIndicator, View } from 'react-native';
import RenderHtml from 'react-native-render-html';
import React, { useState, useEffect, useMemo } from 'react';
import { extractAttachmentIds } from '@trace/core';
import { getAttachmentUri } from '../../attachments/mobileAttachmentApi';
import { PhotoViewer } from '../../photos/components/PhotoViewer';
import { useTheme } from '../../../shared/contexts/ThemeContext';

interface HtmlRendererProps {
  html: string;
  style?: any;
  strikethrough?: boolean;
}

/**
 * Remove inline color styles from HTML to ensure theme colors are used
 * This handles pasted content that may have hardcoded colors like "color: rgb(0, 0, 0)"
 */
function sanitizeHtmlColors(html: string): string {
  return html.replace(
    /style="([^"]*)"/gi,
    (match, styleContent) => {
      // Remove color and background-color properties from the style
      const cleanedStyle = styleContent
        .replace(/\bcolor\s*:\s*[^;]+;?/gi, '')
        .replace(/background-color\s*:\s*[^;]+;?/gi, '')
        .replace(/background\s*:\s*[^;]+;?/gi, '')
        .trim();

      // If style is now empty, remove the attribute entirely
      if (!cleanedStyle) {
        return '';
      }
      return `style="${cleanedStyle}"`;
    }
  );
}

/**
 * Render HTML content using react-native-render-html
 */
export function HtmlRenderer({ html, style, strikethrough }: HtmlRendererProps) {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const [photoUris, setPhotoUris] = useState<Record<string, string>>({});
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // Load photo URIs when HTML changes
  useEffect(() => {
    async function loadPhotos() {
      const extractedIds = extractAttachmentIds(html);
      if (extractedIds.length === 0) return;

      setPhotoIds(extractedIds);
      setLoadingPhotos(true);
      const uris: Record<string, string> = {};

      for (const photoId of extractedIds) {
        const uri = await getAttachmentUri(photoId);
        if (uri) {
          uris[photoId] = uri;
        }
      }

      setPhotoUris(uris);
      setLoadingPhotos(false);
    }

    loadPhotos();
  }, [html]);

  // Sanitize HTML to remove inline color styles that override theme
  const sanitizedHtml = useMemo(() => sanitizeHtmlColors(html), [html]);

  // Memoize custom renderer for img tags with data-photo-id and task list items
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
    // Suppress checkbox inputs - react-native-render-html can't render them
    input: () => null,
    // Suppress empty labels from task lists
    label: () => null,
  }), [photoUris, loadingPhotos, photoIds]);

  // Memoize base styles for rendering
  // This prevents RenderHtml from doing expensive tree rerenders
  const baseStyle = useMemo(() => ({
    body: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.text.primary,
      fontFamily: theme.typography.fontFamily.regular,
      ...(strikethrough && {
        textDecorationLine: 'line-through' as const,
        opacity: 0.6,
      }),
    },
    p: {
      marginTop: 0,
      marginBottom: 8,
      fontFamily: theme.typography.fontFamily.regular,
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
      fontFamily: theme.typography.fontFamily.regular,
    },
    strong: {
      fontWeight: '600' as const,
      fontFamily: theme.typography.fontFamily.semibold,
    },
    b: {
      fontWeight: '600' as const,
      fontFamily: theme.typography.fontFamily.semibold,
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
    a: {
      color: theme.colors.functional.accent,
      textDecorationLine: 'underline' as const,
    },
  }), [strikethrough, theme.colors.text.primary, theme.typography.fontFamily, theme.colors.functional.accent]);

  return (
    <>
      <RenderHtml
        contentWidth={width - 32} // Account for padding
        source={{ html: sanitizedHtml }}
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
