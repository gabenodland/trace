/**
 * Template Editor Modal
 *
 * Full-screen modal for editing content templates with proper keyboard handling.
 * Uses pageSheet presentation with theme-aware styling.
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
  StatusBar,
} from "react-native";
import { TemplateHelpModal } from "./TemplateHelpModal";
import { Icon } from "../../../shared/components";
import { useTheme } from "../../../shared/contexts/ThemeContext";

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
  const theme = useTheme();
  const [localValue, setLocalValue] = useState(value);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Sync local value when modal opens
  useEffect(() => {
    if (visible) {
      setLocalValue(value);
    }
  }, [visible, value]);

  const handleSave = () => {
    onSave(localValue);
    onClose();
  };

  const handleCancel = () => {
    setLocalValue(value);
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.colors.background.primary, borderBottomColor: theme.colors.border.light }]}>
            <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
              <Text style={[styles.cancelText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Cancel</Text>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={[styles.headerTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>{title}</Text>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={() => setShowHelp(true)}
                style={styles.helpButton}
                activeOpacity={0.7}
              >
                <Icon name="HelpCircle" size={22} color={theme.colors.text.tertiary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                style={[styles.headerButton, !hasChanges && styles.headerButtonDisabled]}
                disabled={!hasChanges}
              >
                <Text style={[styles.saveText, { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.semibold }, !hasChanges && { color: theme.colors.text.disabled }]}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Editor */}
          <View style={styles.editorContainer}>
            <TextInput
              ref={inputRef}
              style={[styles.editor, { color: theme.colors.text.primary }]}
              value={localValue}
              onChangeText={setLocalValue}
              placeholder={placeholder}
              placeholderTextColor={theme.colors.text.tertiary}
              multiline
              textAlignVertical="top"
              autoCapitalize="sentences"
              autoCorrect={false}
              autoFocus
              scrollEnabled
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Help Modal */}
      <TemplateHelpModal
        visible={showHelp}
        onClose={() => setShowHelp(false)}
        mode="content"
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 16 : 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  },
  cancelText: {
    fontSize: 16,
  },
  saveText: {
    fontSize: 16,
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
    textAlignVertical: "top",
  },
});
