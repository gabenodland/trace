/**
 * SheetActionBar — Fixed footer button bar for bottom sheets
 *
 * Sits outside the ScrollView, always visible at the bottom of sheet content.
 * Used by VersionHistorySheet, DeletedEntryDetailSheet, and any sheet
 * that needs persistent action buttons below scrollable content.
 */

import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Icon, type IconName } from "../../shared/components";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { themeBase } from "../../shared/theme/themeBase";

export interface SheetAction {
  label: string;
  icon?: IconName;
  onPress: () => void;
  backgroundColor: string;
  textColor?: string;
  isLoading?: boolean;
  disabled?: boolean;
}

interface SheetActionBarProps {
  actions: SheetAction[];
}

export function SheetActionBar({ actions }: SheetActionBarProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {actions.map((action, index) => (
        <TouchableOpacity
          key={action.label}
          style={[styles.button, { backgroundColor: action.backgroundColor, opacity: action.isLoading || action.disabled ? 0.6 : 1 }]}
          onPress={action.onPress}
          activeOpacity={0.8}
          disabled={action.isLoading || action.disabled}
        >
          {action.isLoading ? (
            <ActivityIndicator size="small" color={action.textColor ?? "#fff"} />
          ) : action.icon ? (
            <Icon name={action.icon} size={16} color={action.textColor ?? "#fff"} />
          ) : null}
          <Text style={[styles.label, {
            fontFamily: theme.typography.fontFamily.semibold,
            color: action.textColor ?? "#fff",
          }]}>
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: themeBase.spacing.sm,
    paddingTop: themeBase.spacing.md,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  label: {
    fontSize: 16,
  },
});
