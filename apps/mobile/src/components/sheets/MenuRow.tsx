/**
 * MenuRow + MenuSection - Shared menu row primitives
 *
 * Used by ActionSheet and AttributesPicker for consistent
 * row appearance across all bottom-sheet action menus.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon, type IconName } from '../../shared/components';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { themeBase } from '../../shared/theme/themeBase';

export interface MenuRowProps {
  label: string;
  icon?: IconName;
  /** Override icon color independently of label color */
  iconColor?: string;
  /** Override label color (e.g. text.secondary for unset values). Ignored when isDanger=true. */
  labelColor?: string;
  onPress: () => void;
  isDanger?: boolean;
  showSeparator?: boolean;
}

export function MenuRow({
  label,
  icon,
  iconColor,
  labelColor,
  onPress,
  isDanger = false,
  showSeparator = false,
}: MenuRowProps) {
  const theme = useTheme();
  const resolvedColor = isDanger
    ? theme.colors.functional.overdue
    : (labelColor ?? theme.colors.text.primary);
  const resolvedIconColor = iconColor ?? resolvedColor;

  return (
    <TouchableOpacity
      style={[
        styles.row,
        showSeparator && { borderBottomWidth: 1, borderBottomColor: theme.colors.border.light },
      ]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      {icon && <Icon name={icon} size={18} color={resolvedIconColor} />}
      <Text style={[styles.label, { color: resolvedColor, fontFamily: theme.typography.fontFamily.semibold }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export interface MenuSectionProps {
  title?: string;
  children: React.ReactNode;
}

export function MenuSection({ title, children }: MenuSectionProps) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      {title && (
        <Text style={[styles.sectionHeader, {
          color: theme.colors.text.tertiary,
          fontFamily: theme.typography.fontFamily.semibold,
        }]}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: themeBase.spacing.md,
    gap: themeBase.spacing.md,
  },
  label: {
    fontSize: themeBase.typography.fontSize.base,
    flex: 1,
  },
  section: {
    marginBottom: themeBase.spacing.md,
  },
  sectionHeader: {
    fontSize: themeBase.typography.fontSize.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: themeBase.spacing.sm,
    marginLeft: themeBase.spacing.xs,
  },
});
