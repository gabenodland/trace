import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ReactNode } from 'react';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { Icon } from '../../shared/components';
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
      <Text style={[styles.label, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>{label}:</Text>
      <Text style={[styles.value, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>{value}</Text>
      <Icon name="ChevronDown" size={16} color={theme.colors.text.tertiary} style={styles.icon} />
    </TouchableOpacity>
  );
}

/**
 * SubBarFilters - View/Sort dropdowns with filter button
 * Used when filters are in a bottom sheet instead of a drawer
 */
interface SubBarFiltersProps {
  viewLabel: string;
  sortLabel: string;
  onViewPress: () => void;
  onSortPress: () => void;
  onFilterPress: () => void;
  isFiltering?: boolean; // Show filter button as active
  filterCount?: number; // Number of active filters to show in badge
  isOffline?: boolean;
}

export function SubBarFilters({
  viewLabel,
  sortLabel,
  onViewPress,
  onSortPress,
  onFilterPress,
  isFiltering = false,
  filterCount = 0,
  isOffline,
}: SubBarFiltersProps) {
  const theme = useTheme();

  return (
    <View style={[styles.filtersWrapper, { backgroundColor: theme.colors.background.primary }]}>
      {/* Row 1: View, Sort, Filter button */}
      <View style={styles.filtersRow}>
        {/* Offline indicator */}
        {isOffline && (
          <View style={styles.offlineBadge}>
            <Icon name="WifiOff" size={12} color="#ffffff" />
            <Text style={styles.offlineBadgeText}>Offline</Text>
          </View>
        )}

        {/* View Dropdown */}
        <TouchableOpacity
          style={styles.selector}
          onPress={onViewPress}
          activeOpacity={0.7}
        >
          <Text style={[styles.label, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>View:</Text>
          <Text style={[styles.value, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>{viewLabel}</Text>
          <Icon name="ChevronDown" size={14} color={theme.colors.text.tertiary} style={styles.icon} />
        </TouchableOpacity>

        {/* Sort Dropdown */}
        <TouchableOpacity
          style={styles.selector}
          onPress={onSortPress}
          activeOpacity={0.7}
        >
          <Text style={[styles.label, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>Sort:</Text>
          <Text style={[styles.value, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>{sortLabel}</Text>
          <Icon name="ChevronDown" size={14} color={theme.colors.text.tertiary} style={styles.icon} />
        </TouchableOpacity>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Filter Button with count badge */}
        <TouchableOpacity
          onPress={onFilterPress}
          style={[
            styles.filterButton,
            isFiltering && { backgroundColor: theme.colors.interactive.primary + '15' },
          ]}
          activeOpacity={0.7}
        >
          <Icon name="ListFilter" size={20} color={isFiltering ? theme.colors.interactive.primary : theme.colors.text.secondary} />
          {filterCount > 0 && (
            <View style={[styles.filterCountBadge, { backgroundColor: theme.colors.interactive.primary }]}>
              <Text style={styles.filterCountText}>{filterCount}</Text>
            </View>
          )}
        </TouchableOpacity>

      </View>
    </View>
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
  filtersWrapper: {
    paddingHorizontal: themeBase.spacing.lg,
    paddingTop: themeBase.spacing.md,
    paddingBottom: themeBase.spacing.sm,
  },
  filtersRow: {
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
  },
  value: {
    fontSize: themeBase.typography.fontSize.sm,
  },
  icon: {
    marginLeft: 2,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b', // Warning orange
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
    marginRight: themeBase.spacing.sm,
  },
  offlineBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  filterButton: {
    padding: themeBase.spacing.xs,
    paddingRight: themeBase.spacing.sm,
    marginRight: themeBase.spacing.xs,
    borderRadius: themeBase.borderRadius.sm,
    position: 'relative',
  },
  filterCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterCountText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
