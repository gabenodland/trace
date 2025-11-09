import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { View, StyleSheet } from "react-native";
import {
  RichText,
  useEditorBridge,
  TenTapStartKit,
} from "@10play/tentap-editor";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export const RichTextEditor = forwardRef(({
  value,
  onChange,
  placeholder = "Start typing...",
}: RichTextEditorProps, ref) => {
  const isLocalChange = useRef(false);
  const lastContent = useRef(value);

  const editor = useEditorBridge({
    autofocus: true,
    avoidIosKeyboard: true,
    initialContent: value,
    bridgeExtensions: [
      ...TenTapStartKit,
    ],
  });

  useImperativeHandle(ref, () => ({
    toggleBold: () => editor.toggleBold(),
    toggleItalic: () => editor.toggleItalic(),
    toggleUnderline: () => editor.toggleUnderline(),
    toggleBulletList: () => editor.toggleBulletList(),
    toggleOrderedList: () => editor.toggleOrderedList(),
    toggleTaskList: () => editor.toggleTaskList(),
    indent: () => editor.sink(),
    outdent: () => editor.lift(),
  }));

  useEffect(() => {
    // Subscribe to content changes with debouncing
    const interval = setInterval(async () => {
      const html = await editor.getHTML();
      if (html !== lastContent.current) {
        lastContent.current = html;
        isLocalChange.current = true;
        onChange(html);
      }
    }, 300); // Poll every 300ms

    return () => {
      clearInterval(interval);
    };
  }, [editor, onChange]);

  // Update editor when value changes externally (not from typing)
  useEffect(() => {
    if (!isLocalChange.current && value && value !== lastContent.current) {
      editor.setContent(value);
      lastContent.current = value;
    }
    isLocalChange.current = false;
  }, [value, editor]);

  return (
    <View style={styles.container}>
      <RichText
        editor={editor}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
