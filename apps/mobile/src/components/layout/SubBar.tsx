import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ReactNode } from 'react';
import { useTheme, type ThemeContextValue } from '../../shared/contexts/ThemeContext';
import { themeBase } from '../../shared/theme/themeBase';

interface SubBarProps {
  children: ReactNode;
}

export function SubBar({ children }: SubBarProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      {children}
    </View>
  );
}

interface SubBarSelectorProps {
  label: string;
  value: string;
  onPress: () => void;
}

export function SubBarSelector({ label, value, onPress }: SubBarSelectorProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      style={styles.selector}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.label, { color: theme.colors.text.tertiary }]}>{label}:</Text>
      <Text style={[styles.value, { color: theme.colors.text.primary }]}>{value}</Text>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={styles.icon}>
        <Path
          d="M6 9l6 6 6-6"
          stroke={theme.colors.text.tertiary}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: themeBase.spacing.lg,
    paddingVertical: themeBase.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: themeBase.spacing.lg,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: themeBase.spacing.xs,
  },
  label: {
    fontSize: themeBase.typography.fontSize.sm,
    fontWeight: themeBase.typography.fontWeight.medium,
  },
  value: {
    fontSize: themeBase.typography.fontSize.sm,
    fontWeight: themeBase.typography.fontWeight.semibold,
  },
  icon: {
    marginLeft: 2,
  },
});
