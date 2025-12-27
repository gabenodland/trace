/**
 * WebView-based HTML renderer for React Native
 * Uses react-native-webview to render HTML with full browser support
 * This properly renders task lists with checkboxes, unlike react-native-render-html
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { extractPhotoIds } from '@trace/core';
import { getPhotoUri } from '../../photos/mobilePhotoApi';
import { PhotoViewer } from '../../photos/components/PhotoViewer';

interface WebViewHtmlRendererProps {
  html: string;
  style?: any;
  strikethrough?: boolean;
}

/**
 * Render HTML content using WebView for full browser support
 * Supports task lists with checkboxes, proper indentation, etc.
 */
export function WebViewHtmlRenderer({ html, style, strikethrough }: WebViewHtmlRendererProps) {
  const [photoUris, setPhotoUris] = useState<Record<string, string>>({});
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [webViewHeight, setWebViewHeight] = useState(100);
  const webViewRef = useRef<WebView>(null);
  // Track if this is the first render - only then use default height
  const hasInitializedRef = useRef(false);

  // Load photo URIs when HTML changes
  useEffect(() => {
    async function loadPhotos() {
      const extractedIds = extractPhotoIds(html);
      if (extractedIds.length === 0) return;

      setPhotoIds(extractedIds);
      const uris: Record<string, string> = {};

      for (const photoId of extractedIds) {
        const uri = await getPhotoUri(photoId);
        if (uri) {
          uris[photoId] = uri;
        }
      }

      setPhotoUris(uris);
    }

    loadPhotos();
  }, [html]);

  // Process HTML to replace photo placeholders with actual URIs
  const processedHtml = useMemo(() => {
    let result = html;

    // Replace photo placeholders with actual image URIs
    for (const [photoId, uri] of Object.entries(photoUris)) {
      result = result.replace(
        new RegExp(`<img[^>]*data-photo-id="${photoId}"[^>]*>`, 'g'),
        `<img src="${uri}" data-photo-id="${photoId}" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px;margin:8px 0;" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'photo',photoId:'${photoId}'}))" />`
      );
    }

    return result;
  }, [html, photoUris]);

  // CSS for proper HTML rendering including task lists
  const css = `
    * {
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }
    html, body {
      height: auto;
      min-height: 0;
      overflow: visible;
    }
    #content {
      display: block;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 15px;
      line-height: 1.5;
      color: #111827;
      margin: 0;
      padding: 0;
      ${strikethrough ? 'text-decoration: line-through; opacity: 0.6;' : ''}
    }
    p {
      margin: 0 0 8px 0;
      padding: 0;
    }
    p:last-child {
      margin-bottom: 0;
    }

    /* Headings */
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 8px 0 4px 0;
    }
    h2 {
      font-size: 20px;
      font-weight: 700;
      margin: 6px 0 4px 0;
    }

    /* Regular list styling */
    ul, ol {
      margin: 0 0 8px 0;
      padding-left: 24px;
    }
    ul:last-child, ol:last-child {
      margin-bottom: 0;
    }
    li {
      margin-bottom: 4px;
    }

    /* Nested regular lists */
    ul:not([data-type="taskList"]) ul:not([data-type="taskList"]),
    ol ul:not([data-type="taskList"]),
    ul:not([data-type="taskList"]) ol,
    ol ol {
      padding-left: 20px;
    }

    /* Numbered list hierarchy: 1 -> a -> i -> A -> I */
    ol { list-style-type: decimal; }
    ol ol { list-style-type: lower-alpha; }
    ol ol ol { list-style-type: lower-roman; }
    ol ol ol ol { list-style-type: upper-alpha; }
    ol ol ol ol ol { list-style-type: upper-roman; }

    /* Task list (checkbox) styling */
    ul[data-type="taskList"] {
      padding-left: 0;
      margin-left: 0;
      list-style: none;
    }
    ul[data-type="taskList"] li {
      display: flex;
      align-items: flex-start;
    }
    ul[data-type="taskList"] li > label {
      margin-right: 8px;
      user-select: none;
      display: flex;
      align-items: center;
    }
    ul[data-type="taskList"] li > label input[type="checkbox"] {
      width: 16px;
      height: 16px;
      margin: 2px 0 0 0;
      cursor: pointer;
      accent-color: #111827;
    }
    ul[data-type="taskList"] li > label span {
      display: none;
    }
    ul[data-type="taskList"] li > div {
      flex: 1;
    }
    ul[data-type="taskList"] li > div p {
      margin: 0;
    }

    /* Nested task lists */
    ul[data-type="taskList"] ul[data-type="taskList"],
    li[data-type="taskItem"] ul[data-type="taskList"] {
      padding-left: 24px;
      margin-left: 0;
    }

    /* Text formatting */
    strong, b { font-weight: 600; }
    em, i { font-style: italic; }

    /* Images */
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 8px 0;
    }
  `;

  // Full HTML document
  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <style>${css}</style>
    </head>
    <body>
      <div id="content">${processedHtml}</div>
      <script>
        let lastHeight = 0;

        // Calculate and send content height using getBoundingClientRect for accuracy
        function sendHeight() {
          const content = document.getElementById('content');
          if (content) {
            const rect = content.getBoundingClientRect();
            const height = Math.ceil(rect.height);
            // Only send if height changed to avoid unnecessary updates
            if (height !== lastHeight && height > 0) {
              lastHeight = height;
              window.ReactNativeWebView.postMessage(JSON.stringify({type:'height', height: height}));
            }
          }
        }

        // Use ResizeObserver for continuous monitoring
        if (typeof ResizeObserver !== 'undefined') {
          const content = document.getElementById('content');
          if (content) {
            const observer = new ResizeObserver(() => {
              sendHeight();
            });
            observer.observe(content);
          }
        }

        // Send height after content loads
        window.onload = sendHeight;

        // Send height after images load
        document.querySelectorAll('img').forEach(img => {
          img.onload = sendHeight;
        });

        // Multiple checks to catch layout shifts
        setTimeout(sendHeight, 0);
        setTimeout(sendHeight, 50);
        setTimeout(sendHeight, 150);
        setTimeout(sendHeight, 300);
      </script>
    </body>
    </html>
  `;

  // Handle messages from WebView
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'height') {
        setWebViewHeight(data.height);
      } else if (data.type === 'photo') {
        const index = photoIds.indexOf(data.photoId);
        setSelectedPhotoIndex(index >= 0 ? index : 0);
        setViewerVisible(true);
      }
    } catch (e) {
      // Ignore parse errors
    }
  };

  return (
    <>
      <View style={[{ height: webViewHeight, overflow: 'hidden' }, style]}>
        <WebView
          ref={webViewRef}
          source={{ html: fullHtml }}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          onMessage={handleMessage}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          scalesPageToFit={false}
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
