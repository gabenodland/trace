/**
 * UnsupportedAttributePicker - Shows when an attribute exists but the stream doesn't support it
 * Allows the user to remove the attribute value or keep it (in case they switch streams)
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Icon } from "../../../../shared/components/Icon";
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
            <Icon name="X" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Current value display */}
        <View style={styles.valueContainer}>
          <Text style={styles.valueLabel}>Current value:</Text>
          <Text style={styles.valueText}>{currentValue}</Text>
        </View>

        {/* Warning message */}
        <View style={styles.warningContainer}>
          <Icon name="AlertTriangle" size={16} color="#f59e0b" />
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
            <Icon name="X" size={16} color="#dc2626" />
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
