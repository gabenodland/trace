import { View, StyleSheet } from "react-native";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { themeBase } from "../../shared/theme/themeBase";

interface BottomBarProps {
  children: React.ReactNode;
  keyboardOffset?: number;
}

export function BottomBar({ children, keyboardOffset = 0 }: BottomBarProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, keyboardOffset > 0 && { bottom: keyboardOffset + 25 }]}>
      <View style={[styles.toolbar, { backgroundColor: theme.colors.background.secondary, borderTopColor: theme.colors.border.light }]}>
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
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.lg,
    borderTopWidth: 1,
  },
});
