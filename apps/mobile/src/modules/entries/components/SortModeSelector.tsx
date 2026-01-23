/**
 * SortModeSelector - Sort mode selection using bottom sheet
 * Uses PickerBottomSheet for consistent presentation with other pickers
 * Includes options for pinned first and sort order
 */

import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { EntrySortMode, EntrySortOrder } from '@trace/core';
import { ENTRY_SORT_MODES } from '@trace/core';
import Svg, { Path } from 'react-native-svg';
import { PickerBottomSheet } from '../../../components/sheets';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { themeBase } from '../../../shared/theme/themeBase';

interface SortModeSelectorProps {
  visible: boolean;
  selectedMode: EntrySortMode;
  onSelect: (mode: EntrySortMode) => void;
  onClose: () => void;
  sortOrder?: EntrySortOrder;
  onSortOrderChange?: (order: EntrySortOrder) => void;
  showPinnedFirst?: boolean;
  onShowPinnedFirstChange?: (value: boolean) => void;
}

export function SortModeSelector({
  visible,
  selectedMode,
  onSelect,
  onClose,
  sortOrder = 'desc',
  onSortOrderChange,
  showPinnedFirst = false,
  onShowPinnedFirstChange,
}: SortModeSelectorProps) {
  const theme = useTheme();
  const isDescending = sortOrder === 'desc';

  const handleSelect = (mode: EntrySortMode) => {
    onSelect(mode);
    onClose();
  };

  const handleToggleOrder = () => {
    if (onSortOrderChange) {
      onSortOrderChange(isDescending ? 'asc' : 'desc');
    }
  };

  const handleTogglePinnedFirst = () => {
    if (onShowPinnedFirstChange) {
      onShowPinnedFirstChange(!showPinnedFirst);
    }
  };

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Sort By"
      height="auto"
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Toggle Options */}
        {(onShowPinnedFirstChange || onSortOrderChange) && (
          <View style={styles.togglesSection}>
            {/* Show pinned entries first checkbox */}
            {onShowPinnedFirstChange && (
              <TouchableOpacity
                style={[styles.checkboxRow, { backgroundColor: theme.colors.background.secondary }]}
                onPress={handleTogglePinnedFirst}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: theme.colors.border.dark },
                  showPinnedFirst && { backgroundColor: theme.colors.interactive.primary, borderColor: theme.colors.interactive.primary }
                ]}>
                  {showPinnedFirst && (
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M5 13l4 4L19 7"
                        stroke={theme.colors.background.primary}
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  )}
                </View>
                <Text style={[styles.checkboxLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
                  Show pinned entries first
                </Text>
              </TouchableOpacity>
            )}

            {/* Descending checkbox */}
            {onSortOrderChange && (
              <TouchableOpacity
                style={[styles.checkboxRow, { backgroundColor: theme.colors.background.secondary }]}
                onPress={handleToggleOrder}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: theme.colors.border.dark },
                  isDescending && { backgroundColor: theme.colors.interactive.primary, borderColor: theme.colors.interactive.primary }
                ]}>
                  {isDescending && (
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M5 13l4 4L19 7"
                        stroke={theme.colors.background.primary}
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  )}
                </View>
                <Text style={[styles.checkboxLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
                  Descending (newest first)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Sort Mode Options */}
        <View style={styles.optionsContainer}>
          {ENTRY_SORT_MODES.map((mode) => {
            const isSelected = mode.value === selectedMode;

            return (
              <TouchableOpacity
                key={mode.value}
                style={[
                  styles.optionButton,
                  { backgroundColor: theme.colors.background.secondary },
                  isSelected && { backgroundColor: theme.colors.background.tertiary },
                ]}
                onPress={() => handleSelect(mode.value)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.optionLabel,
                  { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium },
                  isSelected && { fontFamily: theme.typography.fontFamily.semibold }
                ]}>
                  {mode.label}
                </Text>

                {isSelected && (
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.interactive.primary} strokeWidth={2.5}>
                    <Path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    maxHeight: 400,
  },
  togglesSection: {
    gap: themeBase.spacing.sm,
    marginBottom: themeBase.spacing.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: themeBase.spacing.md,
  },
  checkboxLabel: {
    fontSize: themeBase.typography.fontSize.sm,
  },
  optionsContainer: {
    gap: themeBase.spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
  },
  optionLabel: {
    fontSize: themeBase.typography.fontSize.base,
  },
});
