/**
 * TypeConfigModal - Configure custom types for a stream
 * Allows adding, removing, and managing user-defined types
 */

import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Svg, { Path, Line } from "react-native-svg";
import { theme } from "../../../shared/theme/theme";
import {
  sortTypes,
  validateTypeName,
  MAX_TYPE_NAME_LENGTH,
} from "@trace/core";

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
  // Local state for editing
  const [localTypes, setLocalTypes] = useState<string[]>([]);
  const [newTypeName, setNewTypeName] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  // Reset local state when modal opens
  useEffect(() => {
    if (visible) {
      setLocalTypes(sortTypes(types));
      setNewTypeName("");
      setEditingIndex(null);
      setEditingValue("");
    }
  }, [visible, types]);

  const handleAddType = () => {
    const trimmed = newTypeName.trim();
    const validation = validateTypeName(trimmed);

    if (!validation.valid) {
      Alert.alert("Invalid Type", validation.error);
      return;
    }

    // Check for duplicates (case-insensitive)
    if (localTypes.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert("Duplicate Type", "This type already exists.");
      return;
    }

    setLocalTypes(sortTypes([...localTypes, trimmed]));
    setNewTypeName("");
  };

  const handleRemoveType = (index: number) => {
    const typeToRemove = localTypes[index];
    Alert.alert(
      "Remove Type",
      `Are you sure you want to remove "${typeToRemove}"? Entries with this type will show it as a legacy type.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setLocalTypes(localTypes.filter((_, i) => i !== index));
          },
        },
      ]
    );
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingValue(localTypes[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;

    const trimmed = editingValue.trim();
    const validation = validateTypeName(trimmed);

    if (!validation.valid) {
      Alert.alert("Invalid Type", validation.error);
      return;
    }

    // Check for duplicates (case-insensitive), excluding current item
    if (localTypes.some((t, i) =>
      i !== editingIndex && t.toLowerCase() === trimmed.toLowerCase()
    )) {
      Alert.alert("Duplicate Type", "This type already exists.");
      return;
    }

    const updated = [...localTypes];
    updated[editingIndex] = trimmed;
    setLocalTypes(sortTypes(updated));
    setEditingIndex(null);
    setEditingValue("");
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingValue("");
  };

  const handleSave = () => {
    onSave(localTypes);
    onClose();
  };

  const handleClear = () => {
    Alert.alert(
      "Clear All Types",
      "Are you sure you want to remove all types? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => setLocalTypes([]),
        },
      ]
    );
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
          <Pressable style={styles.modal} onPress={e => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Configure Types</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
                <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Add custom types for entries in this stream. Types are sorted alphabetically.
          </Text>

          {/* Add Type Input */}
          <View style={styles.addSection}>
            <TextInput
              style={styles.input}
              placeholder="New type name..."
              placeholderTextColor={theme.colors.text.tertiary}
              value={newTypeName}
              onChangeText={setNewTypeName}
              maxLength={MAX_TYPE_NAME_LENGTH}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleAddType}
            />
            <TouchableOpacity
              style={[
                styles.addButton,
                !newTypeName.trim() && styles.addButtonDisabled
              ]}
              onPress={handleAddType}
              disabled={!newTypeName.trim()}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
                <Line x1={12} y1={5} x2={12} y2={19} strokeLinecap="round" />
                <Line x1={5} y1={12} x2={19} y2={12} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Types List */}
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={true}>
            {localTypes.length === 0 ? (
              <View style={styles.emptyState}>
                <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={1.5}>
                  <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.emptyText}>No types configured</Text>
                <Text style={styles.emptySubtext}>Add types above to categorize entries</Text>
              </View>
            ) : (
              <View style={styles.typesList}>
                {localTypes.map((type, index) => (
                  <View key={`${type}-${index}`} style={styles.typeRow}>
                    {editingIndex === index ? (
                      // Edit mode
                      <View style={styles.editRow}>
                        <TextInput
                          style={styles.editInput}
                          value={editingValue}
                          onChangeText={setEditingValue}
                          maxLength={MAX_TYPE_NAME_LENGTH}
                          autoFocus
                          selectTextOnFocus
                          returnKeyType="done"
                          onSubmitEditing={handleSaveEdit}
                        />
                        <TouchableOpacity
                          style={styles.editActionButton}
                          onPress={handleSaveEdit}
                        >
                          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2}>
                            <Path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.editActionButton}
                          onPress={handleCancelEdit}
                        >
                          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2}>
                            <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
                            <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
                          </Svg>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      // Display mode
                      <>
                        {/* Bookmark icon */}
                        <View style={styles.typeIcon}>
                          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                            <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                        </View>

                        {/* Type name */}
                        <Text style={styles.typeLabel}>{type}</Text>

                        {/* Edit button */}
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleStartEdit(index)}
                          hitSlop={8}
                        >
                          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2}>
                            <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                            <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                        </TouchableOpacity>

                        {/* Delete button */}
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleRemoveType(index)}
                          hitSlop={8}
                        >
                          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2}>
                            <Path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            {localTypes.length > 0 && (
              <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
                <Text style={styles.clearButtonText}>Clear All</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.saveButton, localTypes.length === 0 && styles.saveButtonFullWidth]}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>Save</Text>
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
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  addSection: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: 15,
    color: theme.colors.text.primary,
  },
  addButton: {
    backgroundColor: "#3b82f6",
    borderRadius: theme.borderRadius.md,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonDisabled: {
    backgroundColor: "#9ca3af",
  },
  scrollView: {
    maxHeight: 280,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing.xs,
  },
  typesList: {
    gap: theme.spacing.xs,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  typeIcon: {
    width: 24,
    alignItems: "center",
  },
  typeLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
  },
  actionButton: {
    padding: 6,
  },
  editRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  editInput: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    fontSize: 15,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  editActionButton: {
    padding: 6,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  clearButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.secondary,
    alignItems: "center",
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: theme.typography.fontWeight.medium,
    color: "#ef4444",
  },
  saveButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: "#3b82f6",
    alignItems: "center",
  },
  saveButtonFullWidth: {
    flex: 2,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: theme.typography.fontWeight.semibold,
    color: "#ffffff",
  },
});
