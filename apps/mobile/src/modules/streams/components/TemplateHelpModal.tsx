/**
 * Template Help Modal
 *
 * Shows supported markdown syntax and variables for stream templates.
 */

import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Pressable, Platform } from "react-native";
import { TEMPLATE_HELP } from "@trace/core";
import { Icon } from "../../../shared/components";
import { useTheme } from "../../../shared/contexts/ThemeContext";

interface TemplateHelpModalProps {
  visible: boolean;
  onClose: () => void;
  /** 'title' shows only variables, 'content' shows variables + markdown */
  mode?: 'title' | 'content';
}

export function TemplateHelpModal({ visible, onClose, mode = 'content' }: TemplateHelpModalProps) {
  const theme = useTheme();
  const isTitle = mode === 'title';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.modal, { backgroundColor: theme.colors.background.primary }]}
          onPress={e => e.stopPropagation()}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border.light }]}>
            <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
              {isTitle ? 'Title Variables' : 'Template Syntax'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="X" size={20} color={theme.colors.text.tertiary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Variables Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>Variables</Text>
              <Text style={[styles.sectionDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                These get replaced when a new entry is created:
              </Text>
              {TEMPLATE_HELP.variables.map((item) => (
                <View key={item.syntax} style={[styles.row, { borderBottomColor: theme.colors.border.light }]}>
                  <Text style={[styles.syntax, { color: theme.colors.functional.accent }]}>{item.syntax}</Text>
                  <Text style={[styles.description, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>{item.description}</Text>
                </View>
              ))}
            </View>

            {/* Markdown Section - only for content mode */}
            {!isTitle && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>Formatting</Text>
                <Text style={[styles.sectionDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                  Basic markdown supported in content:
                </Text>
                {TEMPLATE_HELP.markdown.map((item) => (
                  <View key={item.syntax} style={[styles.row, { borderBottomColor: theme.colors.border.light }]}>
                    <Text style={[styles.syntax, { color: theme.colors.functional.accent }]}>{item.syntax}</Text>
                    <Text style={[styles.description, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>{item.description}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Example Section - only for content mode */}
            {!isTitle && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>Example Template</Text>
                <View style={[styles.exampleBox, { backgroundColor: theme.colors.background.tertiary, borderColor: theme.colors.border.light }]}>
                  <Text style={[styles.exampleText, { color: theme.colors.text.primary }]}>## {"{weekday}"} Tasks{"\n"}</Text>
                  <Text style={[styles.exampleText, { color: theme.colors.text.primary }]}>[ ] Meditate{"\n"}</Text>
                  <Text style={[styles.exampleText, { color: theme.colors.text.primary }]}>[ ] Walk 10K{"\n"}</Text>
                  <Text style={[styles.exampleText, { color: theme.colors.text.primary }]}>{"\n"}</Text>
                  <Text style={[styles.exampleText, { color: theme.colors.text.primary }]}>## {"{month_name}"} {"{day}"}, {"{year}"}{"\n"}</Text>
                  <Text style={[styles.exampleText, { color: theme.colors.text.primary }]}>[ ]</Text>
                </View>
              </View>
            )}

            {/* Note */}
            <View style={[styles.note, { backgroundColor: theme.colors.background.tertiary }]}>
              <Icon name="Info" size={16} color={theme.colors.text.tertiary} />
              <Text style={[styles.noteText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                Templates apply when creating a new empty entry in this stream.
              </Text>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    borderRadius: 14,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  syntax: {
    width: 140,
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  description: {
    flex: 1,
    fontSize: 13,
  },
  exampleBox: {
    borderRadius: 8,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  exampleText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
    lineHeight: 18,
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginBottom: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
