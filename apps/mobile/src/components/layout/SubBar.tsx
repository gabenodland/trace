import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ReactNode } from 'react';

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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  value: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
  },
  icon: {
    marginLeft: 2,
  },
});
