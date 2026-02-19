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
import { type RatingType } from "@trace/core";
import { Icon } from "../../../shared/components";
import { useTheme } from "../../../shared/contexts/ThemeContext";

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
  const theme = useTheme();
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
    const color = isSelected ? theme.colors.functional.accent : theme.colors.text.tertiary;

    switch (iconType) {
      case 'star':
        return (
          <Icon name="Star" size={24} color={color} />
        );
      case 'number':
        return (
          <View style={styles.numberIcon}>
            <Text style={[styles.numberIconText, { color, fontFamily: theme.typography.fontFamily.bold }]}>10</Text>
          </View>
        );
      case 'decimal':
        return (
          <View style={styles.numberIcon}>
            <Text style={[styles.numberIconText, { color, fontFamily: theme.typography.fontFamily.bold }]}>8.5</Text>
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
        <Pressable
          style={[styles.modal, { backgroundColor: theme.colors.background.primary }]}
          onPress={e => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>Rating Type</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Icon name="X" size={20} color={theme.colors.text.tertiary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
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
                    { backgroundColor: theme.colors.background.tertiary, borderColor: "transparent" },
                    isSelected && { borderColor: theme.colors.functional.accent },
                  ]}
                  onPress={() => setSelectedType(option.value)}
                  activeOpacity={0.7}
                >
                  {/* Radio button */}
                  <View
                    style={[
                      styles.radio,
                      { borderColor: theme.colors.border.dark },
                      isSelected && { borderColor: theme.colors.functional.accent },
                    ]}
                  >
                    {isSelected && <View style={[styles.radioInner, { backgroundColor: theme.colors.functional.accent }]} />}
                  </View>

                  {/* Icon */}
                  <View style={styles.optionIcon}>
                    {renderIcon(option.icon, isSelected)}
                  </View>

                  {/* Label and description */}
                  <View style={styles.optionInfo}>
                    <Text style={[
                      styles.optionLabel,
                      { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium },
                      isSelected && { color: theme.colors.functional.accent },
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={[styles.optionDescription, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                      {option.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.colors.background.tertiary }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>Cancel</Text>
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
    marginBottom: 20,
    lineHeight: 18,
  },
  optionsList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 12,
    borderWidth: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButtonText: {
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
