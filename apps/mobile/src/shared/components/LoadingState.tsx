/**
 * LoadingState - Shared loading indicator primitive
 *
 * Centered ActivityIndicator with optional message text.
 */

import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { themeBase } from "../theme/themeBase";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message }: LoadingStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.text.tertiary} />
      {message && (
        <Text
          style={[
            styles.message,
            {
              color: theme.colors.text.secondary,
              fontFamily: theme.typography.fontFamily.regular,
            },
          ]}
        >
          {message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: themeBase.spacing.xxl,
  },
  message: {
    marginTop: themeBase.spacing.md,
    fontSize: 14,
  },
});
