/**
 * EditorTestScreen - Direct WebView testing of editor-web bundle
 *
 * Tests our custom TipTap editor bundle directly in a plain WebView.
 * NO TenTap - just WebView + our editorHtml bundle.
 */

import { useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "../shared/contexts/ThemeContext";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";

// Our custom editor bundle - just the HTML string
// @ts-ignore - JS file
import { editorHtml } from "../../editor-web/build/editorHtml.js";

// Sample entry data to simulate loading an existing entry
const SAMPLE_ENTRY_HTML = `<h1 class="entry-title">Morning Reflection</h1><p>Today I woke up feeling energized and ready to tackle the day.</p><p>Key priorities:</p><ul><li><p>Finish the editor testing</p></li><li><p>Review the sync logic</p></li><li><p>Go for a walk at lunch</p></li></ul><p>Let's see how it goes!</p>`;

export function EditorTestScreen() {
  const theme = useTheme();
  const { navigate } = useNavigation();
  const [key, setKey] = useState(0);
  const webviewRef = useRef<WebView>(null);
  const pendingContentRef = useRef<string | null>(null);

  const handleReload = () => {
    console.log('\n========== RELOAD ==========\n');
    pendingContentRef.current = null;
    setKey(k => k + 1);
  };

  const handleReloadWithContent = () => {
    console.log('\n========== RELOAD + SET ==========\n');
    pendingContentRef.current = SAMPLE_ENTRY_HTML;
    setKey(k => k + 1);
  };

  const handleInjectGetHTML = () => {
    console.log('[Test] Injecting getHTML script...');
    webviewRef.current?.injectJavaScript(`
      (function() {
        try {
          // Try to get editor content from ProseMirror
          const pm = document.querySelector('.ProseMirror');
          if (pm) {
            const html = pm.innerHTML;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'htmlResult',
              html: html
            }));
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              message: 'ProseMirror element not found'
            }));
          }
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error',
            message: e.message || String(e)
          }));
        }
      })();
      true;
    `);
  };

  const handleInjectSetContent = () => {
    const newContent = `<h1 class="entry-title">Set at ${new Date().toLocaleTimeString()}</h1><p>Content injected via JavaScript.</p>`;
    console.log('[Test] Injecting setContent script...');
    webviewRef.current?.injectJavaScript(`
      (function() {
        try {
          const pm = document.querySelector('.ProseMirror');
          if (pm) {
            pm.innerHTML = ${JSON.stringify(newContent)};
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'setContentResult',
              success: true
            }));
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              message: 'ProseMirror element not found'
            }));
          }
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error',
            message: e.message || String(e)
          }));
        }
      })();
      true;
    `);
  };

  const injectContent = (content: string) => {
    console.log('[Test] Injecting content via innerHTML...');
    webviewRef.current?.injectJavaScript(`
      (function() {
        try {
          const pm = document.querySelector('.ProseMirror');
          if (pm) {
            pm.innerHTML = ${JSON.stringify(content)};
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'setContentResult',
              success: true,
              contentLength: ${content.length}
            }));
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              message: 'ProseMirror not found for content injection'
            }));
          }
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error',
            message: e.message || String(e)
          }));
        }
      })();
      true;
    `);
  };

  const handleMessage = (event: any) => {
    const raw = event.nativeEvent.data;

    try {
      const data = JSON.parse(raw);

      // Log ALL message types for debugging
      console.log('[Test] MESSAGE:', data.type, JSON.stringify(data).substring(0, 150));

      if (data.type === 'bridgeReady') {
        console.log('[Test] >>> BRIDGE READY RECEIVED <<<');
        // Event-driven: inject pending content now that bridge is ready
        if (pendingContentRef.current) {
          console.log('[Test] Pending content exists, injecting...');
          injectContent(pendingContentRef.current);
          pendingContentRef.current = null;
        }
      } else if (data.type === 'htmlResult') {
        console.log('[Test] HTML content:', data.html?.substring(0, 200));
      } else if (data.type === 'setContentResult') {
        console.log('[Test] Content set successfully:', data);
      } else if (data.type === 'error') {
        console.error('[Test] ERROR from WebView:', data.message);
      } else if (data.type === 'console') {
        // Forward WebView console logs
        const prefix = `[WebView ${data.level}]`;
        console.log(prefix, data.message);
      }
    } catch (e) {
      // Not JSON, log raw
      console.log('[Test] RAW MESSAGE:', raw?.substring?.(0, 100) || raw);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader title="Direct WebView Test" onBack={() => navigate("settings")} />

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Controls */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Controls</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.functional.overdue }]}
              onPress={handleReload}
            >
              <Text style={styles.buttonText}>Reload</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.functional.accent }]}
              onPress={handleReloadWithContent}
            >
              <Text style={styles.buttonText}>Reload+Set</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.interactive.secondary }]}
              onPress={handleInjectGetHTML}
            >
              <Text style={styles.buttonText}>Get HTML</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.interactive.secondary }]}
              onPress={handleInjectSetContent}
            >
              <Text style={styles.buttonText}>Set Content</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.info, { color: theme.colors.text.tertiary, marginTop: 8 }]}>
            Key: {key} | Pure WebView (no TenTap)
          </Text>
        </View>

        {/* WebView - direct load of our editor bundle */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Editor (Direct WebView)</Text>
          <View style={[styles.editorContainer, { borderColor: theme.colors.border.light }]}>
            <WebView
              key={key}
              ref={webviewRef}
              source={{ html: editorHtml }}
              style={{ backgroundColor: theme.colors.background.primary }}
              onMessage={handleMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              originWhitelist={['*']}
              onError={(e) => console.error('[Test] WebView error:', e.nativeEvent)}
              onHttpError={(e) => console.error('[Test] HTTP error:', e.nativeEvent)}
              onLoadStart={() => console.log('[Test] WebView load start')}
              onLoadEnd={() => console.log('[Test] WebView load end')}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  info: {
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  editorContainer: {
    height: 300,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
});
