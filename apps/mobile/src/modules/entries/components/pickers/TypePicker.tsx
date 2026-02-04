/**
 * TypePicker - Type selection picker component
 * Uses PickerBottomSheet for consistent bottom sheet presentation
 * Shows only the types configured for the current stream
 */

import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Icon } from "../../../../shared/components/Icon";
import { PickerBottomSheet, RemoveIcon } from "../../../../components/sheets";
import { themeBase } from "../../../../shared/theme/themeBase";
import { useTheme } from "../../../../shared/contexts/ThemeContext";
import { isLegacyType, sortTypes } from "@trace/core";

interface TypePickerProps {
  visible: boolean;
  onClose: () => void;
  type: string | null;
  onTypeChange: (type: string | null) => void;
  onSnackbar: (message: string) => void;
  /** Types configured for this stream */
  availableTypes: string[];
}

export function TypePicker({
  visible,
  onClose,
  type,
  onTypeChange,
  onSnackbar,
  availableTypes,
}: TypePickerProps) {
  const dynamicTheme = useTheme();

  // Sort types alphabetically
  const sortedTypes = sortTypes(availableTypes);

  // Check if current type is a legacy type not in available list
  const isLegacy = isLegacyType(type, availableTypes);

  const handleSelect = (newType: string) => {
    onTypeChange(newType);
    onSnackbar(`Type set to ${newType}`);
    onClose();
  };

  const handleClear = () => {
    onTypeChange(null);
    onSnackbar("Type cleared");
    onClose();
  };

  // Empty state when no types are available
  if (sortedTypes.length === 0 && !isLegacy) {
    return (
      <PickerBottomSheet
        visible={visible}
        onClose={onClose}
        title="Set Type"
      >
        <View style={styles.emptyState}>
          <Icon name="Bookmark" size={40} color={dynamicTheme.colors.text.tertiary} />
          <Text style={[styles.emptyText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.secondary }]}>
            No types configured
          </Text>
          <Text style={[styles.emptySubtext, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.tertiary }]}>
            Configure types in stream settings to use this feature.
          </Text>
        </View>
      </PickerBottomSheet>
    );
  }

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Set Type"
      height="medium"
      secondaryAction={
        type
          ? {
              label: "Remove",
              variant: "danger",
              icon: <RemoveIcon color={dynamicTheme.colors.functional.overdue} />,
              onPress: handleClear,
            }
          : undefined
      }
    >
      {/* Legacy type warning */}
      {isLegacy && type && (
        <View style={[styles.legacyWarning, { backgroundColor: dynamicTheme.colors.functional.accentLight }]}>
          <View style={styles.legacyTypeRow}>
            <Icon name="Bookmark" size={16} color={dynamicTheme.colors.status.blocked} />
            <Text style={[styles.legacyText, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.status.blocked }]}>
              Current: {type}
            </Text>
          </View>
          <Text style={[styles.legacyHint, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.secondary }]}>
            This type is no longer available. Select a new one or clear it.
          </Text>
        </View>
      )}

      {/* Type Options */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.optionsContainer}>
          {sortedTypes.map((typeOption) => (
            <TouchableOpacity
              key={typeOption}
              style={[
                styles.optionButton,
                { backgroundColor: dynamicTheme.colors.background.secondary },
                type === typeOption && { backgroundColor: dynamicTheme.colors.background.tertiary },
              ]}
              onPress={() => handleSelect(typeOption)}
            >
              <View style={styles.optionIcon}>
                <Icon name="Bookmark" size={20} color={dynamicTheme.colors.text.secondary} />
              </View>
              <Text
                style={[
                  styles.optionText,
                  { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.primary },
                  type === typeOption && { color: dynamicTheme.colors.functional.accent, fontFamily: dynamicTheme.typography.fontFamily.semibold },
                ]}
              >
                {typeOption}
              </Text>
              {type === typeOption && (
                <Icon name="Check" size={18} color={dynamicTheme.colors.functional.accent} style={styles.checkIcon} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: "center",
    paddingVertical: themeBase.spacing.xl,
    gap: themeBase.spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    marginTop: themeBase.spacing.sm,
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: themeBase.spacing.lg,
  },
  legacyWarning: {
    borderRadius: themeBase.borderRadius.md,
    padding: themeBase.spacing.md,
    gap: themeBase.spacing.xs,
    marginBottom: themeBase.spacing.md,
  },
  legacyTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.sm,
  },
  legacyText: {
    fontSize: 14,
  },
  legacyHint: {
    fontSize: 12,
  },
  scrollView: {
    maxHeight: 320,
  },
  optionsContainer: {
    gap: themeBase.spacing.sm,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
    gap: themeBase.spacing.md,
  },
  optionIcon: {
    width: 24,
    alignItems: "center",
  },
  optionText: {
    flex: 1,
    fontSize: 16,
  },
  checkIcon: {
    marginLeft: "auto",
  },
});
