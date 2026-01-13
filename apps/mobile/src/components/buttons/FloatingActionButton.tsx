import { TouchableOpacity, Text, View, StyleSheet } from "react-native";
import { useTheme } from "../../shared/contexts/ThemeContext";

interface FloatingActionButtonProps {
  onPress: () => void;
}

export function FloatingActionButton({ onPress }: FloatingActionButtonProps) {
  const theme = useTheme();

  return (
    <View style={styles.container} pointerEvents="box-none">
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: theme.colors.functional.accent,
            shadowColor: theme.isDark ? '#000' : theme.colors.functional.accent,
          }
        ]}
        onPress={onPress}
      >
        <Text style={styles.buttonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  button: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  buttonText: {
    fontSize: 32,
    color: "#ffffff",
    fontWeight: "300",
  },
});
