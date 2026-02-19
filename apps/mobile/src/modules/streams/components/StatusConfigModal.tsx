/**
 * StatusConfigModal - Configure which statuses are available for a stream
 * Allows selecting which statuses to enable and which is the default
 */

import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
} from "react-native";
import { StatusIcon } from "../../../shared/components/StatusIcon";
import {
  type EntryStatus,
  ALL_STATUSES,
  DEFAULT_STREAM_STATUSES,
  DEFAULT_INITIAL_STATUS,
} from "@trace/core";
import { Icon } from "../../../shared/components";
import { useTheme } from "../../../shared/contexts/ThemeContext";

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
  const theme = useTheme();

  // Local state for editing
  const [localStatuses, setLocalStatuses] = useState<EntryStatus[]>(selectedStatuses);
  const [localDefault, setLocalDefault] = useState<EntryStatus>(defaultStatus);
  const localDefaultRef = useRef(localDefault);
  localDefaultRef.current = localDefault;

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
        if (localDefaultRef.current === status) {
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
        <Pressable
          style={[styles.modal, { backgroundColor: theme.colors.background.primary }]}
          onPress={e => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>Configure Statuses</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Icon name="X" size={20} color={theme.colors.text.tertiary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
            Select which statuses are available for entries in this stream. Tap the star to set the default status for new entries.{"\n\n"}
            <Text style={{ color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }}>Tip:</Text> Enable "None" to allow removing status from entries. Set it as default to make status optional.
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
                    style={[styles.statusRow, { backgroundColor: theme.colors.background.tertiary }]}
                    onPress={() => toggleStatus(statusInfo.value)}
                  >
                    {/* Checkbox */}
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: theme.colors.border.dark },
                        isSelected && { backgroundColor: theme.colors.functional.accent, borderColor: theme.colors.functional.accent },
                      ]}
                    >
                      {isSelected && (
                        <Icon name="Check" size={14} color="#ffffff" />
                      )}
                    </View>

                    {/* Status icon and label */}
                    <View style={styles.statusInfo}>
                      <View style={styles.statusIcon}>
                        <StatusIcon status={statusInfo.value} size={18} color={isSelected ? statusInfo.color : theme.colors.text.disabled} />
                      </View>
                      <Text style={[
                        styles.statusLabel,
                        { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium },
                        !isSelected && { color: theme.colors.text.tertiary },
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
                      <Icon
                        name="Star"
                        size={20}
                        color={isSelected ? (isDefault ? "#f59e0b" : theme.colors.border.dark) : theme.colors.border.light}
                      />
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Selected summary */}
          <View style={[styles.summary, { backgroundColor: theme.colors.background.tertiary }]}>
            <Text style={[styles.summaryLabel, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.semibold }]}>Selected:</Text>
            <Text style={[styles.summaryText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular }]} numberOfLines={2}>
              {localStatuses
                .map(s => ALL_STATUSES.find(info => info.value === s)?.label || s)
                .join(", ")}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.resetButton, { backgroundColor: theme.colors.background.tertiary }]}
              onPress={handleReset}
              activeOpacity={0.7}
            >
              <Text style={[styles.resetButtonText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>Reset to Default</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.colors.functional.accent }]}
              onPress={handleSave}
              activeOpacity={0.7}
            >
              <Text style={[styles.saveButtonText, { fontFamily: theme.typography.fontFamily.semibold }]}>Save</Text>
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
    borderRadius: 14,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  scrollView: {
    maxHeight: 320,
  },
  statusList: {
    gap: 6,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  statusInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusIcon: {
    width: 24,
    alignItems: "center",
  },
  statusLabel: {
    fontSize: 15,
  },
  defaultButton: {
    padding: 4,
  },
  summary: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  summaryLabel: {
    fontSize: 13,
  },
  summaryText: {
    flex: 1,
    fontSize: 13,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  resetButtonText: {
    fontSize: 15,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 15,
    color: "#ffffff",
  },
});
