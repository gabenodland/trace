/**
 * EditorToolbar - Bottom toolbar for rich text editing
 *
 * Layout:
 * - Top bar: B, I, S, H1, H2 | [List] [Table] mode toggles | ✓ Done (right-aligned)
 * - List sub-bar: Bullet, Ordered, Task | Indent, Outdent
 * - Table sub-bar: +Table, +Col, +Row | -Col, -Row, Delete | Header
 *
 * Only one sub-bar open at a time. Mode toggles are visually distinct pill buttons.
 */

import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { Icon } from "../../../shared/components";
import type { RichTextEditorV2Ref } from "../../../components/editor/RichTextEditorV2";

type SubBar = 'none' | 'list' | 'table';

interface EditorToolbarProps {
  editorRef: React.RefObject<RichTextEditorV2Ref | null>;
  onDone: () => void;
  /** When true, block-level buttons (H1, H2, lists) are disabled */
  isInTableCell?: boolean;
}

export function EditorToolbar({ editorRef, onDone, isInTableCell = false }: EditorToolbarProps) {
  const theme = useTheme();
  const [activeSubBar, setActiveSubBar] = useState<SubBar>('none');
  const iconColor = theme.colors.text.secondary;
  const activeColor = theme.colors.functional.accent;
  const disabledColor = theme.colors.text.disabled;

  const toggleSubBar = (bar: SubBar) => {
    setActiveSubBar(prev => prev === bar ? 'none' : bar);
  };

  // Close list sub-bar when entering a table cell
  useEffect(() => {
    if (isInTableCell) {
      setActiveSubBar(prev => prev === 'list' ? 'none' : prev);
    }
  }, [isInTableCell]);

  return (
    <View style={s.container}>
      {/* Top bar - always visible */}
      <View style={s.topRow}>
        {/* Format buttons */}
        <TouchableOpacity style={s.btn} onPress={() => editorRef.current?.toggleBold()} accessibilityLabel="Bold" accessibilityRole="button">
          <Icon name="Bold" size={18} color={iconColor} />
        </TouchableOpacity>
        <TouchableOpacity style={s.btn} onPress={() => editorRef.current?.toggleItalic()} accessibilityLabel="Italic" accessibilityRole="button">
          <Icon name="Italic" size={18} color={iconColor} />
        </TouchableOpacity>
        <TouchableOpacity style={s.btn} onPress={() => editorRef.current?.toggleStrikethrough()} accessibilityLabel="Strikethrough" accessibilityRole="button">
          <Icon name="Strikethrough" size={18} color={iconColor} />
        </TouchableOpacity>
        <TouchableOpacity style={s.btn} onPress={() => editorRef.current?.toggleHeading(1)} disabled={isInTableCell} accessibilityLabel="Heading 1" accessibilityRole="button">
          <Text style={[s.headingText, { color: isInTableCell ? disabledColor : iconColor, fontFamily: theme.typography.fontFamily.bold }]}>H1</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btn} onPress={() => editorRef.current?.toggleHeading(2)} disabled={isInTableCell} accessibilityLabel="Heading 2" accessibilityRole="button">
          <Text style={[s.headingText, { color: isInTableCell ? disabledColor : iconColor, fontFamily: theme.typography.fontFamily.bold }]}>H2</Text>
        </TouchableOpacity>

        <View style={[s.divider, { backgroundColor: theme.colors.border.medium }]} />

        {/* Mode toggle pills */}
        <TouchableOpacity
          style={[
            s.modePill,
            { borderColor: activeSubBar === 'list' ? activeColor : theme.colors.border.dark },
            activeSubBar === 'list' && { backgroundColor: theme.colors.functional.accentLight },
            isInTableCell && { opacity: 0.4 },
          ]}
          onPress={() => toggleSubBar('list')}
          disabled={isInTableCell}
          accessibilityLabel="List tools"
          accessibilityRole="button"
          accessibilityState={{ expanded: activeSubBar === 'list' }}
        >
          <Icon name="List" size={14} color={activeSubBar === 'list' ? activeColor : iconColor} />
          <Text style={[s.modeLabel, { color: activeSubBar === 'list' ? activeColor : iconColor }]}>List</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            s.modePill,
            { borderColor: activeSubBar === 'table' ? activeColor : theme.colors.border.dark },
            activeSubBar === 'table' && { backgroundColor: theme.colors.functional.accentLight },
          ]}
          onPress={() => toggleSubBar('table')}
          accessibilityLabel="Table tools"
          accessibilityRole="button"
          accessibilityState={{ expanded: activeSubBar === 'table' }}
        >
          <Icon name="Table2" size={14} color={activeSubBar === 'table' ? activeColor : iconColor} />
          <Text style={[s.modeLabel, { color: activeSubBar === 'table' ? activeColor : iconColor }]}>Table</Text>
        </TouchableOpacity>

        {/* Done - pushed to far right */}
        <View style={s.spacer} />
        <TouchableOpacity style={s.btn} onPress={onDone} accessibilityLabel="Done" accessibilityRole="button">
          <Icon name="Check" size={20} color={theme.colors.functional.complete} />
        </TouchableOpacity>
      </View>

      {/* List sub-bar */}
      {activeSubBar === 'list' && (
        <View style={[s.subBar, { backgroundColor: theme.colors.background.tertiary, borderTopColor: theme.colors.border.light }]}>
          <TouchableOpacity style={s.subBtn} onPress={() => editorRef.current?.toggleBulletList()} accessibilityLabel="Bullet list" accessibilityRole="button">
            <Icon name="List" size={16} color={iconColor} />
          </TouchableOpacity>
          <TouchableOpacity style={s.subBtn} onPress={() => editorRef.current?.toggleOrderedList()} accessibilityLabel="Numbered list" accessibilityRole="button">
            <Icon name="ListOrdered" size={16} color={iconColor} />
          </TouchableOpacity>
          <TouchableOpacity style={s.subBtn} onPress={() => editorRef.current?.toggleTaskList()} accessibilityLabel="Task list" accessibilityRole="button">
            <Icon name="ListTodo" size={16} color={iconColor} />
          </TouchableOpacity>
          <View style={[s.subDivider, { backgroundColor: theme.colors.border.medium }]} />
          <TouchableOpacity style={s.subBtn} onPress={() => editorRef.current?.indent()} accessibilityLabel="Indent" accessibilityRole="button">
            <Icon name="Indent" size={16} color={iconColor} />
          </TouchableOpacity>
          <TouchableOpacity style={s.subBtn} onPress={() => editorRef.current?.outdent()} accessibilityLabel="Outdent" accessibilityRole="button">
            <Icon name="Outdent" size={16} color={iconColor} />
          </TouchableOpacity>
        </View>
      )}

      {/* Table sub-bar */}
      {activeSubBar === 'table' && (
        <View style={[s.subBar, { backgroundColor: theme.colors.background.tertiary, borderTopColor: theme.colors.border.light }]}>
          <TouchableOpacity style={s.subBtn} onPress={() => editorRef.current?.insertTable()} disabled={isInTableCell} accessibilityLabel="Insert table" accessibilityRole="button">
            <Icon name="Grid2x2Plus" size={15} color={isInTableCell ? disabledColor : iconColor} />
          </TouchableOpacity>
          <TouchableOpacity style={s.subBtn} onPress={() => editorRef.current?.addColumnAfter()} accessibilityLabel="Add column" accessibilityRole="button">
            <Icon name="BetweenVerticalEnd" size={15} color={iconColor} />
          </TouchableOpacity>
          <TouchableOpacity style={s.subBtn} onPress={() => editorRef.current?.addRowAfter()} accessibilityLabel="Add row" accessibilityRole="button">
            <Icon name="BetweenHorizontalEnd" size={15} color={iconColor} />
          </TouchableOpacity>
          <View style={[s.subDivider, { backgroundColor: theme.colors.border.medium }]} />
          <TouchableOpacity style={s.subBtn} onPress={() => editorRef.current?.deleteColumn()} accessibilityLabel="Delete column" accessibilityRole="button">
            <Icon name="TableColumnsSplit" size={15} color={iconColor} />
          </TouchableOpacity>
          <TouchableOpacity style={s.subBtn} onPress={() => editorRef.current?.deleteRow()} accessibilityLabel="Delete row" accessibilityRole="button">
            <Icon name="TableRowsSplit" size={15} color={iconColor} />
          </TouchableOpacity>
          <TouchableOpacity style={s.subBtn} onPress={() => editorRef.current?.deleteTable()} accessibilityLabel="Delete table" accessibilityRole="button">
            <Icon name="Trash2" size={15} color={theme.colors.functional.overdue} />
          </TouchableOpacity>
          <View style={[s.subDivider, { backgroundColor: theme.colors.border.medium }]} />
          <TouchableOpacity style={s.subBtn} onPress={() => editorRef.current?.toggleHeaderRow()} accessibilityLabel="Toggle header row" accessibilityRole="button">
            <Icon name="PanelTop" size={15} color={iconColor} />
          </TouchableOpacity>
          <TouchableOpacity style={s.subBtn} onPress={() => editorRef.current?.toggleHeaderColumn()} accessibilityLabel="Toggle header column" accessibilityRole="button">
            <Icon name="PanelLeft" size={15} color={iconColor} />
          </TouchableOpacity>
          <View style={[s.subDivider, { backgroundColor: theme.colors.border.medium }]} />
          <TouchableOpacity style={s.subBtn} onPress={() => editorRef.current?.goToPreviousCell()} accessibilityLabel="Previous cell" accessibilityRole="button">
            <Icon name="ArrowLeftToLine" size={15} color={iconColor} />
          </TouchableOpacity>
          <TouchableOpacity style={s.subBtn} onPress={() => editorRef.current?.goToNextCell()} accessibilityLabel="Next cell" accessibilityRole="button">
            <Icon name="ArrowRightToLine" size={15} color={iconColor} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  divider: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
  },
  headingText: {
    fontSize: 12,
    fontWeight: "600",
  },
  // Mode toggle pills - visually distinct from regular buttons
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  modeLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  spacer: {
    flex: 1,
  },
  // Sub-bar - distinct visual layer
  subBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderTopWidth: 1,
    borderRadius: 8,
  },
  subBtn: {
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 6,
  },
  subDivider: {
    width: 1,
    height: 14,
    marginHorizontal: 4,
  },
});
