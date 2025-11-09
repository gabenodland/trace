import { View, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

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
        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5}>
          <Path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
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
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5}>
          <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>

      {/* Save Button (Green Check) */}
      <TouchableOpacity
        style={[styles.fabSave, isSaving && styles.fabSaveDisabled]}
        onPress={onSave}
        activeOpacity={0.8}
        disabled={isSaving}
      >
        <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5}>
          <Path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
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
