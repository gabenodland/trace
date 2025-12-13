/**
 * UnsupportedAttributePicker - Shows when an attribute exists but the stream doesn't support it
 * Allows the user to remove the attribute value or keep it (in case they switch streams)
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Path, Line } from "react-native-svg";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { theme } from "../../../../shared/theme/theme";

interface UnsupportedAttributePickerProps {
  visible: boolean;
  onClose: () => void;
  attributeName: string;
  currentValue: string;
  onRemove: () => void;
  onSnackbar: (message: string) => void;
}

export function UnsupportedAttributePicker({
  visible,
  onClose,
  attributeName,
  currentValue,
  onRemove,
  onSnackbar,
}: UnsupportedAttributePickerProps) {
  const handleRemove = () => {
    onRemove();
    onSnackbar(`${attributeName} removed`);
    onClose();
  };

  return (
    <TopBarDropdownContainer visible={visible} onClose={onClose}>
      <View style={styles.container}>
        {/* Header with title and close button */}
        <View style={styles.header}>
          <Text style={styles.title}>{attributeName}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Current value display */}
        <View style={styles.valueContainer}>
          <Text style={styles.valueLabel}>Current value:</Text>
          <Text style={styles.valueText}>{currentValue}</Text>
        </View>

        {/* Warning message */}
        <View style={styles.warningContainer}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2}>
            <Path d="M12 9v4" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.warningText}>
            This stream doesn't support {attributeName.toLowerCase()}. You can keep the value in case you move this entry to another stream, or remove it.
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.keepButton}
            onPress={onClose}
          >
            <Text style={styles.keepButtonText}>Keep Value</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={handleRemove}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
        </View>
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
  valueContainer: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  valueLabel: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
  },
  valueText: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    textDecorationLine: "line-through",
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fef3c7",
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: "#92400e",
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  keepButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.secondary,
  },
  keepButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
  },
  removeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    backgroundColor: "#fee2e2",
    gap: theme.spacing.sm,
  },
  removeButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.medium,
    color: "#dc2626",
  },
});
