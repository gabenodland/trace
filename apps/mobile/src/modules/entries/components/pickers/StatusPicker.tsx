/**
 * StatusPicker - Status selection picker component
 * Allows selecting task status: none, incomplete, in_progress, complete
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { theme } from "../../../../shared/theme/theme";

type EntryStatus = "none" | "incomplete" | "in_progress" | "complete";

interface StatusOption {
  value: EntryStatus;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "incomplete",
    label: "To Do",
    icon: (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
        <Circle cx={12} cy={12} r={10} />
      </Svg>
    ),
    color: "#6b7280",
  },
  {
    value: "in_progress",
    label: "In Progress",
    icon: (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2}>
        <Circle cx={12} cy={12} r={10} />
        <Path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
    color: "#f59e0b",
  },
  {
    value: "complete",
    label: "Complete",
    icon: (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2}>
        <Circle cx={12} cy={12} r={10} />
        <Path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
    color: "#10b981",
  },
];

interface StatusPickerProps {
  visible: boolean;
  onClose: () => void;
  status: EntryStatus;
  onStatusChange: (status: EntryStatus) => void;
  onSnackbar: (message: string) => void;
}

export function StatusPicker({
  visible,
  onClose,
  status,
  onStatusChange,
  onSnackbar,
}: StatusPickerProps) {
  const handleSelect = (newStatus: EntryStatus) => {
    onStatusChange(newStatus);
    const option = STATUS_OPTIONS.find(o => o.value === newStatus);
    onSnackbar(`Status set to ${option?.label || newStatus}`);
    onClose();
  };

  const handleClear = () => {
    onStatusChange("none");
    onSnackbar("Status cleared");
    onClose();
  };

  return (
    <TopBarDropdownContainer visible={visible} onClose={onClose}>
      <View style={styles.container}>
        {/* Header with title and close button */}
        <View style={styles.header}>
          <Text style={styles.title}>Set Status</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Status Options */}
        <View style={styles.optionsContainer}>
          {STATUS_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionButton,
                status === option.value && styles.optionButtonSelected,
              ]}
              onPress={() => handleSelect(option.value)}
            >
              <View style={styles.optionIcon}>{option.icon}</View>
              <Text
                style={[
                  styles.optionText,
                  status === option.value && { color: option.color, fontWeight: "600" },
                ]}
              >
                {option.label}
              </Text>
              {status === option.value && (
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={option.color} strokeWidth={2.5} style={styles.checkIcon}>
                  <Path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Clear Button - only show when status is set */}
        {status !== "none" && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClear}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}>
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
            <Text style={styles.clearButtonText}>Remove Status</Text>
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
