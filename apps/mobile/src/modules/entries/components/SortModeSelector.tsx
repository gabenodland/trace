import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native';
import { useRef, useEffect } from 'react';
import type { EntrySortMode } from '../types/EntrySortMode';
import { ENTRY_SORT_MODES } from '../types/EntrySortMode';
import type { EntrySortOrder } from '../types/EntrySortOrder';
import Svg, { Path, Rect } from 'react-native-svg';
import { theme } from '../../../shared/theme/theme';

interface SortModeSelectorProps {
  visible: boolean;
  selectedMode: EntrySortMode;
  onSelect: (mode: EntrySortMode) => void;
  onClose: () => void;
  sortOrder?: EntrySortOrder;
  onSortOrderChange?: (order: EntrySortOrder) => void;
}

export function SortModeSelector({
  visible,
  selectedMode,
  onSelect,
  onClose,
  sortOrder = 'desc',
  onSortOrderChange,
}: SortModeSelectorProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const isDescending = sortOrder === 'desc';

  const handleSelect = (mode: EntrySortMode) => {
    onSelect(mode);
    onClose();
  };

  const handleToggleOrder = () => {
    if (onSortOrderChange) {
      onSortOrderChange(isDescending ? 'asc' : 'desc');
    }
  };

  // Scroll to selected item when modal opens
  useEffect(() => {
    if (visible && scrollViewRef.current) {
      const selectedIndex = ENTRY_SORT_MODES.findIndex(m => m.value === selectedMode);
      if (selectedIndex >= 0) {
        // Each option is ~60px tall (16px padding top + 16px padding bottom + ~28px content)
        const optionHeight = 60;
        const offset = selectedIndex * optionHeight;
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: offset, animated: true });
        }, 100);
      }
    }
  }, [visible, selectedMode]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Sort By</Text>
          </View>

          {/* Descending checkbox */}
          {onSortOrderChange && (
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={handleToggleOrder}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, isDescending && styles.checkboxChecked]}>
                {isDescending && (
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M5 13l4 4L19 7"
                      stroke="#ffffff"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                )}
              </View>
              <Text style={styles.checkboxLabel}>Descending</Text>
            </TouchableOpacity>
          )}

          <ScrollView ref={scrollViewRef} style={styles.scrollView}>
            {ENTRY_SORT_MODES.map((mode) => {
              const isSelected = mode.value === selectedMode;

              return (
                <TouchableOpacity
                  key={mode.value}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => handleSelect(mode.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {mode.label}
                  </Text>

                  {isSelected && (
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M5 13l4 4L19 7"
                        stroke={theme.colors.text.primary}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  scrollView: {
    maxHeight: 400,
    paddingBottom: 10,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  optionSelected: {
    backgroundColor: '#f3f4f6',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  optionLabelSelected: {
    color: '#111827',
    fontWeight: '600',
  },
});
