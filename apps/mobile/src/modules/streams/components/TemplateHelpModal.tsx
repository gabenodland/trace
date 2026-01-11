/**
 * Template Help Modal
 *
 * Shows supported markdown syntax and variables for stream templates.
 */

import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { TEMPLATE_HELP } from "@trace/core";

interface TemplateHelpModalProps {
  visible: boolean;
  onClose: () => void;
  /** 'title' shows only variables, 'content' shows variables + markdown */
  mode?: 'title' | 'content';
}

export function TemplateHelpModal({ visible, onClose, mode = 'content' }: TemplateHelpModalProps) {
  const isTitle = mode === 'title';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{isTitle ? 'Title Variables' : 'Template Syntax'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Variables Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Variables</Text>
              <Text style={styles.sectionDescription}>
                These get replaced when a new entry is created:
              </Text>
              {TEMPLATE_HELP.variables.map((item) => (
                <View key={item.syntax} style={styles.row}>
                  <Text style={styles.syntax}>{item.syntax}</Text>
                  <Text style={styles.description}>{item.description}</Text>
                </View>
              ))}
            </View>

            {/* Markdown Section - only for content mode */}
            {!isTitle && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Formatting</Text>
                <Text style={styles.sectionDescription}>
                  Basic markdown supported in content:
                </Text>
                {TEMPLATE_HELP.markdown.map((item) => (
                  <View key={item.syntax} style={styles.row}>
                    <Text style={styles.syntax}>{item.syntax}</Text>
                    <Text style={styles.description}>{item.description}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Example Section - only for content mode */}
            {!isTitle && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Example Template</Text>
                <View style={styles.exampleBox}>
                  <Text style={styles.exampleText}>## {"{weekday}"} Tasks{"\n"}</Text>
                  <Text style={styles.exampleText}>[ ] Meditate{"\n"}</Text>
                  <Text style={styles.exampleText}>[ ] Walk 10K{"\n"}</Text>
                  <Text style={styles.exampleText}>{"\n"}</Text>
                  <Text style={styles.exampleText}>## {"{month_name}"} {"{day}"}, {"{year}"}{"\n"}</Text>
                  <Text style={styles.exampleText}>[ ]</Text>
                </View>
              </View>
            )}

            {/* Note */}
            <View style={styles.note}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                <Circle cx={12} cy={12} r={10} />
                <Path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
              </Svg>
              <Text style={styles.noteText}>
                Templates apply when creating a new empty entry in this stream.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
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
    backgroundColor: "#ffffff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
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
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  syntax: {
    width: 140,
    fontFamily: "monospace",
    fontSize: 13,
    color: "#3b82f6",
    fontWeight: "500",
  },
  description: {
    flex: 1,
    fontSize: 13,
    color: "#4b5563",
  },
  exampleBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  exampleText: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#374151",
    lineHeight: 18,
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginBottom: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: "#0369a1",
    lineHeight: 18,
  },
});
