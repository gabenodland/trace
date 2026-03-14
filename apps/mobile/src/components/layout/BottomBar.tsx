import { View, StyleSheet } from "react-native";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { themeBase } from "../../shared/theme/themeBase";

interface BottomBarProps {
  children: React.ReactNode;
  keyboardOffset?: number;
  /** Use inline (flex flow) positioning instead of absolute. For use inside sheets/modals. */
  inline?: boolean;
}

export function BottomBar({ children, keyboardOffset = 0, inline = false }: BottomBarProps) {
  const theme = useTheme();
  const isKeyboardVisible = keyboardOffset > 0;

  if (inline) {
    return (
      <>
        <View style={[
          styles.toolbar,
          { backgroundColor: theme.colors.background.secondary, borderTopColor: theme.colors.border.light },
        ]}>
          {children}
        </View>
        {isKeyboardVisible && <View style={{ height: keyboardOffset }} />}
      </>
    );
  }

  return (
    <View style={[styles.container, isKeyboardVisible && { bottom: keyboardOffset }]}>
      <View style={[
        styles.toolbar,
        { backgroundColor: theme.colors.background.secondary, borderTopColor: theme.colors.border.light },
        isKeyboardVisible && { paddingBottom: themeBase.spacing.md + 25 },
      ]}>
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
    gap: themeBase.spacing.sm,
  },
});
