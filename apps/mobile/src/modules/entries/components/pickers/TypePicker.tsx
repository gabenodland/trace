/**
 * TypePicker - Type selection picker component
 * Shows only the types configured for the current stream
 * Handles legacy types that may no longer be available
 */

import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import Svg, { Path, Line } from "react-native-svg";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { theme } from "../../../../shared/theme/theme";
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
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Set Type</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
                <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={1.5}>
              <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.emptyText}>No types configured</Text>
            <Text style={styles.emptySubtext}>
              Configure types in stream settings to use this feature.
            </Text>
          </View>
        </View>
      </TopBarDropdownContainer>
    );
  }

  return (
    <TopBarDropdownContainer visible={visible} onClose={onClose}>
      <View style={styles.container}>
        {/* Header with title and close button */}
        <View style={styles.header}>
          <Text style={styles.title}>Set Type</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Legacy type warning */}
        {isLegacy && type && (
          <View style={styles.legacyWarning}>
            <View style={styles.legacyTypeRow}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2}>
                <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.legacyText}>
                Current: {type}
              </Text>
            </View>
            <Text style={styles.legacyHint}>
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
                  type === typeOption && styles.optionButtonSelected,
                ]}
                onPress={() => handleSelect(typeOption)}
              >
                <View style={styles.optionIcon}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                    <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text
                  style={[
                    styles.optionText,
                    type === typeOption && styles.optionTextSelected,
                  ]}
                >
                  {typeOption}
                </Text>
                {type === typeOption && (
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2.5} style={styles.checkIcon}>
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
            style={styles.clearButton}
            onPress={handleClear}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
            <Text style={styles.clearButtonText}>Remove Type</Text>
          </TouchableOpacity>
        )}
      </View>
    </TopBarDropdownContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    maxHeight: 500,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.sm,
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
    textAlign: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  legacyWarning: {
    backgroundColor: "#fef3c7",
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  legacyTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  legacyText: {
    fontSize: 14,
    fontWeight: theme.typography.fontWeight.semibold,
    color: "#f59e0b",
  },
  legacyHint: {
    fontSize: 12,
    color: "#92400e",
  },
  scrollView: {
    maxHeight: 320,
  },
  optionsContainer: {
    gap: theme.spacing.sm,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.secondary,
    gap: theme.spacing.md,
  },
  optionButtonSelected: {
    backgroundColor: theme.colors.background.tertiary,
  },
  optionIcon: {
    width: 24,
    alignItems: "center",
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
  },
  optionTextSelected: {
    color: "#3b82f6",
    fontWeight: "600",
  },
  checkIcon: {
    marginLeft: "auto",
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    backgroundColor: "#fee2e2",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.medium,
    color: "#dc2626",
  },
});
