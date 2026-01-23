import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ReactNode } from 'react';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { themeBase } from '../../shared/theme/themeBase';
import { useSettingsDrawer } from '../../shared/contexts/SettingsDrawerContext';

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
 * SubBarSettings - Read-only display of current settings with a button to open settings drawer
 */
interface SubBarSettingsProps {
  viewLabel: string;
  sortLabel: string;
  filterLabel?: string; // Optional - shows when filters are active
  entryCount?: number; // Filtered count
  totalCount?: number; // Total count (shows "X of Y" when different from entryCount)
  isOffline?: boolean; // Show offline indicator
}

export function SubBarSettings({ viewLabel, sortLabel, filterLabel, entryCount, totalCount, isOffline }: SubBarSettingsProps) {
  const theme = useTheme();
  const { openDrawer } = useSettingsDrawer();

  // Build count label: "X of Y" when filtering, just "X" otherwise
  const isFiltering = totalCount !== undefined && entryCount !== undefined && entryCount !== totalCount;
  const countLabel = isFiltering
    ? `${entryCount} of ${totalCount}`
    : entryCount !== undefined
      ? `${entryCount}`
      : undefined;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
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
      <View style={styles.settingsStatus}>
        <Text style={[styles.statusText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
          {viewLabel}
        </Text>
        <Text style={[styles.statusSeparator, { color: theme.colors.text.tertiary }]}>{" \u2022 "}</Text>
        <Text style={[styles.statusText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
          {sortLabel}
        </Text>
        {filterLabel && (
          <>
            <Text style={[styles.statusSeparator, { color: theme.colors.text.tertiary }]}>{" \u2022 "}</Text>
            <Text style={[styles.statusText, { color: theme.colors.interactive.primary, fontFamily: theme.typography.fontFamily.medium }]}>
              {filterLabel}
            </Text>
          </>
        )}
      </View>
      {countLabel && (
        <Text style={[
          styles.countText,
          { color: isFiltering ? theme.colors.interactive.primary : theme.colors.text.secondary },
          { fontFamily: theme.typography.fontFamily.medium }
        ]}>
          {countLabel}
        </Text>
      )}
      <TouchableOpacity onPress={openDrawer} style={styles.settingsButton} activeOpacity={0.7}>
        {/* Sliders icon - better represents view/sort/filter options */}
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"
            stroke={theme.colors.text.secondary}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M1 14h6M9 8h6M17 12h6"
            stroke={theme.colors.text.secondary}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </TouchableOpacity>
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
  settingsStatus: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  statusText: {
    fontSize: themeBase.typography.fontSize.sm,
  },
  statusSeparator: {
    fontSize: themeBase.typography.fontSize.sm,
  },
  countText: {
    fontSize: themeBase.typography.fontSize.sm,
    marginLeft: themeBase.spacing.sm,
  },
  settingsButton: {
    padding: themeBase.spacing.xs,
    marginLeft: themeBase.spacing.sm,
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
});
