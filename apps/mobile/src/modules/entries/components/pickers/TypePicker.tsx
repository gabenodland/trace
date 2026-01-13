/**
 * TypePicker - Type selection picker component
 * Shows only the types configured for the current stream
 * Handles legacy types that may no longer be available
 */

import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import Svg, { Path, Line } from "react-native-svg";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
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

  // Don't render if no types are available
  if (sortedTypes.length === 0 && !isLegacy) {
    return (
      <TopBarDropdownContainer visible={visible} onClose={onClose}>
        <View style={[styles.container, { backgroundColor: dynamicTheme.colors.background.primary }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.primary }]}>Set Type</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.secondary} strokeWidth={2}>
                <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
                <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.tertiary} strokeWidth={1.5}>
              <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={[styles.emptyText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.text.secondary }]}>No types configured</Text>
            <Text style={[styles.emptySubtext, { fontFamily: dynamicTheme.typography.fontFamily.regular, color: dynamicTheme.colors.text.tertiary }]}>
              Configure types in stream settings to use this feature.
            </Text>
          </View>
        </View>
      </TopBarDropdownContainer>
    );
  }

  return (
    <TopBarDropdownContainer visible={visible} onClose={onClose}>
      <View style={[styles.container, { backgroundColor: dynamicTheme.colors.background.primary }]}>
        {/* Header with title and close button */}
        <View style={styles.header}>
          <Text style={[styles.title, { fontFamily: dynamicTheme.typography.fontFamily.semibold, color: dynamicTheme.colors.text.primary }]}>Set Type</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.secondary} strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Legacy type warning */}
        {isLegacy && type && (
          <View style={[styles.legacyWarning, { backgroundColor: dynamicTheme.colors.functional.accentLight }]}>
            <View style={styles.legacyTypeRow}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.status.blocked} strokeWidth={2}>
                <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
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
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.text.secondary} strokeWidth={2}>
                    <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
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
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.functional.accent} strokeWidth={2.5} style={styles.checkIcon}>
                    <Path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Clear Button - only show when type is set */}
        {type && (
          <TouchableOpacity
            style={[styles.clearButton, { backgroundColor: `${dynamicTheme.colors.functional.overdue}15` }]}
            onPress={handleClear}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={dynamicTheme.colors.functional.overdue} strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
            <Text style={[styles.clearButtonText, { fontFamily: dynamicTheme.typography.fontFamily.medium, color: dynamicTheme.colors.functional.overdue }]}>Remove Type</Text>
          </TouchableOpacity>
        )}
      </View>
    </TopBarDropdownContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: themeBase.borderRadius.lg,
    padding: themeBase.spacing.lg,
    gap: themeBase.spacing.md,
    maxHeight: 500,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: themeBase.spacing.xs,
  },
  title: {
    fontSize: 18,
  },
  closeButton: {
    padding: 4,
  },
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
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.lg,
    borderRadius: themeBase.borderRadius.md,
    gap: themeBase.spacing.sm,
    marginTop: themeBase.spacing.xs,
  },
  clearButtonText: {
    fontSize: 16,
  },
});
