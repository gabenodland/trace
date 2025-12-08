/**
 * StatusPicker - Status selection picker component
 * Shows only the statuses allowed by the current stream
 * Handles legacy statuses that may no longer be available
 */

import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import Svg, { Path, Line } from "react-native-svg";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { theme } from "../../../../shared/theme/theme";
import { StatusIcon } from "../../../../shared/components/StatusIcon";
import {
  type EntryStatus,
  ALL_STATUSES,
  getStatusInfo,
  getStatusLabel,
  DEFAULT_STREAM_STATUSES,
} from "@trace/core";

interface StatusPickerProps {
  visible: boolean;
  onClose: () => void;
  status: EntryStatus;
  onStatusChange: (status: EntryStatus) => void;
  onSnackbar: (message: string) => void;
  /** Statuses allowed by the stream. If not provided, uses default set. */
  allowedStatuses?: EntryStatus[];
}

export function StatusPicker({
  visible,
  onClose,
  status,
  onStatusChange,
  onSnackbar,
  allowedStatuses,
}: StatusPickerProps) {
  // Use provided statuses or fall back to defaults
  const availableStatuses = allowedStatuses ?? DEFAULT_STREAM_STATUSES;

  // Check if "none" is allowed (enables clearing status)
  const canClearStatus = availableStatuses.includes("none");

  // Get status info for available statuses (excluding "none" - it's not shown as an option)
  const statusOptions = availableStatuses
    .filter(s => s !== "none") // Don't show "none" as a selectable option
    .map(s => ALL_STATUSES.find(info => info.value === s))
    .filter((info): info is NonNullable<typeof info> => info !== undefined);

  // Check if current status is a legacy status not in allowed list
  const isLegacyStatus = status !== "none" && !availableStatuses.includes(status);
  const legacyStatusInfo = isLegacyStatus ? getStatusInfo(status) : null;

  const handleSelect = (newStatus: EntryStatus) => {
    onStatusChange(newStatus);
    onSnackbar(`Status set to ${getStatusLabel(newStatus)}`);
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

        {/* Legacy status warning */}
        {isLegacyStatus && legacyStatusInfo && (
          <View style={styles.legacyWarning}>
            <View style={styles.legacyStatusRow}>
              <StatusIcon status={status} size={16} color={legacyStatusInfo.color} />
              <Text style={[styles.legacyText, { color: legacyStatusInfo.color }]}>
                Current: {legacyStatusInfo.label}
              </Text>
            </View>
            <Text style={styles.legacyHint}>
              This status is no longer available. Select a new one below.
            </Text>
          </View>
        )}

        {/* Status Options */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.optionsContainer}>
            {statusOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  status === option.value && styles.optionButtonSelected,
                ]}
                onPress={() => handleSelect(option.value)}
              >
                <View style={styles.optionIcon}>
                  <StatusIcon status={option.value} size={20} color={option.color} />
                </View>
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
        </ScrollView>

        {/* Clear Button - only show when status is set AND "none" is in allowed statuses */}
        {status !== "none" && canClearStatus && (
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
    maxHeight: 600,
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
  legacyWarning: {
    backgroundColor: "#fef3c7",
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  legacyStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  legacyText: {
    fontSize: 14,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  legacyHint: {
    fontSize: 12,
    color: "#92400e",
  },
  scrollView: {
    maxHeight: 420,
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
