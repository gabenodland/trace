/**
 * Native HTML renderer for entry list previews
 * Uses react-native-render-html instead of WebView to avoid Android killing WebViews.
 * Custom renderers handle TipTap task lists (data-type="taskList") and tables.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import RenderHtml, { TNodeChildrenRenderer } from 'react-native-render-html';
import type { CustomRendererProps, TBlock, MixedStyleRecord, CustomTagRendererRecord } from 'react-native-render-html';
import { extractAttachmentIds } from '@trace/core';
import { getAttachmentUri } from '../../attachments/mobileAttachmentApi';
import { PhotoViewer } from '../../photos/components/PhotoViewer';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { sanitizeHtmlColors } from '../../../shared/utils/htmlUtils';

interface WebViewHtmlRendererProps {
  html: string;
  style?: any;
  strikethrough?: boolean;
}

/**
 * Render HTML content using native components (no WebView).
 * Supports task lists with checkboxes, tables, lists, and inline photos.
 */
export function WebViewHtmlRenderer({ html, style, strikethrough }: WebViewHtmlRendererProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = width - 64; // Account for padding/margins

  const [photoUris, setPhotoUris] = useState<Record<string, string>>({});
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);

  // Don't render anything for empty content (after hooks)
  const isEmpty = !html.replace(/<[^>]*>/g, '').trim();

  // Load photo URIs when HTML changes
  useEffect(() => {
    async function loadPhotos() {
      const extractedIds = extractAttachmentIds(html);
      if (extractedIds.length === 0) return;

      setPhotoIds(extractedIds);
      const uris: Record<string, string> = {};

      for (const photoId of extractedIds) {
        const uri = await getAttachmentUri(photoId);
        if (uri) {
          uris[photoId] = uri;
        }
      }

      setPhotoUris(uris);
    }

    loadPhotos();
  }, [html]);

  // Process HTML: sanitize colors, replace photo placeholders
  const processedHtml = useMemo(() => {
    let result = sanitizeHtmlColors(html);

    for (const [photoId, uri] of Object.entries(photoUris)) {
      result = result.replace(
        new RegExp(`<img[^>]*data-photo-id="${photoId}"[^>]*>`, 'g'),
        `<img src="${uri}" data-photo-id="${photoId}" style="width:100%;max-height:200px;border-radius:8px;margin:8px 0;" />`
      );
    }

    return result;
  }, [html, photoUris]);

  // Base styles matching the WebView CSS
  const tagsStyles = useMemo<MixedStyleRecord>(() => ({
    body: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.text.primary,
      fontFamily: theme.typography.fontFamily.regular,
      margin: 0,
      padding: 0,
      ...(strikethrough ? { textDecorationLine: 'line-through' as const, opacity: 0.6 } : {}),
    },
    p: {
      marginTop: 0,
      marginBottom: 8,
    },
    h1: {
      fontSize: 17,
      fontFamily: theme.typography.fontFamily.bold,
      marginTop: 12,
      marginBottom: 4,
    },
    h2: {
      fontSize: 16,
      fontFamily: theme.typography.fontFamily.bold,
      marginTop: 8,
      marginBottom: 4,
    },
    h3: {
      fontSize: 15,
      fontFamily: theme.typography.fontFamily.semibold,
      marginTop: 4,
      marginBottom: 2,
      opacity: 0.85,
    },
    h4: {
      fontSize: 15,
      fontFamily: theme.typography.fontFamily.semibold,
      marginTop: 4,
      marginBottom: 2,
      opacity: 0.85,
    },
    h5: {
      fontSize: 15,
      fontFamily: theme.typography.fontFamily.semibold,
      marginTop: 4,
      marginBottom: 2,
      opacity: 0.85,
    },
    h6: {
      fontSize: 15,
      fontFamily: theme.typography.fontFamily.semibold,
      marginTop: 4,
      marginBottom: 2,
      opacity: 0.85,
    },
    strong: {
      fontFamily: theme.typography.fontFamily.semibold,
    },
    a: {
      color: theme.colors.functional.accent,
      textDecorationLine: 'underline' as const,
    },
    ul: {
      marginTop: 0,
      marginBottom: 8,
      paddingLeft: 24,
    },
    ol: {
      marginTop: 0,
      marginBottom: 8,
      paddingLeft: 24,
    },
    li: {
      marginBottom: 4,
    },
    table: {
      marginTop: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.border.dark,
    },
    th: {
      padding: 6,
      borderWidth: 1,
      borderColor: theme.colors.border.dark,
      backgroundColor: theme.colors.background.tertiary,
      fontFamily: theme.typography.fontFamily.semibold,
    },
    td: {
      padding: 6,
      borderWidth: 1,
      borderColor: theme.colors.border.dark,
    },
    img: {
      borderRadius: 8,
      marginTop: 8,
      marginBottom: 8,
    },
  }), [theme, strikethrough]);

  // Custom renderers for task lists (TipTap data-type="taskList"/"taskItem")
  const renderers = useMemo<CustomTagRendererRecord>(() => ({
    // Handle <ul data-type="taskList"> — render without bullets
    ul: ({ TDefaultRenderer, tnode, ...props }: CustomRendererProps<TBlock>) => {
      if (tnode.attributes?.['data-type'] === 'taskList') {
        return (
          <View style={{ marginTop: 0, marginBottom: 8 }}>
            <TNodeChildrenRenderer tnode={tnode} />
          </View>
        );
      }
      return <TDefaultRenderer tnode={tnode} {...props} />;
    },
    // Handle <li data-type="taskItem"> — render checkbox + text
    li: ({ TDefaultRenderer, tnode, ...props }: CustomRendererProps<TBlock>) => {
      if (tnode.attributes?.['data-type'] === 'taskItem') {
        const isChecked = tnode.attributes?.['data-checked'] === 'true';
        // Filter out <label> children (contains the checkbox <input>) — we render our own checkbox
        const textChildren = tnode.children.filter(
          (child: any) => child.tagName !== 'label'
        );

        return (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
            <Text style={{
              fontSize: 16,
              lineHeight: 22,
              marginRight: 8,
              color: theme.colors.text.primary,
            }}>
              {isChecked ? '☑' : '☐'}
            </Text>
            <View style={{ flex: 1, opacity: isChecked ? 0.6 : 1 }}>
              <TNodeChildrenRenderer tnode={{ ...tnode, children: textChildren }} />
            </View>
          </View>
        );
      }

      return <TDefaultRenderer tnode={tnode} {...props} />;
    },
  }), [theme]);

  // System fonts for the renderer
  const systemFonts = useMemo(() => [
    theme.typography.fontFamily.regular,
    theme.typography.fontFamily.bold,
    theme.typography.fontFamily.semibold,
  ], [theme]);

  const onPressPhoto = useCallback((photoId: string) => {
    const index = photoIds.indexOf(photoId);
    setSelectedPhotoIndex(index >= 0 ? index : 0);
    setViewerVisible(true);
  }, [photoIds]);

  if (isEmpty) return null;

  return (
    <>
      <View style={style}>
        <RenderHtml
          contentWidth={contentWidth}
          source={{ html: processedHtml }}
          tagsStyles={tagsStyles}
          renderers={renderers}
          systemFonts={systemFonts}
          enableExperimentalMarginCollapsing={true}
          defaultTextProps={{ selectable: false }}
        />
      </View>
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
