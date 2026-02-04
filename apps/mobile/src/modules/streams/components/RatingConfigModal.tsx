/**
 * RatingConfigModal - Configure rating type for a stream
 * Allows selecting between stars, 10-base, and 10-base with decimals
 */

import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from "react-native";
import { theme } from "../../../shared/theme/theme";
import { type RatingType, getRatingTypeLabel } from "@trace/core";
import { Icon } from "../../../shared/components";

interface RatingConfigModalProps {
  visible: boolean;
  onClose: () => void;
  ratingType: RatingType;
  onSave: (ratingType: RatingType) => void;
}

const RATING_OPTIONS: { value: RatingType; label: string; description: string; icon: string }[] = [
  {
    value: 'stars',
    label: 'Stars (1-5)',
    description: 'Classic 5-star rating with full stars only',
    icon: 'star',
  },
  {
    value: 'decimal_whole',
    label: '10-Base (0-10)',
    description: 'Rate from 0 to 10 with whole numbers only',
    icon: 'number',
  },
  {
    value: 'decimal',
    label: '10-Base with Decimals',
    description: 'Rate from 0.0 to 10.0 with tenths precision (e.g., 8.5)',
    icon: 'decimal',
  },
];

export function RatingConfigModal({
  visible,
  onClose,
  ratingType,
  onSave,
}: RatingConfigModalProps) {
  const [selectedType, setSelectedType] = useState<RatingType>(ratingType);

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedType(ratingType);
    }
  }, [visible, ratingType]);

  const handleSave = () => {
    onSave(selectedType);
    onClose();
  };

  const renderIcon = (iconType: string, isSelected: boolean) => {
    const color = isSelected ? "#3b82f6" : theme.colors.text.tertiary;

    switch (iconType) {
      case 'star':
        return (
          <Icon name="Star" size={24} color={color} />
        );
      case 'number':
        return (
          <View style={styles.numberIcon}>
            <Text style={[styles.numberIconText, { color }]}>10</Text>
          </View>
        );
      case 'decimal':
        return (
          <View style={styles.numberIcon}>
            <Text style={[styles.numberIconText, { color }]}>8.5</Text>
          </View>
        );
      default:
        return null;
    }
  };

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
            <Text style={styles.title}>Rating Type</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Icon name="X" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Choose how ratings are displayed and entered for entries in this stream.
          </Text>

          {/* Options */}
          <View style={styles.optionsList}>
            {RATING_OPTIONS.map((option) => {
              const isSelected = selectedType === option.value;

              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionRow,
                    isSelected && styles.optionRowSelected,
                  ]}
                  onPress={() => setSelectedType(option.value)}
                  activeOpacity={0.7}
                >
                  {/* Radio button */}
                  <View
                    style={[
                      styles.radio,
                      isSelected && styles.radioSelected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioInner} />}
                  </View>

                  {/* Icon */}
                  <View style={styles.optionIcon}>
                    {renderIcon(option.icon, isSelected)}
                  </View>

                  {/* Label and description */}
                  <View style={styles.optionInfo}>
                    <Text style={[
                      styles.optionLabel,
                      isSelected && styles.optionLabelSelected,
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={styles.optionDescription}>
                      {option.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
    marginBottom: theme.spacing.lg,
    lineHeight: 18,
  },
  optionsList: {
    gap: theme.spacing.sm,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.md,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionRowSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "#eff6ff",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: "#3b82f6",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#3b82f6",
  },
  optionIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  numberIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  numberIconText: {
    fontSize: 14,
    fontWeight: theme.typography.fontWeight.bold,
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  optionLabelSelected: {
    color: "#3b82f6",
  },
  optionDescription: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    lineHeight: 16,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.secondary,
    alignItems: "center",
  },
  cancelButtonText: {
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
