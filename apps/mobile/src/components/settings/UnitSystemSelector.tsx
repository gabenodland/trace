/**
 * Unit System Selector - Modal for choosing between Metric and Imperial units
 */

import { View, Text, TouchableOpacity, StyleSheet, Modal, SafeAreaView, Platform, StatusBar } from 'react-native';
import { type UnitSystem, UNIT_OPTIONS } from '@trace/core';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { Icon } from '../../shared/components';

interface UnitSystemSelectorProps {
  visible: boolean;
  selectedUnit: UnitSystem;
  onSelect: (unit: UnitSystem) => void;
  onClose: () => void;
}

export function UnitSystemSelector({
  visible,
  selectedUnit,
  onSelect,
  onClose,
}: UnitSystemSelectorProps) {
  const theme = useTheme();

  const handleSelect = (unit: UnitSystem) => {
    onSelect(unit);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.background.primary, borderBottomColor: theme.colors.border.light }]}>
          <Text style={[styles.title, { color: theme.colors.text.primary }]}>Distance Units</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="X" size={24} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Options */}
        <View style={styles.optionsList}>
          {UNIT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionItem,
                { backgroundColor: theme.colors.background.primary },
                selectedUnit === option.value && [styles.optionItemSelected, { borderColor: theme.colors.functional.accent, backgroundColor: theme.colors.functional.accentLight }],
              ]}
              onPress={() => handleSelect(option.value)}
              activeOpacity={0.7}
            >
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionLabel,
                  { color: theme.colors.text.primary },
                  selectedUnit === option.value && { color: theme.colors.functional.accent },
                ]}>
                  {option.label}
                </Text>
                <Text style={[styles.optionDescription, { color: theme.colors.text.secondary }]}>{option.description}</Text>
              </View>
              {selectedUnit === option.value && (
                <Icon name="Check" size={24} color={theme.colors.functional.accent} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 16,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 4,
  },
  optionsList: {
    padding: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionItemSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  optionContent: {
    flex: 1,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  optionLabelSelected: {
    color: '#2563eb',
  },
  optionDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
});
