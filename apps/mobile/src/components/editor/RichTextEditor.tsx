import { useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import {
  RichText,
  Toolbar,
  useEditorBridge,
  TenTapStartKit,
  CoreBridge,
} from "@10play/tentap-editor";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
}: RichTextEditorProps) {
  const editor = useEditorBridge({
    autofocus: true,
    avoidIosKeyboard: true,
    initialContent: value,
    bridgeExtensions: [
      ...TenTapStartKit,
    ],
  });

  useEffect(() => {
    // Subscribe to content changes
    const interval = setInterval(() => {
      editor.getHTML().then((html) => {
        onChange(html);
      });
    }, 500); // Update every 500ms

    return () => {
      clearInterval(interval);
    };
  }, [editor, onChange]);

  // Update editor when value changes externally
  useEffect(() => {
    if (value && value !== "") {
      editor.setContent(value);
    }
  }, [value]);

  return (
    <View style={styles.container}>
      {/* Rich Text Editor */}
      <View style={styles.editor}>
        <RichText editor={editor} />
      </View>

      {/* Formatting Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarRow}>
          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={() => editor.toggleBold()}
          >
            <Text style={styles.toolbarButtonText}>B</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={() => editor.toggleItalic()}
          >
            <Text style={[styles.toolbarButtonText, styles.italic]}>I</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={() => editor.toggleBulletList()}
          >
            <Text style={styles.toolbarButtonText}>• List</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={() => editor.toggleOrderedList()}
          >
            <Text style={styles.toolbarButtonText}>1. List</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    overflow: "hidden",
  },
  editor: {
    flex: 1,
    minHeight: 200,
    padding: 16,
  },
  toolbar: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  toolbarButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  toolbarButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  italic: {
    fontStyle: "italic",
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: "#d1d5db",
    marginHorizontal: 4,
  },
});
