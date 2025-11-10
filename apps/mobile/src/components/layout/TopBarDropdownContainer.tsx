import { useState, useEffect } from "react";
import { View, TouchableOpacity, StyleSheet, Dimensions, Keyboard, Platform } from "react-native";

interface TopBarDropdownContainerProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function TopBarDropdownContainer({ visible, onClose, children }: TopBarDropdownContainerProps) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  if (!visible) return null;

  const screenHeight = Dimensions.get("window").height;
  const maxDropdownHeight = screenHeight - 130 - keyboardHeight; // Account for keyboard

  return (
    <>
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Dropdown Content */}
      <View style={[styles.dropdown, { maxHeight: maxDropdownHeight }]}>
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
    elevation: 999, // Ensure backdrop renders above BottomBar (elevation: 50)
  },
  dropdown: {
    position: "absolute",
    top: 110,
    left: 16,
    right: 16,
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 1000, // Ensure dropdown renders above backdrop and toolbar
    zIndex: 1000,
    overflow: "hidden", // Prevent content from overflowing rounded corners
  },
});
