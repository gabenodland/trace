/**
 * StatusConfigModal - Configure which statuses are available for a stream
 * Allows selecting which statuses to enable and which is the default
 */

import { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { StatusIcon } from "../../../shared/components/StatusIcon";
import {
  type EntryStatus,
  ALL_STATUSES,
  DEFAULT_STREAM_STATUSES,
  DEFAULT_INITIAL_STATUS,
} from "@trace/core";
import { Icon } from "../../../shared/components";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { PickerBottomSheet } from "../../../components/sheets/PickerBottomSheet";

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

  const [localStatuses, setLocalStatuses] = useState<EntryStatus[]>(selectedStatuses);
  const [localDefault, setLocalDefault] = useState<EntryStatus>(defaultStatus);
  const localDefaultRef = useRef(localDefault);
  localDefaultRef.current = localDefault;

  useEffect(() => {
    if (visible) {
      setLocalStatuses(selectedStatuses.length > 0 ? selectedStatuses : [...DEFAULT_STREAM_STATUSES]);
      setLocalDefault(defaultStatus || DEFAULT_INITIAL_STATUS);
    }
  }, [visible, selectedStatuses, defaultStatus]);

  const toggleStatus = (status: EntryStatus) => {
    setLocalStatuses(prev => {
      if (prev.includes(status)) {
        if (prev.length <= 1) return prev;
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

  const orderedStatuses = [
    ...ALL_STATUSES.filter(s => localStatuses.includes(s.value)),
    ...ALL_STATUSES.filter(s => !localStatuses.includes(s.value)),
  ];

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Configure Statuses"
      height="large"
      swipeArea="grabber"
      primaryAction={{ label: "Save", onPress: handleSave }}
      secondaryAction={{ label: "Reset to Default", onPress: handleReset }}
    >
      <Text style={[styles.subtitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
        Select which statuses are available for entries in this stream. Tap the star to set the default status for new entries.{"\n\n"}
        <Text style={{ color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }}>Tip:</Text> Enable "None" to allow removing status from entries. Set it as default to make status optional.
      </Text>

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
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: theme.colors.border.dark },
                    isSelected && { backgroundColor: theme.colors.functional.accent, borderColor: theme.colors.functional.accent },
                  ]}
                >
                  {isSelected && <Icon name="Check" size={14} color="#ffffff" />}
                </View>

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
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
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
});
