import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Platform, StatusBar } from "react-native";

interface ScrollDebugData {
  scrollOffset: number;
  cursorY: number;
  hasCursorPosition: boolean;
  lastCursorUpdate: number;
  keyboardHeight: number;
  editorTop?: number;
  editorHeight?: number;
  visibleTop: number;
  visibleBottom: number;
  cursorScreenY?: number;
}

interface ScrollDebugOverlayProps {
  data: ScrollDebugData;
  visible?: boolean;
  onScrollToTop?: () => void;
  onResetEditorScroll?: () => void;
  onLogStats?: () => void;
}

export function ScrollDebugOverlay({ data, visible = true, onScrollToTop, onResetEditorScroll, onLogStats }: ScrollDebugOverlayProps) {
  if (!visible) return null;

  const now = Date.now();
  const cursorAge = now - data.lastCursorUpdate;
  const cursorAgeStr = cursorAge > 1000 ? `${(cursorAge / 1000).toFixed(1)}s` : `${cursorAge}ms`;

  // Determine cursor status
  const cursorStatus = !data.hasCursorPosition
    ? "NEVER"
    : cursorAge > 5000
      ? "STALE"
      : cursorAge > 1000
        ? "OLD"
        : "FRESH";

  const cursorColor =
    cursorStatus === "FRESH" ? "#4CAF50" :
    cursorStatus === "OLD" ? "#FF9800" :
    cursorStatus === "STALE" ? "#F44336" : "#9E9E9E";

  // Calculate where cursor would be on screen
  // On Android, measureInWindow gives window coords but View uses screen coords
  // Add status bar height to align coordinate systems
  const statusBarH = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;
  const cursorOnScreen = data.editorTop !== undefined
    ? data.editorTop + data.cursorY + statusBarH
    : null;

  // Check if cursor is in visible range
  const inRange = cursorOnScreen !== null &&
    cursorOnScreen >= data.visibleTop &&
    cursorOnScreen <= data.visibleBottom;

  const logStats = () => {
    // Call parent to log with fresh measurements
    if (onLogStats) {
      onLogStats();
    } else {
      // Fallback: log current (possibly stale) data
      const stats = `[DEBUG] scroll=${Math.round(data.scrollOffset)} kb=${Math.round(data.keyboardHeight)} cursorY=${Math.round(data.cursorY)} age=${cursorAgeStr} editorTop=${Math.round(data.editorTop || 0)} editorH=${Math.round(data.editorHeight || 0)} cursorScreen=${cursorOnScreen !== null ? Math.round(cursorOnScreen) : '?'} visRange=${Math.round(data.visibleTop)}-${Math.round(data.visibleBottom)} inRange=${inRange}`;
      console.log(stats);
    }
  };

  return (
    <Pressable style={styles.container} onPress={logStats}>
      <View style={styles.header}>
        <Text style={styles.title}>DEBUG</Text>
        <View style={styles.buttonRow}>
          {onScrollToTop && (
            <TouchableOpacity style={styles.scrollTopButton} onPress={onScrollToTop}>
              <Text style={styles.scrollTopText}>TOP</Text>
            </TouchableOpacity>
          )}
          {onResetEditorScroll && (
            <TouchableOpacity style={[styles.scrollTopButton, styles.resetButton]} onPress={onResetEditorScroll}>
              <Text style={styles.scrollTopText}>RESET</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Parent Scroll</Text>
        <Text style={styles.value}>{Math.round(data.scrollOffset)}px</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Keyboard</Text>
        <Text style={[styles.value, data.keyboardHeight > 0 && styles.active]}>
          {data.keyboardHeight > 0 ? `${Math.round(data.keyboardHeight)}px` : "hidden"}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.label}>Cursor Y (in editor)</Text>
        <Text style={[styles.value, { color: cursorColor }]}>
          {Math.round(data.cursorY)}px
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Cursor Age</Text>
        <Text style={[styles.value, { color: cursorColor }]}>
          {cursorAgeStr} ({cursorStatus})
        </Text>
      </View>

      {data.editorTop !== undefined && (
        <>
          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.label}>Editor Top</Text>
            <Text style={styles.value}>{Math.round(data.editorTop)}px</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Editor Height</Text>
            <Text style={styles.value}>{Math.round(data.editorHeight || 0)}px</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Cursor Screen Y</Text>
            <Text style={[styles.value, inRange ? styles.visible : styles.hidden]}>
              {cursorOnScreen !== null ? Math.round(cursorOnScreen) : "?"}px
            </Text>
          </View>
        </>
      )}

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.label}>Visible Range</Text>
        <Text style={styles.value}>
          {Math.round(data.visibleTop)} - {Math.round(data.visibleBottom)}
        </Text>
      </View>

      <View style={[styles.indicator, inRange ? styles.indicatorVisible : styles.indicatorHidden]}>
        <Text style={styles.indicatorText}>
          {inRange ? "CURSOR VISIBLE" : "CURSOR HIDDEN"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 100,
    right: 10,
    width: 180,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    borderRadius: 8,
    padding: 8,
    zIndex: 9999,
  },
  header: {
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.2)",
    paddingBottom: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 4,
  },
  scrollTopButton: {
    backgroundColor: "rgba(76, 175, 80, 0.5)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  resetButton: {
    backgroundColor: "rgba(244, 67, 54, 0.5)",
  },
  scrollTopText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "bold",
  },
  section: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  label: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 9,
  },
  value: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  active: {
    color: "#4CAF50",
  },
  visible: {
    color: "#4CAF50",
  },
  hidden: {
    color: "#F44336",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: 4,
  },
  indicator: {
    marginTop: 6,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: "center",
  },
  indicatorVisible: {
    backgroundColor: "rgba(76, 175, 80, 0.3)",
  },
  indicatorHidden: {
    backgroundColor: "rgba(244, 67, 54, 0.3)",
  },
  indicatorText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
});
