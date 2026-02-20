import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert } from "react-native";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { createScopedLogger, LogScopes } from "../../../shared/utils/logger";
import { PickerBottomSheet } from "../../../components/sheets/PickerBottomSheet";

const log = createScopedLogger(LogScopes.Streams);

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
    if (isSubmitting) return;
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
      log.error("Failed to create stream", error);
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
    <PickerBottomSheet
      visible={visible}
      onClose={handleClose}
      title="New Stream"
      height="auto"
      dismissKeyboard={false}
      primaryAction={{ label: isSubmitting ? "Creating..." : "Create", onPress: handleSubmit }}
    >
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
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
});
