/**
 * EditorTestScreen - Isolated testing environment for custom TenTap editor
 *
 * This screen tests the custom editor bundle with Title extensions
 * without the complexity of the full EntryScreen.
 */

import { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import {
  RichText,
  useEditorBridge,
  TenTapStartKit,
  CoreBridge,
} from "@10play/tentap-editor";
import { useTheme } from "../shared/contexts/ThemeContext";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";

// Import the custom editor bundle
// @ts-ignore - JS file with .d.ts declaration
import { editorHtml } from "../../editor-web/build/editorHtml.js";

export function EditorTestScreen() {
  const theme = useTheme();
  const [content, setContent] = useState("<h1>Test Title</h1><p>Test body content...</p>");
  const [logs, setLogs] = useState<string[]>([]);
  const [useCustomSource, setUseCustomSource] = useState(true);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-20), `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  // Log on mount
  useEffect(() => {
    addLog(`Bundle loaded: ${editorHtml?.length || 0} chars`);
  }, []);

  const customCSS = `
    body {
      background-color: ${theme.colors.background.primary};
      color: ${theme.colors.text.primary};
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 12px;
    }
    h1 {
      font-size: 24px;
      font-weight: bold;
      margin: 0 0 12px 0;
      padding: 0 0 8px 0;
      border-bottom: 1px solid ${theme.colors.border.light};
    }
    p {
      margin: 0;
      padding: 0;
    }
    .ProseMirror {
      outline: none;
      min-height: 200px;
    }
  `;

  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    initialContent: content,
    editable: true,
    customSource: useCustomSource ? editorHtml : undefined,
    bridgeExtensions: [
      ...TenTapStartKit,
      CoreBridge.configureCSS(customCSS),
    ],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader title="Editor Test" />

      <ScrollView style={styles.content}>
        {/* Controls */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Controls</Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: useCustomSource ? theme.colors.functional.accent : theme.colors.border.dark }]}
            onPress={() => setUseCustomSource(!useCustomSource)}
          >
            <Text style={styles.buttonText}>
              {useCustomSource ? "Using Custom Source ✓" : "Using Default TenTap"}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.info, { color: theme.colors.text.secondary }]}>
            Bundle size: {editorHtml?.length?.toLocaleString() || 0} chars
          </Text>
          <Text style={[styles.info, { color: theme.colors.text.secondary }]}>
            Starts with DOCTYPE: {editorHtml?.startsWith('<!DOCTYPE') ? 'Yes' : 'No'}
          </Text>
        </View>

        {/* Editor */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Editor</Text>
          <View style={styles.editorContainer}>
            <RichText
              editor={editor}
              style={{ flex: 1, minHeight: 200 }}
            />
          </View>
        </View>

        {/* Logs */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Logs</Text>
          {logs.map((log, i) => (
            <Text key={i} style={[styles.log, { color: theme.colors.text.secondary }]}>{log}</Text>
          ))}
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
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  info: {
    fontSize: 13,
    marginBottom: 4,
  },
  editorContainer: {
    minHeight: 200,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    overflow: "hidden",
  },
  log: {
    fontSize: 11,
    fontFamily: "monospace",
    marginBottom: 2,
  },
});
