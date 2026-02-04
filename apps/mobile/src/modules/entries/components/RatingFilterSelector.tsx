/**
 * RatingFilterSelector - Rating range filter using bottom sheet
 * Adapts display to stream's rating type (stars vs decimal)
 */

import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { PickerBottomSheet } from '../../../components/sheets';
import { Icon } from '../../../shared/components';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { themeBase } from '../../../shared/theme/themeBase';

type RatingType = 'stars' | 'decimal_whole' | 'decimal';

interface RatingFilterSelectorProps {
  visible: boolean;
  ratingMin: number | null;
  ratingMax: number | null;
  ratingType: RatingType;  // From stream or 'decimal_whole' for All Entries
  onSelect: (min: number | null, max: number | null) => void;
  onClose: () => void;
}

// Convert display value to stored value (0-10 normalized)
function toStoredValue(displayValue: number, ratingType: RatingType): number {
  if (ratingType === 'stars') {
    // Stars are 1-5, stored as 0-10 (multiply by 2)
    return displayValue * 2;
  }
  // decimal_whole and decimal are already 0-10
  return displayValue;
}

// Convert stored value (0-10) to display value
function toDisplayValue(storedValue: number | null, ratingType: RatingType): number | null {
  if (storedValue === null) return null;
  if (ratingType === 'stars') {
    // Convert 0-10 to 1-5 stars
    return storedValue / 2;
  }
  return storedValue;
}

// Get range for rating type
function getRatingRange(ratingType: RatingType): { min: number; max: number; step: number } {
  switch (ratingType) {
    case 'stars':
      return { min: 1, max: 5, step: 1 };
    case 'decimal':
      return { min: 0, max: 10, step: 0.5 };
    case 'decimal_whole':
    default:
      return { min: 0, max: 10, step: 1 };
  }
}

// Format value for display
function formatDisplayValue(value: number | null, ratingType: RatingType): string {
  if (value === null) return 'Any';
  if (ratingType === 'stars') {
    return '★'.repeat(Math.round(value));
  }
  if (ratingType === 'decimal') {
    return value.toFixed(1);
  }
  return value.toString();
}

export function RatingFilterSelector({
  visible,
  ratingMin,
  ratingMax,
  ratingType,
  onSelect,
  onClose,
}: RatingFilterSelectorProps) {
  const theme = useTheme();
  const range = getRatingRange(ratingType);

  // Local state for editing
  const [localMin, setLocalMin] = useState<number | null>(toDisplayValue(ratingMin, ratingType));
  const [localMax, setLocalMax] = useState<number | null>(toDisplayValue(ratingMax, ratingType));

  // Reset local state when props change
  useEffect(() => {
    setLocalMin(toDisplayValue(ratingMin, ratingType));
    setLocalMax(toDisplayValue(ratingMax, ratingType));
  }, [ratingMin, ratingMax, ratingType]);

  // Generate options based on rating type
  const options = [];
  for (let i = range.min; i <= range.max; i += range.step) {
    options.push(i);
  }

  const handleMinChange = (value: number | null) => {
    setLocalMin(value);
    // Convert to stored value and apply
    onSelect(
      value !== null ? toStoredValue(value, ratingType) : null,
      localMax !== null ? toStoredValue(localMax, ratingType) : null
    );
  };

  const handleMaxChange = (value: number | null) => {
    setLocalMax(value);
    // Convert to stored value and apply
    onSelect(
      localMin !== null ? toStoredValue(localMin, ratingType) : null,
      value !== null ? toStoredValue(value, ratingType) : null
    );
  };

  const handleClear = () => {
    setLocalMin(null);
    setLocalMax(null);
    onSelect(null, null);
  };

  const isFiltering = localMin !== null || localMax !== null;

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Rating Filter"
      height="auto"
    >
      {/* Header with clear button */}
      <View style={styles.headerRow}>
        <Text style={[styles.hint, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
          {!isFiltering
            ? "Showing all ratings"
            : `${formatDisplayValue(localMin, ratingType)} to ${formatDisplayValue(localMax, ratingType)}`}
        </Text>
        {isFiltering && (
          <TouchableOpacity onPress={handleClear} activeOpacity={0.7}>
            <Text style={[styles.clearButton, { color: theme.colors.interactive.primary, fontFamily: theme.typography.fontFamily.medium }]}>
              Clear
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Min Rating Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>
          Minimum Rating
        </Text>
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={[
              styles.optionChip,
              { backgroundColor: theme.colors.background.secondary },
              localMin === null && { backgroundColor: theme.colors.interactive.primary },
            ]}
            onPress={() => handleMinChange(null)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.optionText,
              { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular },
              localMin === null && { color: theme.colors.background.primary, fontFamily: theme.typography.fontFamily.semibold },
            ]}>
              Any
            </Text>
          </TouchableOpacity>
          {options.map((value) => (
            <TouchableOpacity
              key={`min-${value}`}
              style={[
                styles.optionChip,
                { backgroundColor: theme.colors.background.secondary },
                localMin === value && { backgroundColor: theme.colors.interactive.primary },
              ]}
              onPress={() => handleMinChange(value)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.optionText,
                { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular },
                localMin === value && { color: theme.colors.background.primary, fontFamily: theme.typography.fontFamily.semibold },
              ]}>
                {ratingType === 'stars' ? '★'.repeat(value) : value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Max Rating Section */}
      <View style={[styles.section, { marginTop: themeBase.spacing.lg }]}>
        <Text style={[styles.sectionLabel, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>
          Maximum Rating
        </Text>
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={[
              styles.optionChip,
              { backgroundColor: theme.colors.background.secondary },
              localMax === null && { backgroundColor: theme.colors.interactive.primary },
            ]}
            onPress={() => handleMaxChange(null)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.optionText,
              { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular },
              localMax === null && { color: theme.colors.background.primary, fontFamily: theme.typography.fontFamily.semibold },
            ]}>
              Any
            </Text>
          </TouchableOpacity>
          {options.map((value) => (
            <TouchableOpacity
              key={`max-${value}`}
              style={[
                styles.optionChip,
                { backgroundColor: theme.colors.background.secondary },
                localMax === value && { backgroundColor: theme.colors.interactive.primary },
              ]}
              onPress={() => handleMaxChange(value)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.optionText,
                { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular },
                localMax === value && { color: theme.colors.background.primary, fontFamily: theme.typography.fontFamily.semibold },
              ]}>
                {ratingType === 'stars' ? '★'.repeat(value) : value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Bottom padding */}
      <View style={{ height: themeBase.spacing.md }} />
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: themeBase.spacing.lg,
  },
  hint: {
    fontSize: themeBase.typography.fontSize.xs,
  },
  clearButton: {
    fontSize: themeBase.typography.fontSize.sm,
  },
  section: {
    gap: themeBase.spacing.sm,
  },
  sectionLabel: {
    fontSize: themeBase.typography.fontSize.sm,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: themeBase.spacing.sm,
  },
  optionChip: {
    paddingVertical: themeBase.spacing.sm,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
    minWidth: 44,
    alignItems: 'center',
  },
  optionText: {
    fontSize: themeBase.typography.fontSize.sm,
  },
});
