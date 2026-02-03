/**
 * EditorToolbar - Bottom toolbar for rich text editing
 * Extracted from EntryScreen for maintainability
 */

import { View, Text, TouchableOpacity } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { useTheme } from "../../../shared/contexts/ThemeContext";
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
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2.5}>
          <Path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.toggleItalic()}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2}>
          <Line x1={19} y1={4} x2={10} y2={4} strokeLinecap="round" />
          <Line x1={14} y1={20} x2={5} y2={20} strokeLinecap="round" />
          <Line x1={15} y1={4} x2={9} y2={20} strokeLinecap="round" />
        </Svg>
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
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2}>
          <Line x1={9} y1={6} x2={20} y2={6} strokeLinecap="round" />
          <Line x1={9} y1={12} x2={20} y2={12} strokeLinecap="round" />
          <Line x1={9} y1={18} x2={20} y2={18} strokeLinecap="round" />
          <Circle cx={5} cy={6} r={1} fill={iconColor} />
          <Circle cx={5} cy={12} r={1} fill={iconColor} />
          <Circle cx={5} cy={18} r={1} fill={iconColor} />
        </Svg>
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.toggleOrderedList()}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2}>
          <Line x1={10} y1={6} x2={21} y2={6} strokeLinecap="round" />
          <Line x1={10} y1={12} x2={21} y2={12} strokeLinecap="round" />
          <Line x1={10} y1={18} x2={21} y2={18} strokeLinecap="round" />
          <Path d="M4 6h1v4M3 10h3M3 14.5a1.5 1.5 0 011.5-1.5h.5l-2 3h3" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.toggleTaskList()}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2}>
          <Path d="M3 5h4v4H3zM3 14h4v4H3z" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M4 7l1 1 2-2" strokeLinecap="round" strokeLinejoin="round" />
          <Line x1={10} y1={7} x2={21} y2={7} strokeLinecap="round" />
          <Line x1={10} y1={16} x2={21} y2={16} strokeLinecap="round" />
        </Svg>
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.indent()}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2}>
          <Path d="M3 9l4 3-4 3" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M9 4h12M9 8h12M9 12h12M9 16h12M9 20h12" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={() => editorRef.current?.outdent()}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2}>
          <Path d="M7 9l-4 3 4 3" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M9 4h12M9 8h12M9 12h12M9 16h12M9 20h12" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>

      {/* Done button - green checkmark to exit edit mode */}
      <View style={[styles.toolbarDivider, { backgroundColor: theme.colors.border.light }]} />
      <TouchableOpacity
        style={styles.toolbarButton}
        onPress={onDone}
      >
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={3}>
          <Path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>
    </View>
  );
}
