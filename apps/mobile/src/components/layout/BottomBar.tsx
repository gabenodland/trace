import { View, StyleSheet } from "react-native";
import { theme } from "../../shared/theme/theme";

interface BottomBarProps {
  children: React.ReactNode;
  keyboardOffset?: number;
}

export function BottomBar({ children, keyboardOffset = 0 }: BottomBarProps) {
  return (
    <View style={[styles.container, keyboardOffset > 0 && { bottom: keyboardOffset + 25 }]}>
      <View style={styles.toolbar}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    elevation: 50,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: "#f9fafb",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
});
