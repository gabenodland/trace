/**
 * Native HTML renderer for entry list items
 *
 * Uses react-native-render-html's RenderHTMLSource (lightweight) which
 * expects to be inside a HtmlRenderProvider (TRenderEngineProvider +
 * RenderHTMLConfigProvider). This replaces the old WebView-per-item
 * approach that caused 200+ WebViews and Android OOM kills.
 *
 * Photo URIs are resolved and injected into img tags for inline display.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import type { ViewStyle, StyleProp } from 'react-native';
import { RenderHTMLSource } from 'react-native-render-html';
import { extractAttachmentIds } from '@trace/core';
import { getAttachmentUri } from '../../attachments/mobileAttachmentApi';
import { sanitizeHtmlColors } from '../../../shared/utils/htmlUtils';
import { HTML_CONTENT_HORIZONTAL_PADDING } from './htmlRenderConfig';

interface WebViewHtmlRendererProps {
  html: string;
  style?: StyleProp<ViewStyle>;
  strikethrough?: boolean;
}

/**
 * Render HTML content natively using react-native-render-html.
 * Must be rendered inside a <HtmlRenderProvider>.
 */
export function WebViewHtmlRenderer({ html, style, strikethrough }: WebViewHtmlRendererProps) {
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = windowWidth - HTML_CONTENT_HORIZONTAL_PADDING;

  const [photoUris, setPhotoUris] = useState<Record<string, string>>({});

  // Load photo URIs when HTML changes
  useEffect(() => {
    let cancelled = false;

    async function loadPhotos() {
      const extractedIds = extractAttachmentIds(html);
      if (extractedIds.length === 0) return;

      const uris: Record<string, string> = {};

      for (const photoId of extractedIds) {
        const uri = await getAttachmentUri(photoId);
        if (uri) {
          uris[photoId] = uri;
        }
      }

      if (!cancelled) setPhotoUris(uris);
    }

    loadPhotos();
    return () => { cancelled = true; };
  }, [html]);

  // Process HTML: sanitize colors, decode entities, replace photo placeholders
  const processedHtml = useMemo(() => {
    let result = sanitizeHtmlColors(html);

    // Decode &nbsp; entities to actual non-breaking space character.
    // TipTap's JSON→HTML roundtrip can double-encode (&amp;nbsp; → &nbsp; after
    // first decode), causing RNRH to show literal "&nbsp;" text.
    result = result.replace(/&amp;nbsp;/g, '\u00A0').replace(/&nbsp;/g, '\u00A0');

    // Replace photo placeholders with actual image URIs
    for (const [photoId, uri] of Object.entries(photoUris)) {
      result = result.replace(
        new RegExp(`<img[^>]*data-photo-id="${photoId}"[^>]*>`, 'g'),
        `<img src="${uri}" data-photo-id="${photoId}" style="width:100%;border-radius:8px;margin:8px 0;" />`,
      );
    }

    return result;
  }, [html, photoUris]);

  const source = useMemo(() => ({ html: processedHtml }), [processedHtml]);

  // Don't render anything for empty content — check after hooks to avoid rules violation
  const isEmpty = useMemo(() => !html.replace(/<[^>]*>/g, '').trim(), [html]);
  if (isEmpty) return null;

  return (
    <View style={[styles.container, strikethrough && styles.strikethrough, style]}>
      <RenderHTMLSource
        source={source}
        contentWidth={contentWidth}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  strikethrough: {
    opacity: 0.6,
  },
});
