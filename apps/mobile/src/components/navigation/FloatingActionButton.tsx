import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Icon } from "../../shared/components";

interface FloatingActionButtonProps {
  mode: "add" | "save";
  onAdd?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

export function FloatingActionButton({
  mode,
  onAdd,
  onSave,
  onCancel,
  isSaving = false,
}: FloatingActionButtonProps) {
  if (mode === "add") {
    return (
      <TouchableOpacity
        style={styles.fabAdd}
        onPress={onAdd}
        activeOpacity={0.8}
      >
        <Icon name="Plus" size={28} color="#ffffff" />
      </TouchableOpacity>
    );
  }

  // Save mode - show check and X buttons
  return (
    <View style={styles.fabContainer}>
      {/* Cancel Button (Red X) */}
      <TouchableOpacity
        style={styles.fabCancel}
        onPress={onCancel}
        activeOpacity={0.8}
      >
        <Icon name="X" size={24} color="#ffffff" />
      </TouchableOpacity>

      {/* Save Button (Green Check) */}
      <TouchableOpacity
        style={[styles.fabSave, isSaving && styles.fabSaveDisabled]}
        onPress={onSave}
        activeOpacity={0.8}
        disabled={isSaving}
      >
        <Icon name="Check" size={26} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: "absolute",
    bottom: 30,
    right: 20,
    flexDirection: "row",
    gap: 12,
  },
  fabAdd: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabCancel: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabSave: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabSaveDisabled: {
    opacity: 0.5,
  },
});
