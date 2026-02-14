/**
 * TenTapTestScreen - Test TenTap's standard API (Single Instance)
 *
 * Tests the core operations with ONE editor instance:
 * 1. setContent() - inject HTML
 * 2. getHTML() - retrieve HTML
 * 3. Clear - reset content
 * 4. User can type and edit
 *
 * NOTE: We use a single editor instance because TenTap has a memory leak
 * when remounting (EditorHelper.setEditorLastInstance keeps old refs alive).
 */

import { useState, useRef, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useTheme } from "../shared/contexts/ThemeContext";
import { useNavigate } from "../shared/navigation";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { EditorWebBridge, EditorWebBridgeRef } from "../components/editor/EditorWebBridge";

const SAMPLE_CONTENT_A = `<h1 class="entry-title">Entry A - Morning Notes</h1><p>This is Entry A content.</p><ul><li><p>Item A1</p></li><li><p>Item A2</p></li></ul>`;
const SAMPLE_CONTENT_B = `<h1 class="entry-title">Entry B - Evening Notes</h1><p>This is Entry B content.</p><ol><li><p>Item B1</p></li><li><p>Item B2</p></li></ol>`;

// For backwards compatibility
const SAMPLE_CONTENT = SAMPLE_CONTENT_A;

export function TenTapTestScreen() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [log, setLog] = useState<string[]>([]);
  const [changeCount, setChangeCount] = useState(0);
  const editorRef = useRef<EditorWebBridgeRef>(null);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLog((prev) => [...prev.slice(-15), `[${time}] ${msg}`]);
    console.log(`[L2] ${msg}`);
  };

  // TenTap onChange callback - fires on every content change
  const handleChange = useCallback(() => {
    setChangeCount((c) => c + 1);
    console.log("[L2] onChange fired");
  }, []);

  const handleClear = () => {
    addLog("Clearing content...");
    editorRef.current?.setContent("");
    setChangeCount(0);
    addLog("Content cleared");
  };

  const handleSetContent = () => {
    addLog("Calling setContent()...");
    editorRef.current?.setContent(SAMPLE_CONTENT);
    addLog("setContent() called");
  };

  const handleGetHTML = async () => {
    addLog("Calling getHTML()...");
    try {
      const html = await editorRef.current?.getHTML();
      addLog(`SUCCESS: ${html?.substring(0, 80)}...`);
    } catch (e: any) {
      addLog(`ERROR: ${e.message}`);
    }
  };

  const handleFocus = () => {
    editorRef.current?.focus();
    addLog("focus() called");
  };

  // Formatting handlers
  const handleBold = () => {
    editorRef.current?.toggleBold();
    addLog("toggleBold() called");
  };

  const handleItalic = () => {
    editorRef.current?.toggleItalic();
    addLog("toggleItalic() called");
  };

  const handleUnderline = () => {
    editorRef.current?.toggleUnderline();
    addLog("toggleUnderline() called");
  };

  const handleBulletList = () => {
    editorRef.current?.toggleBulletList();
    addLog("toggleBulletList() called");
  };

  const handleOrderedList = () => {
    editorRef.current?.toggleOrderedList();
    addLog("toggleOrderedList() called");
  };

  const handleTaskList = () => {
    editorRef.current?.toggleTaskList();
    addLog("toggleTaskList() called");
  };

  const handleIndent = () => {
    editorRef.current?.sink();
    addLog("sink() called (indent)");
  };

  const handleOutdent = () => {
    editorRef.current?.lift();
    addLog("lift() called (outdent)");
  };

  // History handlers
  const handleUndo = () => {
    editorRef.current?.undo();
    addLog("undo() called");
  };

  const handleRedo = () => {
    editorRef.current?.redo();
    addLog("redo() called");
  };

  const handleClearHistory = () => {
    addLog("clearHistory() calling...");
    editorRef.current?.clearHistory();
    addLog("clearHistory() injected - check WebView logs");
  };

  // Simulate loading Entry A (with history clear)
  const handleLoadEntryA = () => {
    addLog("Loading Entry A with setContentAndClearHistory...");
    editorRef.current?.setContentAndClearHistory(SAMPLE_CONTENT_A);
    addLog("Entry A loaded - undo should be disabled");
  };

  // Simulate loading Entry B (with history clear)
  const handleLoadEntryB = () => {
    addLog("Loading Entry B with setContentAndClearHistory...");
    editorRef.current?.setContentAndClearHistory(SAMPLE_CONTENT_B);
    addLog("Entry B loaded - undo should be disabled");
  };

  // Set content WITHOUT clearing history (old behavior - for comparison)
  const handleSetContentNoHistoryClear = () => {
    addLog("setContent (NO history clear)...");
    editorRef.current?.setContent(SAMPLE_CONTENT_B);
    addLog("Content set - undo WILL go back to previous content");
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader title="TenTap Single Instance Test" onBack={() => navigate("settings")} />

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Controls */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Controls</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.functional.overdue }]}
              onPress={handleClear}
            >
              <Text style={styles.buttonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.functional.accent }]}
              onPress={handleSetContent}
            >
              <Text style={styles.buttonText}>Set Content</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.interactive.secondary }]}
              onPress={handleGetHTML}
            >
              <Text style={styles.buttonText}>Get HTML</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.interactive.secondary }]}
              onPress={handleFocus}
            >
              <Text style={styles.buttonText}>Focus</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.info, { color: theme.colors.text.tertiary, marginTop: 8 }]}>
            onChange count: {changeCount} | Single instance (no remount)
          </Text>
        </View>

        {/* Formatting Controls */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Formatting</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.border.dark }]}
              onPress={handleBold}
            >
              <Text style={[styles.buttonText, { fontWeight: 'bold' }]}>B</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.border.dark }]}
              onPress={handleItalic}
            >
              <Text style={[styles.buttonText, { fontStyle: 'italic' }]}>I</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.border.dark }]}
              onPress={handleUnderline}
            >
              <Text style={[styles.buttonText, { textDecorationLine: 'underline' }]}>U</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.border.dark }]}
              onPress={handleBulletList}
            >
              <Text style={styles.buttonText}>• List</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.border.dark }]}
              onPress={handleOrderedList}
            >
              <Text style={styles.buttonText}>1. List</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.border.dark }]}
              onPress={handleTaskList}
            >
              <Text style={styles.buttonText}>☐ Task</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.buttonRow, { marginTop: 8 }]}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.border.dark }]}
              onPress={handleIndent}
            >
              <Text style={styles.buttonText}>→ Indent</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.border.dark }]}
              onPress={handleOutdent}
            >
              <Text style={styles.buttonText}>← Outdent</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* History Controls - THE MAIN TEST SECTION */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary, borderWidth: 2, borderColor: theme.colors.functional.accent }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.functional.accent }]}>History Controls (Testing Undo Fix)</Text>
          <Text style={[styles.info, { color: theme.colors.text.secondary, marginBottom: 12 }]}>
            Test: Load Entry A → type → Load Entry B → Undo should NOT go back to Entry A
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.interactive.secondary }]}
              onPress={handleUndo}
            >
              <Text style={styles.buttonText}>↩ Undo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.interactive.secondary }]}
              onPress={handleRedo}
            >
              <Text style={styles.buttonText}>↪ Redo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.functional.overdue }]}
              onPress={handleClearHistory}
            >
              <Text style={styles.buttonText}>Clear History</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.buttonRow, { marginTop: 8 }]}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.functional.accent }]}
              onPress={handleLoadEntryA}
            >
              <Text style={styles.buttonText}>Load Entry A</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.functional.accent }]}
              onPress={handleLoadEntryB}
            >
              <Text style={styles.buttonText}>Load Entry B</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.buttonRow, { marginTop: 8 }]}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.border.dark }]}
              onPress={handleSetContentNoHistoryClear}
            >
              <Text style={styles.buttonText}>Set B (no clear) - OLD BUG</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Editor */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Editor</Text>
          <View style={[styles.editorContainer, { borderColor: theme.colors.border.light }]}>
            <EditorWebBridge ref={editorRef} onChange={handleChange} />
          </View>
        </View>

        {/* Log */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Log</Text>
          <ScrollView style={styles.logContainer} nestedScrollEnabled>
            {log.map((msg, i) => (
              <Text key={i} style={[styles.logLine, { color: theme.colors.text.secondary }]}>
                {msg}
              </Text>
            ))}
            {log.length === 0 && (
              <Text style={[styles.logLine, { color: theme.colors.text.tertiary }]}>
                No logs yet...
              </Text>
            )}
          </ScrollView>
        </View>

        {/* Keyboard spacer - scroll past keyboard */}
        <View style={{ height: 400 }} />
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
    height: 250,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  logContainer: {
    maxHeight: 150,
  },
  logLine: {
    fontSize: 11,
    fontFamily: "monospace",
    marginBottom: 2,
  },
});
