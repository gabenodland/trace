/**
 * TypeConfigModal - Configure custom types for a stream
 * Uses a chip/tag pattern for managing the list of types
 */

import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  sortTypes,
  validateTypeName,
  MAX_TYPE_NAME_LENGTH,
} from "@trace/core";
import { Icon } from "../../../shared/components";
import { useTheme } from "../../../shared/contexts/ThemeContext";

interface TypeConfigModalProps {
  visible: boolean;
  onClose: () => void;
  types: string[];
  onSave: (types: string[]) => void;
}

export function TypeConfigModal({
  visible,
  onClose,
  types,
  onSave,
}: TypeConfigModalProps) {
  const theme = useTheme();
  const [localTypes, setLocalTypes] = useState<string[]>([]);
  const [newTypeName, setNewTypeName] = useState("");

  useEffect(() => {
    if (visible) {
      setLocalTypes(sortTypes(types));
      setNewTypeName("");
    }
  }, [visible, types]);

  const handleAddType = () => {
    const trimmed = newTypeName.trim();
    const validation = validateTypeName(trimmed);

    if (!validation.valid) {
      Alert.alert("Invalid Type", validation.error);
      return;
    }

    if (localTypes.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert("Duplicate Type", "This type already exists.");
      return;
    }

    setLocalTypes(sortTypes([...localTypes, trimmed]));
    setNewTypeName("");
  };

  const handleRemoveType = (index: number) => {
    setLocalTypes(localTypes.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(localTypes);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable
            style={[styles.modal, { backgroundColor: theme.colors.background.primary }]}
            onPress={e => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>Entry Types</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Icon name="X" size={20} color={theme.colors.text.tertiary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.subtitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
              Add types to categorize entries in this stream.
            </Text>

            {/* Add type input */}
            <View style={[styles.addRow, { backgroundColor: theme.colors.background.tertiary }]}>
              <TextInput
                style={[styles.input, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular }]}
                placeholder="Add a type..."
                placeholderTextColor={theme.colors.text.tertiary}
                value={newTypeName}
                onChangeText={setNewTypeName}
                maxLength={MAX_TYPE_NAME_LENGTH}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleAddType}
              />
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: newTypeName.trim() ? theme.colors.functional.accent : theme.colors.border.dark }]}
                onPress={handleAddType}
                disabled={!newTypeName.trim()}
                activeOpacity={0.7}
              >
                <Icon name="Plus" size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Chips container */}
            <View style={styles.chipsContainer}>
              {localTypes.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                  No types yet — add one above
                </Text>
              ) : (
                <View style={styles.chipsWrap}>
                  {localTypes.map((type, index) => (
                    <View
                      key={`${type}-${index}`}
                      style={[styles.chip, { backgroundColor: theme.colors.background.tertiary }]}
                    >
                      <Text style={[styles.chipText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
                        {type}
                      </Text>
                      <TouchableOpacity
                        style={styles.chipRemove}
                        onPress={() => handleRemoveType(index)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Icon name="X" size={14} color={theme.colors.text.tertiary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              {localTypes.length > 0 && (
                <TouchableOpacity
                  style={[styles.clearButton, { backgroundColor: theme.colors.background.tertiary }]}
                  onPress={() => {
                    Alert.alert(
                      "Clear All Types",
                      "Remove all types?",
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Clear All", style: "destructive", onPress: () => setLocalTypes([]) },
                      ]
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.clearButtonText, { color: theme.colors.functional.overdue, fontFamily: theme.typography.fontFamily.medium }]}>Clear All</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.colors.functional.accent }]}
                onPress={handleSave}
                activeOpacity={0.7}
              >
                <Text style={[styles.saveButtonText, { fontFamily: theme.typography.fontFamily.semibold }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    borderRadius: 14,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingLeft: 14,
    paddingRight: 4,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 15,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  chipsContainer: {
    minHeight: 60,
    marginBottom: 16,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  chipText: {
    fontSize: 14,
  },
  chipRemove: {
    padding: 2,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 16,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  clearButtonText: {
    fontSize: 15,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 15,
    color: "#ffffff",
  },
});
