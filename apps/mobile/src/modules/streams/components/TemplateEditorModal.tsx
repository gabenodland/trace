/**
 * Template Editor Modal
 *
 * Full-screen modal for editing content templates with proper keyboard handling.
 */

import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from "react-native";
import { TemplateHelpModal } from "./TemplateHelpModal";
import { Icon } from "../../../shared/components";

interface TemplateEditorModalProps {
  visible: boolean;
  onClose: () => void;
  value: string;
  onSave: (value: string) => void;
  title?: string;
  placeholder?: string;
}

export function TemplateEditorModal({
  visible,
  onClose,
  value,
  onSave,
  title = "Content Template",
  placeholder = "## {weekday} Tasks\n[ ] Task 1\n[ ] Task 2\n\n## {month_name} {day}, {year}",
}: TemplateEditorModalProps) {
  const [localValue, setLocalValue] = useState(value);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Sync local value when modal opens
  useEffect(() => {
    if (visible) {
      setLocalValue(value);
      // Focus the input after a short delay to ensure modal is fully visible
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [visible, value]);

  const handleSave = () => {
    onSave(localValue);
    onClose();
  };

  const handleCancel = () => {
    setLocalValue(value); // Reset to original
    onClose();
  };

  const hasChanges = localValue !== value;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>{title}</Text>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={() => setShowHelp(true)}
                style={styles.helpButton}
                activeOpacity={0.7}
              >
                <Icon name="HelpCircle" size={22} color="#6b7280" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                style={[styles.headerButton, !hasChanges && styles.headerButtonDisabled]}
                disabled={!hasChanges}
              >
                <Text style={[styles.saveText, !hasChanges && styles.saveTextDisabled]}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Editor */}
          <View style={styles.editorContainer}>
            <TextInput
              ref={inputRef}
              style={styles.editor}
              value={localValue}
              onChangeText={setLocalValue}
              placeholder={placeholder}
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              autoCapitalize="sentences"
              autoCorrect={false}
              scrollEnabled
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Help Modal */}
      <TemplateHelpModal
        visible={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  headerButton: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    minWidth: 60,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 60,
    justifyContent: "flex-end",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1f2937",
  },
  cancelText: {
    fontSize: 16,
    color: "#6b7280",
  },
  saveText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3b82f6",
  },
  saveTextDisabled: {
    color: "#9ca3af",
  },
  helpButton: {
    padding: 4,
  },
  editorContainer: {
    flex: 1,
    padding: 16,
  },
  editor: {
    flex: 1,
    fontSize: 15,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 22,
    color: "#1f2937",
    textAlignVertical: "top",
  },
});
