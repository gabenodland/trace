/**
 * EmptyState - Shared empty state primitive
 *
 * Centered layout: optional icon → title → optional subtitle → optional action button
 */

import { View, Text, StyleSheet } from "react-native";
import { Icon, type IconName } from "./Icon";
import { Button } from "./Button";
import { useTheme } from "../contexts/ThemeContext";
import { themeBase } from "../theme/themeBase";

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({ title, subtitle, icon, action }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {icon && (
        <Icon name={icon} size={48} color={theme.colors.text.tertiary} />
      )}
      <Text
        style={[
          styles.title,
          {
            color: theme.colors.text.primary,
            fontFamily: theme.typography.fontFamily.semibold,
          },
        ]}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={[
            styles.subtitle,
            {
              color: theme.colors.text.secondary,
              fontFamily: theme.typography.fontFamily.regular,
            },
          ]}
        >
          {subtitle}
        </Text>
      )}
      {action && (
        <View style={styles.actionContainer}>
          <Button label={action.label} onPress={action.onPress} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    padding: themeBase.spacing.xxxl,
    gap: themeBase.spacing.sm,
  },
  title: {
    fontSize: 18,
    marginTop: themeBase.spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  actionContainer: {
    marginTop: themeBase.spacing.sm,
  },
});
