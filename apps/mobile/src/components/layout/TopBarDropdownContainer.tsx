import { View, TouchableOpacity, StyleSheet } from "react-native";

interface TopBarDropdownContainerProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function TopBarDropdownContainer({ visible, onClose, children }: TopBarDropdownContainerProps) {
  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Dropdown Content */}
      <View style={styles.dropdown}>
        {children}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    zIndex: 999,
  },
  dropdown: {
    position: "absolute",
    top: 110,
    left: 16,
    right: 16,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    maxHeight: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
});
