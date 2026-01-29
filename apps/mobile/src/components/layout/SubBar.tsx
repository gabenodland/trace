import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ReactNode } from 'react';
import { useTheme } from '../../shared/contexts/ThemeContext';
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
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5}>
              <Path d="M1 1l22 22" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M16.72 11.06A10.94 10.94 0 0119 12.55" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M5 12.55a10.94 10.94 0 015.17-2.39" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M10.71 5.05A16 16 0 0122.58 9" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M1.42 9a15.91 15.91 0 014.7-2.88" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M8.53 16.11a6 6 0 016.95 0" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M12 20h.01" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
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
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={styles.icon}>
            <Path
              d="M6 9l6 6 6-6"
              stroke={theme.colors.text.tertiary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>

        {/* Sort Dropdown */}
        <TouchableOpacity
          style={styles.selector}
          onPress={onSortPress}
          activeOpacity={0.7}
        >
          <Text style={[styles.label, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>Sort:</Text>
          <Text style={[styles.value, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>{sortLabel}</Text>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={styles.icon}>
            <Path
              d="M6 9l6 6 6-6"
              stroke={theme.colors.text.tertiary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
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
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"
              stroke={isFiltering ? theme.colors.interactive.primary : theme.colors.text.secondary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M1 14h6M9 8h6M17 12h6"
              stroke={isFiltering ? theme.colors.interactive.primary : theme.colors.text.secondary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
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
    // Note: fontWeight removed - use fontFamily with weight variant instead
  },
  value: {
    fontSize: themeBase.typography.fontSize.sm,
    // Note: fontWeight removed - use fontFamily with weight variant instead
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
