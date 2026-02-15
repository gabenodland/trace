/**
 * RichTextEditorV2TestScreen - Test V2 Editor (Layer 3)
 *
 * Tests the RichTextEditorV2 component which is the full integration layer:
 * - Layer 1: editor-web bundle (TipTap + Title schema)
 * - Layer 2: TenTap bridge (EditorWebBridge)
 * - Layer 3: RichTextEditorV2 wrapper (this tests it)
 *
 * Key test operations:
 * 1. Set Content - inject HTML
 * 2. Get HTML - retrieve content
 * 3. Clear - reset content
 * 4. onChange callback for dirty detection
 * 5. Formatting commands (bold, italic, etc.)
 */

import { useState, useRef, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useTheme } from "../shared/contexts/ThemeContext";
import { useNavigate } from "../shared/navigation";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { RichTextEditorV2, RichTextEditorV2Ref } from "../components/editor/RichTextEditorV2";

const SAMPLE_CONTENT = `<h1 class="entry-title">Test Entry Title</h1><p>This content was set via setContent().</p><ul><li><p>Bullet item 1</p></li><li><p>Bullet item 2</p></li></ul><p>Try typing below to test onChange detection.</p>`;

export function RichTextEditorV2TestScreen() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [log, setLog] = useState<string[]>([]);
  const [changeCount, setChangeCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const editorRef = useRef<RichTextEditorV2Ref>(null);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLog((prev) => [...prev.slice(-15), `[${time}] ${msg}`]);
    console.log(`[V2Test] ${msg}`);
  };

  // onChange callback - fires when content changes
  const handleChange = useCallback((html: string) => {
    setChangeCount((c) => c + 1);
    addLog(`onChange: ${html.length} chars`);
  }, []);

  // handleReady replaced by handleReadyWrapped below (supports reload tests)

  const handleClear = () => {
    addLog("Clearing content...");
    editorRef.current?.setContent("");
    setChangeCount(0);
  };

  const handleSetContent = () => {
    addLog("Setting sample content...");
    editorRef.current?.setContent(SAMPLE_CONTENT);
  };

  // === RELOAD + SET simulations (reproduces activity recreation bug) ===

  // Simulate: reload then immediately set content (0ms gap)
  const handleReloadThenSetImmediate = () => {
    addLog("=== RELOAD → SET (0ms) ===");
    setIsReady(false);
    editorRef.current?.reloadWebView();
    addLog("reloadWebView() called, now calling setContentAndClearHistory...");
    editorRef.current?.setContentAndClearHistory(SAMPLE_CONTENT);
    addLog("setContentAndClearHistory() called immediately after reload");
  };

  // Simulate: reload then set content after 500ms delay
  const handleReloadThenSet500 = () => {
    addLog("=== RELOAD → SET (500ms) ===");
    setIsReady(false);
    editorRef.current?.reloadWebView();
    addLog("reloadWebView() called, waiting 500ms...");
    setTimeout(() => {
      addLog("500ms elapsed, calling setContentAndClearHistory...");
      editorRef.current?.setContentAndClearHistory(SAMPLE_CONTENT);
      addLog("setContentAndClearHistory() called");
    }, 500);
  };

  // Simulate: reload then wait for onReady then set content
  const pendingSetAfterReady = useRef(false);
  const handleReloadThenWaitReady = () => {
    addLog("=== RELOAD → WAIT READY → SET ===");
    setIsReady(false);
    pendingSetAfterReady.current = true;
    editorRef.current?.reloadWebView();
    addLog("reloadWebView() called, waiting for onReady...");
  };

  // Simulate: reload, wait 10ms, set content, then poll with timeout on getHTML
  const handleReloadSetGetHTML = () => {
    const t0 = performance.now();
    const elapsed = () => `${Math.round(performance.now() - t0)}ms`;

    // getHTML with timeout — returns null if WebView doesn't respond
    const getHTMLWithTimeout = (ms: number): Promise<string | null> => {
      return Promise.race([
        editorRef.current?.getHTML() ?? Promise.resolve(null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
      ]);
    };

    addLog("=== RELOAD → 10ms → SET → VERIFY @100ms ===");
    setIsReady(false);
    editorRef.current?.reloadWebView();
    addLog(`[${elapsed()}] reloadWebView() called`);

    setTimeout(() => {
      addLog(`[${elapsed()}] calling setContentAndClearHistory...`);
      editorRef.current?.setContentAndClearHistory(SAMPLE_CONTENT);
      addLog(`[${elapsed()}] setContentAndClearHistory() called`);

      const verify = async (attempt: number) => {
        addLog(`[${elapsed()}] verify #${attempt}...`);
        const html = await getHTMLWithTimeout(80);
        if (html === null) {
          addLog(`[${elapsed()}] getHTML timed out (WebView not ready)`);
          editorRef.current?.setContentAndClearHistory(SAMPLE_CONTENT);
          if (attempt < 50) {
            setTimeout(() => verify(attempt + 1), 100);
          } else {
            addLog(`[${elapsed()}] GAVE UP after 50 attempts`);
          }
        } else if (html.length < 50) {
          addLog(`[${elapsed()}] too short (${html.length}), re-setting...`);
          editorRef.current?.setContentAndClearHistory(SAMPLE_CONTENT);
          if (attempt < 50) {
            setTimeout(() => verify(attempt + 1), 100);
          } else {
            addLog(`[${elapsed()}] GAVE UP after 50 attempts`);
          }
        } else {
          addLog(`[${elapsed()}] OK! ${html.substring(0, 60)}...`);
        }
      };

      setTimeout(() => verify(1), 100);
    }, 10);
  };

  // Hook into onReady for the wait-for-ready test
  const handleReadyWrapped = useCallback(() => {
    setIsReady(true);
    addLog('Editor ready');
    if (pendingSetAfterReady.current) {
      pendingSetAfterReady.current = false;
      addLog("onReady fired! Now calling setContentAndClearHistory...");
      editorRef.current?.setContentAndClearHistory(SAMPLE_CONTENT);
      addLog("setContentAndClearHistory() called after onReady");
    }
  }, []);

  const handleGetHTML = async () => {
    addLog("Getting HTML...");
    try {
      const html = await editorRef.current?.getHTML();
      addLog(`Got: ${html?.substring(0, 80)}...`);
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
    editorRef.current?.indent();
    addLog("indent() called");
  };

  const handleOutdent = () => {
    editorRef.current?.outdent();
    addLog("outdent() called");
  };

  const handleUndo = () => {
    editorRef.current?.undo();
    addLog("undo() called");
  };

  const handleRedo = () => {
    editorRef.current?.redo();
    addLog("redo() called");
  };

  const handleH1 = () => {
    editorRef.current?.toggleHeading(1);
    addLog("toggleHeading(1) called");
  };

  const handleH2 = () => {
    editorRef.current?.toggleHeading(2);
    addLog("toggleHeading(2) called");
  };

  const handleH3 = () => {
    editorRef.current?.toggleHeading(3);
    addLog("toggleHeading(3) called");
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader
        title="RichTextEditorV2 Test"
        onBack={() => navigate("settings")}
      />

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Status */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Status</Text>
          <Text style={[styles.info, { color: isReady ? theme.colors.functional.accent : theme.colors.text.tertiary }]}>
            Editor Ready: {isReady ? '✓ Yes' : '⏳ No'}
          </Text>
          <Text style={[styles.info, { color: theme.colors.text.tertiary }]}>
            onChange Count: {changeCount}
          </Text>
        </View>

        {/* Controls */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Content Controls</Text>
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
        </View>

        {/* Reload + Set Tests (Activity Recreation Simulation) */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Reload + Set Tests</Text>
          <Text style={[styles.info, { color: theme.colors.text.tertiary, marginBottom: 8 }]}>
            Simulates activity recreation: reload WebView then set content
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#c0392b' }]}
              onPress={handleReloadThenSetImmediate}
            >
              <Text style={styles.buttonText}>Reload → Set (0ms)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#e67e22' }]}
              onPress={handleReloadThenSet500}
            >
              <Text style={styles.buttonText}>Reload → Set (500ms)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#27ae60' }]}
              onPress={handleReloadThenWaitReady}
            >
              <Text style={styles.buttonText}>Reload → Wait Ready → Set</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#8e44ad' }]}
              onPress={handleReloadSetGetHTML}
            >
              <Text style={styles.buttonText}>Reload → Set → GetHTML</Text>
            </TouchableOpacity>
          </View>
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
          </View>
          <View style={[styles.buttonRow, { marginTop: 8 }]}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.border.dark }]}
              onPress={handleH1}
            >
              <Text style={[styles.buttonText, { fontWeight: 'bold' }]}>H1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.border.dark }]}
              onPress={handleH2}
            >
              <Text style={[styles.buttonText, { fontWeight: 'bold' }]}>H2</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.border.dark }]}
              onPress={handleH3}
            >
              <Text style={[styles.buttonText, { fontWeight: 'bold' }]}>H3</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Editor */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Editor (V2)</Text>
          <View style={[styles.editorContainer, { borderColor: theme.colors.border.light }]}>
            <RichTextEditorV2
              ref={editorRef}
              onChange={handleChange}
              onReady={handleReadyWrapped}
            />
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
    fontSize: 14,
    marginBottom: 4,
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
