import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native';
import { useRef, useEffect } from 'react';
import type { EntrySortMode } from '../types/EntrySortMode';
import { ENTRY_SORT_MODES } from '../types/EntrySortMode';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../../../shared/theme/theme';

interface SortModeSelectorProps {
  visible: boolean;
  selectedMode: EntrySortMode;
  onSelect: (mode: EntrySortMode) => void;
  onClose: () => void;
}

export function SortModeSelector({
  visible,
  selectedMode,
  onSelect,
  onClose,
}: SortModeSelectorProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  const handleSelect = (mode: EntrySortMode) => {
    onSelect(mode);
    onClose();
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
