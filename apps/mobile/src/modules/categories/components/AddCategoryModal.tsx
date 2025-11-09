import { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Modal, ScrollView, Alert } from "react-native";
import type { CategoryWithPath } from "@trace/core";
import Svg, { Path } from "react-native-svg";

interface AddCategoryModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, parentId: string | null) => Promise<void>;
  categories: CategoryWithPath[];
}

export function AddCategoryModal({ visible, onClose, onSubmit, categories }: AddCategoryModalProps) {
  const [name, setName] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedParent = categories.find(c => c.category_id === selectedParentId);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a category name");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(name.trim(), selectedParentId);
      setName("");
      setSelectedParentId(null);
      onClose();
    } catch (error) {
      console.error("Failed to create category:", error);
      Alert.alert("Error", `Failed to create category: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName("");
    setSelectedParentId(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>New Category</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                <Path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Category Name Input */}
            <View style={styles.field}>
              <Text style={styles.label}>Category Name *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g., Groceries, Work, Exercise"
                placeholderTextColor="#9ca3af"
                style={styles.input}
                autoFocus
                editable={!isSubmitting}
              />
            </View>

            {/* Parent Category Selection */}
            <View style={styles.field}>
              <Text style={styles.label}>Parent Category (Optional)</Text>
              <Text style={styles.hint}>
                Leave blank to create a top-level category
              </Text>

              {selectedParent ? (
                <TouchableOpacity
                  style={styles.selectedParent}
                  onPress={() => !isSubmitting && setSelectedParentId(null)}
                  disabled={isSubmitting}
                >
                  <View style={styles.selectedParentContent}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                      <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.selectedParentText}>{selectedParent.display_path}</Text>
                  </View>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2}>
                    <Path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
              ) : (
                <Text style={styles.noParent}>No parent selected (top-level category)</Text>
              )}

              {categories.length > 0 && !selectedParent && (
                <ScrollView
                  style={styles.categoryList}
                  nestedScrollEnabled={true}
                >
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category.category_id}
                      style={styles.categoryItem}
                      onPress={() => !isSubmitting && setSelectedParentId(category.category_id)}
                      disabled={isSubmitting}
                    >
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                        <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={styles.categoryItemText}>{category.display_path}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.cancelButton}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              disabled={isSubmitting || !name.trim()}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? "Creating..." : "Create"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#111827",
  },
  selectedParent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#dbeafe",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#93c5fd",
  },
  selectedParentContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  selectedParentText: {
    fontSize: 14,
    color: "#1e40af",
    fontWeight: "500",
  },
  noParent: {
    fontSize: 14,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  categoryList: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    maxHeight: 200,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  categoryItemText: {
    fontSize: 14,
    color: "#374151",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#3b82f6",
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});
