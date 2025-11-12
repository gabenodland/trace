import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ReactNode } from 'react';
import { theme } from '../../shared/theme/theme';

interface SubBarProps {
  children: ReactNode;
}

export function SubBar({ children }: SubBarProps) {
  return (
    <View style={styles.container}>
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
  return (
    <TouchableOpacity
      style={styles.selector}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.label}>{label}:</Text>
      <Text style={styles.value}>{value}</Text>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={styles.icon}>
        <Path
          d="M6 9l6 6 6-6"
          stroke="#6b7280"
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
    backgroundColor: theme.colors.background.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.tertiary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  value: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  icon: {
    marginLeft: 2,
  },
});
