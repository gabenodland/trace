/**
 * StatusConfigModal - Configure which statuses are available for a stream
 * Allows selecting which statuses to enable and which is the default
 */

import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
} from "react-native";
import Svg, { Path, Line } from "react-native-svg";
import { theme } from "../../../shared/theme/theme";
import { StatusIcon } from "../../../shared/components/StatusIcon";
import {
  type EntryStatus,
  ALL_STATUSES,
  DEFAULT_STREAM_STATUSES,
  DEFAULT_INITIAL_STATUS,
} from "@trace/core";

interface StatusConfigModalProps {
  visible: boolean;
  onClose: () => void;
  selectedStatuses: EntryStatus[];
  defaultStatus: EntryStatus;
  onSave: (statuses: EntryStatus[], defaultStatus: EntryStatus) => void;
}

export function StatusConfigModal({
  visible,
  onClose,
  selectedStatuses,
  defaultStatus,
  onSave,
}: StatusConfigModalProps) {
  // Local state for editing
  const [localStatuses, setLocalStatuses] = useState<EntryStatus[]>(selectedStatuses);
  const [localDefault, setLocalDefault] = useState<EntryStatus>(defaultStatus);

  // Reset local state when modal opens
  useEffect(() => {
    if (visible) {
      setLocalStatuses(selectedStatuses.length > 0 ? selectedStatuses : [...DEFAULT_STREAM_STATUSES]);
      setLocalDefault(defaultStatus || DEFAULT_INITIAL_STATUS);
    }
  }, [visible, selectedStatuses, defaultStatus]);

  const toggleStatus = (status: EntryStatus) => {
    setLocalStatuses(prev => {
      if (prev.includes(status)) {
        // Don't allow removing the last status
        if (prev.length <= 1) return prev;
        // If removing the default status, switch default to first remaining
        const newStatuses = prev.filter(s => s !== status);
        if (localDefault === status) {
          setLocalDefault(newStatuses[0]);
        }
        return newStatuses;
      } else {
        return [...prev, status];
      }
    });
  };

  const handleSetDefault = (status: EntryStatus) => {
    // Can only set default if the status is selected
    if (localStatuses.includes(status)) {
      setLocalDefault(status);
    }
  };

  const handleSave = () => {
    onSave(localStatuses, localDefault);
    onClose();
  };

  const handleReset = () => {
    setLocalStatuses([...DEFAULT_STREAM_STATUSES]);
    setLocalDefault(DEFAULT_INITIAL_STATUS);
  };

  // Get ordered display of statuses (selected first, then unselected)
  const orderedStatuses = [
    ...ALL_STATUSES.filter(s => localStatuses.includes(s.value)),
    ...ALL_STATUSES.filter(s => !localStatuses.includes(s.value)),
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={e => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Configure Statuses</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
                <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Select which statuses are available for entries in this stream. Tap the star to set the default status for new entries.{"\n\n"}
            <Text style={styles.subtitleHighlight}>Tip:</Text> Enable "None" to allow removing status from entries. Set it as default to make status optional.
          </Text>

          {/* Status List */}
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={true}>
            <View style={styles.statusList}>
              {orderedStatuses.map((statusInfo) => {
                const isSelected = localStatuses.includes(statusInfo.value);
                const isDefault = localDefault === statusInfo.value;

                return (
                  <Pressable
                    key={statusInfo.value}
                    style={styles.statusRow}
                    onPress={() => toggleStatus(statusInfo.value)}
                  >
                    {/* Checkbox */}
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && styles.checkboxSelected,
                      ]}
                    >
                      {isSelected && (
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={3}>
                          <Path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                      )}
                    </View>

                    {/* Status icon and label */}
                    <View style={styles.statusInfo}>
                      <View style={styles.statusIcon}>
                        <StatusIcon status={statusInfo.value} size={18} color={isSelected ? statusInfo.color : "#9ca3af"} />
                      </View>
                      <Text style={[
                        styles.statusLabel,
                        !isSelected && styles.statusLabelDisabled,
                      ]}>
                        {statusInfo.label}
                      </Text>
                    </View>

                    {/* Default star */}
                    <Pressable
                      style={styles.defaultButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleSetDefault(statusInfo.value);
                      }}
                      disabled={!isSelected}
                      hitSlop={8}
                    >
                      <Svg
                        width={20}
                        height={20}
                        viewBox="0 0 24 24"
                        fill={isDefault ? "#f59e0b" : "none"}
                        stroke={isSelected ? (isDefault ? "#f59e0b" : "#d1d5db") : "#e5e7eb"}
                        strokeWidth={2}
                      >
                        <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </Svg>
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Selected summary */}
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>Selected:</Text>
            <Text style={styles.summaryText} numberOfLines={2}>
              {localStatuses
                .map(s => ALL_STATUSES.find(info => info.value === s)?.label || s)
                .join(", ")}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Reset to Default</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  subtitleHighlight: {
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  scrollView: {
    maxHeight: 320,
  },
  statusList: {
    gap: theme.spacing.xs,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  statusInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  statusIcon: {
    width: 24,
    alignItems: "center",
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
  },
  statusLabelDisabled: {
    color: theme.colors.text.tertiary,
  },
  defaultButton: {
    padding: 4,
  },
  summary: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.secondary,
  },
  summaryText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.text.primary,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  resetButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.secondary,
    alignItems: "center",
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: "#3b82f6",
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: theme.typography.fontWeight.semibold,
    color: "#ffffff",
  },
});
