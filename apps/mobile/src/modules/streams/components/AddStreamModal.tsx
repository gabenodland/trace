import { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Modal, ScrollView, Alert } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../../../shared/contexts/ThemeContext";

interface AddStreamModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export function AddStreamModal({ visible, onClose, onSubmit }: AddStreamModalProps) {
  const theme = useTheme();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a stream name");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(name.trim());
      setName("");
      onClose();
    } catch (error) {
      console.error("Failed to create stream:", error);
      Alert.alert("Error", `Failed to create stream: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName("");
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
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background.primary }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border.light }]}>
            <Text style={[styles.headerTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]}>New Stream</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.secondary} strokeWidth={2}>
                <Path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Stream Name Input */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.semibold }]}>Stream Name *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g., Work, Personal, Ideas"
                placeholderTextColor={theme.colors.text.tertiary}
                style={[styles.input, { borderColor: theme.colors.border.medium, color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular }]}
                autoFocus
                editable={!isSubmitting}
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: theme.colors.border.light }]}>
            <TouchableOpacity
              onPress={handleClose}
              style={[styles.cancelButton, { borderColor: theme.colors.border.medium }]}
              disabled={isSubmitting}
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.semibold }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.submitButton, { backgroundColor: theme.colors.functional.accent }, isSubmitting && styles.submitButtonDisabled]}
              disabled={isSubmitting || !name.trim()}
            >
              <Text style={[styles.submitButtonText, { fontFamily: theme.typography.fontFamily.semibold }]}>
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
  },
  headerTitle: {
    fontSize: 20,
    // Note: fontWeight removed - use fontFamily with weight variant instead
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
    // Note: fontWeight removed - use fontFamily with weight variant instead
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    // Note: fontWeight removed - use fontFamily with weight variant instead
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    // Note: fontWeight removed - use fontFamily with weight variant instead
    color: "#ffffff",
  },
});
