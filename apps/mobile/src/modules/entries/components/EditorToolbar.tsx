/**
 * EditorToolbar - Bottom toolbar for rich text editing
 * Extracted from EntryScreen for maintainability
 */

import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { Icon } from "../../../shared/components";
import { styles } from "./EntryScreen.styles";

interface EditorToolbarProps {
  editorRef: React.RefObject<any>;
  onDone: () => void;
}

export function EditorToolbar({
  editorRef,
  onDone,
}: EditorToolbarProps) {
  const theme = useTheme();
  const iconColor = theme.colors.text.secondary;

  return (
    <View style={styles.fullScreenToolbar}>
      {/* Text formatting */}
      <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.toggleBold()}>
        <Icon name="Bold" size={18} color={iconColor} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.toggleItalic()}>
        <Icon name="Italic" size={18} color={iconColor} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.toggleHeading(1)}>
        <Text style={[styles.headingButtonText, { color: iconColor, fontFamily: theme.typography.fontFamily.bold }]}>H1</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.toggleHeading(2)}>
        <Text style={[styles.headingButtonText, { color: iconColor, fontFamily: theme.typography.fontFamily.bold }]}>H2</Text>
      </TouchableOpacity>

      <View style={[styles.toolbarDivider, { backgroundColor: theme.colors.border.light }]} />

      {/* List formatting */}
      <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.toggleBulletList()}>
        <Icon name="List" size={18} color={iconColor} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.toggleOrderedList()}>
        <Icon name="ListOrdered" size={18} color={iconColor} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.toggleTaskList()}>
        <Icon name="ListTodo" size={18} color={iconColor} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.indent()}>
        <Icon name="Indent" size={18} color={iconColor} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.outdent()}>
        <Icon name="Outdent" size={18} color={iconColor} />
      </TouchableOpacity>

      {/* Done button - green checkmark to exit edit mode */}
      <View style={[styles.toolbarDivider, { backgroundColor: theme.colors.border.light }]} />
      <TouchableOpacity
        style={styles.toolbarButton}
        onPress={onDone}
      >
        <Icon name="Check" size={20} color="#22c55e" />
      </TouchableOpacity>
    </View>
  );
}
