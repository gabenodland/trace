/**
 * Template Editor Modal
 *
 * Full-screen sheet for editing content templates with proper keyboard handling.
 * Uses PickerBottomSheet with height="full" for consistent overlay behavior.
 */

import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
} from "react-native";
import { TemplateHelpModal } from "./TemplateHelpModal";
import { Icon } from "../../../shared/components";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { PickerBottomSheet } from "../../../components/sheets/PickerBottomSheet";

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
    <>
      <PickerBottomSheet
        visible={visible}
        onClose={handleCancel}
        title={title}
        height="full"
        swipeArea="grabber"
        dismissKeyboard={false}
        primaryAction={{ label: hasChanges ? "Save" : "Done", onPress: hasChanges ? handleSave : handleCancel }}
      >
        {/* Help button */}
        <TouchableOpacity
          onPress={() => setShowHelp(true)}
          style={styles.helpButton}
          activeOpacity={0.7}
        >
          <Icon name="HelpCircle" size={20} color={theme.colors.text.tertiary} />
          <Text style={[styles.helpText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
            Syntax Help
          </Text>
        </TouchableOpacity>

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
      </PickerBottomSheet>

      {/* Help Modal (nested) */}
      <TemplateHelpModal
        visible={showHelp}
        onClose={() => setShowHelp(false)}
        mode="content"
      />
    </>
  );
}

const styles = StyleSheet.create({
  helpButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
  },
  editorContainer: {
    flex: 1,
  },
  editor: {
    flex: 1,
    fontSize: 15,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 22,
    textAlignVertical: "top",
  },
});
